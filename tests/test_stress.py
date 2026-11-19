"""Stress signals (scripts/stress.py): hand checks and the no-look-ahead property.

    uv run --with pytest==8.4.2 --with brotli==1.1.0 --with pyyaml==6.0.3 pytest -q tests/test_stress.py

The first group needs no data; the second reads the built files under data/ (run scripts/build.py first) and is
skipped when they are missing.
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE / "scripts"))
import stress  # noqa: E402


# ---------------------------------------------------------------- pure functions
def test_import_cover_by_hand():
    # 240 bn of net reserves against 480 bn of imports a year = 40 bn a month = 6 months
    assert stress.import_cover(240.0, 480.0) == pytest.approx(6.0)
    assert stress.import_cover(None, 480.0) is None
    assert stress.import_cover(240.0, 0) is None


def test_financing_need_by_hand():
    # 100 bn short-term debt + a 2% of GDP deficit on 1,000 bn GDP = 120 bn, over 400 bn of exports = 30%
    assert stress.financing_need(100.0, -2.0, 1000.0, 400.0) == pytest.approx(30.0)
    # a surplus adds nothing
    assert stress.financing_need(100.0, 3.0, 1000.0, 400.0) == pytest.approx(25.0)


def test_partner_weights_sum_to_one_and_coverage():
    shares = {"USA": 0.20, "CHN": 0.25, "HKG": 0.10, "VNM": 0.05, "JPN": 0.05}
    w, cov = stress.partner_weights(shares, {"USA", "CHN", "JPN"})
    assert sum(w.values()) == pytest.approx(1.0)
    assert cov == pytest.approx(50.0)
    assert set(w) == {"USA", "CHN", "JPN"}
    assert w["CHN"] == pytest.approx(0.25 / 0.50)


def test_overlap_is_the_sum_of_minima():
    assert stress.overlap({"USA": 30, "GBR": 20, "JPN": 10}, {"USA": 15, "JPN": 25, "CHN": 30}) == pytest.approx(15 + 10)


def test_own_percentile_never_looks_ahead():
    rng = random.Random(7)
    qs = [f"q{i:03d}" for i in range(40)]
    vals = [rng.gauss(0, 1) for _ in qs]
    base = stress.own_pct(list(zip(qs, vals)), 8)
    # change every value after quarter 25: no percentile up to quarter 25 may move
    later = vals[:26] + [v * 10 + 5 for v in vals[26:]]
    moved = stress.own_pct(list(zip(qs, later)), 8)
    for q in qs[:26]:
        assert base.get(q) == moved.get(q)
    # the first eight quarters get none
    assert all(q not in base for q in qs[:8])


def test_own_signal_floor_and_cap():
    h = [10.0] * 12
    # a flat history: the scale is the floor, so a move of one floor is one third of the way to the cap
    assert stress.own_signal(h + [11.0], 11.0, 1.0, 8, 3.0) == pytest.approx(50 + 50 / 3)
    assert stress.own_signal(h + [100.0], 100.0, 1.0, 8, 3.0) == pytest.approx(100.0)
    assert stress.own_signal(h[:5], 11.0, 1.0, 8, 3.0) is None


def test_auroc_and_spearman():
    assert stress.auroc([3, 4], sorted([1, 2])) == 1.0
    assert stress.auroc([1], sorted([1])) == 0.5
    assert stress.spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]) == pytest.approx(1.0)
    assert stress.spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]) == pytest.approx(-1.0)


# ---------------------------------------------------------------- the built data
DATA = HERE / "data"


def rd(name: str):
    brotli = pytest.importorskip("brotli")
    p = DATA / f"{name}.json.br"
    if not p.exists():
        pytest.skip(f"no {p}; run scripts/build.py")
    return json.loads(brotli.decompress(p.read_bytes()))


def test_korea_2008q3_j1_j2_by_hand():
    s = rd("stress")
    e = rd("stress/KOR")
    k = s["quarters"].index("2008-09-30")
    i = e["inputs"]
    b = rd("board")["KOR"]
    kb = b["q"].index("2008-09-30")
    # J1 = net reserves / (12-month imports / 12)
    assert s["grid"]["KOR"]["j1"][k] == pytest.approx(i["res_net"][k] / (i["m"][k] / 12), abs=0.02)
    # J2 = (st + max(0, -CA% x GDP)) / exports
    need = b["st"][kb] + max(0.0, -b["ca"][kb]) * b["gdp"][kb] / 100
    assert s["grid"]["KOR"]["j2"][k] == pytest.approx(100 * need / i["x"][k], abs=0.05)
    assert i["t"][k] == 200809


def test_count_matches_fired_rules_at_default_thresholds():
    s = rd("stress")
    thr = {r["id"]: r["threshold"] for r in s["rules"]}
    dirs = {r["id"]: r["dir"] for r in s["rules"]}
    for e, g in s["grid"].items():
        for k, c in enumerate(g["cnt"]):
            if c is None:
                continue
            n = 0
            for r in thr:
                if r == "j3":
                    n += 1 if g["j3f"][k] else 0
                    continue
                v = g[r][k]
                if v is None:
                    continue
                n += 1 if (v <= thr[r] if dirs[r] == "low" else v >= thr[r]) else 0
            assert n == c, (e, s["quarters"][k])


def test_no_trade_window_after_the_quarter():
    s = rd("stress")
    for e, g in s["grid"].items():
        for q, tm in zip(s["quarters"], g["tm"]):
            if tm is not None:
                assert tm <= int(q[:4]) * 100 + int(q[5:7]), (e, q, tm)


def test_admitted_only_with_interval_above_zero():
    s = rd("stress")
    f = s["validation"]["funding"]
    for r, x in f["rules"].items():
        assert x["admitted"] == (x["inc_lo"] is not None and x["inc_lo"] > 0), r
    assert (f["composite"] is None) == (not f["admitted"] or not any(d.get("pass") for d in f["designs"]))
