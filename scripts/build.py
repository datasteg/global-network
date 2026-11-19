#!/usr/bin/env python3
"""global-network data build: join money-flow's export surface with trade-flow's export surface (docs/SURFACES.md).

    uv run --with brotli==1.1.0 --with duckdb==1.5.6 --with pyyaml==6.0.3 --with pyarrow==21.0.0 scripts/build.py

Reads (rule G18: this site collects nothing; both parents publish a versioned surface and the build refuses a major
version it was not written for)
  $MONEY_FLOW_SITE/surface.json        money-flow's surface (release, method, surface version) and that release's
                                            views: world/global, econ/<ISO3>, earn/global (WDI annual and IMF quarterly
                                            earnings), changes/global (money-side change items), episodes/global (the
                                            validation set), checks (V23), meta
  $MONEY_FLOW_TABLES/*.parquet         links (BIS LBS, IMF PIP, IMF DIP only; no commercial vendor rows are read)
                                            and signals (the dollar index, swap lines): the release's tables
  ../trade-flow/data/surface.json           trade-flow's surface (built, shown month, surface version) and its files:
                                            meta, nodes/W/TOTAL, series/W/TOTAL (3- and 12-month), snap/W/<slug>/<year>.w12|w3, chains,
                                            econ, nodes/A/HS-25..27, products.json.br (HS chapters per economy),
                                            changes.json.br (trade-side change items), events/index.json.br
  ../trade-flow/config/events.yaml          the trade events (titles, dates, economies), read with config/shocks.yaml
Writes data/*.json.br (brotli JSON) read by the Next.js app at run time (app/lib/data.ts), data/pairs/<A>-<B>.json.br
(each pair's four channels through time and the finance-to-trade ratio by quarter), data/surface.json (this
site's own surface, with the replay ids trade-flow reads back) and a build log $GN_STORE/builds/<stamp>.json
(inputs, outputs, checks; copied to <tag>.json after a successful deploy). Nothing else under
$GN_STORE is read or written.

Rules (G1-G10, G18): the economy set is money-flow's Signal Board (R19); trade reads the last shown
month only; every joined number keeps its own period; no commercial data in any form (G9, 1 Nov 2026); money links are
values in USD bn; first-round scenarios only; the pulse and the parents' change items are published by the
parents and never recomputed here (money-flow R20).
"""
from __future__ import annotations

import bisect
import datetime as dt
import hashlib
import json
import math
import os
import random
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

import brotli
import duckdb
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))

HERE = Path(__file__).resolve().parent.parent
MF_SITE = Path(os.environ.get("MONEY_FLOW_SITE", "/data/money-flow/site"))
MF_TABLES = Path(os.environ.get("MONEY_FLOW_TABLES", "/data/money-flow/tables"))
TF = Path(os.environ.get("TRADE_FLOW_DIR", HERE.parent / "trade-flow"))
TF_DATA = TF / "data"
OUT = HERE / "data"
# The only thing kept under GN_STORE: one build log per build, copied to <tag>.json after a deploy.
GN_STORE = Path(os.environ.get("GN_STORE", "/data/global-network"))
BUILDS = GN_STORE / "builds"
# The measures registry (rule C1): one id, name and definition per quantity, shared by the flow
# sites, the API and the desk. Read for the names of measures this build labels (partner 490's node, asia_nes).
MEASURES = Path(os.environ.get("MEASURES_JSON", HERE.parent / "family" / "measures.json"))

# The surface major version this build was written for (docs/SURFACES.md): a parent that moves to 2.x is a decision,
# not a silent break, so the build stops and says so.
SURFACE_MAJOR = 1
OWN_SURFACE = "1.0"

# The validation set (episodes, global windows, out-of-scope spans, the pre-window and the threshold) arrives in
# money-flow's episodes/global view; main() fills these before anything reads them.
EPISODES: dict = {}
GLOBAL_WINDOWS: list = []
OUT_OF_SCOPE: dict = {}
PRE = 4
THRESHOLD = 60.0
HUB = "USA"
# Replay quarters for the funding-withdrawal scenario (S1): the stress quarter and the one after it (ids as the
# episodes view names them; a quarter whose episode is not in the view is dropped with a note).
REPLAYS = [("gfc-2008", "2008-12-31"), ("gfc-2008", "2009-03-31"), ("taper-2013", "2013-09-30"), ("covid-2020", "2020-03-31"),
           ("covid-2020", "2020-06-30"), ("turkey-2018", "2018-09-30"), ("argentina-2018", "2018-06-30")]
BOOT_DRAWS = 1000        # bootstrap draws over economy-episodes for every AUROC interval
BOOT_LEVEL = 90          # % interval (5th to 95th percentile)
BOOT_SEED = 20261102
PAIR_TOL = 0.02          # pair totals against the parents' totals: within 2% (check b)
T_START = time.monotonic()
TIMINGS: dict[str, float] = {}


def lap(name: str) -> None:
    """Record the seconds since the last lap under `name` (printed and kept in the build log)."""
    now = time.monotonic()
    TIMINGS[name] = round(now - (lap.last if hasattr(lap, "last") else T_START), 2)
    lap.last = now  # type: ignore[attr-defined]


def read_surface(path: Path, who: str) -> dict:
    """A parent's surface.json, refused when missing or of another major version."""
    if not path.exists():
        sys.exit(f"{who}: no surface at {path}. The parent has not published its export surface (docs/SURFACES.md); nothing to build from.")
    s = json.loads(path.read_text())
    ver = str(s.get("surface", ""))
    try:
        major = int(ver.split(".")[0])
    except ValueError:
        sys.exit(f"{who}: surface version {ver!r} in {path} is not a semantic version")
    if major != SURFACE_MAJOR:
        sys.exit(f"{who}: surface {ver} at {path} is major version {major}; this build.py reads major version {SURFACE_MAJOR} only. "
                 f"Read the parent's change note, update build.py and SURFACE_MAJOR, then build again.")
    return s


def rd_br(p: Path):
    return json.loads(brotli.decompress(p.read_bytes()))


def utc(s) -> str | None:
    """An ISO date-time with any offset as UTC 'YYYY-MM-DDTHH:MM:SSZ' (one format for every build date: the
    parents write KST offsets in surface.json and UTC in their meta; slicing the first gave the wrong day)."""
    if not s:
        return None
    d = dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


# ---------------------------------------------------------------- partners that are not economies
# UN Comtrade partner 490 ("Other Asia, not elsewhere specified") is trade a reporter does not assign to a named Asian
# partner; most importers book their trade with Taiwan there, Gulf exporters their unnamed Asian destinations.
# trade-flow maps it to its own node S19 (registry id asia_nes), never to Taiwan. It is a partner like any other in
# shares, rankings, HHI, J4's coverage and the partners net; only where an economy's identity is needed is it left out:
# it is never a lender (J5 never matches it), has no country sheet and is in no economy list. Items carry economy false.
NON_ECONOMY_IDS = {"ASIA_NES", "X490", "490", "S19", "OAS", "XAS"}
ASIA_NES_IDS = {"ASIA_NES", "X490", "490", "S19", "OAS", "XAS"}
NES = re.compile(r"not elsewhere specified|\bn\.?e\.?s\.?\b", re.I)


def node_is_economy(n: dict) -> bool:
    nid = str(n.get("id", ""))
    if n.get("economy") is False or n.get("nes") or (n.get("kind") not in (None, "economy")):
        return False
    if nid.upper() in NON_ECONOMY_IDS or str(n.get("comtrade", "")) == "490" or NES.search(str(n.get("en") or "")):
        return False
    return bool(re.fullmatch(r"[A-Z]{3}", nid))


def node_is_asia_nes(n: dict) -> bool:
    return str(n.get("id", "")).upper() in ASIA_NES_IDS or str(n.get("comtrade", "")) == "490" or n.get("measure") == "asia_nes" \
        or bool(re.search(r"asia.*not elsewhere specified|other asia", str(n.get("en") or ""), re.I))


def wr(name: str, obj, quiet: bool = False) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
    (OUT / f"{name}.json.br").write_bytes(brotli.compress(raw, quality=9))
    if not quiet:
        print(f"  {name}.json.br  {len(raw)/1e6:.2f} MB json")
    return len(raw)


def R(x, n=2):
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return None
    return round(x, n)


def qend(d: dt.date) -> dt.date:
    m = ((d.month - 1) // 3 + 1) * 3
    return dt.date(d.year, m, 1) + dt.timedelta(days=32)


def qend_str(d: dt.date) -> str:
    q = qend(d)
    q = dt.date(q.year, q.month, 1) - dt.timedelta(days=1)
    return q.isoformat()


def qshift(q: str, k: int) -> str:
    d = dt.date.fromisoformat(q)
    m = d.month + 3 * k
    y = d.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    nxt = dt.date(y + (m // 12), m % 12 + 1, 1)
    return (nxt - dt.timedelta(days=1)).isoformat()


# ---------------------------------------------------------------- money-flow
class Money:
    """money-flow's surface: surface.json names the release; the release manifest maps view keys to objects."""

    def __init__(self):
        self.surface = read_surface(MF_SITE / "surface.json", "money-flow")
        self.tag = str(self.surface["release"])
        manifest = MF_SITE / "releases" / f"{self.tag}.json"
        if not manifest.exists():
            sys.exit(f"money-flow: surface.json names release {self.tag} but {manifest} does not exist")
        self.man = json.loads(manifest.read_text())
        latest = (MF_SITE / "releases" / "latest").read_text().strip() if (MF_SITE / "releases" / "latest").exists() else None
        if latest and latest != self.tag:
            print(f"  note: money-flow surface names release {self.tag}; releases/latest says {latest} (the surface wins)")

    def view(self, path: str):
        h = self.man["files"].get(path)
        if not h:
            return None
        return rd_br(MF_SITE / "objects" / f"{h}.json.br")

    def need(self, path: str):
        v = self.view(path)
        if v is None:
            sys.exit(f"money-flow release {self.tag} has no view {path!r}; the surface lists {self.surface.get('files')}")
        return v


# Where res_net_raw came from in this build: money-flow's board column, or derived here from the board's
# res and res_drains while money-flow's release does not carry the column yet (the same sum, unfloored).
RES_NET_RAW_FROM = "money-flow"


def net_reserves_raw(res, drains):
    """Net reserves as the registry defines them (net_reserves): IRFCL Section I plus the predetermined short-term net
    drains of Section II (negative for outflows), never floored, so they can be negative; None where either section is
    not published for the quarter (money-flow rules.py net_reserves_raw, the same rule)."""
    if res is None or drains is None:
        return None
    return round(res + drains, 2)


def board_series(world: dict) -> tuple[list[str], dict[str, dict]]:
    """Per economy: the quarterly trail of the Signal Board, compact arrays keyed by column. `res_net` is money-flow's
    A2 denominator (registry a2_reserve_base: net reserves floored at a tenth of gross, used only inside A2);
    `res_net_raw` is net reserves (registry net_reserves, may be negative), which J1, the replay and the API use."""
    global RES_NET_RAW_FROM
    b = world["board"]
    cols = b["cols"]
    keep = ["v", "flow", "exp", "buf", "a1", "a1n", "a2", "a2g", "a2_basis", "a2_floored", "a2_scored", "a3", "niip", "ca",
            "b1", "b2", "size", "gdp", "st", "res", "res_net", "res_net_raw", "res_drains", "ids", "loans", "stock_prev", "local_fx", "a1_local", "offshore"]
    RES_NET_RAW_FROM = "money-flow" if "res_net_raw" in cols else "derived"
    if RES_NET_RAW_FROM == "derived":
        print("  note: money-flow's board has no res_net_raw column yet; net reserves = res + res_drains here (unfloored)")
    idx = {c: cols.index(c) for c in keep if c in cols}
    ie = cols.index("eco")
    quarters = b["quarters"]
    out = {e: {"q": [], **{k: [] for k in keep}, "flow_note": []} for e in b["set"]["in"]}
    for q in quarters:
        rows = b["q"].get(q, {}).get("rows", [])
        # money-flow method 1.6: a row stays on the board when a flow input is missing; flow, b1, b2 (and a3, ids, loans)
        # are then null and `no_flow` names the reason. Signals that need them are unscored for the quarter, with it.
        nf = {e_: why for e_, why in (b["q"].get(q, {}).get("no_flow") or [])}
        for r in rows:
            e = r[ie]
            if e not in out:
                continue
            out[e]["q"].append(q)
            for k in keep:
                if k in idx:
                    out[e][k].append(r[idx[k]])
                elif k == "res_net_raw":
                    out[e][k].append(net_reserves_raw(r[idx["res"]], r[idx["res_drains"]]))
                else:
                    out[e][k].append(None)
            out[e]["flow_note"].append(nf.get(e))
    return quarters, out


# ---------------------------------------------------------------- trade-flow
class Trade:
    """trade-flow's surface: surface.json (built, shown month) over the data folder it describes."""

    def __init__(self):
        self.surface = read_surface(TF_DATA / "surface.json", "trade-flow")
        self.meta = rd_br(TF_DATA / "meta.json.br")
        self.nodes = self.meta["nodes"]
        self.idx = {n["id"]: i for i, n in enumerate(self.nodes)}
        self.shown_m = self.meta["shown"]["W"]
        self.complete_a = self.meta["complete"]["A"]
        if int(self.surface.get("shown", self.shown_m)) != int(self.shown_m):
            print(f"  note: trade-flow surface says shown {self.surface.get('shown')}, meta.json says {self.shown_m} (meta wins for the windows)")
        self._snaps = {}

    def file(self, name: str):
        p = TF_DATA / name
        if not p.exists():
            sys.exit(f"trade-flow: {p} is missing; the surface lists {self.surface.get('files')}")
        return rd_br(p)

    def snap_w12(self, t: int) -> dict:
        year = t // 100
        if year not in self._snaps:
            self._snaps[year] = rd_br(TF_DATA / "snap" / "W" / "TOTAL" / f"{year}.w12.json.br")
        f = self._snaps[year]
        for s in f["snaps"]:
            if s["t"] == t:
                return {"ncols": f["ncols"], "ecols": f["ecols"], **s}
        raise KeyError(t)

    def nodes_w12(self) -> dict:
        return rd_br(TF_DATA / "nodes" / "W" / "TOTAL.json.br")["12"]

    def nodes_a(self, slug="TOTAL") -> dict:
        return rd_br(TF_DATA / "nodes" / "A" / f"{slug}.json.br")["A"]

    def series_w12(self) -> tuple[list, list]:
        s = rd_br(TF_DATA / "series" / "W" / "TOTAL.json.br")
        return s["cols"], s["rows"]["12"]

    def series_w3(self) -> tuple[list, list]:
        """World trade by 3-month window (W composite). trade-flow retired the M-lens files."""
        s = rd_br(TF_DATA / "series" / "W" / "TOTAL.json.br")
        return s["cols"], s["rows"]["3"]


def month_add(t: int, k: int) -> int:
    y, m = divmod(t, 100)
    m += k
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return y * 100 + m


# ---------------------------------------------------------------- how economies earn (display only, G5/G6)
EARN_BAND = 1.0          # % of GDP: a balance inside ±1 counts as "not earning" on that axis
EARN_FROM = 2005
# Expectations from the brief of 1 Nov 2026, checked and printed, never tuned: (economy, axis, test, words)
EARN_CHECKS = [("DEU", "trade", "gs>pi", "Germany earns more from trade than from foreign assets"),
               ("KOR", "trade", "gs>pi", "Korea earns more from trade than from foreign assets"),
               ("CHN", "trade", "gs>pi", "China earns more from trade than from foreign assets"),
               ("JPN", "finance", "pi>3", "Japan's primary income surplus is large (above 3% of GDP)"),
               ("NOR", "finance", "pi>gs", "Norway earns more from foreign assets than from trade"),
               ("CHE", "finance", "in_set", "Switzerland is among the board economies")]


def earn_quadrant(gs, pi, band=EARN_BAND):
    if gs is None or pi is None:
        return None
    t, f = gs > band, pi > band
    return "both" if t and f else "trade" if t else "finance" if f else "neither"


def year_end(pts: list, y: int):
    """The value at the last published quarter of year y in a [[date, value], ...] series, or None."""
    v = None
    for d, x in pts:
        if d[:4] == str(y) and x is not None:
            v = x
    return v


def build_earn(econs: list[str], board: dict, trade: dict, chains: list[dict], hub: str, mf: "Money", earn_view: dict) -> dict:
    # money-flow's earn/global view carries the WDI file as fetch_earn.py writes it (read, source, licence, series, meta)
    w = earn_view.get("wdi")
    if not w or "series" not in w:
        sys.exit(f"money-flow release {mf.tag}: earn/global has no 'wdi' object with series (docs/SURFACES.md)")
    S = w["series"]
    codes = econs + [hub]
    last = max(int(y) for e in codes for y in S["gs"].get(e, {}))
    years = list(range(EARN_FROM, last + 1))
    out_e = {}
    # gross external assets and liabilities (IMF IIP via money-flow's economy views, USD bn), the hub included: display
    # only, for the Financial scale lens and the scale block (they enter neither V nor F)
    iip = {}
    for e in codes:
        v = mf.view(f"econ/{e}")
        border = (v or {}).get("border", {})
        iip[e] = (border.get("out", {}).get("iip", {}).get("total", []), border.get("in", {}).get("iip", {}).get("total", []))
    gap_x = gap_ne = gap_n = 0.0
    filled: dict[str, int] = {}
    for e in codes:
        gs, pi, pc, gdp, niip, quad, nf = [], [], [], [], [], [], []
        xg, mg, xu, mu, fa, fl, fag, flg = [], [], [], [], [], [], [], []
        b = board.get(e)
        for y in years:
            g = S["gdp"].get(e, {}).get(str(y))
            x = S["gs"].get(e, {}).get(str(y))
            f = S["pi"].get(e, {}).get(str(y))
            gs.append(R(100 * x / g, 2) if x is not None and g else None)
            pi.append(R(100 * f / g, 2) if f is not None and g else None)
            pc.append(R(S["gdp_pc"].get(e, {}).get(str(y)), 0))
            gdp.append(R(g / 1e9, 1) if g else None)
            v = None
            if b:  # net IIP at the year's last published quarter (money-flow board, IMF IIP)
                for qi in range(len(b["q"]) - 1, -1, -1):
                    if b["q"][qi][:4] == str(y) and b["niip"][qi] is not None:
                        v = b["niip"][qi]
                        break
            niip.append(R(v, 1))
            quad.append(earn_quadrant(gs[-1], pi[-1]))
            # trade scale: exports and imports of goods and services on the BoP basis of the net line, so xg - mg = gs
            ex, im = S["x"].get(e, {}).get(str(y)), S["m"].get(e, {}).get(str(y))
            xu.append(R(ex / 1e9, 1) if ex is not None else None)
            mu.append(R(im / 1e9, 1) if im is not None else None)
            xg.append(R(100 * ex / g, 2) if ex is not None and g else None)
            mg.append(R(100 * im / g, 2) if im is not None and g else None)
            if xg[-1] is not None and mg[-1] is not None and gs[-1] is not None:
                gap_x = max(gap_x, abs(xg[-1] - mg[-1] - gs[-1]))
            nx = S["ne_x"].get(e, {}).get(str(y))
            if nx is not None and xg[-1] is not None:
                gap_ne = max(gap_ne, abs(nx - xg[-1]))
            # financial scale: gross assets and liabilities at the year's last published quarter, % of WDI GDP
            a_, l_ = year_end(iip[e][0], y), year_end(iip[e][1], y)
            fa.append(R(a_, 0))
            fl.append(R(l_, 0))
            fag.append(R(100 * a_ / (g / 1e9), 1) if a_ is not None and g else None)
            flg.append(R(100 * l_ / (g / 1e9), 1) if l_ is not None and g else None)
            if fag[-1] is not None and flg[-1] is not None and niip[-1] is not None:
                gap_n = max(gap_n, abs(fag[-1] - flg[-1] - niip[-1]))
            # the board covers the 36 borrowers only: the hub, and years before an economy's board series starts, take
            # net IIP from the same IMF IIP gross positions over WDI GDP (assets - liabilities), not "no net IIP"
            nf.append(0)
            if niip[-1] is None and fag[-1] is not None and flg[-1] is not None:
                niip[-1] = R(fag[-1] - flg[-1], 1)
                nf[-1] = 1     # marked on the page: net IIP from gross IIP positions over WDI GDP (gdp_wdi), not the board's
                filled[e] = filled.get(e, 0) + 1
        out_e[e] = {"gs": gs, "pi": pi, "pc": pc, "gdp": gdp, "niip": niip, "nf": nf, "q": quad,
                    "xg": xg, "mg": mg, "xu": xu, "mu": mu, "fa": fa, "fl": fl, "fag": fag, "flg": flg}
    print(f"  earn net IIP from gross positions where the board has none: {filled or 'none'}")
    print(f"  earn scale: |exports - imports - net| <= {gap_x:.2f} pt of GDP; WDI national-accounts exports differ from BoP by up to "
          f"{gap_ne:.1f} pt; |assets - liabilities - board net IIP| <= {gap_n:.1f} pt (GDP denominators differ)")
    # the side panel: concentration, world share, chokepoints held, FX credit dependence (each at its own period)
    panel = {}
    for e in codes:
        now = trade[e]["now"]
        holds = []
        for ch in chains:
            cp = ch["chokepoint"]
            if cp and cp["top_exporters"] and cp["top_exporters"][0][0] == e:
                holds.append({"chain": ch["id"], "en": ch["en"], "ko": ch["ko"], "stage": cp["en"], "stage_ko": cp["ko"], "share": cp["top_exporters"][0][1], "hhi": cp["hhi"], "year": ch["year"]})
        b = board.get(e)
        a1 = a1q = None
        if b:
            for qi in range(len(b["q"]) - 1, -1, -1):
                if b["a1"][qi] is not None:
                    a1, a1q = b["a1"][qi], b["q"][qi]
                    break
        pr = trade[e]["products"]
        panel[e] = {"t": now["t"], "hm": now["hm"], "x_share": now["x_share"], "x_bn": now["x_bn"], "holds": holds, "a1": a1, "a1q": a1q,
                    "a1_local": (b["a1_local"][-1] if b else None),
                    "prod": {"t": pr["t"], "x_bn": pr["x_bn"], "m_bn": pr["m_bn"], "x": pr["x"][:5], "m": pr["m"][:5]}}
    # the brief's expectations, read at the latest year, printed and published as they come out
    k = len(years) - 1
    checks = []
    for e, axis, test, words in EARN_CHECKS:
        if e not in out_e:
            checks.append({"eco": e, "axis": axis, "test": test, "en": words, "ok": False, "note": "not among the board economies"})
            continue
        g, p = out_e[e]["gs"][k], out_e[e]["pi"][k]
        ok = (g > p) if test == "gs>pi" else (p > g) if test == "pi>gs" else (p > 3) if test == "pi>3" else True
        checks.append({"eco": e, "axis": axis, "test": test, "en": words, "ok": bool(ok), "gs": g, "pi": p, "quad": out_e[e]["q"][k]})
    for c in checks:
        print(f"  earn check {c['eco']}: {'ok ' if c['ok'] else 'FLAG'} {c['en']} (trade {c.get('gs')}, primary income {c.get('pi')}{', ' + c['note'] if c.get('note') else ''})")
    counts = {q: sum(1 for e in econs if out_e[e]["q"][k] == q) for q in ("trade", "finance", "both", "neither")}
    print(f"  earn {years[0]}-{years[-1]}: {counts} in {years[-1]}, WDI read {w['read']} (money-flow release {mf.tag}, earn/global)")
    wmeta = w.get("meta") or {}
    return {"years": years, "band": EARN_BAND, "read": w["read"], "updated": (wmeta.get("gs") or {}).get("lastupdated"),
            "series": {k2: (v.get("id") if isinstance(v, dict) else v) for k2, v in wmeta.items()},
            "econ": out_e, "panel": panel, "checks": checks, "hub": hub, "via": {"money_release": mf.tag, "view": "earn/global"}}


# ---------------------------------------------------------------- products by HS chapter (display only)
PROD_TOP = 10            # chapters per side on the country sheet (the Overview panel shows the first five)
PROD_EST_MIN = 0.10      # a chapter row is marked estimated when estimates make up at least this share of its value
PROD_YOY_MIN = 0.1       # USD bn: below this a year earlier, no change is printed


def build_products(trade: dict, codes: list[str], tf: "Trade") -> dict:
    """Each economy's exports and imports by HS chapter over its own 12-month window (trade-flow's build_products.py and
    window rules, published as data/products.json.br), the largest PROD_TOP per side, each with the other side of the
    same chapter (net)."""
    d = tf.file("products.json.br")
    # the HS-chapter file must come from the same trade-flow build as the windows and snapshots it is read
    # with; a products file from another build is refused, not used
    if utc(d.get("trade_flow_built")) != utc(tf.meta.get("built_at")):
        sys.exit(f"trade-flow products.json.br was built for trade-flow {d.get('trade_flow_built')}, but meta.json says the windows are from "
                 f"{tf.meta.get('built_at')}. Rebuild trade-flow's products (scripts/build_products.py) for this build; global-network does not mix them (K8).")
    fname = f"products.json.br (trade-flow {utc(d.get('trade_flow_built'))})"
    ends = {str(t) for t in d["ends"]}
    out, gaps = {}, []

    def yoy(a, b):
        return R(100 * (a / b - 1), 1) if b is not None and b >= PROD_YOY_MIN else None
    for e in codes:
        now = trade[e]["now"]
        t, tp = str(now["t"]), str(month_add(now["t"], -12))
        if t not in ends or tp not in ends:
            sys.exit(f"trade-flow {fname} has no window ending {t} or {tp} for {e}: trade-flow's products build is behind its windows")
        X, M = now["x_bn"], now["m_bn"]
        rows = []
        for ch, by in d["econ"].get(e, {}).items():
            v, p = by.get(t), by.get(tp)
            if not v:
                continue
            x, m = v[0] / 1e9, v[1] / 1e9
            rows.append({"ch": ch, "x": R(x, 2), "m": R(m, 2), "xs": R(100 * x / X, 1) if X else None, "ms": R(100 * m / M, 1) if M else None,
                         "xy": yoy(x, p[0] / 1e9 if p else None), "my": yoy(m, p[1] / 1e9 if p else None),
                         "xe": v[3] if (v[2] or 0) >= PROD_EST_MIN else 0, "me": v[5] if (v[4] or 0) >= PROD_EST_MIN else 0})
        sx, sm = sum(r["x"] for r in rows), sum(r["m"] for r in rows)
        gaps.append((e, sx / X if X else None, sm / M if M else None))
        out[e] = {"t": now["t"], "x_bn": X, "m_bn": M,
                  "x": sorted((r for r in rows if r["x"] > 0), key=lambda r: -r["x"])[:PROD_TOP],
                  "m": sorted((r for r in rows if r["m"] > 0), key=lambda r: -r["m"])[:PROD_TOP]}
    rx = [g[1] for g in gaps if g[1]]
    rm = [g[2] for g in gaps if g[2]]
    print(f"  products {fname}: chapters sum to {min(rx):.2f}-{max(rx):.2f} of exports, "
          f"{min(rm):.2f}-{max(rm):.2f} of imports (the rest: chapters 77/98/99 and flows not positive every month)")
    return {"file": fname, "read": d.get("read"), "trade_flow_built": d.get("trade_flow_built"), "econ": out}


# Quarterly view of the Overview chart (display only): IMF BOP and QNEA, BIS XRU averages, money-flow IIP and board net IIP.
Q_FROM = "2005-Q1"
Q_TOL = 0.03             # a quarterly series is shown only if its Q4 rolling sums match WDI within ±3% (median over years)
Q_WDI = {"xu": ("x", "BX.GSR.GNFS.CD"), "mu": ("m", "BM.GSR.GNFS.CD"), "pi": ("pi", "BN.GSR.FCTY.CD"), "gdp": ("gdp", "NY.GDP.MKTP.CD")}
Q_END = {"1": "03-31", "2": "06-30", "3": "09-30", "4": "12-31"}


def q_label(i: int) -> str:
    """Quarter index (year*4 + q-1) to '2024-Q1'."""
    return f"{i // 4}-Q{i % 4 + 1}"


def q_index(p: str) -> int:
    return int(p[:4]) * 4 + int(p[-1]) - 1


def q_date(p: str) -> str:
    return f"{p[:4]}-{Q_END[p[-1]]}"


def q_of_date(d: str) -> str:
    return f"{d[:4]}-Q{(int(d[5:7]) - 1) // 3 + 1}"


def earn_groups(codes: list[str], names: dict, euro: dict, advanced: set, econs: list[str], hub: str) -> dict:
    """Overview filter groups from config/regions.yaml folded over the UN M49 region/subregion of trade-flow's nodes."""
    cfg = yaml.safe_load((HERE / "config" / "regions.yaml").read_text())
    pins = cfg.get("economies") or {}
    out = {}
    for e in codes:
        n = names[e]
        g = pins.get(e)
        if g is None:
            g = next((k for k, v in cfg["groups"].items() if n.get("subregion") in (v.get("subregions") or [])), None)
        if g is None:
            g = next((k for k, v in cfg["groups"].items() if n.get("region") in (v.get("regions") or [])), None)
        if g is None:
            sys.exit(f"regions.yaml places no group for {e} ({n.get('region')} / {n.get('subregion')})")
        out[e] = {"region": g, "euro": e in euro, "advanced": e in advanced or e == hub, "borrower": e in econs}
    out[hub]["region"] = "americas"
    return out


def build_earn_q(econs: list[str], board: dict, hub: str, mf: "Money", names: dict, euro: dict, advanced: set, earn_view: dict) -> dict:
    # money-flow's earn/global view: the quarterly file as fetch_earn.py writes it (read, bop, gdp, fx, sources) beside the WDI file
    qf = earn_view.get("quarterly")
    if not qf or "bop" not in qf:
        sys.exit(f"money-flow release {mf.tag}: earn/global has no 'quarterly' object with bop (docs/SURFACES.md)")
    w = earn_view["wdi"]
    S = w["series"]
    codes = econs + [hub]
    fx_all = qf["fx"]
    eur = fx_all.get("XM", {}).get("EUR", {}).get("obs", {})

    def fx_of(e: str, unit: str):
        """Currency per USD by quarter for converting a series labelled `unit` of economy e (None: already USD)."""
        if unit == "USD":
            return None
        own = fx_all.get(e, {})
        if unit == "EUR":
            return own["EUR"]["obs"] if "EUR" in own else eur
        return next(iter(own.values()))["obs"] if len(own) == 1 else {}

    def to_usd(e: str, unit: str, obs: dict) -> dict[int, float]:
        f = fx_of(e, unit)
        if f is None:
            return {q_index(p): v for p, v in obs.items()}
        return {q_index(p): v / f[p] for p, v in obs.items() if f.get(p)}

    def sum4(s, i: int):
        if not s:
            return None
        xs = [s.get(i - k) for k in range(4)]
        return None if any(x is None for x in xs) else sum(xs)

    def check(e: str, key: str, cands: dict[str, dict[int, float]]):
        """Pick the unit whose calendar-year sums best match WDI: (series or None, check row)."""
        wk, wid = Q_WDI[key]
        ref = S[wk].get(e, {})
        best = None
        for unit, s in cands.items():
            rs = sorted(a / v for y, v in ref.items() if v and (a := sum4(s, int(y) * 4 + 3)) is not None)
            if not rs:
                continue
            h = len(rs) // 2
            m = rs[h] if len(rs) % 2 else (rs[h - 1] + rs[h]) / 2
            if best is None or abs(m - 1) < abs(best[1] - 1):
                best = (unit, m, len(rs))
        if best is None:
            return None, {"eco": e, "series": key, "median_ratio": None, "unit_used": None, "ok": False,
                          "note": f"no year overlaps {wid}" if cands else "no IMF series with values"}
        unit, m, n = best
        ok = abs(m - 1) <= Q_TOL
        row = {"eco": e, "series": key, "median_ratio": round(m, 4), "unit_used": unit, "ok": ok,
               "note": f"{n} years vs {wid}" + ("" if ok else f"; outside ±{Q_TOL:.0%}, series withheld")}
        return (cands[unit] if ok else None), row

    checks, ser, lat = [], {}, {}
    for e in codes:
        by = defaultdict(dict)  # (indicator, entry) -> unit -> USD by quarter index
        raw_last = defaultdict(dict)
        for s in qf["bop"].get(e, {}).values():
            by[(s["indicator"], s["entry"])][s["unit"]] = to_usd(e, s["unit"], s["obs"])
            raw_last[(s["indicator"], s["entry"])][s["unit"]] = max(s["obs"])
        cr, db = by[("IN1", "CD_T")], by[("IN1", "DB_T")]
        net = {u: {i: cr[u][i] - db[u][i] for i in cr[u] if i in db[u]} for u in cr if u in db}
        gdp_c = {k: to_usd(e, k, g["obs"]) for k, g in qf["gdp"].get(e, {}).items()}
        got, units = {}, {}
        for key, cands in (("xu", by[("GS", "CD_T")]), ("mu", by[("GS", "DB_T")]), ("pi", net), ("gdp", gdp_c)):
            got[key], row = check(e, key, cands)
            checks.append(row)
            if row["ok"]:
                units[key] = row["unit_used"]
        ser[e] = got
        bl = [raw_last[("GS", ent)].get(units.get(k)) for k, ent in (("xu", "CD_T"), ("mu", "DB_T"))]
        gl = qf["gdp"].get(e, {}).get(units.get("gdp"), {}).get("obs")
        lat[e] = {"bop": min(bl) if all(bl) else None, "gdp": max(gl) if gl else None}

    # gross IIP (money-flow economy views, as the annual view reads them) and the board's net IIP, by quarter end
    iip, niip_q = {}, {}
    for e in codes:
        v = mf.view(f"econ/{e}")
        border = (v or {}).get("border", {})
        iip[e] = tuple({d: x for d, x in border.get(side, {}).get("iip", {}).get("total", []) if x is not None} for side in ("out", "in"))
        b = board.get(e)
        niip_q[e] = {d: x for d, x in zip(b["q"], b["niip"]) if x is not None} if b else {}
        both = [d for d in iip[e][0] if d in iip[e][1]]
        lat[e]["iip"] = q_of_date(max(both)) if both else None

    i0 = q_index(Q_FROM)
    i_end = q_index(f"{dt.date.today().year}-Q4")
    keys = ("gs", "pi", "xg", "mg", "xu", "mu", "gdp", "fa", "fl", "fag", "flg", "niip")
    full = {}
    filled_q: dict[str, int] = {}
    for e in codes:
        g = ser[e]
        cols = {k: [] for k in keys + ("pc", "nf")}
        for i in range(i0, i_end + 1):
            p = q_label(i)
            d = q_date(p)
            bn = {k: (x / 1e9 if (x := sum4(g[k], i)) is not None else None) for k in ("gdp", "xu", "mu", "pi")}
            gd, xu, mu = bn["gdp"], bn["xu"], bn["mu"]
            fa, fl = iip[e][0].get(d), iip[e][1].get(d)

            def pct(x):
                return R(100 * x / gd, 2) if x is not None and gd else None
            cols["gdp"].append(R(gd, 1))
            cols["xu"].append(R(xu, 1))
            cols["mu"].append(R(mu, 1))
            cols["xg"].append(pct(xu))
            cols["mg"].append(pct(mu))
            cols["gs"].append(pct(xu - mu) if xu is not None and mu is not None else None)
            cols["pi"].append(pct(bn["pi"]))
            cols["fa"].append(R(fa, 1))
            cols["fl"].append(R(fl, 1))
            cols["fag"].append(pct(fa))
            cols["flg"].append(pct(fl))
            nq = niip_q[e].get(d)
            cols["nf"].append(0)
            if nq is None and fa is not None and fl is not None and gd:   # as the annual frame: gross positions where the board has none
                nq = 100 * (fa - fl) / gd
                cols["nf"][-1] = 1   # over IMF quarterly GDP (gdp_qnea) here
                filled_q[e] = filled_q.get(e, 0) + 1
            cols["niip"].append(R(nq, 2))
            cols["pc"].append(R(S["gdp_pc"].get(e, {}).get(p[:4]), 0))
        full[e] = cols
    print(f"  earn quarterly net IIP from gross positions where the board has none: {filled_q or 'none'}")
    n_all = i_end - i0 + 1
    last_j = max((j for e in codes for k in keys for j in range(n_all) if full[e][k][j] is not None), default=0)
    periods = [q_label(i0 + j) for j in range(last_j + 1)]
    econ = {e: {k: v[: last_j + 1] for k, v in cols.items()} for e, cols in full.items()}

    def median_q(vals):
        vs = sorted(v for v in vals if v)
        return vs[(len(vs) - 1) // 2] if vs else None

    fx_last = {e: max(next(iter(fx_all[e].values()))["obs"]) for e in codes if fx_all.get(e)}
    latest = {"bop": median_q(lat[e]["bop"] for e in codes), "gdp": median_q(lat[e]["gdp"] for e in codes),
              "iip": median_q(lat[e]["iip"] for e in codes), "fx": median_q(fx_last.values())}

    # the validation table, printed compactly: median ratio to WDI, unit used, ok or FLAG per economy and series
    print(f"  earn quarterly {periods[0]}-{periods[-1]}, read {qf.get('read')} (money-flow earn/global), latest {latest}")
    print("  eco  " + "".join(f"{k:<18}" for k in Q_WDI))
    rows = {(r["eco"], r["series"]): r for r in checks}
    for e in codes:
        cells = [f"{rows[e, k]['median_ratio'] or 0:.3f} {rows[e, k]['unit_used'] or '-':<4} {'ok' if rows[e, k]['ok'] else 'FLAG'}" for k in Q_WDI]
        print(f"  {e}  " + "".join(f"{c:<18}" for c in cells))
    nok = sum(r["ok"] for r in checks)
    print(f"  earn quarterly checks: {nok} ok, {len(checks) - nok} flagged of {len(checks)}")
    for r in checks:
        if not r["ok"]:
            print(f"  FLAG {r['eco']} {r['series']}: ratio {r['median_ratio']} ({r['unit_used']}), {r['note']}")
    src = qf["sources"]

    def imf(k):
        s = src[k]
        return {"id": s["id"], "structure": s.get("structure"), "url": (s.get("urls") or [None])[0], "published": s.get("publication_date")}
    q = {"periods": periods, "econ": econ, "latest": latest, "econ_latest": lat, "checks": checks, "read": qf["read"],
         "sources": {"bop": imf("bop"), "qnea": imf("qnea"),
                     "xru": {"id": src["xru"]["id"], "vintage": src["xru"]["vintage"], "filter": src["xru"]["filter"]},
                     "iip": f"money-flow release {mf.tag}, econ/<ISO3> border.out|in.iip.total (IMF IIP)",
                     "niip": f"money-flow release {mf.tag}, Signal Board niip", "pc": f"WDI NY.GDP.PCAP.CD, read {w['read']}",
                     "missing": {k: [e for e in codes if not qf[k].get(e)] for k in ("bop", "gdp")}, "tolerance": Q_TOL}}
    wdi_last = max(int(y) for e in codes for y in S["gs"].get(e, {}))
    return {"q": q, "groups": earn_groups(codes, names, euro, advanced, econs, hub), "latest": {"wdi": wdi_last}}



# ---------------------------------------------------------------- pair history: one file per unordered pair
def build_pair_history(con, links: str, codes: list[str], tf: "Trade", shown: int, trade: dict, max_lag: int) -> dict:
    """Every channel of a pair through time, each at its own period: goods both ways by 12-month
    window (every snapshot month of trade-flow, backbone flows only, so a month the pair falls below the 1,500 largest
    flows is null), bank claims by quarter (BIS LBS loans and deposits, creditor -> debtor), portfolio holdings by half
    year (IMF PIP, holder -> issuer, the half-yearly row where the IMF publishes one), direct investment by year (IMF
    DIP, investor -> host, one report per pair in R4's order), and the finance-to-trade ratio by quarter. Writes
    data/pairs/<A>-<B>.json.br (A < B) and returns a summary for the build log. Only the four public datasets are read."""
    cset = set(codes)
    set_sql = ",".join(f"'{e}'" for e in codes)
    ids = [n["id"] for n in tf.nodes]
    # goods: every 12-month window up to the shown month; value = share of world x that window's world total
    months: list[int] = []
    goods: dict[tuple[str, str], dict[int, tuple]] = defaultdict(dict)
    for y in range(2000, shown // 100 + 1):
        p = TF_DATA / "snap" / "W" / "TOTAL" / f"{y}.w12.json.br"
        if not p.exists():
            continue
        f = rd_br(p)
        ec = {c: i for i, c in enumerate(f["ecols"])}
        i_s, i_t, i_w, i_mr, i_src, i_est = ec["s"], ec["t"], ec["w"], ec["mr"], ec["src"], ec["est"]
        for sn in f["snaps"]:
            if sn["t"] > shown:
                continue
            k = len(months)
            months.append(sn["t"])
            world = sn["world"]
            for e in sn["edges"]:
                a, b = ids[e[i_s]], ids[e[i_t]]
                if a in cset and b in cset:
                    usd = e[i_w] * world / 1e9
                    mr = e[i_mr]
                    # the other report of the same flow: the exporter's when the importer's is drawn (src 1), else the importer's
                    other = None if mr is None or mr <= 0 else (usd / mr if e[i_src] == 1 else usd * mr)
                    goods[(a, b)][k] = (R(usd, 2), R(other, 2), e[i_est])
    # bank claims by quarter (positions; a null quarter is one the BIS did not publish for the pair)
    rows = con.sql(f"""
        select creditor, debtor, period, position_usd from '{links}'
        where dataset='bis.LBS' and channel='bank_loans' and sector_debtor='all' and currency='all' and basis='residence'
          and creditor in ({set_sql}) and debtor in ({set_sql}) and period >= DATE '2005-12-31' and position_usd is not null""").fetchall()
    bq = sorted({r[2] for r in rows})
    bqi = {q: i for i, q in enumerate(bq)}
    bank: dict[tuple[str, str], dict[int, float]] = defaultdict(dict)
    for c_, d_, per, pos in rows:
        bank[(c_, d_)][bqi[per]] = R(pos, 1)
    # portfolio by half year (the half-yearly row preferred over the annual one for the same June or December date)
    rows = con.sql(f"""
        select creditor, debtor, period, position_usd from '{links}'
        where dataset='imf.PIP' and channel='portfolio' and sector_debtor='all' and currency='all'
          and creditor in ({set_sql}) and debtor in ({set_sql}) and period >= DATE '2005-12-31' and position_usd is not null
        qualify row_number() over (partition by creditor, debtor, period order by freq desc) = 1""").fetchall()
    pp = sorted({r[2] for r in rows})
    ppi = {q: i for i, q in enumerate(pp)}
    port: dict[tuple[str, str], dict[int, float]] = defaultdict(dict)
    for c_, d_, per, pos in rows:
        port[(c_, d_)][ppi[per]] = R(pos, 1)
    # direct investment by year, one report per pair and year (the host's first, as the latest-period pairs)
    rows = con.sql(f"""
        select creditor, debtor, period, position_usd from '{links}'
        where dataset='imf.DIP' and channel='fdi' and creditor in ({set_sql}) and debtor in ({set_sql}) and position_usd is not null
        qualify row_number() over (partition by creditor, debtor, period
          order by case reported_by when 'debtor' then 0 when 'creditor' then 1 when 'mirror_debtor' then 2 else 3 end) = 1""").fetchall()
    fy = sorted({r[2] for r in rows})
    fyi = {q: i for i, q in enumerate(fy)}
    fdi: dict[tuple[str, str], dict[int, float]] = defaultdict(dict)
    for c_, d_, per, pos in rows:
        fdi[(c_, d_)][fyi[per]] = R(pos, 1)

    def series(d: dict[int, object], n: int, pick=lambda v: v) -> list:
        return [pick(d[k]) if k in d else None for k in range(n)]

    def latest_at(d: dict[int, float], axis: list, q) -> float | None:
        """The latest value of a slower channel at or before quarter end q."""
        best = None
        for k in sorted(d):
            if axis[k] <= q:
                best = d[k]
            else:
                break
        return best

    month_idx = {t: k for k, t in enumerate(months)}
    complete = {e: {t for t, x in zip(trade[e]["t"], trade[e]["x"]) if x is not None} for e in codes}

    def own_window(e: str, qm: int) -> int | None:
        for lag in range(max_lag + 1):
            t = month_add(qm, -lag)
            if t in complete[e] and t in month_idx:
                return t
        return None
    (OUT / "pairs").mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("pairs/*.json.br"):
        old.unlink()
    written = 0
    total_bytes = 0
    with_goods = with_bank = 0
    for i, a in enumerate(sorted(codes)):
        for b in sorted(codes)[i + 1:]:
            ab, ba = (a, b), (b, a)
            if not (goods.get(ab) or goods.get(ba) or bank.get(ab) or bank.get(ba) or port.get(ab) or port.get(ba) or fdi.get(ab) or fdi.get(ba)):
                continue
            g_ab, g_ba = goods.get(ab, {}), goods.get(ba, {})
            b_ab, b_ba = bank.get(ab, {}), bank.get(ba, {})
            p_ab, p_ba = port.get(ab, {}), port.get(ba, {})
            f_ab, f_ba = fdi.get(ab, {}), fdi.get(ba, {})
            # finance-to-trade by quarter: positions in both directions (bank at the quarter, portfolio and direct
            # investment at their latest period at or before it) over goods both ways in the 12 months to the quarter end;
            # null until every finance channel has a value for at least one direction and goods exist for at least one
            # goods in each direction over the exporter's own complete window, as its country sheet and the pair goods
            # use (rule C1: the sheet's 0.9 completeness rule): the last window at or before the quarter's last month
            # that is complete for the exporter, at most max_lag months earlier (rule C2; then partial); none within the
            # lag, no ratio for the quarter
            ratio, r_fin, r_goods, r_ta, r_tb, r_part = [], [], [], [], [], []
            for k, q in enumerate(bq):
                qm = q.year * 100 + q.month
                ta, tb = own_window(a, qm), own_window(b, qm)
                gsum = []
                if ta is not None and tb is not None:
                    for x, t_ in ((g_ab.get(month_idx.get(ta)), ta), (g_ba.get(month_idx.get(tb)), tb)):
                        if x is not None and x[0] is not None:
                            gsum.append(x[0])
                bk = [v for v in (b_ab.get(k), b_ba.get(k)) if v is not None]
                pk = [v for v in (latest_at(p_ab, pp, q), latest_at(p_ba, pp, q)) if v is not None]
                fk = [v for v in (latest_at(f_ab, fy, q), latest_at(f_ba, fy, q)) if v is not None]
                ok_r = bool(gsum and sum(gsum) > 0 and bk and pk and fk)
                ratio.append(R((sum(bk) + sum(pk) + sum(fk)) / sum(gsum), 2) if ok_r else None)
                r_fin.append(R(sum(bk) + sum(pk) + sum(fk), 1) if ok_r else None)
                r_goods.append(R(sum(gsum), 1) if ok_r else None)
                r_ta.append(ta if ok_r else None)
                r_tb.append(tb if ok_r else None)
                r_part.append((ta != qm or tb != qm) if ok_r else None)
            obj = {
                "a": a, "b": b, "shown": shown,
                "goods": {"t": months, "ab": series(g_ab, len(months), lambda v: v[0]), "ba": series(g_ba, len(months), lambda v: v[0]),
                          "ab2": series(g_ab, len(months), lambda v: v[1]), "ba2": series(g_ba, len(months), lambda v: v[1]),
                          "est_ab": series(g_ab, len(months), lambda v: v[2]), "est_ba": series(g_ba, len(months), lambda v: v[2])},
                "bank": {"q": [q.isoformat() for q in bq], "ab": series(b_ab, len(bq)), "ba": series(b_ba, len(bq))},
                "portfolio": {"p": [q.isoformat() for q in pp], "ab": series(p_ab, len(pp)), "ba": series(p_ba, len(pp))},
                "fdi": {"y": [q.isoformat() for q in fy], "ab": series(f_ab, len(fy)), "ba": series(f_ba, len(fy))},
                "ratio": {"q": [q.isoformat() for q in bq], "v": ratio, "fin": r_fin, "goods": r_goods, "t_ab": r_ta, "t_ba": r_tb, "partial": r_part},
                "per": {"goods": shown, "bank": bq[-1].isoformat() if bq else None, "portfolio": pp[-1].isoformat() if pp else None, "fdi": fy[-1].isoformat() if fy else None},
            }
            total_bytes += wr(f"pairs/{a}-{b}", obj, quiet=True)
            written += 1
            with_goods += 1 if (g_ab or g_ba) else 0
            with_bank += 1 if (b_ab or b_ba) else 0
    n_pairs = len(codes) * (len(codes) - 1) // 2
    print(f"  pairs/<A>-<B>.json.br: {written} of {n_pairs} unordered pairs ({with_goods} with goods months, {with_bank} with bank quarters), "
          f"{len(months)} windows {months[0] if months else '-'}..{months[-1] if months else '-'}, {len(bq)} bank quarters, {len(pp)} portfolio periods, {len(fy)} FDI years; {total_bytes/1e6:.1f} MB json")
    return {"written": written, "of": n_pairs, "with_goods": with_goods, "with_bank": with_bank, "months": len(months), "bank_quarters": len(bq), "portfolio_periods": len(pp), "fdi_years": len(fy)}


# ---------------------------------------------------------------- funding lens: who holds an economy's liabilities
def build_funding(con, links: str, codes: list[str], years: list[int], fl: dict[str, list]) -> dict:
    """Per economy and year, the share of gross external liabilities (IMF IIP, the year's last published quarter, as
    build_earn carries it in `fl`) held by the three largest named creditor economies, summing three channels at each
    channel's latest period within the year (or the year before when the year's is not yet published): bank loans and
    deposits (BIS LBS, every named reporting economy), portfolio holdings (IMF PIP, every holder) and direct investment
    (IMF DIP, every investor, one report per pair). BIS and IMF aggregates ("BIS:5A", "IMF:...") are never a creditor.
    A lower bound: the BIS withholds confidential bilateral cells and the IIP total includes instruments no bilateral
    dataset covers (derivatives, currency, trade credit). Display only (G5, G6)."""
    set_sql = ",".join(f"'{e}'" for e in codes)
    first = dt.date(years[0] - 1, 12, 31)
    def table(sql):
        out: dict[str, dict[dt.date, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
        for d_, c_, per, pos in con.sql(sql).fetchall():
            out[d_][per][c_] = pos
        return out
    bank = table(f"""
        select debtor, creditor, period, position_usd from '{links}'
        where dataset='bis.LBS' and channel='bank_loans' and sector_debtor='all' and currency='all' and basis='residence'
          and debtor in ({set_sql}) and creditor not like '%:%' and length(creditor) = 3 and position_usd > 0 and period >= DATE '{first}'""")
    port = table(f"""
        select debtor, creditor, period, position_usd from '{links}'
        where dataset='imf.PIP' and channel='portfolio' and sector_debtor='all' and currency='all'
          and debtor in ({set_sql}) and creditor not like '%:%' and length(creditor) = 3 and position_usd > 0 and period >= DATE '{first}'
        qualify row_number() over (partition by debtor, creditor, period order by freq desc) = 1""")
    fdi = table(f"""
        select debtor, creditor, period, position_usd from '{links}'
        where dataset='imf.DIP' and channel='fdi' and debtor in ({set_sql}) and creditor not like '%:%' and length(creditor) = 3
          and position_usd > 0 and period >= DATE '{first}'
        qualify row_number() over (partition by debtor, creditor, period
          order by case reported_by when 'debtor' then 0 when 'creditor' then 1 when 'mirror_debtor' then 2 else 3 end) = 1""")
    out = {}
    shares = []
    for e in codes:
        top3, named, who, per_used, year_used = [], [], None, None, None
        for yi, y in enumerate(years):
            end, floor = dt.date(y, 12, 31), dt.date(y - 1, 12, 31)
            tot: dict[str, float] = defaultdict(float)
            pers = {}
            for key, tb in (("bank", bank), ("portfolio", port), ("fdi", fdi)):
                ps = [p for p in tb.get(e, {}) if floor <= p <= end]
                if not ps:
                    continue
                p = max(ps)
                pers[key] = p.isoformat()
                for c_, v in tb[e][p].items():
                    tot[c_] += v
            liab = fl.get(e, [None] * len(years))[yi]
            ranked = sorted(tot.items(), key=lambda z: -z[1])
            if liab and ranked and len(pers) == 3:
                t3 = sum(v for _, v in ranked[:3])
                top3.append(R(100 * t3 / liab, 1))
                named.append(R(100 * sum(tot.values()) / liab, 1))
                who = [[c_, R(100 * v / liab, 1)] for c_, v in ranked[:3]]
                per_used, year_used = pers, y
            else:
                top3.append(None)
                named.append(None)
        out[e] = {"top3": top3, "named": named, "who": who, "year": year_used, "per": per_used}
        if top3[-1] is not None:
            shares.append((e, top3[-1]))
    shares.sort(key=lambda z: z[1])
    print(f"  funding lens {years[-1]}: top-3 creditor share of gross liabilities for {len(shares)} of {len(codes)} economies, "
          f"{shares[0][0]} {shares[0][1]}% .. {shares[-1][0]} {shares[-1][1]}% (median {shares[len(shares)//2][1]}%)" if shares else "  funding lens: no economy")
    return out


# ---------------------------------------------------------------- consistency checks (rule C5)
K2_SAMPLE = ("KOR", "CHN", "JPN", "DEU", "USA", "SAU", "ARG", "TUR", "BRA", "IND", "GBR", "MEX")


def months_between(t_from: int, t_to: int) -> int:
    return (t_to // 100 * 12 + t_to % 100) - (t_from // 100 * 12 + t_from % 100)


def consistency_checks(econs, hub, trade, tf, board, world, latest_q, lender_total, replay, stress_eco, stress_idx, pairs,
                       max_lag, tables_at_start, vintages_read, out_dir) -> list[dict]:
    """K1, K2, K3 and K8 as this build can run them. Each returns status pass, fail (the build stops) or wait (the check
    needs an upstream change that has not arrived; it is printed and kept in the log, and it does not stop the build)."""
    out = []
    qm = int(latest_q[:4]) * 100 + int(latest_q[5:7])
    # K1: every growth field's base window ends exactly 12 months before its window, and the value is that ratio,
    # recomputed from trade-flow's 12-month node series by month lookup (not by list position)
    nw = tf.nodes_w12()
    pos = {t: k for k, t in enumerate(nw["t"])}
    bad, n = [], 0
    for e in econs + [hub]:
        tr = trade[e]
        j = nw["ids"].index(tf.idx[e]) if tf.idx[e] in nw["ids"] else None
        for k, t in enumerate(tr["t"]):
            for key, side in (("mom_x", "x"), ("mom_m", "m")):
                v = tr[key][k]
                if v is None:
                    continue
                n += 1
                base = tr["mom_base"][k]
                if base != month_add(t, -12):
                    bad.append(f"{e} {key} {t}: base {base}")
                    continue
                if j is None or base not in pos:
                    bad.append(f"{e} {key} {t}: base window {base} not in trade-flow's series")
                    continue
                a, b_ = nw[side][j][pos[t]], nw[side][j][pos[base]]
                ref = R(100 * (a / b_ - 1), 1) if a is not None and b_ else None
                if ref is None or abs(ref - v) > 0.051:
                    bad.append(f"{e} {key} {t}: {v} against {ref} from trade-flow")
        aq = tr.get("at_q")
        if aq and aq["mom_x"] is not None and aq["base"] != month_add(aq["t"], -12):
            bad.append(f"{e} at_q base {aq['base']}")
    out.append({"id": "K1", "status": "fail" if bad else "pass", "en": "Every growth figure compares a window with the window ending exactly 12 months earlier (month arithmetic), and equals trade-flow's series",
                "ko": "", "figure": f"{n} growth values, {len(bad)} off" + (f": {'; '.join(bad[:5])}" if bad else ""), "detail": {"n": n, "bad": bad[:50]}})
    # K2: the same measure for the same economy and period has the same value here as in the parent that publishes it
    mf_rows = {}
    cols = world["board"]["cols"]
    for r in world["board"]["q"].get(latest_q, {}).get("rows", []):
        mf_rows[r[cols.index("eco")]] = dict(zip(cols, r))
    bad, notes, n = [], [], 0
    waits = []
    for e in [x for x in K2_SAMPLE if x in trade]:
        tr = trade[e]
        j = nw["ids"].index(tf.idx[e]) if tf.idx[e] in nw["ids"] else None
        for label, t, v in (("goods exports, sheet window", tr["now"]["t"], tr["now"]["x_bn"]),
                            ("goods exports, window at the quarter", (tr.get("at_q") or {}).get("t"), (tr.get("at_q") or {}).get("x_bn"))):
            if t is None or v is None:
                continue
            n += 1
            ref = nw["x"][j][pos[t]] / 1e9 if j is not None and t in pos and nw["x"][j][pos[t]] is not None else None
            if ref is None or abs(ref - v) > 0.06:
                bad.append(f"{e} {label} {t}: {v} here, {R(ref, 2)} in trade-flow")
        if e == hub or e not in board:
            continue
        b = board[e]
        k = b["q"].index(latest_q) if latest_q in b["q"] else None
        row = mf_rows.get(e)
        if k is None or row is None:
            continue
        n += 1
        if b["loans"][k] != row.get("loans"):
            bad.append(f"{e} bank loans {latest_q}: {b['loans'][k]} here, {row.get('loans')} on money-flow's board")
        if lender_total.get(e) and row.get("loans") and abs(lender_total[e] / row["loans"] - 1) > PAIR_TOL:
            bad.append(f"{e} bank loans {latest_q}: BIS:5A {lender_total[e]} in links against the board's {row['loans']}")
        rp = (replay["econ"].get(e) or {})
        if "res_net_raw" in row:
            n += 1
            if rp.get("net_reserves") != row["res_net_raw"]:
                bad.append(f"{e} net reserves {latest_q}: {rp.get('net_reserves')} here, {row['res_net_raw']} on money-flow's board")
        else:
            waits.append(e)
    status = "fail" if bad else ("wait" if waits else "pass")
    out.append({"id": "K2", "status": status, "en": "Goods exports at a window equal trade-flow's series at that window; bank loans and net reserves at the quarter equal money-flow's board (sample of economies)",
                "ko": "", "figure": f"{n} values for {len([x for x in K2_SAMPLE if x in trade])} economies, {len(bad)} off" + (f": {'; '.join(bad[:5])}" if bad else "")
                + (f"; net reserves wait for money-flow's res_net_raw column ({len(waits)} economies not compared)" if waits else ""),
                "detail": {"sample": list(K2_SAMPLE), "bad": bad, "wait": waits}})
    # K3: every joint value pairs a quarter with the 12-month window ending in its last month, or up to max_lag months
    # earlier and then marked partial (rule C2)
    bad, n = [], 0

    def c2(what, q, t, partial):
        nonlocal n
        n += 1
        if t is None:
            return
        qmm = int(q[:4]) * 100 + int(q[5:7])
        lag = months_between(t, qmm)
        if lag < 0 or lag > max_lag:
            bad.append(f"{what} {q}: window to {t} ({lag} months)")
        elif partial is not None and bool(partial) != (lag > 0):
            bad.append(f"{what} {q}: window to {t} lag {lag} but partial={partial}")
    for e in econs + [hub]:
        aq = trade[e].get("at_q")
        if aq:
            c2(f"{e} exports/imports at the quarter", aq["q"], aq["t"], aq["partial"])
        rp = replay["econ"].get(e)
        if rp and rp.get("imports_12m") is not None:
            c2(f"{e} replay imports", rp["q"], rp["imports_window_to"], rp["imports_partial"])
        se = stress_eco.get(e)
        if se:
            g = stress_idx["grid"][e]
            for i, q in enumerate(se["q"]):
                if se["inputs"]["t"][i] is not None:
                    c2(f"{e} stress inputs", q, se["inputs"]["t"][i], (se["inputs"]["lag"][i] or 0) > 0)
                    if g["tm"][i] is not None and (g["tm"][i] != se["inputs"]["t"][i] or (g["lag"][i] or 0) != (se["inputs"]["lag"][i] or 0)):
                        bad.append(f"{e} stress grid {q}: window {g['tm'][i]} lag {g['lag'][i]} against the inputs' {se['inputs']['t'][i]} lag {se['inputs']['lag'][i]}")
            p = se.get("partners")
            if p:
                c2(f"{e} stress partners", p["q"], p["t"], None)
    # pair goods are a window, not a join; the finance-to-trade ratio's join is checked on the history files
    for f in sorted((out_dir / "pairs").glob("*.json.br")):
        h = rd_br(f)
        tset = set(h["goods"]["t"])
        rt = h["ratio"]
        for i, (q, v) in enumerate(zip(rt["q"], rt["v"])):
            if v is None:
                continue
            for side in ("t_ab", "t_ba"):
                t_ = rt[side][i]
                c2(f"pair {f.name} ratio goods {side}", q, t_, None)
                if t_ not in tset:
                    bad.append(f"pair {f.name} ratio {q}: goods window {t_} not among the windows")
            qmm = int(q[:4]) * 100 + int(q[5:7])
            if bool(rt["partial"][i]) != (rt["t_ab"][i] != qmm or rt["t_ba"][i] != qmm):
                bad.append(f"pair {f.name} ratio {q}: partial flag wrong")
    out.append({"id": "K3", "status": "fail" if bad else "pass", "en": "Every joint value pairs a quarter with the 12-month window ending in its last month, or up to 6 months earlier marked partial (rule C2)",
                "ko": "", "figure": f"{n} joint values, {len(bad)} outside the rule" + (f": {'; '.join(bad[:5])}" if bad else ""), "detail": {"n": n, "bad": bad[:50], "max_lag": max_lag}})
    # K8: the money-flow tables read are the ones hashed when the build began, and the products file is from the
    # trade-flow build of the windows (the build already refused another one)
    bad = []
    for t_, h in tables_at_start.items():
        now_h = sha256_file(MF_TABLES / t_)
        if now_h != h or vintages_read["tables"][t_]["sha256"] != h:
            bad.append(f"{t_} changed during the build")
    if vintages_read["products"]["trade_flow_built"] != utc(tf.meta["built_at"]):
        bad.append("products.json.br from another trade-flow build")
    out.append({"id": "K8", "status": "fail" if bad else "pass", "en": "The money-flow tables read match their hashes from the start of the build; the products file is from the same trade-flow build as the windows",
                "ko": "", "figure": "; ".join(bad) if bad else f"links {vintages_read['tables']['links.parquet']['sha256'][:12]}, signals {vintages_read['tables']['signals.parquet']['sha256'][:12]}, products of trade-flow {vintages_read['products']['trade_flow_built']}",
                "detail": {"tables": vintages_read["tables"], "products": vintages_read["products"], "bad": bad}})
    return out


def main() -> None:
    global EPISODES, GLOBAL_WINDOWS, OUT_OF_SCOPE, PRE, THRESHOLD
    print("global-network build")
    # the money-flow tables as they were when this build began; K8 compares them again at the end
    tables_at_start = {t_: sha256_file(MF_TABLES / t_) for t_ in ("links.parquet", "signals.parquet")}
    mf = Money()
    world = mf.need("world/global")
    mf_meta = mf.need("meta")
    quarters, board = board_series(world)
    econs = world["board"]["set"]["in"]
    latest_q = quarters[-1]
    euro = {e: d for e, d in world["board"]["set"]["euro"]} if isinstance(world["board"]["set"]["euro"], list) else world["board"]["set"]["euro"]
    advanced = set(world["board"]["groups"]["advanced"])
    print(f"  money-flow surface {mf.surface['surface']}: release {mf.tag}, method {mf.surface.get('method', mf.man.get('method'))}, "
          f"latest quarter {latest_q}, {len(econs)} economies")
    # the validation set, published by money-flow (its episodes/global view) instead of being copied here
    ep_view = mf.need("episodes/global")
    EPISODES = ep_view["episodes"]
    GLOBAL_WINDOWS = [tuple(w) for w in ep_view["global_windows"]]
    OUT_OF_SCOPE = {e: tuple(v) for e, v in ep_view["out_of_scope"].items()}
    PRE = int(ep_view.get("pre", PRE))
    THRESHOLD = float(ep_view.get("threshold", THRESHOLD))
    replay_quarters = [(eid, q) for eid, q in REPLAYS if eid in EPISODES]
    if len(replay_quarters) < len(REPLAYS):
        print(f"  note: S1 replay quarters dropped (episode not in money-flow's set): {[x for x in REPLAYS if x[0] not in EPISODES]}")
    print(f"  episodes/global: {len(EPISODES)} episodes, {sum(len(e['eco']) for e in EPISODES.values())} economy-episodes, pre {PRE}, threshold {THRESHOLD:g}")
    earn_view = mf.need("earn/global")
    money_changes = mf.need("changes/global")
    mf_checks = mf.view("checks")
    lap("money-flow read")

    tf = Trade()
    shown = tf.shown_m
    print(f"  trade-flow surface {tf.surface['surface']}: built {str(tf.surface.get('built', tf.meta['built_at']))[:10]}, shown month {shown}, complete year {tf.complete_a}")
    names = {}
    for e in econs + [HUB]:
        n = tf.nodes[tf.idx[e]]
        names[e] = {"en": n["en"], "ko": n["ko"], "region": n["region"], "subregion": n["subregion"]}

    # ---- trade per economy: 12-month windows (W12), annual, latest snap row and partners
    nw = tf.nodes_w12()
    na = tf.nodes_a()
    w_t = nw["t"]
    a_t = na["t"]
    _ctx = {}

    def snap_ctx(t: int) -> dict:
        """One 12-month snapshot indexed for lookups: node rows, edges by exporter and importer, a year-earlier edge map."""
        if t in _ctx:
            return _ctx[t]
        s = tf.snap_w12(t)
        nc = {c: i for i, c in enumerate(s["ncols"])}
        ec = {c: i for i, c in enumerate(s["ecols"])}
        by_s, by_t = defaultdict(list), defaultdict(list)
        for e in s["edges"]:
            by_s[e[ec["s"]]].append(e)
            by_t[e[ec["t"]]].append(e)
        prev = tf.snap_w12(month_add(t, -12))
        _ctx[t] = {"t": t, "nc": nc, "ec": ec, "world": s["world"], "rows": {r[nc["i"]]: r for r in s["nodes"]}, "by_s": by_s, "by_t": by_t,
                   "prev_edge": {(e[0], e[1]): e for e in prev["edges"]}, "prev_world": prev["world"]}
        return _ctx[t]

    snap = snap_ctx(shown)
    nc, ec, world_usd = snap["nc"], snap["ec"], snap["world"]
    node_rows, edges_by_s, edges_by_t = snap["rows"], snap["by_s"], snap["by_t"]
    prev_edge, prev_world = snap["prev_edge"], snap["prev_world"]
    COMPLETE = 0.9  # trade-flow's rule: an economy's line stops where its completeness is below 0.9

    # commodity share of exports (HS 25-27 over TOTAL), the last complete year
    hs = {}
    for ch in ("HS-25", "HS-26", "HS-27"):
        try:
            hs[ch] = tf.nodes_a(ch)
        except FileNotFoundError:
            pass
    ya = a_t.index(tf.complete_a)

    def ser_val(d: dict, iso: str, k: int, which="x"):
        i = tf.idx[iso]
        if i not in d["ids"]:
            return None
        j = d["ids"].index(i)
        return d[which][j][k]

    cutoff_k = w_t.index(shown)
    trade = {}
    partner_seen: dict[str, dict] = {}   # every partner node on a sheet, for its name and whether it is an economy
    for e in econs + [HUB]:
        i = tf.idx[e]
        j = nw["ids"].index(i) if i in nw["ids"] else None
        c_raw = nw["c"][j][: cutoff_k + 1] if j is not None else []
        ok = [v is not None and v >= COMPLETE for v in c_raw]
        x = [v if o else None for v, o in zip(nw["x"][j][: cutoff_k + 1], ok)] if j is not None else []
        m = [v if o else None for v, o in zip(nw["m"][j][: cutoff_k + 1], ok)] if j is not None else []
        c = c_raw
        t = w_t[: cutoff_k + 1]
        # the economy's own shown month: the last window at or before the world's shown month that is complete for it
        own_k = max((k for k, o in enumerate(ok) if o), default=None)
        own_t = t[own_k] if own_k is not None else shown
        sc = snap_ctx(own_t) if own_t != shown else snap
        nc, ec, world_usd = sc["nc"], sc["ec"], sc["world"]
        node_rows, edges_by_s, edges_by_t, prev_edge, prev_world = sc["rows"], sc["by_s"], sc["by_t"], sc["prev_edge"], sc["prev_world"]
        row = node_rows.get(i)
        # growth over the year (registry goods_trade_growth): the 12-month sum against the window ending
        # exactly twelve months earlier, found by month arithmetic (the W12 list skips January, so a position k - 12 is
        # 13 or 14 months back); null where either window is incomplete
        ti = {tt: kk for kk, tt in enumerate(t)}

        def mom(arr, k):
            kb = ti.get(month_add(t[k], -12))
            if kb is None or not arr[kb] or arr[k] is None:
                return None
            return R(100 * (arr[k] / arr[kb] - 1), 1)
        mom_x = [mom(x, k) for k in range(len(x))]
        mom_m = [mom(m, k) for k in range(len(m))]
        mom_base = [month_add(t[k], -12) if (mom_x[k] is not None or mom_m[k] is not None) else None for k in range(len(t))]
        dests, sups = [], []
        for ed in sorted(edges_by_s[i], key=lambda z: -z[ec["w"]])[:8]:
            p = prev_edge.get((ed[0], ed[1]))
            pn = tf.nodes[ed[ec["t"]]]
            partner_seen[pn["id"]] = pn
            dests.append({"p": pn["id"], "eco": node_is_economy(pn), "usd": R(ed[ec["w"]] * world_usd / 1e9, 1),
                          "share": R(100 * ed[ec["w"]] / row[nc["x"]], 1) if row and row[nc["x"]] else None,
                          "mr": R(ed[ec["mr"]], 2) if ed[ec["mr"]] is not None else None, "src": ed[ec["src"]], "est": ed[ec["est"]], "dv": ed[ec["dv"]],
                          "yoy": R(100 * (ed[ec["w"]] * world_usd / (p[ec["w"]] * prev_world) - 1), 1) if p else None})
        for ed in sorted(edges_by_t[i], key=lambda z: -z[ec["w"]])[:8]:
            p = prev_edge.get((ed[0], ed[1]))
            pn = tf.nodes[ed[ec["s"]]]
            partner_seen[pn["id"]] = pn
            sups.append({"p": pn["id"], "eco": node_is_economy(pn), "usd": R(ed[ec["w"]] * world_usd / 1e9, 1),
                         "share": R(100 * ed[ec["w"]] / row[nc["m"]], 1) if row and row[nc["m"]] else None,
                         "mr": R(ed[ec["mr"]], 2) if ed[ec["mr"]] is not None else None, "src": ed[ec["src"]], "est": ed[ec["est"]], "dv": ed[ec["dv"]],
                         "yoy": R(100 * (ed[ec["w"]] * world_usd / (p[ec["w"]] * prev_world) - 1), 1) if p else None})
        tot_x = ser_val(na, e, ya, "x")
        com = sum((ser_val(hs[ch], e, hs[ch]["t"].index(tf.complete_a), "x") or 0) for ch in hs) if hs and tot_x else None
        trade[e] = {
            "t": t, "x": [R(v / 1e9, 2) if v is not None else None for v in x], "m": [R(v / 1e9, 2) if v is not None else None for v in m], "c": [R(v, 2) for v in c],
            "mom_x": mom_x, "mom_m": mom_m, "mom_base": mom_base,
            "annual": {"t": a_t, "x": [R(v / 1e9, 1) if v else None for v in (na["x"][na["ids"].index(i)] if i in na["ids"] else [])],
                        "m": [R(v / 1e9, 1) if v else None for v in (na["m"][na["ids"].index(i)] if i in na["ids"] else [])]},
            # the 12-month totals from trade-flow's node series (the measure goods_exports_partner / goods_imports_own as
            # trade-flow publishes it, K2), not share x world from the snapshot, whose rounded shares differ by up to 0.1%
            "now": {"t": own_t, "x_bn": R(nw["x"][j][own_k] / 1e9, 1) if own_k is not None else None, "m_bn": R(nw["m"][j][own_k] / 1e9, 1) if own_k is not None else None,
                    "x_share": R(100 * row[nc["x"]], 2) if row else None, "m_share": R(100 * row[nc["m"]], 2) if row else None,
                    "hs": R(row[nc["hs"]], 3) if row else None, "hm": R(row[nc["hm"]], 3) if row else None,
                    "ts": tf.nodes[row[nc["ts"]]]["id"] if row and row[nc["ts"]] >= 0 else None, "tss": R(100 * row[nc["tss"]], 1) if row else None,
                    "od": row[nc["od"]] if row else None, "id": row[nc["id"]] if row else None, "reported": row[nc["r"]] if row else None,
                    "est": row[nc["est"]] if row else None, "pv": R(row[nc["pv"]], 4) if row else None, "c": R(c_raw[own_k], 2) if own_k is not None else None},
            "dests": dests, "sups": sups,
            "commodity_share": R(100 * com / tot_x, 1) if com is not None and tot_x else None, "commodity_year": tf.complete_a,
        }

    products = build_products(trade, econs + [HUB], tf)
    for e in econs + [HUB]:
        trade[e]["products"] = products["econ"][e]

    # ---- the window joined at the funding quarter: the 12-month window ending in the board quarter's last
    # month, or the newest complete one up to trade_max_lag months earlier, marked partial; the stress signals read the
    # same rule (stress.py tw), so a number joined with the board quarter is never the newest window by accident
    max_lag = int(yaml.safe_load((HERE / "config" / "stress.yaml").read_text())["trade_max_lag"])

    def window_at(e: str, q: str) -> dict | None:
        tr = trade[e]
        ti = {tt: kk for kk, tt in enumerate(tr["t"])}
        tm = int(q[:4]) * 100 + int(q[5:7])
        for lag in range(max_lag + 1):
            k = ti.get(month_add(tm, -lag))
            if k is not None and tr["x"][k] is not None and tr["m"][k] is not None:
                return {"q": q, "t": tr["t"][k], "lag": lag, "partial": lag > 0, "x_bn": R(tr["x"][k], 1), "m_bn": R(tr["m"][k], 1),
                        "mom_x": tr["mom_x"][k], "mom_m": tr["mom_m"][k], "base": tr["mom_base"][k]}
        return None
    for e in econs + [HUB]:
        trade[e]["at_q"] = window_at(e, latest_q)

    # ---- partner names: every partner node on a sheet, with whether it is an economy; partner 490's node takes
    # the registry's name (asia_nes), never Taiwan's
    registry = json.loads(MEASURES.read_text()) if MEASURES.exists() else {"measures": {}}
    if not MEASURES.exists():
        print(f"  note: no measures registry at {MEASURES}; partner 490 keeps trade-flow's node name")
    asia_name = (registry["measures"].get("asia_nes") or {}).get("name") or {}
    for n in tf.nodes:
        if not node_is_economy(n):
            partner_seen.setdefault(n["id"], n)
    partner_names = {}
    for pid, pn in sorted(partner_seen.items()):
        nes = node_is_asia_nes(pn)
        nm = {"en": asia_name.get("en") or pn["en"], "ko": asia_name.get("ko") or pn.get("ko") or ""} if nes else {"en": pn["en"], "ko": pn.get("ko") or ""}
        partner_names[pid] = {**nm, "economy": node_is_economy(pn), **({"measure": "asia_nes"} if nes else {})}
    non_eco = sorted(p for p, v in partner_names.items() if not v["economy"])
    print(f"  partners: {len(partner_names)} partner nodes named, {len(non_eco)} not economies"
          + (f" ({', '.join(p for p in non_eco if partner_names[p].get('measure'))} = asia_nes)" if any(partner_names[p].get('measure') for p in non_eco) else "; partner 490 has no node of its own in this trade-flow build"))
    lap("trade windows and products")

    # ---- chains: chokepoints of the last complete year, and each economy's position in them
    chains_idx = rd_br(TF_DATA / "chains" / "index.json.br")["chains"]
    chains = []
    stage_names: dict[str, dict[str, dict]] = {}
    for ch in chains_idx:
        cj = rd_br(TF_DATA / "chains" / f"{ch['id']}.json.br")
        stage_names[ch["id"]] = {s["key"]: {"en": s["en"], "ko": s["ko"]} for s in cj["stages"]}
        year = str(ch["year"])
        cp = cj["chokepoint"].get(year)
        st = next((s for s in cj["stages"] if s["key"] == cp), None) if cp else None
        yv = st["years"].get(year) if st else None
        econ_rows = {}
        if st:
            er = rd_br(TF_DATA / "econ" / ch["id"] / f"{year}.json.br")
            cols = er["cols"]
            for r in er["stages"].get(cp, []):
                econ_rows[tf.nodes[r[cols.index("i")]]["id"]] = {"x": R(100 * r[cols.index("x")], 2), "m": R(100 * r[cols.index("m")], 2),
                                                                    "ts": tf.nodes[r[cols.index("ts")]]["id"] if r[cols.index("ts")] is not None and r[cols.index("ts")] >= 0 else None,
                                                                    "tss": R(100 * r[cols.index("tss")], 1) if r[cols.index("tss")] is not None else None}
        chains.append({
            "id": ch["id"], "en": ch["en"], "ko": ch["ko"], "year": ch["year"], "levels": ch["levels"],
            "chokepoint": None if not st else {
                "key": cp, "en": st["en"], "ko": st["ko"], "stage": st["stage"], "hhi": R(yv["hhi"], 3), "world_bn": R(yv["world"] / 1e9, 1),
                "top_exporters": [[tf.nodes[n]["id"], R(100 * s, 1)] for n, s in yv["top_exporters"][:8]],
                "top_importers": [[tf.nodes[n]["id"], R(100 * s, 1)] for n, s in yv["top_importers"][:8]],
                "econ": {e: econ_rows[e] for e in econ_rows if e in names},
            },
            "history": {y: k for y, k in cj["chokepoint"].items() if k},
        })
    # ---- world trade series (pulse)
    # world trade momentum: the 3-month window against the 3-month window ending exactly 12 months earlier, on
    # trade-flow's one monthly rule (W; the M-lens series is retired)
    scols, srows = tf.series_w3()
    si = {c: i for i, c in enumerate(scols)}
    wrows = [r for r in srows if r[si["t"]] <= shown]
    by_t = {r[si["t"]]: r for r in wrows}
    world_mom = []
    for k, r in enumerate(wrows):
        prev = by_t.get(month_add(r[si["t"]], -12))
        world_mom.append([r[si["t"]], R(100 * (r[si["world"]] / prev[si["world"]] - 1), 1) if prev else None, R(r[si["cmp"]], 2), r[si["reporters"]]])
    wcols, w12rows = tf.series_w12()
    wi = {c: i for i, c in enumerate(wcols)}
    world_w12 = [[r[wi["t"]], R(r[wi["world"]] / 1e12, 3), R(r[wi["hhi"]], 4), R(r[wi["top1"]], 4), R(r[wi["cmp"]], 2), r[wi["dv"]], R(r[wi["est"]], 3)] for r in w12rows if r[wi["t"]] <= shown]

    # ---- events
    ev = yaml.safe_load((TF / "config" / "events.yaml").read_text())["events"]
    # trade-flow's events index carries `replay` per event, read back from this site's surface.json (the family link
    # trade-flow event -> global-network replay appears only when the replay exists)
    ev_index = tf.file("events/index.json.br") if (TF_DATA / "events" / "index.json.br").exists() else {"events": []}
    ev_flag = {e["id"]: bool(e.get("replay", False)) for e in ev_index.get("events", [])}
    events = [{"id": e["id"], "num": str(e.get("num")), "start": str(e["start"]), "end": str(e["end"]) if e.get("end") else None,
               "en": e["title"]["en"], "ko": e["title"]["ko"], "dek": {"en": e["dek"]["en"], "ko": e["dek"]["ko"]} if isinstance(e.get("dek"), dict) else None,
               "economies": e.get("economies", []), "products": e.get("products", []), "replay": ev_flag.get(e["id"], False)} for e in ev]

    # ---- money per economy: reserves, border totals (no commercial data, G9)
    money = {}
    for e in econs:
        v = mf.view(f"econ/{e}")
        if not v:
            continue
        made = v.get("made", {})
        border = v.get("border", {})
        money[e] = {
            "fx_reserves": made.get("fx_reserves", {}).get("pts", [])[-104:] if made.get("fx_reserves") else None,
            "broad_money": made.get("broad_money", {}).get("pts", [])[-1] if made.get("broad_money") else None,
            "iip": {"in": border.get("in", {}).get("iip", {}).get("total", [])[-1:], "out": border.get("out", {}).get("iip", {}).get("total", [])[-1:],
                    "net": border.get("net", [])[-1:], "reserves": border.get("out", {}).get("iip", {}).get("reserves", [])[-1:]},
            "bop_in": {k: border.get("in", {}).get("bop", {}).get(k, [])[-8:] for k in ("portfolio", "direct", "other")},
            "vintage": border.get("vintage"),
        }

    # ---- links: pairs among the 36 + hub, and the lender matrix
    con = duckdb.connect()
    links = str(MF_TABLES / "links.parquet")
    set_sql = ",".join(f"'{e}'" for e in econs + [HUB])
    pairs = defaultdict(dict)
    # bank loans and deposits (LBS), creditor -> debtor, latest quarter, all sectors and currencies
    q = con.sql(f"""
        select creditor, debtor, position_usd, flow_usd, flow_kind, period from '{links}'
        where dataset='bis.LBS' and channel='bank_loans' and sector_debtor='all' and currency='all' and basis='residence'
          and period = (select max(period) from '{links}' where dataset='bis.LBS' and channel='bank_loans')
          and creditor in ({set_sql}) and debtor in ({set_sql})""").fetchall()
    bank_q = None
    for c_, d_, pos, fl, fk, per in q:
        bank_q = per.isoformat()
        pairs[f"{c_}>{d_}"]["bank"] = {"pos": R(pos, 1), "flow": R(fl, 1), "kind": fk, "per": per.isoformat()}
    # portfolio (PIP, holder -> issuer), newest period, half-yearly row preferred
    q = con.sql(f"""
        with p as (select creditor, debtor, channel, position_usd, period, freq from '{links}'
          where dataset='imf.PIP' and sector_debtor='all' and currency='all' and creditor in ({set_sql}) and debtor in ({set_sql})
          and period = (select max(period) from '{links}' where dataset='imf.PIP'))
        select creditor, debtor, channel, position_usd, period from p qualify row_number() over (partition by creditor, debtor, channel order by freq desc) = 1""").fetchall()
    port_q = None
    for c_, d_, ch, pos, per in q:
        port_q = per.isoformat()
        pairs[f"{c_}>{d_}"].setdefault("portfolio", {})[ch] = R(pos, 1)
        pairs[f"{c_}>{d_}"]["portfolio"]["per"] = per.isoformat()
    # direct investment (DIP, investor -> host), newest annual, one report per pair in R4's order
    q = con.sql(f"""
        with d as (select creditor, debtor, position_usd, reported_by, period from '{links}'
          where dataset='imf.DIP' and channel='fdi' and creditor in ({set_sql}) and debtor in ({set_sql})
          and period = (select max(period) from '{links}' where dataset='imf.DIP'))
        select creditor, debtor, position_usd, reported_by, period from d
        qualify row_number() over (partition by creditor, debtor order by case reported_by when 'debtor' then 0 when 'creditor' then 1 when 'mirror_debtor' then 2 else 3 end) = 1""").fetchall()
    fdi_q = None
    for c_, d_, pos, rep, per in q:
        fdi_q = per.isoformat()
        pairs[f"{c_}>{d_}"]["fdi"] = {"pos": R(pos, 1), "rep": rep, "per": per.isoformat()}
    # goods, exporter -> importer (backbone flows only), from the exporter's own window: the snapshot of the month its
    # country sheet shows (the sheet's rule, an economy below 0.9 completeness at the shown month uses its own
    # last complete window), taken explicitly from that month's snapshot context; `own` marks a window before the shown
    # month, so the pair says which window each direction is
    for e in econs + [HUB]:
        i = tf.idx[e]
        sc = snap_ctx(trade[e]["now"]["t"])
        ecx = sc["ec"]
        for ed in sc["by_s"][i]:
            d_ = tf.nodes[ed[ecx["t"]]]["id"]
            if d_ in names:
                pairs[f"{e}>{d_}"]["goods"] = {"usd": R(ed[ecx["w"]] * sc["world"] / 1e9, 1), "mr": R(ed[ecx["mr"]], 2) if ed[ecx["mr"]] is not None else None,
                                               "src": ed[ecx["src"]], "est": ed[ecx["est"]], "dv": ed[ecx["dv"]], "per": sc["t"], "own": sc["t"] != shown}
    # lender matrix (S4): every LBS reporting creditor -> each board debtor, latest quarter
    q = con.sql(f"""
        select creditor, debtor, position_usd, period from '{links}'
        where dataset='bis.LBS' and channel='bank_loans' and sector_debtor='all' and currency='all' and basis='residence'
          and period = (select max(period) from '{links}' where dataset='bis.LBS' and channel='bank_loans')
          and debtor in ({",".join(f"'{e}'" for e in econs)}) and position_usd is not null and position_usd > 0.05""").fetchall()
    lenders = defaultdict(dict)
    lender_total: dict[str, float] = {}   # BIS:5A, all reporters, at the same quarter: the denominator of lender shares (J7)
    lend_q = None
    for c_, d_, pos, per in q:
        lend_q = per.isoformat()
        if c_ == "BIS:5A":
            lender_total[d_] = R(pos, 2)
        if ":" in c_:  # BIS aggregates (all reporters) are totals, never lenders (R11)
            continue
        lenders[d_][c_] = R(pos, 1)
    # a lender share divides a position by the all-reporter total of the same quarter, and the sheet shows it
    # under the board's quarter; a links table at another quarter than the board is a mismatch, and the build stops
    if lend_q != latest_q:
        sys.exit(f"links.parquet's newest BIS LBS quarter is {lend_q}, money-flow's board quarter is {latest_q}: lender shares would join "
                 f"two quarters. Rebuild money-flow's tables for its release, then build again.")

    # ---- dollar channel (E2): quarterly dollar index (period average) and export growth two quarters later
    sig = str(MF_TABLES / "signals.parquet")
    di = con.sql(f"select date_trunc('quarter', period) as q, avg(value_usd) from '{sig}' where measure='dollar_index' group by 1 order by 1").fetchall()
    dollar = {}
    for qd, v in di:
        dollar[qend_str(qd)] = v
    pulse_day = str(mf_meta.get("day") or "9999")
    dq = [q for q in sorted(dollar) if q <= pulse_day]  # the running quarter is a partial average; leave it out
    dollar_yoy = {q: R(100 * (dollar[q] / dollar[qshift(q, -4)] - 1), 2) for q in dq if qshift(q, -4) in dollar}
    # export growth at quarter ends from the W12 series (12-month sum y/y at the quarter's last month)
    def export_growth(e: str) -> dict[str, float]:
        tr = trade[e]
        out = {}
        for k, t in enumerate(tr["t"]):
            if t % 100 in (3, 6, 9, 12) and tr["mom_x"][k] is not None:
                out[qend_str(dt.date(t // 100, t % 100, 1))] = tr["mom_x"][k]
        return out

    def corr(xs, ys):
        n = len(xs)
        if n < 8:
            return None
        mx, my = sum(xs) / n, sum(ys) / n
        sxx = sum((a - mx) ** 2 for a in xs); syy = sum((b - my) ** 2 for b in ys)
        if sxx == 0 or syy == 0:
            return None
        return sum((a - mx) * (b - my) for a, b in zip(xs, ys)) / math.sqrt(sxx * syy)

    dollar_out = {"dollar_yoy": [[q, dollar_yoy[q]] for q in dq if q in dollar_yoy], "lag": 2, "econ": {}}
    for e in econs:
        g = export_growth(e)
        a1 = dict(zip(board[e]["q"], board[e]["a1"]))
        pts = []
        for q in dq:
            q2 = qshift(q, 2)
            if q in dollar_yoy and q2 in g and q >= "2007-03-31":
                pts.append([q, dollar_yoy[q], g[q2], a1.get(q)])
        dollar_out["econ"][e] = {"pts": pts, "corr": R(corr([p[1] for p in pts], [p[2] for p in pts]), 2),
                                 "a1_mean": R(sum(p[3] for p in pts if p[3] is not None) / max(1, len([p for p in pts if p[3] is not None])), 1)}
    # pooled by A1 tercile of the economy mean
    means = sorted((v["a1_mean"], e) for e, v in dollar_out["econ"].items() if v["a1_mean"] is not None)
    n3 = len(means) // 3
    terciles = {"low": [e for _, e in means[:n3]], "mid": [e for _, e in means[n3:2 * n3]], "high": [e for _, e in means[2 * n3:]]}
    dollar_out["terciles"] = {}
    for k, es in terciles.items():
        xs, ys = [], []
        for e in es:
            for p in dollar_out["econ"][e]["pts"]:
                xs.append(p[1]); ys.append(p[2])
        # slope of export growth on dollar y/y
        c = corr(xs, ys)
        slope = None
        if c is not None:
            mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
            slope = sum((a - mx) * (b - my) for a, b in zip(xs, ys)) / sum((a - mx) ** 2 for a in xs)
        dollar_out["terciles"][k] = {"econ": es, "corr": R(c, 2), "slope": R(slope, 2), "n": len(xs)}

    # ---- validation (E1, q7): AUROC of V and of trade indicators against the named episodes, own-history percentiles
    def labels():
        ev_list = []
        near = defaultdict(set)
        for eid, ep in EPISODES.items():
            for e in ep["eco"]:
                ev_list.append((e, ep["q"], eid))
                for k in range(-PRE - 4, PRE + 5):
                    near[e].add(qshift(ep["q"], k))
        return ev_list, near

    def auroc(pos, neg):
        if not pos or not neg:
            return None
        neg = sorted(neg)
        s = 0.0
        for p in pos:
            lo, hi = bisect.bisect_left(neg, p), bisect.bisect_right(neg, p)
            s += lo + 0.5 * (hi - lo)
        return s / (len(pos) * len(neg))

    def boot(pos, neg, draws=BOOT_DRAWS, level=BOOT_LEVEL):
        """Bootstrap interval of the AUROC over economy-episodes: the positives (one per economy-episode) are redrawn
        with replacement `draws` times against the fixed calm set; the interval is the central `level` %."""
        if not pos or not neg:
            return None, None
        rng = random.Random(BOOT_SEED)
        neg_s = sorted(neg)
        n = len(pos)
        vals = []
        for _ in range(draws):
            sample = [pos[rng.randrange(n)] for _ in range(n)]
            s = 0.0
            for p in sample:
                lo, hi = bisect.bisect_left(neg_s, p), bisect.bisect_right(neg_s, p)
                s += lo + 0.5 * (hi - lo)
            vals.append(s / (n * len(neg_s)))
        vals.sort()
        a = (100 - level) / 200
        return vals[int(a * (draws - 1))], vals[int((1 - a) * (draws - 1))]

    def indicator(iid, en, ko, pos, neg, side):
        lo, hi = boot(pos, neg)
        return {"id": iid, "en": en, "ko": ko, "auroc": R(auroc(pos, neg), 3), "lo": R(lo, 3), "hi": R(hi, 3), "pos": len(pos), "neg": len(neg), "side": side}

    def in_global(q):
        return any(a <= q <= b for a, b in GLOBAL_WINDOWS)

    def score_sets(sc: dict[tuple, float]):
        ev_list, near = labels()
        pos, neg = [], []
        for e, q, _ in ev_list:
            pre = [sc.get((e, qshift(q, -k))) for k in range(PRE, 0, -1)]
            got = [v for v in pre if v is not None]
            if got:
                pos.append(max(got))
        for (e, q), v in sc.items():
            if e in OUT_OF_SCOPE and OUT_OF_SCOPE[e][0] <= q <= OUT_OF_SCOPE[e][1]:
                continue
            if q in near.get(e, set()) or in_global(q):
                continue
            neg.append(v)
        return pos, neg

    def own_pct(series: dict[str, float], min_hist=8) -> dict[str, float]:
        out = {}
        hist = []
        for q in sorted(series):
            v = series[q]
            if v is None:
                continue
            if len(hist) >= min_hist:
                out[q] = 100 * sum(1 for h in hist if h <= v) / len(hist)
            hist.append(v)
        return out

    valid = {"episodes": sum(len(ep["eco"]) for ep in EPISODES.values()), "indicators": [], "interval": {"draws": BOOT_DRAWS, "level": BOOT_LEVEL, "over": "economy-episodes"},
             "set": {"pre": PRE, "threshold": THRESHOLD, "global_windows": GLOBAL_WINDOWS, "out_of_scope": OUT_OF_SCOPE, "source": f"money-flow release {mf.tag}, episodes/global"}}
    v_scores = {(e, q): v for e in econs for q, v in zip(board[e]["q"], board[e]["v"]) if v is not None}
    pos, neg = score_sets(v_scores)
    valid["indicators"].append(indicator("v", f"Vulnerability score V (money-flow method {mf.surface.get('method', mf.man.get('method'))})", "", pos, neg, "money"))
    # trade indicators at quarter ends, own-history percentiles (expanding, so nothing looks ahead)
    def quarterly(e, key, sign=1):
        tr = trade[e]
        out = {}
        for k, t in enumerate(tr["t"]):
            if t % 100 in (3, 6, 9, 12):
                v = tr[key][k]
                if v is not None:
                    out[qend_str(dt.date(t // 100, t % 100, 1))] = sign * v
        return out
    for key, sign, en, ko in (("mom_x", -1, "Export momentum, inverted (12-month exports against a year earlier)", "수출 모멘텀 역부호 (12개월 수출의 전년 대비)"),
                              ("mom_m", -1, "Import momentum, inverted", "수입 모멘텀 역부호")):
        sc = {}
        for e in econs:
            for q, p in own_pct(quarterly(e, key, sign)).items():
                sc[(e, q)] = p
        pos, neg = score_sets(sc)
        valid["indicators"].append(indicator(key, en, ko, pos, neg, "trade"))
    # market concentration (hm) needs the monthly snaps at quarter ends: read the w12 snaps' node rows
    hm_q = defaultdict(dict)
    for year in range(2007, shown // 100 + 1):
        try:
            f = rd_br(TF_DATA / "snap" / "W" / "TOTAL" / f"{year}.w12.json.br")
        except FileNotFoundError:
            continue
        ncs = {c: i for i, c in enumerate(f["ncols"])}
        for s in f["snaps"]:
            if s["t"] > shown or s["t"] % 100 not in (3, 6, 9, 12):
                continue
            qs = qend_str(dt.date(s["t"] // 100, s["t"] % 100, 1))
            for r in s["nodes"]:
                e = tf.nodes[r[ncs["i"]]]["id"]
                if e in names:
                    hm_q[e][qs] = r[ncs["hm"]]
    sc = {}
    for e in econs:
        for q, p in own_pct(hm_q.get(e, {})).items():
            sc[(e, q)] = p
    pos, neg = score_sets(sc)
    valid["indicators"].append(indicator("hm", "Export market concentration (HHI of destinations)", "수출 시장 집중도 (수출처 HHI)", pos, neg, "trade"))
    # combined: V and inverted export momentum, equal weights
    mom_sc = {}
    for e in econs:
        for q, p in own_pct(quarterly(e, "mom_x", -1)).items():
            mom_sc[(e, q)] = p
    comb = {k: 0.5 * v + 0.5 * mom_sc[k] for k, v in v_scores.items() if k in mom_sc}
    pos, neg = score_sets(comb)
    valid["indicators"].append(indicator("v_mom", "V and inverted export momentum, equal weights", "V와 수출 모멘텀 역부호의 등가중 평균", pos, neg, "both"))

    # ---- what changed (E3): the parents publish their own change items (money-flow changes/global at release, trade-flow
    # changes.json.br at build; rule R20, never recomputed here); this site merges them and adds the joint kinds only it
    # can see: funding left while exports fell; a chokepoint moved while a lender withdrew from a top exporter of it
    prev_q = money_changes.get("prev") or (quarters[-2] if len(quarters) > 1 else None)
    mq = money_changes.get("q")
    if mq and mq != latest_q:
        print(f"  note: money-flow changes/global is for {mq}; the board's latest quarter is {latest_q}")
    trade_changes = tf.file("changes.json.br")
    m_items = [dict(c, side="money") for c in money_changes.get("items", [])]
    t_items = [dict(c, side="trade") for c in trade_changes.get("items", [])]
    chain_by_id = {ch["id"]: ch for ch in chains}
    for c in t_items:  # stage and chain names for chokepoint moves where trade-flow sends keys only
        if c.get("kind") == "chokepoint":
            sn = stage_names.get(c.get("chain"), {})
            c.setdefault("from_name", sn.get(c.get("from") or "", None))
            c.setdefault("to_name", sn.get(c.get("to") or "", None))
            ch_ = chain_by_id.get(c.get("chain"))
            if ch_ and not c.get("chain_name"):
                c["chain_name"] = {"en": ch_["en"], "ko": ch_["ko"]}
    neg_flow = {c["eco"]: c for c in m_items if c.get("kind") == "flow_sign" and c.get("flow") and c["flow"][1] is not None and c["flow"][1] < 0}
    neg_exp = {c["eco"]: c for c in t_items if c.get("kind") == "export_sign" and c.get("mom") and c["mom"][1] is not None and c["mom"][1] < 0}
    joint = []
    for e, fc in neg_flow.items():
        if e in neg_exp:
            joint.append({"eco": e, "side": "both", "kind": "funding_exports", "q": fc.get("q", latest_q), "t": neg_exp[e].get("t"),
                          "flow": fc["flow"], "mom": neg_exp[e]["mom"], "b1": fc.get("b1"), "b2": fc.get("b2")})
    for c in t_items:
        if c.get("kind") != "chokepoint":
            continue
        ch_ = chain_by_id.get(c.get("chain"))
        tops = ch_["chokepoint"]["top_exporters"][:5] if ch_ and ch_.get("chokepoint") else []
        for e, share in tops:
            if e in neg_flow:
                joint.append({**c, "eco": e, "side": "both", "kind": "chokepoint_lender", "q": neg_flow[e].get("q", latest_q), "flow": neg_flow[e]["flow"], "share": share,
                              "stage_name": {"en": ch_["chokepoint"]["en"], "ko": ch_["chokepoint"]["ko"]}})
    changes = joint + m_items + t_items
    print(f"  changes: {len(joint)} joint {sorted({c['kind'] for c in joint}) or ''}, {len(m_items)} money ({prev_q} -> {mq}), {len(t_items)} trade ({trade_changes.get('prev')} -> {trade_changes.get('shown')})")
    top = world["board"]["q"][latest_q]["top"]
    n_out = world["board"]["q"][latest_q]["n_out"]
    lap("validation and changes")

    # ---- replay (S1): withdrawal shares in the replay quarters, per economy
    replay = {"quarters": [], "econ": {}}
    for eid, q in replay_quarters:
        replay["quarters"].append({"episode": eid, "q": q, "en": EPISODES[eid]["en"], "ko": EPISODES[eid]["ko"]})
    for e in econs:
        b = board[e]
        qi = {q: k for k, q in enumerate(b["q"])}
        k = qi.get(latest_q)
        if k is None:
            continue
        rows = []
        for eid, q in replay_quarters:
            j = qi.get(q)
            if j is None or b["stock_prev"][j] in (None, 0) or b["b1"][j] is None or b["b2"][j] is None:
                rows.append({"q": q, "share": None, "b1": None, "b2": None, **({"note": b["flow_note"][j]} if j is not None and b["flow_note"][j] else {})})
                continue
            rows.append({"q": q, "share": R(100 * (b["b1"][j] + b["b2"][j]) / b["stock_prev"][j], 1), "b1": b["b1"][j], "b2": b["b2"][j],
                         "share_bank": R(100 * b["b1"][j] / b["stock_prev"][j], 1), "share_bond": R(100 * b["b2"][j] / b["stock_prev"][j], 1)})
        # imports at the window joined at the quarter (rule C2), not the newest window; net reserves unfloored:
        # the A2 base is kept beside them under its own name and never used as net reserves
        wq = trade[e]["at_q"]
        replay["econ"][e] = {"stock": R((b["ids"][k] or 0) + (b["loans"][k] or 0), 1), "ids": b["ids"][k], "loans": b["loans"][k],
                             "net_reserves": b["res_net_raw"][k], "a2_reserve_base": b["res_net"][k], "a2_floored": b["a2_floored"][k], "res": b["res"][k],
                             "st": b["st"][k], "imports_12m": wq["m_bn"] if wq else None, "imports_window_to": wq["t"] if wq else None,
                             "imports_partial": wq["partial"] if wq else None, "rows": rows, "q": latest_q}

    # ---- write
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("*.json.br"):
        old.unlink()
    for old in OUT.glob("country/*.json.br"):
        old.unlink()
    built = utc(dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"))
    mf_method = str(mf.surface.get("method", mf.man.get("method")))
    # one date format for build dates: UTC with Z. trade-flow's build is its meta.json built_at (the windows'
    # build), which the products file must match; its surface.json was written a few minutes later in KST.
    tf_built = utc(tf.meta["built_at"])
    surfaces = {
        "money": {"release": mf.tag, "method": mf_method, "surface": str(mf.surface["surface"]), "built": utc(mf.surface.get("built")), "files": mf.surface.get("files"), "path": str(MF_SITE / "surface.json")},
        "trade": {"built": tf_built, "surface_written": utc(tf.surface.get("built")), "shown": int(tf.surface.get("shown", shown)), "surface": str(tf.surface["surface"]), "complete_a": tf.surface.get("complete_a", tf.complete_a), "files": tf.surface.get("files"), "path": str(TF_DATA / "surface.json")},
    }
    # vintages of what was read beside the surfaces: money-flow's tables are rewritten between releases
    # (weekly.sh), so each one read is recorded by hash and time; the products file by the trade-flow build it names
    tables = {}
    for tname in ("links.parquet", "signals.parquet"):
        tp = MF_TABLES / tname
        tables[tname] = {"sha256": sha256_file(tp), "modified": utc(dt.datetime.fromtimestamp(tp.stat().st_mtime, dt.timezone.utc).isoformat()), "bytes": tp.stat().st_size}
    vintages_read = {"tables": tables, "products": {"file": "products.json.br", "trade_flow_built": utc(products.get("trade_flow_built"))},
                     "measures": {"file": str(MEASURES), "version": registry.get("version"), "sha256": sha256_file(MEASURES) if MEASURES.exists() else None},
                     "res_net_raw": RES_NET_RAW_FROM}
    wr("meta", {
        "built": built,
        "read": vintages_read,
        "partner_names": partner_names,
        "money": {"release": mf.tag, "method": mf_method, "surface": str(mf.surface["surface"]), "date": mf.man.get("date"), "quarter": latest_q, "quarters": quarters, "built": utc(mf.surface.get("built")),
                  "vintages": {k: v for k, v in mf.man.get("vintages", {}).items() if k in ("bis.LBS", "bis.CBS", "bis.DSS", "imf.IIP", "imf.PIP", "imf.DIP", "imf.IRFCL", "imf.BOP", "fred.observations", "tic.files")},
                  "pulse_day": mf_meta.get("day")},
        "trade": {"built": tf_built, "surface": str(tf.surface["surface"]), "shown": shown, "complete": tf.meta["complete"], "last": tf.meta["last"], "world_bn": R(snap["world"] / 1e9, 0)},
        "surfaces": {"money": {k: v for k, v in surfaces["money"].items() if k != "path"}, "trade": {k: v for k, v in surfaces["trade"].items() if k != "path"}},
        "periods": {"bank": bank_q, "portfolio": port_q, "fdi": fdi_q, "goods": shown},
        "hub": HUB,
        "economies": [{"code": e, **names[e], "euro_from": euro.get(e), "advanced": e in advanced} for e in econs],
        "hub_names": {HUB: names[HUB]},
        "episodes": {k: v for k, v in EPISODES.items()},
        "events": events,
        "n_out": n_out, "top_withdrawals": top,
    })
    wr("board", board)
    wr("pulse", {"money": world["pulse"], "world_mom": world_mom, "world_w12": world_w12, "n_out": n_out, "n": len(econs), "top": top, "quarter": latest_q})
    wr("chains", {"chains": chains})
    wr("pairs", pairs)
    wr("lenders", {"q": bank_q, "debtors": lenders, "total": lender_total, "total_from": "BIS:5A, all reporting countries, loans and deposits, residence basis, same quarter"})
    wr("dollar", dollar_out)
    wr("validation", valid)
    wr("replay", replay)
    earn_obj = build_earn(econs, board, trade, chains, HUB, mf, earn_view)
    earn_obj.update(build_earn_q(econs, board, HUB, mf, names, euro, advanced, earn_view))
    earn_obj["fund"] = build_funding(con, links, econs + [HUB], earn_obj["years"], {e: earn_obj["econ"][e]["fl"] for e in earn_obj["econ"]})
    wr("earn", earn_obj)
    lap("earn")
    pair_hist = build_pair_history(con, links, econs + [HUB], tf, shown, trade, max_lag)
    lap("pair history")
    from shocks import build_shocks
    shock_index, shock_objs = build_shocks({"R": R, "rd_br": rd_br, "config": HERE / "config" / "shocks.yaml", "tf_meta": tf.meta, "tf_data": TF_DATA,
                                            "board": board, "econs": econs, "hub": HUB, "earn": earn_obj, "events_yaml": TF / "config" / "events.yaml",
                                            "con": duckdb.connect(), "signals": str(MF_TABLES / "signals.parquet")})
    wr("shocks", shock_index)
    (OUT / "shocks").mkdir(exist_ok=True)
    for old in OUT.glob("shocks/*.json.br"):
        old.unlink()
    for k, v in shock_objs.items():
        wr(f"shocks/{k}", v)
    lap("shock replays")
    # ---- stress signals (config/stress.yaml, scripts/stress.py): seven joint signals,
    # the count at K, the composite under G19, the three validations; its change kinds join /changes
    from stress import build_stress
    stress_idx, stress_eco, stress_changes, stress_sum = build_stress({
        "config": HERE / "config" / "stress.yaml", "board": board, "econs": econs, "hub": HUB, "trade": trade, "tf": tf, "quarters": quarters,
        "names": names, "episodes": EPISODES, "global_windows": GLOBAL_WINDOWS, "out_of_scope": OUT_OF_SCOPE, "pre": PRE, "rd_br": rd_br,
        "tf_data": TF_DATA, "con": con, "links": links, "signals": sig, "pulse_day": pulse_day, "nodes_a": tf.nodes_a, "is_economy": node_is_economy,
        "sovereign": mf.view("sovereign/global"), "shocks": shock_objs, "events": events})
    wr("stress", stress_idx)
    (OUT / "stress").mkdir(exist_ok=True)
    for old in OUT.glob("stress/*.json.br"):
        old.unlink()
    for k, v in stress_eco.items():
        wr(f"stress/{k}", v, quiet=True)
    print(f"  stress: thresholds {stress_sum['thresholds']}; admitted {stress_sum['admitted'] or 'none'}; composite {stress_sum['composite'] or 'none'}; "
          f"count AUROC {stress_sum['count_auroc']} vs V {stress_sum['v_auroc']}; expectations {stress_sum['expectations']}")
    for r, x in stress_sum["rules"].items():
        print(f"    {r}: AUROC {x['auroc']}, over the better single side {x['inc']} ({x['inc_lo']} to {x['inc_hi']}), threshold {x['threshold']}, admitted {x['admitted']}")
    print(f"    fiscal: {stress_sum['fiscal']}; trade events: {stress_sum['trade']}")
    changes = changes[:len(joint)] + stress_changes + changes[len(joint):]
    wr("changes", {"q": latest_q, "prev_q": prev_q, "t": shown, "prev_t": trade_changes.get("prev"), "items": changes,
                   "via": {"money": f"money-flow release {mf.tag}, changes/global", "trade": f"trade-flow {tf_built[:10]}, changes.json.br",
                           "stress": f"global-network stress signals {stress_idx['version']}"}})
    lap("stress signals")
    (OUT / "country").mkdir(exist_ok=True)

    sdir = {x["id"]: x["dir"] for x in stress_idx["rules"]}

    def fired_at(g, r, k, thr):
        if r == "j3":
            return bool(g["j3f"][k])
        v = g[r][k]
        if v is None or thr[r] is None:
            return False
        return v <= thr[r] if sdir[r] == "low" else v >= thr[r]

    def stress_strip(e):
        g = stress_idx["grid"].get(e)
        if not g:
            return None
        k = len(stress_idx["quarters"]) - 1
        while k > 0 and g["cnt"][k] is None:
            k -= 1
        thr = {r["id"]: r["threshold"] for r in stress_idx["rules"]}
        return {"q": stress_idx["quarters"][k], "count": g["cnt"][k], "comp": g["comp"][k], "v": g["v"][k], "ch": g["ch"][k], "lead": g["lead"][k],
                "lag": g["lag"][k], "tm": g["tm"][k], "K": stress_idx["K"],
                "fired": [r for r in thr if fired_at(g, r, k, thr)],
                "scored": sum(1 for r in thr if g[r][k] is not None)}
    for e in econs:
        wr(f"country/{e}", {"code": e, **names[e], "euro_from": euro.get(e), "advanced": e in advanced, "board": board[e], "trade": trade[e], "money": money.get(e),
                             "chokepoints": [{"chain": ch["id"], "en": ch["en"], "ko": ch["ko"], "stage": ch["chokepoint"]["en"], "stage_ko": ch["chokepoint"]["ko"], "key": ch["chokepoint"]["key"],
                                              "hhi": ch["chokepoint"]["hhi"], "top": ch["chokepoint"]["top_exporters"][:3], **ch["chokepoint"]["econ"].get(e, {})}
                                             for ch in chains if ch["chokepoint"] and e in ch["chokepoint"]["econ"]],
                             "episodes": [k for k, v in EPISODES.items() if e in v["eco"]],
                             "events": [ev["id"] for ev in events if e in ev["economies"]],
                             "replay": replay["econ"].get(e), "stress": stress_strip(e)})
    wr(f"country/{HUB}", {"code": HUB, **names[HUB], "board": None, "trade": trade[HUB], "money": None, "chokepoints": [], "episodes": [], "events": [ev["id"] for ev in events if HUB in ev["economies"]], "replay": None})

    # ---- checks: pass or warn, each with its figure; shown on About and kept in the build log
    checks = []
    v23 = next((r for r in (mf_checks or {}).get("results", []) if str(r.get("id")) == "V23"), None)
    own_withheld = sorted(f"{r['eco']} {r['series']}" for r in earn_obj["q"]["checks"] if not r["ok"])
    if v23:
        mf_withheld = sorted(f"{r.get('economy')} {r.get('series')}" for r in (v23.get("details") or []) if r.get("ok") is False)
        agree = mf_withheld == own_withheld
        checks.append({"id": "C1", "status": "pass" if v23.get("status") == "pass" else "warn",
                       "en": "WDI annual against IMF quarterly GDP within 3% (money-flow check V23; this build withholds the series it lists)", "ko": "WDI 연간 GDP와 IMF 분기 GDP의 3% 이내 일치 (money-flow 검사 V23. 이 빌드는 거기 열거된 시계열을 제외)",
                       "figure": str(v23.get("summary") or v23.get("observed") or v23.get("status")) + (" This build withholds the same series." if agree else f" This build withholds {own_withheld or 'none'}."),
                       "detail": {"money_status": v23.get("status"), "observed": v23.get("observed"), "tolerance": v23.get("tolerance"), "release": mf.tag, "withheld_money": mf_withheld, "withheld_here": own_withheld}})
    else:
        q_ok = sum(1 for r in earn_obj["q"]["checks"] if r["ok"])
        checks.append({"id": "C1", "status": "warn", "en": "WDI annual against IMF quarterly GDP within 3% (money-flow check V23)", "ko": "WDI 연간 GDP와 IMF 분기 GDP의 3% 이내 일치 (money-flow 검사 V23)",
                       "figure": f"V23 is not in money-flow release {mf.tag}; this build's own comparison: {q_ok} of {len(earn_obj['q']['checks'])} economy-series within 3%",
                       "detail": {"release": mf.tag, "own_ok": q_ok, "own_n": len(earn_obj["q"]["checks"])}})
    # (b) pair totals against the parents' totals. trade-flow publishes backbone flows only (derived records: the largest
    # flows of each window), so the goods pairs of an economy can never be expected to sum to its exports; what must hold
    # is that they never exceed them (2% tolerance), and the covered share is printed. For banks, the BIS all-reporter
    # row (BIS:5A) in the links table is the same series as the board's bank loans and must match it within 2%; the named
    # reporters cover less because BIS withholds confidential bilateral cells, and that share is printed too.
    goods_cov, goods_over = [], []
    for e in econs + [HUB]:
        sc = snap_ctx(trade[e]["now"]["t"])
        i = tf.idx[e]
        row = sc["rows"].get(i)
        if row and row[sc["nc"]["x"]]:
            r = sum(ed[sc["ec"]["w"]] for ed in sc["by_s"][i]) / row[sc["nc"]["x"]]
            goods_cov.append((e, r))
            if r > 1 + PAIR_TOL:
                goods_over.append((e, r))
    covs = sorted(r for _, r in goods_cov)
    cov_med = covs[len(covs) // 2] if covs else None
    checks.append({"id": "C2", "status": "pass" if goods_cov and not goods_over else "warn",
                   "en": "Goods pairs never exceed the economy's 12-month exports in the same trade-flow window (2% tolerance); backbone coverage printed",
                   "ko": "상품 쌍의 합이 같은 trade-flow 창의 12개월 수출을 넘지 않음(허용 오차 2%). 기간망 쌍의 포괄 비중을 함께 표시",
                   "figure": (f"{len(goods_cov) - len(goods_over)} of {len(goods_cov)} economies; pairs cover {100 * covs[0]:.0f}–{100 * covs[-1]:.0f}% of exports (median {100 * cov_med:.0f}%)" if covs else "no economy")
                   + ("" if not goods_over else "; over the total: " + ", ".join(f"{e} {100 * (r - 1):.1f}%" for e, r in goods_over)),
                   "detail": {"n": len(goods_cov), "over": goods_over, "coverage": {e: R(100 * r, 1) for e, r in goods_cov}, "tolerance_pct": 100 * PAIR_TOL}})
    agg_rows = con.sql(f"""
        select debtor, position_usd from '{links}'
        where dataset='bis.LBS' and channel='bank_loans' and sector_debtor='all' and currency='all' and basis='residence'
          and period = (select max(period) from '{links}' where dataset='bis.LBS' and channel='bank_loans')
          and creditor like '%:%' and debtor in ({",".join(f"'{e}'" for e in econs)})""").fetchall()
    agg = {d_: v for d_, v in agg_rows if v}
    bank_gaps, bank_cov = [], []
    for e in econs:
        b = board[e]
        loans = b["loans"][len(b["q"]) - 1]
        if loans and agg.get(e):
            bank_gaps.append((e, abs(agg[e] / loans - 1)))
            bank_cov.append((e, sum(lenders.get(e, {}).values()) / agg[e]))
    bw = max(bank_gaps, key=lambda z: z[1]) if bank_gaps else ("-", 0.0)
    b_in = sum(1 for _, g in bank_gaps if g <= PAIR_TOL)
    bcov = sorted(r for _, r in bank_cov)
    checks.append({"id": "C3", "status": "pass" if b_in == len(bank_gaps) and len(bank_gaps) == len(econs) else "warn",
                   "en": "The BIS all-reporter bank row behind the pairs equals the board's bank loans within 2%; the share named reporters cover is printed",
                   "ko": "쌍의 기초인 BIS 전체 보고국 행이 신호판의 은행 대출과 2% 이내로 일치. 이름이 있는 보고국의 포괄 비중을 함께 표시",
                   "figure": f"{b_in} of {len(bank_gaps)} economies within 2% (largest gap {bw[0]} {100 * bw[1]:.1f}%); named reporters cover {100 * bcov[0]:.0f}–{100 * bcov[-1]:.0f}% of the total" if bank_gaps else "no economy",
                   "detail": {"within": b_in, "n": len(bank_gaps), "worst": {"eco": bw[0], "gap_pct": R(100 * bw[1], 2)}, "named_coverage": {e: R(100 * r, 1) for e, r in bank_cov}, "tolerance_pct": 100 * PAIR_TOL}})
    # (c) every replay month exists in trade-flow's windows (skipped months and months after the shown month excepted)
    wmiss = {k: v["windows"] for k, v in shock_objs.items()}
    n_exp = sum(w["expected"] for w in wmiss.values())
    n_found = sum(w["found"] for w in wmiss.values())
    checks.append({"id": "C4", "status": "pass" if n_found == n_exp else "warn",
                   "en": "Every replay month has its 12-month window in trade-flow", "ko": "모든 재생 월에 trade-flow의 12개월 창이 있음",
                   "figure": f"{n_found} of {n_exp} replay months across {len(wmiss)} replays" + ("" if n_found == n_exp else "; missing " + "; ".join(f"{k}: {v['missing']}" for k, v in wmiss.items() if v["missing"])),
                   "detail": wmiss})
    # (d) every AUROC carries its bootstrap interval
    with_iv = [x for x in valid["indicators"] if x["lo"] is not None and x["hi"] is not None]
    checks.append({"id": "C5", "status": "pass" if len(with_iv) == len(valid["indicators"]) else "warn",
                   "en": f"Every AUROC has a {BOOT_LEVEL}% bootstrap interval ({BOOT_DRAWS} draws over economy-episodes)", "ko": f"모든 AUROC에 {BOOT_LEVEL}% 부트스트랩 구간이 있음 (경제×사례 {BOOT_DRAWS}회 복원 추출)",
                   "figure": "; ".join(f"{x['id']} {x['auroc']} ({x['lo']}–{x['hi']})" for x in valid["indicators"]),
                   "detail": {"indicators": [{k: x[k] for k in ("id", "auroc", "lo", "hi", "pos", "neg")} for x in valid["indicators"]]}})
    checks += consistency_checks(econs, HUB, trade, tf, board, world, latest_q, lender_total, replay, stress_eco, stress_idx, pairs,
                                 max_lag, tables_at_start, vintages_read, OUT)
    for c in checks:
        print(f"  check {c['id']} {c['status'].upper():4} {c['en']}: {c['figure']}")
    stamp = built.replace("-", "").replace(":", "").replace("+00:00", "Z")
    wr("checks", {"built": built, "items": checks, "log": f"builds/{stamp}.json", "tolerance": {"pairs_pct": 100 * PAIR_TOL, "interval": valid["interval"]}})

    # ---- this site's own surface (docs/SURFACES.md): trade-flow reads `replays` to flag events that have a replay here
    own = {"surface": OWN_SURFACE, "built": built,
           "money": {"release": mf.tag, "method": mf_method, "surface": str(mf.surface["surface"])},
           "trade": {"built": tf_built, "shown": int(tf.surface.get("shown", shown)), "surface": str(tf.surface["surface"])},
           "replays": [r["id"] for r in shock_index["replays"]]}
    (OUT / "surface.json").write_text(json.dumps(own, ensure_ascii=False, indent=1) + "\n")
    print(f"  surface.json: replays {own['replays']}")

    # ---- the build log: inputs (both surfaces), outputs, checks, timings; copied to <tag>.json after a deploy
    lap("country files and checks")
    outputs = [{"file": str(f.relative_to(OUT)), "bytes": f.stat().st_size} for f in sorted(OUT.rglob("*.json*")) if f.is_file()]
    log = {"built": built, "stamp": stamp, "tag": None, "surface": own,
           "inputs": {"money": surfaces["money"], "trade": surfaces["trade"],
                      "tables": [str(MF_TABLES / "links.parquet"), str(MF_TABLES / "signals.parquet")],
                      "config": [str(HERE / "config" / "shocks.yaml"), str(HERE / "config" / "regions.yaml"), str(TF / "config" / "events.yaml")]},
           "outputs": outputs, "pairs_history": pair_hist, "checks": checks, "validation": valid["indicators"], "timings_s": {**TIMINGS, "total": round(time.monotonic() - T_START, 2)}}
    BUILDS.mkdir(parents=True, exist_ok=True)
    (BUILDS / f"{stamp}.json").write_text(json.dumps(log, ensure_ascii=False, indent=1) + "\n")
    (BUILDS / "latest").write_text(f"{stamp}.json\n")
    print(f"  build log {BUILDS / (stamp + '.json')} ({len(outputs)} files, {log['timings_s']['total']} s)")
    failed = [c for c in checks if c["status"] == "fail"]
    if failed:
        sys.exit(f"build failed: consistency check(s) {', '.join(c['id'] for c in failed)} failed (rule C5); see above. "
                 f"data/ holds this build's files for inspection; do not deploy it.")
    print("done")

if __name__ == "__main__":
    main()
