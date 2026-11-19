# Export surfaces — the contract between the three sites

Written 2 Nov 2026. money-flow and trade-flow publish; global-network reads and collects nothing (rule G18).
A surface has a semantic version; global-network's `build.py` reads the manifest first and refuses a major version it was
not written for. Shapes below are the shapes global-network already consumes today, moved behind a manifest, so the
first migration is a change of path, not of logic.

## money-flow (`<money-flow store>/site`, release store)

`surface.json` at the store root, rewritten at every release (and stored as release file key `surface`):

```json
{"surface": "1.0", "release": "20261103.1", "method": "1.5", "built": "2026-11-03T07:45:00+09:00",
 "files": ["world/global", "econ/*", "mkt/*", "earn/global", "changes/global", "episodes/global", "sovereign/global", "registry/*", "checks", "meta"]}
```

New release files (view keys), gated and checked like every other view:

| key | shape | from |
|---|---|---|
| `earn/global` | `{"wdi": <the newest WDI file as global-network's fetch_wdi.py writes it: read, source, licence, series{gs,pi,gdp,…}{ISO3}{year}>, "quarterly": <the newest quarterly file as fetch_quarterly.py writes it: read, from, economies, sources, bop{ISO3}{key}, qnea, xru…>}` | `scripts/fetch_earn.py` (the two fetchers moved from global-network) → `<money-flow store>/external/{wdi,quarterly}/<date>.json`; licence class open (World Bank CC BY 4.0; IMF terms as registered) |
| `changes/global` | `{"q": "2026-06-30", "prev": "2026-03-31", "items": [{"eco": "TUR", "side": "money", "kind": "at_risk_in"\|"at_risk_out"\|"flow_sign"\|"a2_100"\|"v_jump", "q": "...", "v": [v0, v1], "flow": [f0, f1], "b1", "b2", "a2": [a0, a1], "basis"}]}` — the exact objects global-network's build.py produces today in its "what changed (E3)" money block (kinds and fields unchanged) | board history, computed at release (rule R20: pulse and changes are published once, never recomputed downstream) |
| `episodes/global` | `{"episodes": {"gfc-2008": {"en", "ko", "q": "2008-12-31", "eco": ["KOR", …]}, …}, "global_windows": [["2008-09-30", "2009-06-30"], ["2020-03-31", "2020-06-30"]], "out_of_scope": {"GRC": ["2010-06-30", "2012-12-31"], …}, "pre": 4, "threshold": 60}` — global-network build.py's EPISODES, GLOBAL_WINDOWS, OUT_OF_SCOPE, PRE, THRESHOLD | money-flow method 1.4 validation set (`vulnerability_v13.py`) |
| `sovereign/global` | the object `scripts/warning.py` writes today to global-network's `data/warning.json` (years, proj0, last_actual, rules, K, order, validation_cfg, econ, episodes, spells, coverage, valid, checks, meta, economies, names, gloss), unchanged | `scripts/fetch_warning.py` (moved) → `<money-flow store>/external/warning/<date>.json`; rules R22–R28 in method.yaml; validation as checks |
| `mkt/bank` gains `lender_cut` | `{"q": "2026-06-30", "debtors": {"TUR": {"claims_usd": 123.4, "res_net": 45.6, "lenders": {"GBR": 44.7, "USA": 10.7, …}}}}` shares in % of the debtor's bank claims from all reporters (LBS), net reserves as the board's A2 denominator | rule R21 "Cut a lender": loss = cut% × share × claims; shown against res_net; the browser only scales |

Already present and listed in the surface: `world/global` (`board`, `pulse`, `pairs`, `apex`, `cofer`, `gli`), `econ/<ISO3>`, `mkt/<market>`, `registry/*`, `checks`, `meta`.

**Board fields global-network reads (`world/global` → `board`, 17 Nov 2026).** `build.py` reads the
board by column name from `board.cols`, never by position, so a column added or removed elsewhere does not move a field.
Read: `v flow exp buf a1 a1n a2 a2g a2_basis a2_floored a2_scored a3 niip ca b1 b2 size gdp st res res_net res_net_raw
res_drains ids loans stock_prev local_fx a1_local offshore`, and per quarter `no_flow`.
- `res_net_raw` (money-flow method 1.6, registry `net_reserves`): IRFCL Section I plus Section II drains, not floored,
  may be negative, null where Section II is not published. J1, the replay, the country and stress views and K2 use it.
  `res_net` is A2's reserve base only (registry `a2_reserve_base`, floored at a tenth of gross, flagged `a2_floored`).
  Until a release carries `res_net_raw`, build.py derives it from `res + res_drains` (same rule) and K2 waits.
- Since method 1.6 a row stays on the board when a flow input is missing: `flow`, `b1`, `b2` and possibly `a3`, `ids`,
  `loans` are null, `flow_missing` is set, and the quarter's `no_flow` lists `[eco, reason]`. global-network keeps the
  reason (`flow_note`): J3 is unscored with it (`j3n` in the stress grid, `j3_not_scored` in the API) and a replay
  quarter without flows carries it as `note`.
- New and not read: `o1x`, `flow_missing` (the reason comes from `no_flow`). Removed in method 1.6: `v12`, `p1`–`p3`
  (global-network never read them).
- `mkt/bank` → `lender_cut.debtors[X]` gains `res_net_raw` and `all_instr` (not read here; the country sheet's lender
  shares divide LBS positions by BIS:5A from the links table at the same quarter).

## trade-flow (`trade-flow/data`)

`surface.json` written by `build_snapshots.py` (full and `--meta-only`):

```json
{"surface": "1.0", "built": "2026-11-03T06:10:00+09:00", "shown": 202607, "complete_a": 2024,
 "files": ["meta.json", "snap/W/*", "series/W/*", "nodes/W/*", "flows/W/*", "chains/*", "events/*", "cases/*", "products.json", "changes.json", "checks/*", "build.json"]}
```

| file | shape | from |
|---|---|---|
| `data/products.json.br` | exactly the file `build_products.py` writes today to `<global-network store>/products/<date>.json` (read, trade_flow_built, shown, ends, window, cols, chapters, world, econ{ISO3}…) | `scripts/build_products.py` moved from global-network; runs after `build_windows.py`; check: each economy's chapter sum within 1% of its all-goods window |
| `data/changes.json.br` | `{"shown": 202607, "prev": 202606, "items": [{"side": "trade", "kind": "export_sign"\|"divergence"\|"chokepoint", …}]}` — the exact objects global-network's build.py produces today in its "what changed (E3)" trade block (12-month exports changed direction; a top-5 destination reported differently; a chokepoint moved along a chain, with chain, chain_name, year, from, to) | `build_stories.py` |
| `data/events/index.json` gains `replay: true\|false` per event | read from `../global-network/data/surface.json` → `replays` when present, else false | `build_stories.py` |

## global-network (`global-network/data`)

`data/surface.json`: `{"surface": "1.0", "built": "...", "money": {"release", "method", "surface"}, "trade": {"built", "shown", "surface"}, "replays": ["covid-2020", "iran-war-2026", "gfc-2008", "russia-ukraine-2022"]}`.
`meta.json` records both parent surfaces; every footer prints them. No file under `<global-network store>/` is read any more; the folder keeps only `builds/<tag>.json` (build logs).

## Fixed URLs the sites link to (family/family.json holds the templates)

- money-flow: `/{lang}/e/{iso3}`, `/{lang}/world?bf={iso3}`, `/{lang}/m/bank?h={a}&d={b}` (focus a cell, new), `/{lang}/m/bank?cut=1&by=debtor&e={iso3}` (lender cut, new), `/{lang}/sovereign?e={iso3}` (new).
- trade-flow: `/{lang}/explore?focus={iso3}`, `/{lang}/explore?flow={a}-{b}` (seed the flow card, new), `/{lang}/chains/{chain}?focus={iso3}`, `/{lang}/events/{event}`, `/{lang}/cases/tools/cut-supplier?stage={stage}&exporter={iso3}` (new).
- global-network: `/{lang}/c/{iso3}` (+ `#funding`, `#trade`), `/{lang}/c/{a}/with/{b}`, `/{lang}/shocks/{event}`, `/{lang}/shocks/dollar`, `/{lang}/about`.
- 301s from global-network after the moves: `/{lang}/fiscal-stress` and `/{lang}/warning` → money-flow `/{lang}/sovereign` (query kept); `/{lang}/shocks/scenarios/supplier` → trade-flow cut-supplier; `/{lang}/shocks/scenarios/lenders` → money-flow lender cut; `/{lang}/shocks/episodes` → `/{lang}/shocks`.
