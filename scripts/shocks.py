"""Shock replays (config/shocks.yaml): month-by-month trade along three waves, with the funding overlay.

Called from build.py as build_shocks(ctx). For each replay it writes one object, read by the app's ShockReplay:

  frames      the months t0+from .. t0+to; a month after trade-flow's last shown month has no trade (`nodata`)
  nodes       origins (wave 1), direct importers (wave 2), third markets (wave 3), with map positions (lat/lon,
              nudged apart) and per-frame completeness (trade-flow `c`, 12-month windows of all goods)
  edges       origin -> importer (wave-1 products) and importer -> third market (wave-3 products), per frame:
              v = the 12-month window's value (USD bn, width), y = the 3-month window against the same 3 months a year
              earlier (%, colour); a month where trade-flow writes no window of that length (trade-flow skips it) holds the
              month before and is marked
  waves       the three waves' 3-month totals against a year earlier, per frame, and the month each bottomed
  finance     per board economy and quarter: F, V, A2 (scored only), and the crossings (V up through 60, A2 up
              through 100%) that the page pulses
  dollar      the broad dollar index (FRED DTWEXBGS, weekly mean) and Fed liquidity swaps outstanding (FRED SWPT)
  summary     every board economy: its worst 3-month export change (t0 .. t0+12), its F drop (worst of four quarters
              from t0's against the quarter before), its quadrant in the summary year; medians by quadrant

Observed data only: no model, no attribution (rules G8, G10 spirit). Values follow trade-flow: share x world.
"""
from __future__ import annotations

import math
import statistics
from pathlib import Path

import yaml

COMPLETE = 0.9


def month_add(t: int, k: int) -> int:
    y, m = divmod(t, 100)
    m += k
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return y * 100 + m


def qend_of(t: int) -> str:
    y, m = divmod(t, 100)
    qm = ((m - 1) // 3 + 1) * 3
    day = {3: 31, 6: 30, 9: 30, 12: 31}[qm]
    return f"{y}-{qm:02d}-{day}"


def ym(s) -> int:
    s = str(s)
    return int(s[:4]) * 100 + int(s[5:7])


class Windows:
    """trade-flow's monthly windows (snap/W/<slug>/<year>.w<w>), as {(s, t): USD} edges and {node: (x, m)} rows."""

    def __init__(self, tf_data: Path, rd_br, nodes: list[dict]):
        self.root, self.rd, self.nodes = tf_data, rd_br, nodes
        self.files: dict = {}
        self.cache: dict = {}

    def snap(self, slug: str, w: int, t: int):
        key = (slug, w, t)
        if key in self.cache:
            return self.cache[key]
        fk = (slug, w, t // 100)
        if fk not in self.files:
            p = self.root / "snap" / "W" / slug / f"{t // 100}.w{w}.json.br"
            self.files[fk] = self.rd(p) if p.exists() else None
        f = self.files[fk]
        out = None
        if f:
            for s in f["snaps"]:
                if s["t"] == t:
                    nc, ec = f["ncols"], f["ecols"]
                    world = s["world"]
                    ii, ix, im = nc.index("i"), nc.index("x"), nc.index("m")
                    es, et, ew = ec.index("s"), ec.index("t"), ec.index("w")
                    out = {"edges": {(self.nodes[e[es]]["id"], self.nodes[e[et]]["id"]): e[ew] * world for e in s["edges"]},
                           "rows": {self.nodes[r[ii]]["id"]: (r[ix] * world, r[im] * world) for r in s["nodes"]}}
                    break
        self.cache[key] = out
        return out

    def edge(self, slugs: list[str], w: int, t: int, s: str, d: str):
        tot, seen = 0.0, False
        for sl in slugs:
            sn = self.snap(sl, w, t)
            if sn is None:
                return None  # no window of this length ends in this month
            v = sn["edges"].get((s, d))
            if v is not None:
                tot += v
                seen = True
        return tot if seen else 0.0

    def exports(self, slugs: list[str], w: int, t: int, e: str):
        tot = 0.0
        for sl in slugs:
            sn = self.snap(sl, w, t)
            if sn is None:
                return None
            r = sn["rows"].get(e)
            if r:
                tot += r[0]
        return tot

    def imports(self, slugs: list[str], w: int, t: int, e: str):
        tot = 0.0
        for sl in slugs:
            sn = self.snap(sl, w, t)
            if sn is None:
                return None
            r = sn["rows"].get(e)
            if r:
                tot += r[1]
        return tot


def yoy(a, b):
    if a is None or b is None or b <= 0:
        return None
    return 100.0 * (a / b - 1.0)


def spread(pos: dict[str, list[float]], min_d: float = 0.045, iters: int = 400) -> dict[str, list[float]]:
    """Nudge map positions apart so no two nodes are closer than min_d (normalised units), keeping them near home."""
    home = {k: v[:] for k, v in pos.items()}
    keys = list(pos)
    for _ in range(iters):
        moved = False
        for i, a in enumerate(keys):
            for b in keys[i + 1:]:
                dx, dy = pos[b][0] - pos[a][0], pos[b][1] - pos[a][1]
                d = math.hypot(dx, dy)
                if d < min_d:
                    if d < 1e-6:
                        dx, dy, d = 0.001, 0.0005, 0.0011
                    push = (min_d - d) / 2
                    ux, uy = dx / d, dy / d
                    pos[a][0] -= ux * push; pos[a][1] -= uy * push
                    pos[b][0] += ux * push; pos[b][1] += uy * push
                    moved = True
        for k in keys:  # a weak pull home
            pos[k][0] += (home[k][0] - pos[k][0]) * 0.02
            pos[k][1] += (home[k][1] - pos[k][1]) * 0.02
        if not moved:
            break
    return {k: [round(min(0.98, max(0.02, v[0])), 4), round(min(0.97, max(0.03, v[1])), 4)] for k, v in pos.items()}


def project(lat: float, lon: float) -> list[float]:
    # equirectangular, cropped to the inhabited band (lat 72 N .. 47 S), longitudes from 170 W; the Americas left
    return [(lon + 170.0) / 360.0 if lon >= -170 else (lon + 530.0) / 360.0, (72.0 - lat) / 119.0]


def build_shocks(ctx: dict) -> tuple[dict, dict]:
    R, rd_br = ctx["R"], ctx["rd_br"]
    cfg = yaml.safe_load(Path(ctx["config"]).read_text())
    tf_meta = ctx["tf_meta"]
    nodes_meta = tf_meta["nodes"]
    by_id = {n["id"]: n for n in nodes_meta}
    shown = tf_meta["shown"]["W"]
    cov_m = {int(k): v for k, v in tf_meta["coverage"]["M"].items()}
    skip = {int(k): v for k, v in tf_meta["windows"]["skip"].items()}
    W = Windows(ctx["tf_data"], rd_br, nodes_meta)
    nodes_tot = rd_br(ctx["tf_data"] / "nodes" / "W" / "TOTAL.json.br")
    comp = {}
    for w in ("3", "12"):
        blk = nodes_tot[w]
        comp[w] = {nodes_meta[i]["id"]: dict(zip(blk["t"], blk["c"][k])) for k, i in enumerate(blk["ids"])}
    board, econs, hub = ctx["board"], set(ctx["econs"]), ctx["hub"]
    earn = ctx["earn"]
    events = {e["id"]: e for e in yaml.safe_load(Path(ctx["events_yaml"]).read_text())["events"]}
    con, sig = ctx["con"], ctx["signals"]

    def has(w: int, t: int) -> bool:
        return t <= shown and (t % 100) not in skip.get(w, [])

    index, out = [], {}
    for rp in cfg["replays"]:
        ev = events.get(rp["id"])
        if not ev:
            raise SystemExit(f"shocks.yaml: no trade-flow event {rp['id']}")
        t0, base = ym(rp["t0"]), ym(rp["base"])
        months = [month_add(t0, k) for k in range(rp["from"], rp["to"] + 1)]
        s1, s3 = rp["wave1"]["products"], rp["wave3"]["products"]
        origins = rp["origins"]
        # check (c) of the About page: every replay month at or before the shown month that is not a skip month must
        # have a 12-month window in trade-flow for every slug the replay draws (missing ones are listed, never guessed)
        slugs = sorted(set(s1 + s3 + ["TOTAL"]))
        exp_months = [m for m in months if m <= shown and has(12, m)]
        missing = [m for m in exp_months if any(W.snap(sl, 12, m) is None for sl in slugs)]
        windows = {"expected": len(exp_months), "found": len(exp_months) - len(missing), "missing": missing, "slugs": slugs}
        if missing:
            print(f"  shock {rp['id']}: {len(missing)} of {len(exp_months)} months lack a 12-month window for {slugs}: {missing[:6]}{'...' if len(missing) > 6 else ''}")
        # ---- wave 2: direct importers of the origins' wave-1 goods in the base window
        b12 = {sl: W.snap(sl, 12, base) for sl in s1}
        if any(v is None for v in b12.values()):
            raise SystemExit(f"{rp['id']}: no 12-month window ending {base} for {s1}")
        from_o: dict[str, float] = {}
        for sl, sn in b12.items():
            for (s, d), v in sn["edges"].items():
                if s in origins and d not in origins:
                    from_o[d] = from_o.get(d, 0.0) + v
        cand = sorted(from_o.items(), key=lambda kv: -kv[1])
        wave2 = []
        for d, v in cand:
            imp = W.imports(s1, 12, base, d) or 0.0
            if imp > 0 and v / imp >= rp["wave2"]["min_share"]:
                wave2.append({"id": d, "from_origins_bn": R(v / 1e9, 2), "share": R(100 * v / imp, 1)})
            if len(wave2) >= rp["wave2"]["n"]:
                break
        w2 = [x["id"] for x in wave2]
        # ---- wave 3: where the importers sell wave-3 goods, origins and importers left out
        sales: dict[str, float] = {}
        per_src: dict[str, list] = {}
        for sl in s3:
            sn = W.snap(sl, 12, base)
            for (s, d), v in sn["edges"].items():
                if s in w2 and d not in w2 and d not in origins and d != "WLD":
                    sales[d] = sales.get(d, 0.0) + v
                    per_src.setdefault(s, []).append((d, v))
        w3 = [d for d, _ in sorted(sales.items(), key=lambda kv: -kv[1])[: rp["wave3"]["n"]]]
        # ---- the drawn edges
        edges = []
        for d in w2:  # each importer from its three largest origins
            o_rank = sorted(((o, sum(b12[sl]["edges"].get((o, d), 0.0) for sl in s1)) for o in origins), key=lambda kv: -kv[1])
            for o, v in o_rank[:3]:
                if v > 0:
                    edges.append({"s": o, "t": d, "wave": 2, "p": s1})
        for s in w2:  # each importer to its `per` largest third markets
            agg: dict[str, float] = {}
            for d, v in per_src.get(s, []):
                if d in w3:
                    agg[d] = agg.get(d, 0.0) + v
            for d, _ in sorted(agg.items(), key=lambda kv: -kv[1])[: rp["wave3"]["per"]]:
                edges.append({"s": s, "t": d, "wave": 3, "p": s3})
        # ---- frames: 12-month value (width) and 3-month change on a year earlier (colour), holding skipped months
        nodata = [m > shown for m in months]
        for e in edges:
            v12, y3, held = [], [], []
            last_v = last_y = None
            for m in months:
                if m > shown:
                    v12.append(None); y3.append(None); held.append(0)
                    continue
                h = 0
                if has(12, m):
                    v = W.edge(e["p"], 12, m, e["s"], e["t"])
                    last_v = R(v / 1e9, 3) if v is not None else None
                else:
                    h = 1
                if has(3, m) and has(3, month_add(m, -12)):
                    a, b = W.edge(e["p"], 3, m, e["s"], e["t"]), W.edge(e["p"], 3, month_add(m, -12), e["s"], e["t"])
                    last_y = R(yoy(a, b), 1) if a and b else None
                else:
                    h = 1
                v12.append(last_v); y3.append(last_y); held.append(h)
            e["v"], e["y"], e["held"] = v12, y3, held
            del e["p"]
        # ---- wave totals (3-month windows against a year earlier)
        def wave_series(fn):
            out_s = []
            for m in months:
                if m > shown or not (has(3, m) and has(3, month_add(m, -12))):
                    out_s.append(None)
                    continue
                out_s.append(R(yoy(fn(m), fn(month_add(m, -12))), 1))
            return out_s
        def w1(m):
            vals = [W.exports(s1, 3, m, o) for o in origins]
            return None if any(v is None for v in vals) else sum(vals)
        def w2f(m):
            vals = [W.edge(s1, 3, m, o, d) for o in origins for d in w2]
            return None if any(v is None for v in vals) else sum(vals)
        def w3f(m):
            vals = [W.edge(s3, 3, m, s, d) for s in w2 for d in w3]
            return None if any(v is None for v in vals) else sum(vals)
        waves = {"1": wave_series(w1), "2": wave_series(w2f), "3": wave_series(w3f)}
        trough = {}
        for k, s in waves.items():
            pts = [(v, months[i]) for i, v in enumerate(s) if v is not None and months[i] >= month_add(t0, -2)]
            if pts:
                v, m = min(pts)
                trough[k] = {"t": m, "v": v}
        # ---- nodes
        ids = origins + w2 + [d for d in w3 if d not in w2]
        pos = {}
        for e in ids:
            n = by_id.get(e)
            pos[e] = project(n["lat"], n["lon"]) if n and n.get("lat") is not None else [0.5, 0.5]
        # fit the nodes' own extent (a stretched projection, as trade-flow's maps), then nudge them apart
        xs_, ys_ = [v[0] for v in pos.values()], [v[1] for v in pos.values()]
        x0, x1, y0, y1 = min(xs_), max(xs_), min(ys_), max(ys_)
        pos = {k: [0.04 + 0.92 * (v[0] - x0) / ((x1 - x0) or 1), 0.05 + 0.9 * (v[1] - y0) / ((y1 - y0) or 1)] for k, v in pos.items()}
        pos = spread(pos, min_d=0.075)
        node_rows = []
        for e in ids:
            wave = 1 if e in origins else 2 if e in w2 else 3
            c = [R(comp["12"].get(e, {}).get(m), 3) if m <= shown and has(12, m) else None for m in months]
            node_rows.append({"id": e, "wave": wave, "xy": pos[e], "board": e in econs, "c": c,
                              **({"from_origins_bn": next(x["from_origins_bn"] for x in wave2 if x["id"] == e), "share": next(x["share"] for x in wave2 if x["id"] == e)} if wave == 2 else {})})
        # ---- finance overlay: the quarters the timeline touches
        qs = sorted({qend_of(m) for m in months} | {qend_of(month_add(months[0], -3))})
        fin = {}
        for e in ids + [x for x in sorted(econs) if x not in ids]:
            b = board.get(e)
            if not b:
                continue
            rows = {}
            for i, q in enumerate(b["q"]):
                if q in qs:
                    prev_v = b["v"][i - 1] if i > 0 else None
                    prev_a2 = b["a2"][i - 1] if i > 0 else None
                    scored = b["a2_scored"][i] == 1
                    rows[q] = {"f": b["flow"][i], "v": b["v"][i], "a2": b["a2"][i] if scored else None,
                               "vx": 1 if (prev_v is not None and b["v"][i] is not None and prev_v < 60 <= b["v"][i]) else 0,
                               "ax": 1 if (scored and prev_a2 is not None and b["a2"][i] is not None and prev_a2 < 100 <= b["a2"][i]) else 0}
            fin[e] = rows
        # ---- the dollar strip: weekly
        d0, d1 = f"{months[0] // 100}-{months[0] % 100:02d}-01", f"{months[-1] // 100}-{months[-1] % 100:02d}-28"
        dol = con.sql(f"select strftime(date_trunc('week', period), '%Y-%m-%d') w, avg(value_usd) from '{sig}' where measure='dollar_index' and period between '{d0}' and '{d1}' group by 1 order by 1").fetchall()
        swp = con.sql(f"select strftime(date_trunc('week', period), '%Y-%m-%d') w, avg(value_usd) from '{sig}' where measure='swap_lines' and period between '{d0}' and '{d1}' group by 1 order by 1").fetchall()
        # ---- summary: every board economy
        yi = earn["years"].index(rp["summary"]) if rp["summary"] in earn["years"] else None
        q0 = qend_of(t0)
        summ = []
        for e in sorted(econs):
            worst = None
            for m in months:
                if m < t0 or m > month_add(t0, 12) or m > shown or not (has(3, m) and has(3, month_add(m, -12))):
                    continue
                c_now, c_then = comp["3"].get(e, {}).get(m), comp["3"].get(e, {}).get(month_add(m, -12))
                if c_now is None or c_then is None or c_now < COMPLETE or c_then < COMPLETE:
                    continue
                v = yoy(W.exports(["TOTAL"], 3, m, e), W.exports(["TOTAL"], 3, month_add(m, -12), e))
                if v is not None and (worst is None or v < worst[0]):
                    worst = (v, m)
            b = board.get(e)
            f_hit = f_low = f_before = None
            if b and q0 in b["q"]:
                i0 = b["q"].index(q0)
                f_before = b["flow"][i0 - 1] if i0 > 0 else None
                window = [b["flow"][j] for j in range(i0, min(i0 + 4, len(b["q"]))) if b["flow"][j] is not None]
                if window and f_before is not None:
                    f_low = min(window)
                    f_hit = f_low - f_before
            quad = earn["econ"].get(e, {}).get("q", [None])[yi] if yi is not None else None
            wave = 1 if e in origins else 2 if e in w2 else 3 if e in w3 else None
            summ.append({"eco": e, "x": R(worst[0], 1) if worst else None, "xt": worst[1] if worst else None,
                         "f0": R(f_before, 1), "f1": R(f_low, 1), "fd": R(f_hit, 1), "quad": quad, "wave": wave})
        summ.sort(key=lambda r: (r["x"] is None, r["x"] if r["x"] is not None else 0))
        med = {}
        for qd in ("trade", "finance", "both", "neither"):
            xs = [r["x"] for r in summ if r["quad"] == qd and r["x"] is not None]
            fs = [r["fd"] for r in summ if r["quad"] == qd and r["fd"] is not None]
            med[qd] = {"n": len([r for r in summ if r["quad"] == qd]), "x": R(statistics.median(xs), 1) if xs else None, "nx": len(xs),
                       "fd": R(statistics.median(fs), 1) if fs else None, "nf": len(fs)}
        obj = {
            "id": rp["id"], "label": rp["label"], "note": rp.get("note"),
            "event": {"num": ev.get("num"), "start": str(ev.get("start")), "end": str(ev["end"]) if ev.get("end") else None, "ongoing": bool(ev.get("ongoing")),
                      "kind": ev.get("kind"), "title": ev.get("title"), "dek": ev.get("dek"), "economies": ev.get("economies")},
            "t0": t0, "base": base, "months": months, "shown": shown, "nodata": nodata, "windows": windows,
            "coverage": [cov_m.get(m) for m in months],
            "wave1": rp["wave1"]["label"], "wave3": rp["wave3"]["label"], "products": {"1": s1, "3": s3},
            "rule": {"n2": rp["wave2"]["n"], "min_share": rp["wave2"]["min_share"], "n3": rp["wave3"]["n"], "per": rp["wave3"]["per"]},
            "nodes": node_rows, "edges": edges, "waves": waves, "trough": trough,
            "quarters": qs, "finance": fin,
            "dollar": [[w, R(v, 2)] for w, v in dol], "swap": [[w, R(v, 1)] for w, v in swp],
            "summary": summ, "medians": med, "summary_year": rp["summary"],
        }
        out[rp["id"]] = obj
        index.append({"id": rp["id"], "label": rp["label"], "t0": t0, "ongoing": bool(ev.get("ongoing")), "title": ev.get("title")})
        print(f"  shock {rp['id']}: waves 1={origins} 2={w2} 3={w3}; troughs {trough}; months {months[0]}-{months[-1]} (data to {min(shown, months[-1])})")
    return {"replays": index}, out
