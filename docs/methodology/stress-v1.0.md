# Stress signals, method 1.0

Written 3 November 2026. Config: [`config/stress.yaml`](../../config/stress.yaml). Code:
[`scripts/stress.py`](../../scripts/stress.py), called by `scripts/build.py`. Tests:
[`tests/test_stress.py`](../../tests/test_stress.py). Page: `/[lang]/stress`.

All numbers below come from the build of 3 November 2026: money-flow release 20261102.2 (method 1.5, board to
2026 Q2) and trade-flow built 2 November 2026 (shown month July 2026). The page prints the same numbers from
`data/stress.json.br`. Re-running the build on new parent releases changes them, and the page follows.

## 1. Expectations (S0, written before the first run)

| Id | Expectation | Result |
|---|---|---|
| E1 | Korea's count is 3 or more in 2008 Q3 | **fail**: 0. J3 has no own history yet (first scored 2009 Q1), J4 is not scored (44% of exports go to covered partners, below the 50% floor), and J1 (6.3 months), J2 (34%) and J7 (2.8) are far from their thresholds |
| E2 | Türkiye's count is 3 or more in 2018 Q2 | **fail**: 1 (J2) |
| E3 | Argentina's count is 3 or more in 2018 Q1 | **fail**: 2 (J1, J2) |
| E4 | Russia's count is 3 or more in 2014 Q4 | **fail**: 2 (J6, J7) |
| E5 | Czechia's count is 1 or less through 2017–2019 | pass: at most 1 |
| E6 | Saudi Arabia's J7 fires in 2015 and in 2020 | pass: 2015 Q4; every quarter of 2020 |
| E7 | J4 for Hungary and Poland rises in 2008 Q3 while their own V does not yet | **fail**: J4 rose (HUN 50.8 → 54.6, POL 44.8 → 47.2) but V rose too (82.5 → 88.5, 62.0 → 65.0) |

The page shows these results in the Past shocks tab, with pass or fail for each.

## 2. The seven signals as built

Each signal is computed per economy-quarter, using only data up to that quarter (section 5).

| Signal | Value | Scored economy-quarters | Threshold | Where the threshold comes from |
|---|---|---|---|---|
| J1 import cover | net reserves ÷ (12-month imports ÷ 12), months | 1,809 (24 economies; not euro members or reserve issuers) | ≤ 3 | convention |
| J2 financing need ÷ exports | (st + max(0, −CA) × GDP) ÷ 12-month exports, % | 2,798 | ≥ 50 | validation; candidates 150/125/100/75/50, written in S0 |
| J3 double hit | fires when F < 0 and export momentum ≤ its own 20th percentile | 2,325 (from 2009 Q1) | definition | — |
| J4 partner stress | Σ partners' V × export weight over covered partners (United States V = 0) | 2,250 (needs ≥ 50% coverage) | ≥ 50.85 | validation; pooled P90/P85/P80/P75 |
| J5 dual dependence | Σ min(BIS LBS lender share, destination share), % | 2,798 | ≥ 43.5 | validation; pooled P90…P75 |
| J6 dollar channel | −(A1-tercile slope of export growth on the dollar, two quarters on) × 4-quarter dollar change, % of exports | 2,583 (from 2008 Q1) | ≥ 4 | validation; candidates 4/3/2/1 |
| J7 commodities and buffers | commodity share (HS 25–27, the previous year) × buffer weakness ÷ 100 | 2,947 | ≥ 9.1 | validation; pooled P90…P75 |

How validation picks a threshold: the threshold with the highest Youden J (hit rate minus false-signal rate) on
funding episodes and calm quarters up to 2020 Q4. On a tie, the stricter candidate (listed first) wins. The
2021–2026 quarters are a hold-out, but they contain only one positive (Türkiye 2021), so the hold-out mainly measures
the false-signal rate.

Two inputs are read from what the parents already publish, not from new files:

- J5 needs bank lender shares by quarter. They come from money-flow's release table `links.parquet` (BIS LBS
  residence basis, named reporters divided by the BIS:5A all-reporter row), which `build.py` already reads.
- J4 needs partner shares by quarter. They come from trade-flow's yearly `snap/W/TOTAL/<year>.w12` files at
  quarter-end months.

Two cleaner files could serve instead: a quarterly `lender_cut` history from money-flow and
`partners/<ISO3>.json` from trade-flow. They would make the build faster but would not change any number.

## 3. Validation

### Funding episodes (they decide admission)

There are 29 economy-episodes in money-flow's episodes/global view (the method 1.4 set). Each positive is the
highest value in the four quarters before an episode. Calm quarters are more than two years from any episode and
outside the global windows. Intervals are 90%, from 1,000 bootstrap draws over economy-episodes. G19 compares each
signal with the better of its two single-side inputs on the same sample.

| Signal | AUROC (90%) | Money input alone | Trade input alone | Gain over the better side (90%) | Admitted |
|---|---|---|---|---|---|
| J1 | 0.512 (0.406–0.620) | 0.655 | 0.394 | −0.143 (−0.230 to −0.066) | no |
| J2 | 0.625 (0.550–0.696) | 0.483 | 0.675 | −0.049 (−0.101 to −0.000) | no |
| J3 | 0.734 (0.653–0.804) | 0.754 | 0.640 | −0.020 (−0.047 to 0.011) | no |
| J4 | 0.661 (0.545–0.769) | 0.677 | 0.534 | −0.016 (−0.100 to 0.064) | no |
| J5 | 0.379 (0.308–0.450) | 0.428 | 0.450 | −0.071 (−0.187 to 0.054) | no |
| J6 | 0.756 (0.674–0.824) | 0.760 | 0.641 | −0.003 (−0.029 to 0.023) | no |
| J7 | 0.777 (0.727–0.823) | 0.722 | 0.680 | +0.055 (−0.035 to 0.148) | no |

**No signal is admitted, so no composite is published.** The three composite designs written in S0 (D1, half
level and half own-history z, the default design; D2, level only; D3, own-history only) are not tested, because the
composite would have no inputs. The page says this in its notice and on the Method tab.

The count at K = 3 with the default thresholds:

- AUROC 0.751 (0.675–0.827), against 0.725 (0.642–0.807) for V on the same 27 positives and 2,312 calm quarters.
- The difference is +0.026, with an interval of −0.088 to 0.130. The count adds no measurable skill over V.
- Hit rate 40.7%, false-signal rate 8.9%, hold-out false-signal rate 5.0%.
- Leaving one episode out moves the AUROC between 0.727 (without the taper tantrum) and 0.803 (without the GFC).

What this says:

- J7 is the strongest single signal (0.777). Its interval overlaps its money side, the buffer half of V (0.722).
  J7 is mostly V's buffers, sharpened for commodity exporters.
- J5 is below 0.5: economies whose lenders and buyers are the same partners are calmer, not more fragile. Most such
  pairs are advanced neighbours, such as Canada with the United States or the Nordics with each other.
- J1 is below its own money side. Scaling reserves by imports rather than GDP removes skill, because the most open
  economies hold the most reserves.
- J6 is almost entirely a dollar-year signal. Every economy in an A1 tercile gets the same dollar move, so J6 adds
  nothing over A1 × dollar change.

### Programme and default spells (reported)

This set uses money-flow's sovereign/global spells. A spell counts as seen if the count reached K = 3 in any quarter
in the 1 to 3 years before it started. Calm years are those more than 3 years away from any spell, excluding 2008,
2009 and 2020.

- 6 of the 21 spells in the board economies have a count before them: GRC 2010, PRT 2011, ESP 2012 and ARG 2022 are
  seen; HUN 2008 and RUS 2022 are missed.
- Hit rate 66.7%, but the false-signal rate is 17.3% (100 of 579 calm years), and the AUROC is 0.761.
- money-flow's own Sovereign rules on the full set score an AUROC of 0.493, a hit rate of 21.1% and a false-signal
  rate of 2.7%. That covers more spells, and older ones. Six spells are too few to say the joint count does better.

### Trade events (reported)

For each replay, the count one quarter before the shock is compared with each economy's 3-month export fall, using a
one-sided permutation test (2,000 permutations).

| Replay | Quarter before | Economies | Spearman | p |
|---|---|---|---|---|
| COVID-19, 2020 | 2019 Q4 | 35 | +0.02 | 0.446 |
| Strait of Hormuz, 2026 | 2025 Q4 | 32 | +0.35 | 0.027 |
| GFC, 2008 | 2008 Q2 | 33 | +0.22 | 0.116 |
| Russia–Ukraine, 2022 | 2021 Q4 | 36 | −0.48 | 0.999 |

Only the Hormuz replay is positive and significant. In 2022 the economies with more signals were often commodity
exporters (J7), and their exports rose with prices. The condition written beforehand ("positive and significant on the replays
that exist") is not met.

## 4. One change after the first run

The first run gave J6 values from −40% to +70% of exports. The cause was the export growth points behind the
tercile slopes: the pooled distribution reached +883% at the 99th percentile and +112% at the 95th. These come from
windows where an economy's reporting coverage jumps, and a handful of them set the slope.

Since then, export growth is clipped to ±40 points before the slope is fitted (`clip: 40` in the config). J6 now runs
from about −10 to +17 between the 5th and 95th percentiles. The threshold candidates were not changed. This was a
fix to a data defect, not a tuning toward the episodes: J6 was then still admitted, and was then rejected only
because of the comparison fix below.

The run also fixed two bugs in the code:

- The G19 gain had been computed on a two-way sample, different from the three-way sample used to pick the better
  side. That briefly admitted J6 (+0.033). On the correct, common sample the gain is −0.003.
- Thresholds are now applied to values rounded to the published precision, so the count in the browser equals the
  count in the build. A test checks this for every economy-quarter.

## 5. Point in time

For a quarter, the build reads only:

- the board row for that quarter;
- the 12-month trade window ending in the quarter's last month, or the newest complete window up to six months
  earlier (flagged partial);
- the BIS LBS positions for the quarter;
- the commodity share for the previous year;
- own-history percentiles and robust scales from earlier quarters only (J3 needs eight quarters before its first
  percentile);
- level ranks over every board economy-quarter up to that quarter;
- J6 slopes from points whose outcome quarter is no later than the quarter being scored.

`tests/test_stress.py` checks that the expanding percentile never moves when later values change, and that no trade
window is later than its quarter. It also checks J1 and J2 by hand for Korea in 2008 Q3: 232.5 ÷ (443.1 ÷ 12) = 6.30
months, and (144.7 + 0.59% × 991.8) ÷ 437.9 = 34.4%. Its other checks:

- partner weights sum to 1;
- the published count equals the fired signals;
- an admitted signal always has an interval above zero.

## 6. What the page may claim

- It shows seven signals beside V, and a count read at K. It does not show a composite score.
- The count is not more skilful than V on funding episodes (difference +0.026, with an interval that includes zero),
  and the page says so in the Past shocks tab.
- "Channel first" describes which signal leads. It is not a forecast.
- The vocabulary stays "signal" and "stress", and never "warning" or "crisis" in a title.

