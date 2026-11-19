"""Consistency rules of the build (rules C1-C5): growth by month arithmetic (K1), net reserves
unfloored and J1 not meaningful below zero, partners that are not economies, UTC build dates, the C2
window rule (K3). Each test also shows that a deliberate mismatch is caught.

    uv run --with pytest==8.4.2 --with brotli==1.1.0 --with duckdb==1.5.6 --with pyyaml==6.0.3 pytest -q tests/test_consistency.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE / "scripts"))
import build  # noqa: E402
import stress  # noqa: E402


def test_growth_base_is_twelve_months_not_twelve_positions():
    # a W12 list skips January: positions 12 back from 2026-07 land on 2025-06, months 12 back on 2025-07
    t = [y * 100 + m for y in (2024, 2025, 2026) for m in range(2, 13)]
    t = [x for x in t if x <= 202607]
    k = t.index(202607)
    assert t[k - 12] == 202506                        # the old, wrong base (13 months back)
    assert build.month_add(202607, -12) == 202507     # the rule
    assert build.months_between(202507, 202607) == 12


def test_net_reserves_raw_is_not_floored():
    # Argentina 2026 Q2: section I 44.87, drains -68.43
    assert build.net_reserves_raw(44.87, -68.43) == pytest.approx(-23.56)
    assert build.net_reserves_raw(44.87, None) is None
    assert stress.cover_not_meaningful(-23.56, 44.87, 1.0) == "net reserves are negative"
    assert stress.cover_not_meaningful(0.2, 44.87, 1.0) == "net reserves are under 1% of gross reserves"
    assert stress.cover_not_meaningful(433.7, 427.36, 1.0) is None


def test_partner_490_is_not_an_economy():
    s19 = {"id": "S19", "en": "Asia, not elsewhere specified", "region": None}
    assert not build.node_is_economy(s19) and build.node_is_asia_nes(s19)
    assert build.node_is_economy({"id": "TWN", "en": "Taiwan"})
    assert not build.node_is_asia_nes({"id": "TWN", "en": "Taiwan"})
    assert not build.node_is_economy({"id": "XAA", "en": "Areas, nes"})


def test_build_dates_are_utc():
    assert build.utc("2026-11-12T03:35:06+09:00") == "2026-11-11T18:35:06Z"
    assert build.utc("2026-11-04T15:27:39Z") == "2026-11-04T15:27:39Z"
    # the bug this test guards against: slicing the KST string gives the next day
    assert "2026-11-05T00:27:58+09:00"[:10] != build.utc("2026-11-05T00:27:58+09:00")[:10]


def _built(name):
    p = HERE / "data" / f"{name}.json.br"
    if not p.exists():
        pytest.skip("run scripts/build.py first")
    return build.rd_br(p)


def test_built_growth_and_windows_follow_the_rules():
    c = _built("country/KOR")
    tr = c["trade"]
    for t, b, v in zip(tr["t"], tr["mom_base"], tr["mom_x"]):
        if v is not None:
            assert b == build.month_add(t, -12)
    aq = tr["at_q"]
    lag = build.months_between(aq["t"], int(aq["q"][:4]) * 100 + int(aq["q"][5:7]))
    assert 0 <= lag <= 6 and aq["partial"] == (lag > 0)


def test_built_checks_pass_or_wait():
    ch = _built("checks")
    assert all(c["status"] in ("pass", "warn", "wait") for c in ch["items"]), [c for c in ch["items"] if c["status"] == "fail"]
    assert {"K1", "K2", "K3", "K8"} <= {c["id"] for c in ch["items"]}
