"""Stress signals (memo docs/methodology/stress-v1.0.md): seven signals, each a
money quantity from money-flow's surface set against a trade quantity from trade-flow's, scored point in time for the
36 board economies; the count at K, the composite with admission rule G19, and the three validations.

Called by build.py (`build_stress(ctx)`), which has already read both surfaces; this module reads nothing else except
config/stress.yaml. Pure functions at the top are tested in tests/test_stress.py.

Point in time: a quarter's value uses only periods up to and including that quarter: the board row of the quarter, the
12-month trade window ending in its last month (or the newest complete one up to `trade_max_lag` months earlier,
marked partial), the BIS LBS position of the quarter, the commodity share of the year before, own-history percentiles
and scales over earlier quarters only, pooled level ranks over every board economy-quarter up to the quarter, and the
dollar-channel slope estimated on points whose outcome quarter is not later than the quarter scored.
"""
from __future__ import annotations

import bisect
import datetime as dt
import math
import random
from collections import defaultdict
from pathlib import Path

import yaml

RULES = ("j1", "j2", "j3", "j4", "j5", "j6", "j7")
MAD_K = 1.4826


# ---------------------------------------------------------------- pure helpers (tested)
def median(x: list[float]) -> float:
    s = sorted(x)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def own_pct(series: list[tuple[str, float | None]], min_hist: int = 8) -> dict[str, float]:
    """Expanding own-history percentile: the share (%) of the economy's EARLIER values at or below this one. Nothing
    after the quarter is read; the first `min_hist` values get no percentile."""
    out, hist = {}, []
    for q, v in series:
        if v is None:
            continue
        if len(hist) >= min_hist:
            out[q] = 100 * sum(1 for h in hist if h <= v) / len(hist)
        hist.append(v)
    return out


def own_signal(history: list[float], value: float | None, floor: float, min_hist: int, z_cap: float) -> float | None:
    """money-flow method 1.3's own-history signal on 0-100 (rules.py robust_z): 50 = the own median so far, 100 = z_cap
    robust deviations above it; the scale is at least `floor`. `history` includes the current value."""
    h = [v for v in history if v is not None and math.isfinite(v)]
    if len(h) < min_hist or value is None:
        return None
    med = median(h)
    scale = max(MAD_K * median([abs(v - med) for v in h]), floor)
    z = max(-z_cap, min(z_cap, (value - med) / scale))
    return 50 + 50 * z / z_cap


def level_signal(pool_sorted: list[float], value: float | None, min_pool: int) -> float | None:
    """Share (%) of every board economy-quarter up to and including this quarter at or below this value."""
    if value is None or len(pool_sorted) < min_pool:
        return None
    return 100 * bisect.bisect_right(pool_sorted, value) / len(pool_sorted)


def import_cover(res_net: float | None, imports_12m: float | None) -> float | None:
    """J1: months of imports that net reserves pay for (net reserves unfloored; see cover_not_meaningful)."""
    if res_net is None or not imports_12m:
        return None
    return res_net / (imports_12m / 12)


def cover_not_meaningful(res_net_raw: float | None, res: float | None, min_pct_of_gross: float) -> str | None:
    """Why J1 is not a meaningful number for these net reserves, or None when it is. Net reserves at or
    below zero cover no month of imports, and net reserves that are a sliver of gross reserves make the months an
    artefact of the drains; J1 is then null with this reason, never a floored number."""
    if res_net_raw is None:
        return None
    if res_net_raw <= 0:
        return "net reserves are negative" if res_net_raw < 0 else "net reserves are zero"
    if res and res > 0 and 100 * res_net_raw / res < min_pct_of_gross:
        return f"net reserves are under {min_pct_of_gross:g}% of gross reserves"
    return None


def financing_need(st: float | None, ca_pct: float | None, gdp: float | None, exports_12m: float | None) -> float | None:
    """J2: (BIS banks' claims due within a year + current-account deficit in USD) as % of 12-month goods exports as
    partners record them (registry bank_claims_short_term, financing_need, j2; not the economy's short-term external
    debt)."""
    if st is None or ca_pct is None or gdp is None or not exports_12m:
        return None
    return 100 * (st + max(0.0, -ca_pct) * gdp / 100) / exports_12m


def partner_weights(shares: dict[str, float], covered: set[str]) -> tuple[dict[str, float], float]:
    """J4's weights: destination shares (fractions of the economy's exports) renormalised over the covered partners;
    returns (weights summing to 1, covered share of exports in %)."""
    cov = {p: s for p, s in shares.items() if p in covered and s > 0}
    tot = sum(cov.values())
    if tot <= 0:
        return {}, 0.0
    return {p: s / tot for p, s in cov.items()}, 100 * tot


def overlap(lend: dict[str, float], dest: dict[str, float]) -> float:
    """J5: Σ_j min(lender share_j, destination share_j), both in %."""
    return sum(min(v, dest[p]) for p, v in lend.items() if p in dest)


def auroc(pos: list[float], neg_sorted: list[float]) -> float | None:
    if not pos or not neg_sorted:
        return None
    s = 0.0
    for p in pos:
        lo, hi = bisect.bisect_left(neg_sorted, p), bisect.bisect_right(neg_sorted, p)
        s += lo + 0.5 * (hi - lo)
    return s / (len(pos) * len(neg_sorted))


def spearman(xs: list[float], ys: list[float]) -> float | None:
    def ranks(v):
        o = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(o):
            j = i
            while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]:
                j += 1
            for k in range(i, j + 1):
                r[o[k]] = (i + j) / 2 + 1
            i = j + 1
        return r
    n = len(xs)
    if n < 4:
        return None
    rx, ry = ranks(xs), ranks(ys)
    mx, my = sum(rx) / n, sum(ry) / n
    sxx = sum((a - mx) ** 2 for a in rx); syy = sum((b - my) ** 2 for b in ry)
    if sxx == 0 or syy == 0:
        return None
    return sum((a - mx) * (b - my) for a, b in zip(rx, ry)) / math.sqrt(sxx * syy)


def qshift(q: str, k: int) -> str:
    d = dt.date.fromisoformat(q)
    m = d.month + 3 * k
    y = d.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    nxt = dt.date(y + (m // 12), m % 12 + 1, 1)
    return (nxt - dt.timedelta(days=1)).isoformat()


def q_month(q: str) -> int:
    return int(q[:4]) * 100 + int(q[5:7])


def month_add(t: int, k: int) -> int:
    y, m = divmod(t, 100)
    m += k
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return y * 100 + m


def R(x, n=2):
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return None
    return round(x, n)


def ols_slope(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((a - mx) ** 2 for a in xs)
    if sxx == 0:
        return None
    return sum((a - mx) * (b - my) for a, b in zip(xs, ys)) / sxx


# ---------------------------------------------------------------- the build
def build_stress(ctx: dict) -> tuple[dict, dict[str, dict], list[dict], dict]:
    """Returns (index for data/stress.json, {ISO3: economy file}, change items for /changes, summary for the log)."""
    cfg = yaml.safe_load(Path(ctx["config"]).read_text())
    rules = cfg["rules"]
    K = int(cfg["K"])
    MINH, MINP, ZCAP = int(cfg["min_history"]), int(cfg["min_pool"]), float(cfg["z_cap"])
    board, econs, hub = ctx["board"], ctx["econs"], ctx["hub"]
    trade, tf = ctx["trade"], ctx["tf"]
    quarters_all = ctx["quarters"]
    names = ctx["names"]
    episodes, gwin, oos, PRE = ctx["episodes"], ctx["global_windows"], ctx["out_of_scope"], ctx["pre"]
    train_to = str(cfg["train_to"])

    # ---- inputs indexed by (economy, quarter)
    brow = {}
    for e in econs:
        b = board[e]
        for k, q in enumerate(b["q"]):
            brow[(e, q)] = {c: b[c][k] for c in b if c != "q"}
    Q = [q for q in quarters_all]

    # trade window per (economy, quarter): newest complete window at or before the quarter's last month, <= max_lag back
    max_lag = int(cfg["trade_max_lag"])
    tw = {}
    for e in econs:
        tr = trade[e]
        ti = {t: k for k, t in enumerate(tr["t"])}
        for q in Q:
            tm = q_month(q)
            for lag in range(0, max_lag + 1):
                t = month_add(tm, -lag)
                k = ti.get(t)
                if k is not None and tr["x"][k] is not None and tr["m"][k] is not None:
                    tw[(e, q)] = {"t": t, "x": tr["x"][k], "m": tr["m"][k], "mom": tr["mom_x"][k], "lag": lag}
                    break

    # destination shares and HHI from trade-flow's 12-month snapshots, at each month used
    snap_files: dict[int, dict] = {}

    def snap(t: int):
        y = t // 100
        if y not in snap_files:
            try:
                f = ctx["rd_br"](ctx["tf_data"] / "snap" / "W" / "TOTAL" / f"{y}.w12.json.br")
            except FileNotFoundError:
                f = {"snaps": [], "ncols": [], "ecols": []}
            snap_files[y] = {"nc": {c: i for i, c in enumerate(f["ncols"])}, "ec": {c: i for i, c in enumerate(f["ecols"])},
                             "by_t": {s["t"]: s for s in f["snaps"]}, "idx": {}}
        sf = snap_files[y]
        s = sf["by_t"].get(t)
        if s is None:
            return None
        if t not in sf["idx"]:
            nc, ec = sf["nc"], sf["ec"]
            rows = {r[nc["i"]]: r for r in s["nodes"]}
            by_s = defaultdict(list)
            for ed in s["edges"]:
                by_s[ed[ec["s"]]].append(ed)
            sf["idx"][t] = (rows, by_s)
        return sf["nc"], sf["ec"], sf["idx"][t]

    is_eco = ctx.get("is_economy") or (lambda n: True)
    # (e, q) -> ({partner: fraction of e's exports}, hhi). Partner 490's node (S19, registry asia_nes) is a partner like
    # any other in shares, HHI and J4's coverage (it has no V, so it is never a covered partner); it is left out only
    # where an economy's identity is needed: it is never a lender, so J5 never matches it against one
    dest = {}
    non_eco: set[str] = set()
    for (e, q), w in tw.items():
        sn = snap(w["t"])
        if not sn:
            continue
        nc, ec, (rows, by_s) = sn
        i = tf.idx[e]
        row = rows.get(i)
        if not row or not row[nc["x"]]:
            continue
        sh = {}
        for ed in by_s.get(i, []):
            pn = tf.nodes[ed[ec["t"]]]
            sh[pn["id"]] = ed[ec["w"]] / row[nc["x"]]
            if not is_eco(pn):
                non_eco.add(pn["id"])
        dest[(e, q)] = (sh, row[nc["hm"]])

    # lender shares by quarter (BIS LBS, residence, all sectors and currencies), % of claims from all reporters
    con, links = ctx["con"], ctx["links"]
    eset = ",".join(f"'{e}'" for e in econs)
    rows = con.sql(f"""
        select debtor, period, creditor, position_usd from '{links}'
        where dataset='bis.LBS' and channel='bank_loans' and sector_debtor='all' and currency='all' and basis='residence'
          and debtor in ({eset}) and period >= '2006-01-01' and position_usd is not null and position_usd > 0""").fetchall()
    tot, named = {}, defaultdict(dict)
    for d_, per, c_, pos in rows:
        key = (d_, per.isoformat())
        if c_ == "BIS:5A":
            tot[key] = pos
        elif ":" not in c_:
            named[key][c_] = pos
    lend = {}
    for key, cs in named.items():
        if tot.get(key):
            lend[key] = {c: 100 * v / tot[key] for c, v in cs.items()}

    # commodity share of exports by year (HS 25-27 over all goods, trade-flow annual nodes)
    com = defaultdict(dict)
    na = ctx["nodes_a"]("TOTAL")
    hs = {}
    for ch in ("HS-25", "HS-26", "HS-27"):
        try:
            hs[ch] = ctx["nodes_a"](ch)
        except FileNotFoundError:
            pass
    for e in econs:
        i = tf.idx[e]
        if i not in na["ids"]:
            continue
        xs = na["x"][na["ids"].index(i)]
        for k, y in enumerate(na["t"]):
            if not xs[k]:
                continue
            c = 0.0
            for h in hs.values():
                if i in h["ids"] and y in h["t"]:
                    v = h["x"][h["ids"].index(i)][h["t"].index(y)]
                    c += v or 0
            com[e][y] = 100 * c / xs[k]

    # dollar index: quarterly average, 4-quarter change; the running quarter (after the pulse day) is left out
    di = con.sql(f"select date_trunc('quarter', period) as q, avg(value_usd) from '{ctx['signals']}' where measure='dollar_index' group by 1 order by 1").fetchall()
    dq = {}
    for qd, v in di:
        qe = (dt.date(qd.year + (qd.month + 2) // 12, (qd.month + 2) % 12 + 1, 1) - dt.timedelta(days=1)).isoformat()
        if qe <= ctx["pulse_day"]:
            dq[qe] = v
    d4 = {q: 100 * (dq[q] / dq[qshift(q, -4)] - 1) for q in dq if qshift(q, -4) in dq}

    # ---- own-history percentiles for J3 (F, export momentum)
    f_pct, m_pct = {}, {}
    for e in econs:
        b = board[e]
        f_pct[e] = own_pct(list(zip(b["q"], b["flow"])), MINH)
        m_pct[e] = own_pct([(q, tw[(e, q)]["mom"] if (e, q) in tw and tw[(e, q)]["lag"] == 0 else None) for q in Q], MINH)

    # ---- A1 terciles by quarter and the expanding dollar-channel slope per tercile
    lag6 = int(rules["j6"]["lag"])
    terc = {}
    for q in Q:
        a = sorted((brow[(e, q)]["a1"], e) for e in econs if (e, q) in brow and brow[(e, q)]["a1"] is not None)
        n = len(a)
        for r, (_, e) in enumerate(a):
            terc[(e, q)] = 0 if r < n / 3 else (1 if r < 2 * n / 3 else 2)
    pts = []  # (outcome quarter, tercile at the move, dollar change, export growth two quarters later)
    for e in econs:
        for q in Q:
            q2 = qshift(q, lag6)
            if q in d4 and (e, q) in terc and (e, q2) in tw and tw[(e, q2)]["lag"] == 0 and tw[(e, q2)]["mom"] is not None:
                clip = float(rules["j6"].get("clip", 1e9))
                pts.append((q2, terc[(e, q)], d4[q], max(-clip, min(clip, tw[(e, q2)]["mom"]))))
    pts.sort()
    slope = {}
    acc = {0: ([], []), 1: ([], []), 2: ([], [])}
    j = 0
    for q in Q:
        while j < len(pts) and pts[j][0] <= q:
            acc[pts[j][1]][0].append(pts[j][2]); acc[pts[j][1]][1].append(pts[j][3]); j += 1
        for t in (0, 1, 2):
            if len(acc[t][0]) >= int(rules["j6"]["min_points"]):
                slope[(t, q)] = ols_slope(*acc[t])

    # ---- the seven values and their single-side inputs
    covered = set(econs) | {hub}   # J4's covered partners: economies only, so a non-economy partner is never covered
    j1_min = float(rules["j1"].get("not_meaningful_below_gross_pct", 1.0))
    val = {r: {} for r in RULES}
    single = {r: {"money": {}, "trade": {}} for r in RULES}
    extra = {}  # (e, q) -> detail for the economy file
    for q in Q:
        vq = {e: brow[(e, q)]["v"] for e in econs if (e, q) in brow and brow[(e, q)]["v"] is not None}
        fq = {e: brow[(e, q)]["flow"] for e in econs if (e, q) in brow and brow[(e, q)]["flow"] is not None}
        vq_h = dict(vq, **{hub: float(rules["j4"]["us_v"])})
        fq_h = dict(fq, **{hub: 0.0})
        for e in econs:
            b = brow.get((e, q))
            if not b:
                continue
            w = tw.get((e, q))
            d = {"t": w["t"] if w else None, "lag": w["lag"] if w else None}
            gdp = b["gdp"]
            # J1: net reserves (unfloored, registry net_reserves) over a month of imports at the window joined at the
            # quarter; null with a reason when net reserves are negative or a sliver of gross
            if b.get("a2_scored") == 1 and w:
                nm = cover_not_meaningful(b["res_net_raw"], b.get("res"), j1_min)
                if nm:
                    d["j1_nm"] = nm
                v1 = None if nm else import_cover(b["res_net_raw"], w["m"])
                if v1 is not None:
                    val["j1"][(e, q)] = v1
                    single["j1"]["money"][(e, q)] = 100 * b["res_net_raw"] / gdp if gdp else None
                    single["j1"]["trade"][(e, q)] = 100 * w["m"] / gdp if gdp else None
            # J2
            if w:
                v2 = financing_need(b["st"], b["ca"], gdp, w["x"])
                if v2 is not None:
                    val["j2"][(e, q)] = v2
                    single["j2"]["money"][(e, q)] = 100 * (b["st"] + max(0.0, -b["ca"]) * gdp / 100) / gdp if gdp else None
                    single["j2"]["trade"][(e, q)] = 100 * w["x"] / gdp if gdp else None
                    d["need"] = R(b["st"] + max(0.0, -b["ca"]) * gdp / 100, 1)
            # J3
            fp, mp = f_pct[e].get(q), m_pct[e].get(q)
            if b.get("flow") is None and b.get("flow_note"):
                d["j3_nm"] = f"flow score F not published for the quarter: {b['flow_note']}"   # money-flow 1.6 no_flow
            if fp is not None and mp is not None:
                val["j3"][(e, q)] = 0.5 * (100 - fp) + 0.5 * (100 - mp)
                d["j3_fire"] = 1 if (b["flow"] is not None and b["flow"] < float(rules["j3"]["fire"]["f_below"]) and mp <= float(rules["j3"]["fire"]["mom_pct_at_most"])) else 0
                d["fp"], d["mp"] = R(fp, 1), R(mp, 1)
                single["j3"]["money"][(e, q)] = 100 - fp
                single["j3"]["trade"][(e, q)] = 100 - mp
            # J4 (and the fast version with F)
            dd = dest.get((e, q))
            if dd:
                sh, hhi = dd
                cov_set = {p for p in covered if p in vq_h and p != e}
                wts, cov = partner_weights(sh, cov_set)
                d["cov"] = R(cov, 1)
                if wts and cov >= float(rules["j4"]["min_coverage"]):
                    val["j4"][(e, q)] = sum(wv * vq_h[p] for p, wv in wts.items())
                    d["j4f"] = R(sum(wv * fq_h.get(p, 0.0) for p, wv in wts.items()), 1)
                    others = [v for p, v in vq.items() if p != e]
                    single["j4"]["money"][(e, q)] = sum(others) / len(others) if others else None
                    single["j4"]["trade"][(e, q)] = hhi
            # J5: lenders against destinations that are economies (a non-economy partner is never a lender)
            ld = lend.get((e, q))
            if dd and ld:
                dsh = {p: 100 * s for p, s in dd[0].items() if p not in non_eco}
                val["j5"][(e, q)] = overlap(ld, dsh)
                single["j5"]["money"][(e, q)] = sum((v / 100) ** 2 for v in ld.values())
                single["j5"]["trade"][(e, q)] = dd[1]
            # J6
            tq = terc.get((e, q))
            if tq is not None and q in d4 and slope.get((tq, q)) is not None:
                val["j6"][(e, q)] = -slope[(tq, q)] * d4[q]
                d["terc"], d["slope"], d["d4"] = tq, R(slope[(tq, q)], 3), R(d4[q], 2)
                single["j6"]["money"][(e, q)] = (b["a1"] or 0) * max(0.0, d4[q])
                if mp is not None:
                    single["j6"]["trade"][(e, q)] = 100 - mp
            # J7
            y = int(q[:4]) - 1
            if y in com.get(e, {}) and b["buf"] is not None:
                val["j7"][(e, q)] = com[e][y] * b["buf"] / 100
                d["com"], d["com_y"] = R(com[e][y], 1), y
                single["j7"]["money"][(e, q)] = b["buf"]
                single["j7"]["trade"][(e, q)] = com[e][y]
            extra[(e, q)] = d

    # the published values are rounded to 2 decimals; everything below (thresholds, counts, ranks) uses the same rounded
    # numbers, so the browser's re-application of a threshold (model.ts) gives the build's count exactly
    for r in RULES:
        val[r] = {k: round(v, 2) for k, v in val[r].items() if v is not None and math.isfinite(v)}

    # direction-adjusted value (higher = worse) for ranking and AUROC
    sign = {r: (-1.0 if rules[r]["dir"] == "low" else 1.0) for r in RULES}

    def adj(r, v):
        return None if v is None else sign[r] * v

    # ---- episode labels (money-flow's funding episode set)
    near = defaultdict(set)
    ev_list = []
    for eid, ep in episodes.items():
        for e in ep["eco"]:
            if e in econs:
                ev_list.append((e, ep["q"], eid))
            for k in range(-PRE - 4, PRE + 5):
                near[e].add(qshift(ep["q"], k))

    def calm(e, q):
        if e in oos and oos[e][0] <= q <= oos[e][1]:
            return False
        if q in near.get(e, set()) or any(a <= q <= b for a, b in gwin):
            return False
        return True

    def sets(score: dict, to: str | None = None, frm: str | None = None, drop: str | None = None):
        """(positives with their episode ids, calm values): positives are the maximum of the PRE quarters before each
        economy-episode; calm quarters as build.py's validation."""
        pos = []
        for e, qe, eid in ev_list:
            if drop and eid == drop:
                continue
            if to and qe > to or frm and qe <= frm:
                continue
            got = [score.get((e, qshift(qe, -k))) for k in range(PRE, 0, -1)]
            got = [g for g in got if g is not None]
            if got:
                pos.append((max(got), (e, qe, eid)))
        neg = [v for (e, q), v in score.items() if v is not None and calm(e, q) and (not to or q <= to) and (not frm or q > frm)]
        return pos, sorted(neg)

    def fired_sets(fired: dict, to=None, frm=None):
        pos, n_cal, n_fire = [], 0, 0
        for e, qe, eid in ev_list:
            if to and qe > to or frm and qe <= frm:
                continue
            got = [fired.get((e, qshift(qe, -k))) for k in range(PRE, 0, -1)]
            got = [g for g in got if g is not None]
            if got:
                pos.append(1 if any(got) else 0)
        for (e, q), f in fired.items():
            if f is None or not calm(e, q) or (to and q > to) or (frm and q <= frm):
                continue
            n_cal += 1
            n_fire += f
        tpr = sum(pos) / len(pos) if pos else None
        fpr = n_fire / n_cal if n_cal else None
        return tpr, fpr, len(pos), n_cal

    # ---- thresholds: convention, definition or validation (Youden's J on the training span)
    pooled_train = {r: sorted(adj(r, v) for (e, q), v in val[r].items() if q <= train_to) for r in RULES}
    thr, thr_table = {}, {}

    def fires(r, v, t, e=None, q=None):
        if v is None:
            return None
        if r == "j3":
            return extra.get((e, q), {}).get("j3_fire", 0)
        return 1 if (v <= t if rules[r]["dir"] == "low" else v >= t) else 0

    for r in RULES:
        src = rules[r].get("threshold_from")
        if src == "convention":
            thr[r] = float(rules[r]["threshold"])
            continue
        if src == "definition":
            thr[r] = None
            continue
        cands = rules[r]["candidates"]
        if isinstance(cands, dict):
            pool = pooled_train[r]
            cands = [R(pool[min(len(pool) - 1, int(p / 100 * len(pool)))], 2) for p in cands["pooled_pct"]]
            labels = [f"P{p}" for p in rules[r]["candidates"]["pooled_pct"]]
        else:
            labels = [None] * len(cands)
        table = []
        for c, lab in zip(cands, labels):
            fz = {k: fires(r, v, c, *k) for k, v in val[r].items()}
            tpr, fpr, npos, ncal = fired_sets(fz, to=train_to)
            table.append({"t": c, "label": lab, "tpr": R(100 * tpr, 1) if tpr is not None else None, "fpr": R(100 * fpr, 1) if fpr is not None else None,
                          "j": R(100 * (tpr - fpr), 1) if tpr is not None and fpr is not None else None, "pos": npos, "calm": ncal})
        best = max(range(len(table)), key=lambda i: (table[i]["j"] if table[i]["j"] is not None else -1e9, -i))
        thr[r] = float(table[best]["t"])
        thr_table[r] = {"rows": table, "chosen": best}

    fired = {r: {k: fires(r, v, thr[r], *k) for k, v in val[r].items()} for r in RULES}

    # ---- count, components, composite designs
    def count_at(e, q, on=RULES):
        fs = [fired[r].get((e, q)) for r in on]
        n_sc = sum(1 for f in fs if f is not None)
        return (sum(f for f in fs if f), n_sc) if n_sc else (None, 0)

    cnt = {}
    for e in econs:
        for q in Q:
            c, n = count_at(e, q)
            if c is not None:
                cnt[(e, q)] = c

    # level ranks (pooled, expanding) and own-history signals per rule, direction-adjusted
    lvl, own = {r: {} for r in RULES}, {r: {} for r in RULES}
    for r in RULES:
        pool: list[float] = []
        byq = defaultdict(list)
        for (e, q), v in val[r].items():
            byq[q].append((e, adj(r, v)))
        hist = defaultdict(list)
        for q in Q:
            for _, v in byq.get(q, []):
                bisect.insort(pool, v)
            for e, v in byq.get(q, []):
                lvl[r][(e, q)] = level_signal(pool, v, MINP)
                hist[e].append(v)
                own[r][(e, q)] = own_signal(hist[e], v, float(rules[r]["floor"]), MINH, ZCAP)

    def component(r, k, w_level):
        a, b = lvl[r].get(k), own[r].get(k)
        if w_level >= 1:
            return a
        if w_level <= 0:
            return b
        if a is None:
            return None
        return a if b is None else w_level * a + (1 - w_level) * b

    # ---- validation helpers
    BL = float(cfg["composite"]["admission"]["level"])
    DRAWS = int(cfg["composite"]["admission"]["draws"])
    SEED = int(cfg["composite"]["admission"]["seed"])
    v_score = {(e, q): brow[(e, q)]["v"] for (e, q) in brow if brow[(e, q)]["v"] is not None}

    def paired(scores: list[dict], base_ix: int | None = None):
        """AUROC of each score on one common sample (economy-episodes and calm quarters where all are scored) and the
        bootstrap over positives; with base_ix, the interval of score 0 minus score base_ix."""
        keys = None
        for s in scores:
            ks = {k for k, v in s.items() if v is not None}
            keys = ks if keys is None else keys & ks
        common = [{k: s[k] for k in keys} for s in scores]
        sp = [sets(c) for c in common]
        # align positives by economy-episode
        ids = None
        for pos, _ in sp:
            i_ = {p[1] for p in pos}
            ids = i_ if ids is None else ids & i_
        ids = sorted(ids or [])
        pv = [{p[1]: p[0] for p in pos} for pos, _ in sp]
        P = [[pv[s][i] for i in ids] for s in range(len(scores))]
        N = [neg for _, neg in sp]
        au = [auroc(P[s], N[s]) for s in range(len(scores))]
        out = {"auroc": au, "pos": len(ids), "neg": len(N[0]) if N else 0, "lo": [None] * len(scores), "hi": [None] * len(scores)}
        if not ids or not N[0]:
            return out
        rng = random.Random(SEED)
        draws = [[] for _ in scores]
        diffs = []
        n = len(ids)
        for _ in range(DRAWS):
            pick = [rng.randrange(n) for _ in range(n)]
            a = [auroc([P[s][i] for i in pick], N[s]) for s in range(len(scores))]
            for s in range(len(scores)):
                draws[s].append(a[s])
            if base_ix is not None:
                diffs.append(a[0] - a[base_ix])
        lo_q = (100 - BL) / 200
        for s in range(len(scores)):
            d_ = sorted(draws[s])
            out["lo"][s], out["hi"][s] = d_[int(lo_q * (DRAWS - 1))], d_[int((1 - lo_q) * (DRAWS - 1))]
        if diffs:
            diffs.sort()
            out["diff"] = au[0] - au[base_ix]
            out["diff_lo"], out["diff_hi"] = diffs[int(lo_q * (DRAWS - 1))], diffs[int((1 - lo_q) * (DRAWS - 1))]
        return out

    def loo(score: dict):
        vals = []
        for eid in episodes:
            pos, neg = sets(score, drop=eid)
            a = auroc([p[0] for p in pos], neg)
            if a is not None:
                vals.append((eid, a))
        if not vals:
            return None
        lo = min(vals, key=lambda z: z[1]); hi = max(vals, key=lambda z: z[1])
        return {"min": R(lo[1], 3), "min_drop": lo[0], "max": R(hi[1], 3), "max_drop": hi[0]}

    funding = {"rules": {}, "set": {"pre": PRE, "global_windows": gwin, "train_to": train_to, "draws": DRAWS, "level": BL,
                                     "episodes": len(ev_list)}}
    admitted = []
    for r in RULES:
        J = {k: adj(r, v) for k, v in val[r].items()}
        sm = single[r]
        ms, ts = rules[r]["single"]["money"], rules[r]["single"]["trade"]
        M = {k: (None if v is None else (-v if ms["dir"] == "low" else v)) for k, v in sm["money"].items()}
        T = {k: (None if v is None else (-v if ts["dir"] == "low" else v)) for k, v in sm["trade"].items()}
        base = paired([J, M, T])
        better = 1 if (base["auroc"][1] or 0) >= (base["auroc"][2] or 0) else 2
        # the increment on the same three-way sample the better side was chosen on
        inc = paired([J, M, T], base_ix=better)
        pos, neg = sets(J)
        full = auroc([p[0] for p in pos], neg)
        tpr, fpr, npos, ncal = fired_sets(fired[r])
        h_tpr, h_fpr, h_pos, h_cal = fired_sets(fired[r], frm=train_to)
        ok = inc.get("diff_lo") is not None and inc["diff_lo"] > 0
        if ok:
            admitted.append(r)
        funding["rules"][r] = {
            "auroc": R(full, 3), "pos": len(pos), "neg": len(neg),
            "common": {"pos": base["pos"], "neg": base["neg"], "j": R(base["auroc"][0], 3), "money": R(base["auroc"][1], 3), "trade": R(base["auroc"][2], 3),
                       "j_lo": R(base["lo"][0], 3), "j_hi": R(base["hi"][0], 3)},
            "better": "money" if better == 1 else "trade",
            "inc": R(inc.get("diff"), 3), "inc_lo": R(inc.get("diff_lo"), 3), "inc_hi": R(inc.get("diff_hi"), 3), "admitted": ok,
            "loo": loo(J), "threshold": thr[r], "tpr": R(100 * tpr, 1) if tpr is not None else None, "fpr": R(100 * fpr, 1) if fpr is not None else None,
            "holdout": {"tpr": R(100 * h_tpr, 1) if h_tpr is not None else None, "fpr": R(100 * h_fpr, 1) if h_fpr is not None else None, "pos": h_pos, "calm": h_cal},
            "candidates": thr_table.get(r),
        }

    # the count and V on the same sample
    cs = paired([{k: float(v) for k, v in cnt.items()}, v_score], base_ix=1)
    tpr, fpr, npos, ncal = fired_sets({k: 1 if v >= K else 0 for k, v in cnt.items()})
    h = fired_sets({k: 1 if v >= K else 0 for k, v in cnt.items()}, frm=train_to)
    funding["count"] = {"auroc": R(cs["auroc"][0], 3), "lo": R(cs["lo"][0], 3), "hi": R(cs["hi"][0], 3), "v": R(cs["auroc"][1], 3), "v_lo": R(cs["lo"][1], 3), "v_hi": R(cs["hi"][1], 3),
                        "diff": R(cs.get("diff"), 3), "diff_lo": R(cs.get("diff_lo"), 3), "diff_hi": R(cs.get("diff_hi"), 3),
                        "pos": cs["pos"], "neg": cs["neg"], "K": K, "tpr": R(100 * tpr, 1) if tpr is not None else None, "fpr": R(100 * fpr, 1) if fpr is not None else None,
                        "holdout": {"tpr": R(100 * h[0], 1) if h[0] is not None else None, "fpr": R(100 * h[1], 1) if h[1] is not None else None, "pos": h[2], "calm": h[3]},
                        "loo": loo({k: float(v) for k, v in cnt.items()})}
    v_all = sets(v_score)
    funding["v"] = {"auroc": R(auroc([p[0] for p in v_all[0]], v_all[1]), 3), "pos": len(v_all[0]), "neg": len(v_all[1])}

    designs = []
    comp = {}
    chosen = None
    min_share = float(cfg["composite"]["min_share"])
    for dsg in cfg["composite"]["designs"]:
        if not admitted:
            designs.append({"id": dsg["id"], "en": dsg["en"], "ko": dsg["ko"], "skipped": "no admitted signal"})
            continue
        cp = {}
        for e in econs:
            for q in Q:
                cs_ = [component(r, (e, q), float(dsg["level"])) for r in admitted]
                got = [c for c in cs_ if c is not None]
                if got and len(got) >= min_share * len(admitted):
                    cp[(e, q)] = sum(got) / len(got)
        res = paired([cp, v_score], base_ix=1)
        passes = res["lo"][0] is not None and res["auroc"][1] is not None and res["lo"][0] > res["auroc"][1]
        designs.append({"id": dsg["id"], "en": dsg["en"], "ko": dsg["ko"], "auroc": R(res["auroc"][0], 3), "lo": R(res["lo"][0], 3), "hi": R(res["hi"][0], 3),
                        "v": R(res["auroc"][1], 3), "diff": R(res.get("diff"), 3), "diff_lo": R(res.get("diff_lo"), 3), "diff_hi": R(res.get("diff_hi"), 3),
                        "pos": res["pos"], "neg": res["neg"], "pass": passes, "loo": loo(cp)})
        if passes and chosen is None:
            chosen = dsg["id"]
            comp = cp
    funding["designs"] = designs
    funding["admitted"] = admitted
    funding["composite"] = chosen

    # ---- fiscal spells (reported): annual maximum count in the 1-3 years before a spell start
    fv = cfg["validation"]["fiscal"]
    ann = defaultdict(dict)
    for (e, q), c in cnt.items():
        y = int(q[:4])
        ann[e][y] = max(ann[e].get(y, 0), c)
    sov = ctx.get("sovereign") or {}
    spells = [s for s in sov.get("spells", []) if s.get("eco") in econs]
    first_y = int(Q[0][:4]) + 1
    last_y = int(Q[-1][:4])
    fis_rows, fis_pos = [], []
    blocked = defaultdict(set)
    for s in spells:
        for y in range(int(s["y0"]) - int(fv["calm_gap"]), int(s["y1"]) + 1):
            blocked[s["eco"]].add(y)
    for s in spells:
        y0 = int(s["y0"])
        pre = [y0 - k for k in range(int(fv["pre_years"][0]), int(fv["pre_years"][1]) + 1)]
        have = [ann[s["eco"]].get(y) for y in pre if y >= first_y]
        have = [h for h in have if h is not None]
        if not have:
            fis_rows.append({"eco": s["eco"], "start": s["start"], "data": False})
            continue
        m = max(have)
        fis_pos.append(m)
        fis_rows.append({"eco": s["eco"], "start": s["start"], "data": True, "max": m, "hit": m >= K})
    fis_neg = sorted(c for e in econs for y, c in ann[e].items() if first_y <= y <= last_y and y not in blocked[e] and y not in fv["global_years"])
    fiscal = {"spells": fis_rows, "with_data": len(fis_pos), "hits": sum(1 for r in fis_rows if r.get("hit")),
              "hit_rate": R(100 * sum(1 for r in fis_rows if r.get("hit")) / len(fis_pos), 1) if fis_pos else None,
              "calm": len(fis_neg), "false": sum(1 for c in fis_neg if c >= K), "false_rate": R(100 * sum(1 for c in fis_neg if c >= K) / len(fis_neg), 1) if fis_neg else None,
              "auroc": R(auroc(fis_pos, fis_neg), 3), "K": K, "money_flow": {k: sov.get("valid", {}).get(k) for k in ("auroc", "hit_rate", "false_rate", "hits", "episodes")},
              "pre_years": fv["pre_years"], "calm_gap": fv["calm_gap"], "global_years": fv["global_years"]}

    # ---- trade events (reported): count and composite one quarter before the shock against the export fall
    tv = cfg["validation"]["trade"]
    trade_tests = []
    rng = random.Random(SEED)
    for sid, sh in (ctx.get("shocks") or {}).items():
        t0 = int(sh["t0"])
        q0 = qshift(f"{t0 // 100}-{((t0 % 100 - 1) // 3 + 1) * 3:02d}-01", 0)
        qb = qshift(q0, -1)
        rows_ = []
        for srow in sh.get("summary", []):
            e = srow["eco"]
            if e in econs and srow.get("x") is not None and (e, qb) in cnt:
                rows_.append({"eco": e, "count": cnt[(e, qb)], "comp": R(comp.get((e, qb)), 1), "x": srow["x"], "xt": srow.get("xt")})
        xs = [r_["count"] for r_ in rows_]
        ys = [-r_["x"] for r_ in rows_]
        rho = spearman(xs, ys)
        p = None
        if rho is not None:
            perms = int(tv["perms"])
            hits = 0
            yy = ys[:]
            for _ in range(perms):
                rng.shuffle(yy)
                rr = spearman(xs, yy)
                if rr is not None and rr >= rho:
                    hits += 1
            p = (hits + 1) / (perms + 1)
        rc = spearman([r_["comp"] for r_ in rows_ if r_["comp"] is not None], [-r_["x"] for r_ in rows_ if r_["comp"] is not None]) if comp else None
        trade_tests.append({"id": sid, "label": sh["label"], "t0": t0, "q": qb, "n": len(rows_), "rho": R(rho, 2), "p": R(p, 3), "rho_comp": R(rc, 2),
                            "rows": sorted(rows_, key=lambda z: z["x"])})

    # ---- expectations
    exps = []
    for x in cfg["expectations"]:
        kind = x["kind"]
        got, ok = None, None
        if kind == "count_at_least":
            got = cnt.get((x["eco"], x["q"]))
            ok = got is not None and got >= x["n"]
            fired_list = [r for r in RULES if fired[r].get((x["eco"], x["q"]))]
            got = {"count": got, "fired": fired_list}
        elif kind == "count_at_most_span":
            span = [(q, cnt.get((x["eco"], q))) for q in Q if x["from"] <= q <= x["to"]]
            mx = max((c for _, c in span if c is not None), default=None)
            ok = mx is not None and mx <= x["n"]
            got = {"max": mx, "at": [q for q, c in span if c == mx]}
        elif kind == "fires_in_years":
            per = {}
            for y in x["years"]:
                qs = [q for q in Q if q.startswith(str(y))]
                per[str(y)] = [q for q in qs if fired[x["rule"]].get((x["eco"], q))]
            ok = all(per.values())
            got = per
        elif kind == "j4_leads_v":
            per = {}
            ok = True
            for e in x["eco"]:
                a0, a1 = val["j4"].get((e, x["q0"])), val["j4"].get((e, x["q1"]))
                v0, v1 = v_score.get((e, x["q0"])), v_score.get((e, x["q1"]))
                good = None not in (a0, a1, v0, v1) and a1 > a0 and v1 <= v0 + 1
                per[e] = {"j4": [R(a0, 1), R(a1, 1)], "v": [R(v0, 1), R(v1, 1)], "ok": good}
                ok = ok and good
            got = per
        exps.append({"id": x["id"], "en": x["en"], "ko": x["ko"], "pass": bool(ok), "got": got})

    # ---- channel first
    chan_of = {r: c for c, rs in cfg["channels"].items() for r in rs}

    def channel(e, q):
        fl = [r for r in RULES if fired[r].get((e, q))]
        pick = fl or [r for r in RULES if lvl[r].get((e, q)) is not None]
        if not pick:
            return None
        lead = max(pick, key=lambda r: lvl[r].get((e, q)) or 0)
        return chan_of[lead], lead

    # ---- outputs
    first_q = min(q for (e, q) in cnt) if cnt else Q[0]
    QS = [q for q in Q if q >= first_q]
    latest = Q[-1]
    grid = {}
    for e in econs:
        g = {"v": [R(v_score.get((e, q)), 1) for q in QS], "f": [R(brow.get((e, q), {}).get("flow"), 1) for q in QS],
             "cnt": [cnt.get((e, q)) for q in QS], "comp": [R(comp.get((e, q)), 1) for q in QS],
             "lag": [extra.get((e, q), {}).get("lag") for q in QS], "tm": [extra.get((e, q), {}).get("t") for q in QS],
             "ch": [(channel(e, q) or (None, None))[0] for q in QS], "lead": [(channel(e, q) or (None, None))[1] for q in QS],
             "cov": [extra.get((e, q), {}).get("cov") for q in QS],
             "j1n": [extra.get((e, q), {}).get("j1_nm") for q in QS],
             "j3n": [extra.get((e, q), {}).get("j3_nm") for q in QS]}
        for r in RULES:
            g[r] = [R(val[r].get((e, q)), 2) for q in QS]
            g[f"{r}l"] = [R(lvl[r].get((e, q)), 1) for q in QS]
        g["j3f"] = [extra.get((e, q), {}).get("j3_fire") if (e, q) in val["j3"] else None for q in QS]
        grid[e] = g

    # partners: trade-weighted stress network and dual-dependence pairs, at the latest quarter
    def partners_at(q):
        net, pairs = [], []
        vq = {e: brow[(e, q)]["v"] for e in econs if (e, q) in brow and brow[(e, q)]["v"] is not None}
        fq = {e: brow[(e, q)]["flow"] for e in econs if (e, q) in brow}
        for e in econs:
            dd = dest.get((e, q))
            if not dd:
                continue
            for p, s in dd[0].items():
                pv = vq.get(p, float(rules["j4"]["us_v"]) if p == hub else None)
                if pv is None:
                    continue
                net.append({"e": e, "p": p, "w": R(100 * s, 1), "v": R(pv, 1), "f": R(fq.get(p), 1) if p != hub else 0.0, "x": R(s * pv, 2)})
            ld = lend.get((e, q))
            if ld:
                for p, l_ in ld.items():
                    ds = 0.0 if p in non_eco else 100 * dd[0].get(p, 0.0)
                    if min(l_, ds) > 0:
                        pairs.append({"e": e, "p": p, "lend": R(l_, 1), "dest": R(ds, 1), "min": R(min(l_, ds), 1)})
        net.sort(key=lambda z: -z["x"])
        pairs.sort(key=lambda z: -z["min"])
        return net, pairs

    pq = latest
    net, pairs = partners_at(pq)
    if not net:  # the latest quarter's windows may be missing for every economy; step back
        for k in range(1, 4):
            pq = qshift(latest, -k)
            net, pairs = partners_at(pq)
            if net:
                break

    # episodes, spells and events for the chart bands
    bands = {"funding": [{"id": eid, "en": ep["en"], "ko": ep["ko"], "q": ep["q"], "eco": ep["eco"]} for eid, ep in episodes.items()],
             "fiscal": [{"eco": s["eco"], "start": s["start"], "end": s["end"]} for s in spells if s["end"] >= QS[0]],
             "events": [{"id": ev["id"], "start": ev["start"], "en": ev["en"], "ko": ev["ko"], "eco": ev["economies"]} for ev in ctx.get("events", [])]}

    rule_out = []
    for r in RULES:
        c = rules[r]
        rule_out.append({"id": r, "en": c["en"], "ko": c["ko"], "unit": c["unit"], "formula": c["formula"], "money": c["money"], "trade": c["trade"], "dir": c["dir"],
                         "threshold": thr[r], "threshold_from": c["threshold_from"], "slider": c.get("slider"), "channel": c["channel"],
                         "single": {"money": {k: c["single"]["money"][k] for k in ("en", "ko", "dir")}, "trade": {k: c["single"]["trade"][k] for k in ("en", "ko", "dir")}},
                         "fire": c.get("fire"), "scope": c.get("scope"), "min_coverage": c.get("min_coverage"),
                         "n": len(val[r]), "econ": len({e for e, _ in val[r]}), "first": min((q for _, q in val[r]), default=None)})

    index = {"version": cfg["version"], "written": cfg["written"], "K": K, "K_range": cfg["K_range"], "quarters": QS, "latest": latest,
             "econs": econs, "rules": rule_out, "grid": grid, "channels": cfg["channels"],
             "validation": {"funding": funding, "fiscal": fiscal, "trade": trade_tests},
             "expectations": exps, "partners": {"q": pq, "net": net[:400], "pairs": pairs[:60]}, "bands": bands,
             "designs": [{k: d[k] for k in ("id", "en", "ko")} for d in cfg["composite"]["designs"]],
             "train_to": train_to, "trade_max_lag": max_lag}

    # economy files: inputs per rule, partners panel at the latest quarter with data
    eco_files = {}
    for e in econs:
        ins = {"t": [], "lag": [], "x": [], "m": [], "res_net": [], "a2_base": [], "st": [], "need": [], "fp": [], "mp": [], "j4f": [], "cov": [], "d4": [], "slope": [], "terc": [], "com": [], "buf": [], "gdp": [], "j1_nm": []}
        for q in QS:
            b = brow.get((e, q), {})
            w = tw.get((e, q))
            d = extra.get((e, q), {})
            ins["t"].append(w["t"] if w else None)
            ins["lag"].append(w["lag"] if w else None)
            ins["x"].append(R(w["x"], 1) if w else None)
            ins["m"].append(R(w["m"], 1) if w else None)
            ins["res_net"].append(R(b.get("res_net_raw"), 1))     # net reserves, unfloored (registry net_reserves)
            ins["a2_base"].append(R(b.get("res_net"), 1))        # A2's reserve base (registry a2_reserve_base), shown beside
            ins["j1_nm"].append(d.get("j1_nm"))
            ins["st"].append(R(b.get("st"), 1))
            ins["need"].append(d.get("need"))
            ins["fp"].append(d.get("fp")); ins["mp"].append(d.get("mp")); ins["j4f"].append(d.get("j4f")); ins["cov"].append(d.get("cov"))
            ins["d4"].append(d.get("d4")); ins["slope"].append(d.get("slope")); ins["terc"].append(d.get("terc"))
            ins["com"].append(d.get("com")); ins["buf"].append(R(b.get("buf"), 1)); ins["gdp"].append(R(b.get("gdp"), 0))
        # partner panel: the newest quarter with a destination split
        pqe = next((q for q in reversed(QS) if (e, q) in dest), None)
        panel = None
        if pqe:
            sh, _ = dest[(e, pqe)]
            vq = {p: brow[(p, pqe)]["v"] for p in econs if (p, pqe) in brow}
            ld = lend.get((e, pqe)) or {}
            lq = pqe
            if not ld:  # LBS may lag the board by a quarter
                for k in range(1, 3):
                    if lend.get((e, qshift(pqe, -k))):
                        lq = qshift(pqe, -k); ld = lend[(e, lq)]; break
            dests = sorted(sh.items(), key=lambda z: -z[1])[:10]
            panel = {"q": pqe, "t": tw[(e, pqe)]["t"], "lq": lq,
                     "dests": [{"p": p, "share": R(100 * s, 1), "v": R(vq.get(p), 1) if p != hub else 0.0, "board": p in vq or p == hub, "eco": p not in non_eco} for p, s in dests],
                     "lenders": [{"p": p, "share": R(s, 1)} for p, s in sorted(ld.items(), key=lambda z: -z[1])[:10]],
                     "overlap": sorted([{"p": p, "lend": R(l_, 1), "dest": R(100 * sh.get(p, 0), 1), "min": R(min(l_, 100 * sh.get(p, 0)), 1)} for p, l_ in ld.items() if sh.get(p, 0) > 0 and p not in non_eco],
                                       key=lambda z: -z["min"])[:8]}
        ins["mom"] = [R(tw[(e, q)]["mom"], 1) if (e, q) in tw and tw[(e, q)]["lag"] == 0 else None for q in QS]
        sides = {r: {"money": [R(single[r]["money"].get((e, q)), 3) for q in QS], "trade": [R(single[r]["trade"].get((e, q)), 3) for q in QS]} for r in RULES}
        eco_files[e] = {"code": e, "q": QS, "inputs": ins, "single": sides, "partners": panel}

    # ---- change items for /changes (joint kinds computed here): count crossed K; partner stress rose by a tercile
    changes = []
    if len(QS) >= 2:
        q1, q0 = QS[-1], QS[-2]
        j4_pool = sorted(v for (e, q), v in val["j4"].items() if q <= q1)
        t1 = j4_pool[len(j4_pool) // 3] if j4_pool else None
        t2 = j4_pool[2 * len(j4_pool) // 3] if j4_pool else None

        def terc_of(v):
            return None if v is None or t1 is None else (0 if v < t1 else 1 if v < t2 else 2)
        for e in econs:
            c0, c1 = cnt.get((e, q0)), cnt.get((e, q1))
            if c0 is not None and c1 is not None and (c0 >= K) != (c1 >= K):
                changes.append({"eco": e, "side": "both", "kind": "stress_count", "q": q1, "count": [c0, c1], "K": K,
                                "fired": [r for r in RULES if fired[r].get((e, q1))]})
            a0, a1 = val["j4"].get((e, q0)), val["j4"].get((e, q1))
            if terc_of(a0) is not None and terc_of(a1) is not None and terc_of(a1) > terc_of(a0):
                changes.append({"eco": e, "side": "both", "kind": "partner_stress", "q": q1, "j4": [R(a0, 1), R(a1, 1)], "terc": [terc_of(a0), terc_of(a1)]})

    summary = {"admitted": admitted, "composite": chosen, "thresholds": thr, "count_auroc": funding["count"]["auroc"], "v_auroc": funding["v"]["auroc"],
               "expectations": {x["id"]: x["pass"] for x in exps}, "rules": {r: {k: funding["rules"][r][k] for k in ("auroc", "inc", "inc_lo", "inc_hi", "admitted", "threshold")} for r in RULES},
               "fiscal": {k: fiscal[k] for k in ("with_data", "hits", "hit_rate", "false_rate", "auroc")},
               "trade": [{k: t[k] for k in ("id", "n", "rho", "p")} for t in trade_tests]}
    return index, eco_files, changes, summary
