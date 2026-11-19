"""The /svc/v1 views (api/docs/SVC-CONTRACT.md, global-network/api.yaml) against a running server: every economy,
every replay, every stress economy and signal, a sample of pairs; no restricted or commercial source, no oversized
answer, English summaries, the guard.

    SVC_BASE=http://127.0.0.1:3513 uv run --with pytest==8.4.2 --with pyyaml==6.0.3 pytest -q tests/test_svc.py

Skipped when SVC_BASE is not set. The contract's own checker (api/scripts/svc_check.py) covers the envelope and the
hooks; this file adds the licence gate (R14, G9: no commercial data in any form) and the size budget on every id.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pytest
import yaml

BASE = os.environ.get("SVC_BASE", "").rstrip("/")
pytestmark = pytest.mark.skipif(not BASE, reason="set SVC_BASE to a running global-network server")

HERE = Path(__file__).resolve().parent.parent
MANIFEST = yaml.safe_load((HERE / "api.yaml").read_text(encoding="utf-8"))
MAX = {v["id"]: int(v.get("max_bytes", 60000)) for v in MANIFEST["views"]}
# contract: "a default answer should be well under 20,000 bytes"; contract 1.1 adds `basis` (every number's measure and
# period) and the vintage note, about 2-8 kB, so the default budget is 30,000 since 17 Nov 2026
DEFAULT_BUDGET = 30000

# R14 / G9: no commercial vendor, in any form (wider than the contract checker's list)
VENDORS = re.compile(r"\b(EPFR|Lipper|LSEG|Refinitiv|Capital IQ|S&P Capital|S&P Global|Bloomberg|FactSet|Haver|CEIC|Datastream|Markit|MSCI|Morningstar|ICE Data)\b", re.I)
# the licences of lib/sources.ts: open statistics, public domain, derived Comtrade records, open government data, the sites' own lists
LICENCES = {"open, with attribution", "CC BY 4.0", "public domain, citation requested", "public domain", "derived records only (shares × world total)", "open government data (data.go.kr terms)", "this site"}
RESTRICTED = re.compile(r'"(publishable|restricted|licence_gate|vendor)"\s*:', re.I)
HANGUL = re.compile(r"[가-힣]")


def get(path: str, host: str = "global-network", extra: dict | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(BASE + path, headers={"Host": host, "Accept": "application/json", **(extra or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def check(path: str, view: str, budget: int | None = None) -> dict:
    s, b = get(path)
    assert s == 200, f"{path}: {s} {b[:200]!r}"
    assert len(b) <= MAX.get(view, 60000), f"{path}: {len(b):,} bytes over max_bytes"
    if budget:
        assert len(b) <= budget, f"{path}: default answer {len(b):,} bytes over {budget:,}"
    text = b.decode("utf-8")
    assert not VENDORS.search(text), f"{path}: commercial vendor name {VENDORS.search(text).group(0)}"
    assert not RESTRICTED.search(text), f"{path}: restricted marker"
    body = json.loads(b)
    for src in body.get("sources", []):
        assert src["licence"] in LICENCES, f"{path}: licence {src['licence']!r} not in the allow-list"
        assert not VENDORS.search(src["publisher"] + src["dataset"]), f"{path}: commercial source {src}"
    assert 0 < len(body["summary"]) <= 600 and not HANGUL.search(body["summary"]), f"{path}: summary"
    t = body.get("table")
    if t:
        assert all(len(r) == len(t["columns"]) for r in t["rows"]), f"{path}: table rows misaligned"
    return body


def codes() -> list[str]:
    s, b = get("/svc/v1/economies")
    assert s == 200
    return [e["code"] for e in json.loads(b)["data"]["economies"]]


def test_every_country_sheet_and_hook():
    cs = codes()
    assert len(cs) == 37 and "USA" in cs and "KOR" in cs
    for c in cs:
        for lang in ("en", "ko"):
            check(f"/svc/v1/countries/{c}?lang={lang}", "country", DEFAULT_BUDGET)
        for part in ("funding", "trade"):
            check(f"/svc/v1/countries/{c}?part={part}", "country")
        d = check(f"/svc/v1/economy/{c}", "economy", DEFAULT_BUDGET)["data"]
        assert d["covered"] is True and 0 < len(d["headline"]) <= 8
        it = check(f"/svc/v1/item?id=country:{c}", "item", DEFAULT_BUDGET)["data"]
        assert it["id"] == f"country:{c}" and len(it["text"]) <= 20000


def test_pairs_sample():
    cs = codes()
    pairs = [("KOR", b) for b in cs if b != "KOR"] + [(a, "KOR") for a in cs if a != "KOR"] + [(cs[i], cs[(i * 7 + 3) % len(cs)]) for i in range(len(cs)) if cs[i] != cs[(i * 7 + 3) % len(cs)]]
    for a, b in pairs:
        d = check(f"/svc/v1/pairs/{a}/{b}", "pair", DEFAULT_BUDGET)["data"]
        assert d["a"] == a and d["b"] == b
    for h in ("goods", "bank", "portfolio", "fdi", "ratio"):
        for a, b in pairs[:12]:
            s, _ = get(f"/svc/v1/pairs/{a}/{b}?history={h}")
            assert s in (200, 404)
            if s == 200:
                check(f"/svc/v1/pairs/{a}/{b}?history={h}", "pair")
    it = check("/svc/v1/item?id=pair:KOR-USA", "item")["data"]
    assert len(it["text"]) <= 20000


def test_every_shock_replay():
    s, b = get("/svc/v1/shocks")
    ids = [r["id"] for r in json.loads(b)["data"]["replays"]]
    assert ids
    for i in ids:
        for lang in ("en", "ko"):
            check(f"/svc/v1/shocks/{i}?lang={lang}", "shock", DEFAULT_BUDGET)
        check(f"/svc/v1/shocks/{i}?economy=KOR", "shock", DEFAULT_BUDGET)
        check(f"/svc/v1/shocks/{i}?part=network", "shock")
        check(f"/svc/v1/shocks/{i}?part=dollar", "shock")
        it = check(f"/svc/v1/item?id=shock:{i}", "item", DEFAULT_BUDGET)["data"]
        assert len(it["text"]) <= 20000


def test_stress_board_economies_and_signals():
    b = check("/svc/v1/stress", "stress", DEFAULT_BUDGET)
    assert b["data"]["composite"] is None and len(b["data"]["economies"]) == 36
    assert "G19" in b["summary"]
    for e in b["data"]["economies"]:
        c = e["economy"]
        check(f"/svc/v1/stress?economy={c}", "stress", DEFAULT_BUDGET)
        check(f"/svc/v1/stress?economy={c}&inputs=true", "stress")
        it = check(f"/svc/v1/item?id=stress:{c}", "item", DEFAULT_BUDGET)["data"]
        assert len(it["text"]) <= 20000
    check("/svc/v1/stress?economy=TUR&quarter=2018-Q2", "stress")
    check("/svc/v1/stress?quarter=2008-12-31", "stress", DEFAULT_BUDGET)
    for j in range(1, 8):
        check(f"/svc/v1/item?id=stress:j{j}", "item", DEFAULT_BUDGET)
    check("/svc/v1/item?id=stress:board", "item", DEFAULT_BUDGET)


def test_errors_and_guard():
    for path, want in [("/svc/v1/countries/ZZZ", 404), ("/svc/v1/countries/KORR", 404), ("/svc/v1/countries/KOR?part=all", 400),
                       ("/svc/v1/pairs/KOR/KOR", 400), ("/svc/v1/shocks/nosuch", 404), ("/svc/v1/stress?economy=USA", 404),
                       ("/svc/v1/stress?quarter=1999-Q1", 400), ("/svc/v1/item?id=country:ZZZ", 404), ("/svc/v1/item?id=bad", 400),
                       ("/svc/v1/search", 400), ("/svc/v1/economy/KORR", 400)]:
        s, b = get(path)
        assert s == want, f"{path}: {s}"
        err = json.loads(b)["error"]
        assert err["status"] == want and err["detail"] and "at " not in err["detail"][:3]
    s, b = get("/svc/v1/economy/VNM")
    assert s == 200 and json.loads(b)["data"]["covered"] is False
    assert get("/svc/v1/manifest", host="global-network.datasteg.com")[0] == 404
    assert get("/svc/v1/manifest", extra={"X-Forwarded-Host": "global-network.datasteg.com"})[0] == 404
    s, b = get("/svc/v1/search?" + urllib.parse.urlencode({"q": "한국", "limit": 20}))
    assert s == 200 and json.loads(b)["items"][0]["id"] == "country:KOR"
    s, b = get("/svc/v1/search?q=korea%20japan")
    assert json.loads(b)["items"][0]["id"] == "pair:KOR-JPN"
