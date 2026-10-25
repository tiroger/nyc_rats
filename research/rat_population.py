# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "marimo>=0.25",
#     "pandas>=2.2",
#     "numpy>=2.0",
#     "scipy>=1.13",
#     "statsmodels>=0.14",
#     "altair>=5.4",
#     "pyarrow>=17",
#     "requests>=2.32",
# ]
# ///

import marimo

__generated_with = "0.25.2"
app = marimo.App(width="medium", app_title="How many rats? A capture-recapture study")


@app.cell(hide_code=True)
def _():
    import sys

    import marimo as mo

    # The estimators and data helpers live next to this notebook so they can be
    # unit-tested (research/test_capture_recapture.py).
    sys.path.insert(0, str(mo.notebook_dir()))

    import altair as alt
    import numpy as np
    import pandas as pd

    import capture_recapture as cr
    import sources
    import sweeps as sw

    _ = alt.data_transformers.disable_max_rows()
    return alt, cr, mo, np, pd, sources, sw


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # How many rats live in New York City?

    ### Reproducing, then stress-testing, a capture-recapture estimate from 311 data

    In 2014 Jonathan Auerbach estimated that New York has about **2 million rats**,
    using rat-sighting reports to 311 instead of physically trapping animals
    (*Significance* 11(4), 22–27). This notebook tries, first, to **reproduce** his
    numbers from today's public data, and then to **improve** the method: test
    each assumption with the data, quantify uncertainty, and compare estimators
    against simulations where the true answer is known.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.callout(
        mo.md(
            "**Research notebook, not a published result.** Nothing here goes on "
            "the Ratlas website unless the checks in *Is this ready to publish?* "
            "pass. Numbers update when the data is re-downloaded; every "
            "interpretation below is generated from the current results."
        ),
        kind="warn",
    )
    return


@app.cell(hide_code=True)
def _(mo, summary_text):
    mo.md(summary_text)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## 1. The original study

    Capture-recapture estimates a population you cannot count directly. Mark the
    animals caught on a first occasion, catch again later, and see what share of
    the second catch was already marked. If 10% of the second catch carries a mark,
    the first catch was probably about 10% of the population. With $n_1$ animals
    caught first, $n_2$ caught second, and $m$ caught both times, the
    **Lincoln–Petersen** estimate is

    $$\hat N = \frac{n_1\, n_2}{m}.$$

    Auerbach's substitutions:

    | Ecology | This study |
    |:---|:---|
    | Animal | A tax lot (BBL). New York has ~842,000 |
    | Capture | At least one 311 rat-sighting report on the lot |
    | Occasion 1 | January–June 2010 |
    | Occasion 2 | January–June 2011 (six months later, same season) |
    | Population | Lots infested with rats |
    | Head count | Infested lots × 40–50 rats per colony |

    Published results, as reported: **~40,500 infested lots (4.75%)** and
    **~2 million rats**, which he called a generous upper estimate because it
    assumes a full colony on every infested lot and one colony per lot. The paper
    is paywalled and press coverage does not report $n_1$, $n_2$ or $m$, so the
    reproduction below can be compared only with the headline numbers.
    """)
    return


@app.cell(hide_code=True)
def _():
    PUBLISHED = {
        "lots_total": 842_000,
        "infested_lots": 40_500,
        "infested_share": 0.0475,
        "colony_low": 40,
        "colony_high": 50,
        "rats": 2_000_000,
    }
    return (PUBLISHED,)


@app.cell(hide_code=True)
def _(PUBLISHED, mo, pd):
    _implied_share = PUBLISHED["infested_lots"] / PUBLISHED["lots_total"]
    _implied_lots = PUBLISHED["infested_share"] * PUBLISHED["lots_total"]
    published_checks = pd.DataFrame(
        [
            ["40,500 ÷ 842,000", f"{_implied_share:.2%}", "published 4.75%"],
            ["4.75% × 842,000", f"{_implied_lots:,.0f} lots", "published 40,500"],
            ["40,500 × 50 rats", f"{PUBLISHED['infested_lots'] * 50:,.0f}", "published ~2 million"],
            ["40,500 × 40 rats", f"{PUBLISHED['infested_lots'] * 40:,.0f}", "the low end of the colony range"],
        ],
        columns=["Calculation", "Result", "Compare with"],
    )
    mo.vstack(
        [
            mo.md("**Do the published numbers agree with each other?**"),
            mo.ui.table(published_checks, selection=None),
            mo.md(
                f"The share and the lot count are slightly inconsistent: 40,500 of "
                f"842,000 is {_implied_share:.2%}, while 4.75% would be about "
                f"{_implied_lots:,.0f} lots. The gap is small ({abs(_implied_lots - PUBLISHED['infested_lots']):,.0f} "
                "lots, about 1%) and probably rounding, but it means we treat "
                "**40,000–40,500 infested lots** as the target. The 2 million figure "
                "uses the top of the colony range (50); at 40 rats per colony the same "
                f"method gives {PUBLISHED['infested_lots'] * 40 / 1e6:.1f} million."
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## 2. Data, provenance and validation

    | Source | NYC Open Data | Used for |
    |:---|:---|:---|
    | 311 Service Requests 2010–2019 | [76ig-c548](https://data.cityofnewyork.us/d/76ig-c548) | rat-sighting reports with BBL |
    | 311 Service Requests 2020– | [erm2-nwe9](https://data.cityofnewyork.us/d/erm2-nwe9) | rat-sighting reports with BBL |
    | PLUTO (current release) | [64uk-42ks](https://data.cityofnewyork.us/d/64uk-42ks) | every tax lot and its traits |
    | DOHMH Rodent Inspection | [p937-wjvj](https://data.cityofnewyork.us/d/p937-wjvj) | independent findings and treatments |

    Reports use the same filter as the Ratlas site: Problem `Rodent`, Problem
    Detail `Rat Sighting`. Downloads are paged with an explicit order, cached in
    `research/data/`, and **must reconcile with an independent `count(*)`
    query** or the download fails. Press the button to re-download everything.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    refresh = mo.ui.run_button(label="Re-download from NYC Open Data")
    refresh
    return (refresh,)


@app.cell
def _(refresh, sources):
    with __import__("marimo").status.spinner("Loading 311 reports and PLUTO…"):
        sightings = sources.sightings(refresh=refresh.value)
        pluto_lots = sources.pluto(refresh=refresh.value)
        insp_2010_h1 = sources.inspections("2010-01-01", "2010-07-01", refresh=refresh.value)
        insp_2010_h2 = sources.inspections("2010-07-01", "2011-01-01", refresh=refresh.value)
        insp_2011_h1 = sources.inspections("2011-01-01", "2011-07-01", refresh=refresh.value)
        treated_2010_h2 = sources.treatments("2010-07-01", "2011-01-01", refresh=refresh.value)
        rodent_2010_h1 = sources.rodent_complaints("2010-01-01", "2010-07-01", refresh=refresh.value)
        rodent_2011_h1 = sources.rodent_complaints("2011-01-01", "2011-07-01", refresh=refresh.value)
        # Record-level inspections and complaints for finding proactive sweeps (§6).
        insp_records_2010 = sources.inspection_records("2010-01-01", "2012-01-01", refresh=refresh.value)
        insp_records_2023 = sources.inspection_records("2023-01-01", "2025-01-01", refresh=refresh.value)
        complaints_2010 = sources.rodent_complaint_records("2009-10-01", "2012-01-01", refresh=refresh.value)
        complaints_2023 = sources.rodent_complaint_records("2022-10-01", "2025-01-01", refresh=refresh.value)
    return (
        complaints_2010,
        complaints_2023,
        insp_2010_h1,
        insp_2010_h2,
        insp_2011_h1,
        insp_records_2010,
        insp_records_2023,
        pluto_lots,
        rodent_2010_h1,
        rodent_2011_h1,
        sightings,
        treated_2010_h2,
    )


@app.cell(hide_code=True)
def _(mo, pd, pluto_lots, sightings, sources):
    _manifest = pd.DataFrame(sources.manifest()).T.reset_index(names="file")
    provenance = _manifest[["file", "name", "rows", "api_count", "fetched", "updated", "url"]].rename(
        columns={
            "rows": "rows saved",
            "api_count": "records per API count(*)",
            "fetched": "downloaded",
            "updated": "source last updated",
        }
    )
    mo.vstack(
        [
            mo.md(
                f"**Provenance.** {len(sightings):,} rat-sighting reports "
                f"({sightings.created_date.min():%b %Y} → {sightings.created_date.max():%b %d, %Y}) "
                f"and {len(pluto_lots):,} PLUTO lots (release {pluto_lots.version.dropna().iloc[0]})."
            ),
            mo.ui.table(provenance, selection=None),
            mo.md(
                "Report and PLUTO files save one row per record, so the two counts "
                "match. Inspection and complaint files are grouped by lot on the "
                "server; they save one row per lot, and the sum of their record "
                "counts must equal the API's count instead."
            ),
        ]
    )
    return


@app.cell
def _(pd, pluto_lots, sightings):
    # One row per report with a valid BBL, labelled with the windows we use.
    reports = sightings.dropna(subset=["bbl"]).copy()
    reports["year"] = reports.created_date.dt.year
    reports["half"] = (
        reports.year.astype(str) + "-H" + (reports.created_date.dt.month > 6).add(1).astype(str)
    )
    reports["quarter"] = reports.year.astype(str) + "-Q" + reports.created_date.dt.quarter.astype(str)
    reports["month"] = reports.created_date.dt.strftime("%Y-%m")
    pluto_bbls = set(pluto_lots.bbl.dropna())
    reports["in_pluto"] = reports.bbl.isin(pluto_bbls)
    reports["block"] = reports.bbl.str[:6]
    reports["condo_unit"] = pd.to_numeric(reports.bbl.str[6:]).between(1001, 6999)

    def lots_in(frame, column, label):
        """Distinct lots with at least one report in the window."""
        return set(frame.loc[frame[column] == label, "bbl"])

    def capture_matrix(frame, column, labels):
        """Lots x occasions, 1 if the lot was reported in that occasion."""
        _sub = frame[frame[column].isin(labels)]
        return (
            pd.crosstab(_sub.bbl, _sub[column])
            .reindex(columns=labels, fill_value=0)
            .gt(0)
            .astype("int8")
        )

    return capture_matrix, lots_in, pluto_bbls, reports


@app.cell(hide_code=True)
def _(alt, mo, pd, pluto_lots, sightings, sources):
    import json as _json

    _manifest = sources.manifest()
    _reconciled = all(
        (_m["api_count"] == _m["rows"]) if not _m["group"] else _m["api_count"] is not None
        for _m in _manifest.values()
    )
    _site = _json.loads((sources.DATA.parent.parent / "public/data/sightings.json").read_text())
    _site_total = _site["totalReports"]
    _same_window = sightings[sightings.created_date < pd.Timestamp(_site["coverage"]["to"]) + pd.Timedelta(days=1)]
    _drift = len(_same_window) / _site_total - 1
    _dupes = sightings.unique_key.duplicated().sum()
    _pluto_dupes = pluto_lots.bbl.dropna().duplicated().sum()
    _by_year = (
        sightings.assign(year=sightings.created_date.dt.year)
        .groupby("year")
        .agg(reports=("unique_key", "size"), with_bbl=("bbl", lambda s: s.notna().mean()))
        .reset_index()
    )
    _valid = sightings.dropna(subset=["bbl"])
    _in_pluto = _valid.bbl.isin(set(pluto_lots.bbl.dropna()))
    _y2010 = _valid.created_date.dt.year.isin([2010, 2011])
    validation = pd.DataFrame(
        [
            ["Every download reconciles with the API's count(*)", "yes" if _reconciled else "NO", _reconciled],
            [
                "Report total matches the Ratlas site snapshot (same dates)",
                f"{len(_same_window):,} vs {_site_total:,} ({_drift:+.2%})",
                abs(_drift) < 0.01,
            ],
            ["No duplicate 311 request IDs", f"{_dupes:,} duplicates", _dupes == 0],
            ["No duplicate BBLs in PLUTO", f"{_pluto_dupes:,} duplicates", _pluto_dupes == 0],
            [
                "2010–11 reports with a valid BBL",
                f"{sightings[sightings.created_date.dt.year.isin([2010, 2011])].bbl.notna().mean():.1%}",
                True,
            ],
            [
                "2010–11 report BBLs found in today's PLUTO",
                f"{_in_pluto[_y2010].mean():.1%}",
                _in_pluto[_y2010].mean() > 0.9,
            ],
        ],
        columns=["Check", "Result", "Pass"],
    )
    _chart = (
        alt.Chart(_by_year)
        .mark_line(point=True)
        .encode(
            x=alt.X("year:O", title=None),
            y=alt.Y("with_bbl:Q", title="Reports with a valid BBL", axis=alt.Axis(format="%"), scale=alt.Scale(domain=[0, 1])),
            tooltip=["year", "reports", alt.Tooltip("with_bbl", format=".1%")],
        )
        .properties(height=180, width="container")
    )
    mo.vstack(
        [
            mo.md("**Validation checks**"),
            mo.ui.table(validation, selection=None),
            mo.md(
                "Reports without a BBL cannot be assigned to a lot, so they never count "
                "as a capture. That is not a bias in itself for capture-recapture (it "
                "lowers every lot's chance of being caught equally), **unless** missing "
                "BBLs are concentrated in particular kinds of places. Coverage by year:"
            ),
            _chart,
        ]
    )
    return (validation,)


@app.cell(hide_code=True)
def _(mo, reports):
    _types = (
        reports[reports.year.isin([2010, 2011])]
        .location_type.fillna("(blank)")
        .value_counts(normalize=True)
        .head(12)
        .map("{:.1%}".format)
        .rename("share of reports")
        .reset_index()
    )
    _condo = reports[reports.year.isin([2010, 2011])].condo_unit.mean()
    mo.vstack(
        [
            mo.md(
                "**What kind of place is a 'captured' lot?** The location type the "
                "caller chose, 2010–11. Street, sidewalk, park and sewer reports still "
                "carry the BBL of a nearby address, which may not be where the rats live."
            ),
            mo.ui.table(_types, selection=None),
            mo.md(
                f"{_condo:.1%} of 2010–11 report BBLs are condominium *unit* lots "
                "(lot numbers 1001–6999). "
                + (
                    "311 geocodes condo buildings to their billing lot, so one building "
                    "does not show up as several 'animals'."
                    if _condo < 0.005
                    else "Each condo building has one billing lot and many unit lots, "
                    "so one building can appear as several 'animals'."
                )
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## 3. Reproduction

    Following the published design exactly: a lot is **captured** in an occasion
    if it has at least one rat-sighting report with a valid BBL during that
    window. Occasion 1 is January–June 2010, occasion 2 is January–June 2011.
    Alongside Lincoln–Petersen we report **Chapman's** version,
    $\hat N = \frac{(n_1+1)(n_2+1)}{m+1} - 1$, which is nearly unbiased in small
    samples, with Seber's variance and a log-normal 95% interval (Chao 1987).
    """)
    return


@app.cell
def _(cr, lots_in, reports):
    occasion_1 = lots_in(reports, "half", "2010-H1")
    occasion_2 = lots_in(reports, "half", "2011-H1")
    repro = cr.two_occasion(occasion_1, occasion_2)
    return occasion_1, occasion_2, repro


@app.cell(hide_code=True)
def _(PUBLISHED, mo, repro):
    reproduction_gap = repro["lincoln_petersen"] / PUBLISHED["infested_lots"] - 1
    _verdict = (
        "reproduces the published estimate closely"
        if abs(reproduction_gap) <= 0.10
        else "is in the same range as the published estimate, but not identical"
        if abs(reproduction_gap) <= 0.30
        else "does **not** reproduce the published estimate"
    )
    mo.vstack(
        [
            mo.hstack(
                [
                    mo.stat(f"{repro['n1']:,}", label="n₁ lots reported, H1 2010"),
                    mo.stat(f"{repro['n2']:,}", label="n₂ lots reported, H1 2011"),
                    mo.stat(f"{repro['m']:,}", label="m reported in both"),
                    mo.stat(
                        f"{repro['lincoln_petersen']:,.0f}",
                        label="Lincoln–Petersen N̂",
                        caption=f"{reproduction_gap:+.1%} vs published 40,500",
                    ),
                    mo.stat(
                        f"{repro['chapman']:,.0f}",
                        label="Chapman N̂",
                        caption=f"95% CI {repro['low']:,.0f}–{repro['high']:,.0f}",
                    ),
                ],
                widths="equal",
            ),
            mo.md(
                f"With today's data the original design {_verdict}: "
                f"**{repro['lincoln_petersen']:,.0f} infested lots** against the "
                f"published 40,500 ({reproduction_gap:+.1%}). Only "
                f"{repro['recapture_rate']:.1%} of lots reported in early 2010 were "
                f"reported again a year later, which is why the estimate is so much "
                f"larger than the {repro['observed']:,} lots actually seen. At 40–50 "
                f"rats per lot this is **{repro['lincoln_petersen'] * 40 / 1e6:.2f}–"
                f"{repro['lincoln_petersen'] * 50 / 1e6:.2f} million rats**.\n\n"
                "Why might today's numbers differ from 2014's? 311 records are "
                "revised and geocoded after the fact (BBLs back-filled, duplicates "
                "merged), the 2010–2019 archive was republished, and we do not know "
                "Auerbach's exact filters. The variants below show how much these "
                "choices matter."
            ),
        ]
    )
    return (reproduction_gap,)


@app.cell
def _(cr, lots_in, pd, reports, rodent_2010_h1, rodent_2011_h1):
    _public = ["Street", "Sidewalk", "Catch Basin/Sewer", "Park", "Public Garden", "Public Stairs"]
    _variants = {
        "As published: every valid BBL": reports,
        "Only BBLs in today's PLUTO": reports[reports.in_pluto],
        "Exclude condo unit lots": reports[~reports.condo_unit],
        "Exclude street, sidewalk, park and sewer reports": reports[
            ~reports.location_type.fillna("").str.contains("|".join(_public), case=False)
        ],
    }
    _rows = []
    for _name, _frame in _variants.items():
        _r = cr.two_occasion(lots_in(_frame, "half", "2010-H1"), lots_in(_frame, "half", "2011-H1"))
        _rows.append({"variant": _name, "kind": "cleaning", **_r})
    # Which 311 complaints count as a capture? The original says "rat sightings",
    # but the exact filter is not published.
    _definitions = {
        "Rat Sighting + Signs of Rodents": ["Rat Sighting", "Signs of Rodents"],
        "Every Rodent complaint except mice": [
            "Rat Sighting",
            "Signs of Rodents",
            "Condition Attracting Rodents",
            "Rodent Bite - PCS Only",
        ],
        "Every Rodent complaint, including mice": None,
    }
    for _name, _kinds in _definitions.items():
        _a, _b = rodent_2010_h1, rodent_2011_h1
        if _kinds is not None:
            _a, _b = _a[_a.descriptor.isin(_kinds)], _b[_b.descriptor.isin(_kinds)]
        _r = cr.two_occasion(set(_a.bbl), set(_b.bbl))
        _rows.append({"variant": _name, "kind": "definition", **_r})
    repro_variants = pd.DataFrame(_rows)
    return (repro_variants,)


@app.cell(hide_code=True)
def _(PUBLISHED, mo, repro_variants):
    _cleaning = repro_variants[repro_variants.kind == "cleaning"].lincoln_petersen
    _spread = _cleaning.max() / _cleaning.min() - 1
    _closest = repro_variants.loc[
        (repro_variants.lincoln_petersen - PUBLISHED["infested_lots"]).abs().idxmin()
    ]
    _defs = repro_variants[repro_variants.kind == "definition"]
    mo.vstack(
        [
            mo.md("**How sensitive is the reproduction to defensible data choices?**"),
            mo.ui.table(
                repro_variants[["variant", "kind", "n1", "n2", "m", "lincoln_petersen", "chapman", "low", "high"]].round(0),
                selection=None,
            ),
            mo.md(
                f"Cleaning choices move the estimate by at most {_spread:.0%}"
                + (", so the reproduction is robust to them. " if _spread < 0.2 else ", enough to report with any number. ")
                + "The **complaint definition** matters much more: counting broader "
                f"rodent complaints raises the estimate to {_defs.lincoln_petersen.min():,.0f}–"
                f"{_defs.lincoln_petersen.max():,.0f}. The published 40,500 sits between "
                "rat sightings alone and every rodent complaint; the closest single "
                f"variant is *{_closest.variant}* ({_closest.lincoln_petersen:,.0f}). We "
                "keep **rat sightings only** as the reproduction, because that is what "
                "the paper describes, and treat the rest as unexplained (D1, D3 in the "
                "register). We do not pick the variant that happens to land closest."
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    **Try other occasion pairs.** The same design applied to any two half-years.
    Same-season pairs (H1 vs H1) mirror the original; adjacent halves have the
    shortest gap but mix seasons.
    """)
    return


@app.cell(hide_code=True)
def _(mo, reports):
    _halves = sorted(h for h in reports.half.unique() if h <= "2026-H1")
    pair_first = mo.ui.dropdown(_halves, value="2010-H1", label="First occasion")
    pair_second = mo.ui.dropdown(_halves, value="2011-H1", label="Second occasion")
    mo.hstack([pair_first, pair_second], justify="start")
    return pair_first, pair_second


@app.cell(hide_code=True)
def _(cr, lots_in, mo, pair_first, pair_second, reports):
    _r = cr.two_occasion(
        lots_in(reports, "half", pair_first.value), lots_in(reports, "half", pair_second.value)
    )
    mo.md(
        f"{pair_first.value} vs {pair_second.value}: n₁ = {_r['n1']:,}, n₂ = {_r['n2']:,}, "
        f"m = {_r['m']:,} → Lincoln–Petersen **{_r['lincoln_petersen']:,.0f}**, Chapman "
        f"{_r['chapman']:,.0f} (95% CI {_r['low']:,.0f}–{_r['high']:,.0f}) infested lots."
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## 4. Testing the assumptions

    Lincoln–Petersen is only as good as its assumptions. Each one is stated, then
    checked against the data. Where an assumption fails we note **which way it
    pushes the estimate**.

    | # | Assumption | If violated |
    |:---|:---|:---|
    | A1 | **Closure:** the set of infested lots doesn't change between occasions | Turnover inflates N̂ (it counts lots infested *at some point*) |
    | A2 | **Equal catchability:** every infested lot is equally likely to be reported | Lots that are always reported make m too big → N̂ too **low** |
    | A3 | **Independence:** being reported once doesn't change the chance of being reported again | Treatment after a report lowers recapture → N̂ too high; aware residents raise it → too low |
    | A4 | **Marks are stable:** a lot keeps its BBL | Splits, merges and condo units create or hide "animals" |
    | A5 | **A capture means rats:** a reported lot is really infested | False positives inflate n₁, n₂ |
    | A6 | **One lot, one colony of 40–50** | Colonies span lots → too many colonies; small colonies → too many rats |
    """)
    return


@app.cell
def _(cr, lots_in, occasion_1, pd, reports):
    # A1: estimate against the same first occasion with growing gaps.
    _later = ["2010-H2", "2011-H1", "2011-H2", "2012-H1", "2013-H1", "2015-H1", "2018-H1"]
    _rows = []
    for _label in _later:
        _r = cr.two_occasion(occasion_1, lots_in(reports, "half", _label))
        _gap = (int(_label[:4]) - 2010) * 2 + (int(_label[-1]) - 1)
        _rows.append({"second": _label, "half_years_later": _gap, **_r})
    closure = pd.DataFrame(_rows)
    return (closure,)


@app.cell(hide_code=True)
def _(alt, closure, mo):
    _adjacent = closure.iloc[0]
    _year = closure[closure.second == "2011-H1"].iloc[0]
    _growth = _year.chapman / _adjacent.chapman - 1
    _chart = (
        alt.Chart(closure)
        .mark_line(point=True)
        .encode(
            x=alt.X("half_years_later:Q", title="Half-years after H1 2010"),
            y=alt.Y("chapman:Q", title="Chapman N̂ (infested lots)"),
            tooltip=["second", alt.Tooltip("chapman", format=",.0f"), alt.Tooltip("recapture_rate", format=".1%")],
        )
        .properties(height=200, width="container")
    )
    _band = _chart.mark_area(opacity=0.15).encode(y="low:Q", y2="high:Q")
    mo.vstack(
        [
            mo.md("### A1 · Closure"),
            _band + _chart,
            mo.md(
                f"Against the very next half-year the estimate is "
                f"**{_adjacent.chapman:,.0f}**; a year later it is **{_year.chapman:,.0f}** "
                f"({_growth:+.0%}), and it keeps "
                f"{'rising' if closure.chapman.iloc[-1] > _year.chapman else 'changing'} with longer gaps. "
                "In a closed population the estimate would not depend on the gap. "
                + (
                    "This one clearly does: lots move in and out of being reported, so "
                    "a year-apart design estimates *lots infested at some point over "
                    "about 18 months*, not lots infested at any one time. That pushes "
                    "the published estimate **up**."
                    if _growth > 0.1
                    else "The change is modest, so closure looks acceptable over this gap."
                )
                + " (Part of the adjacent-half difference is seasonal: H2 is the "
                "busier half for reports.)"
            ),
        ]
    )
    return


@app.cell
def _(capture_matrix, cr, reports):
    # A2: eight quarterly occasions, 2010-2011.
    quarters_2010_11 = [f"{_y}-Q{_q}" for _y in (2010, 2011) for _q in (1, 2, 3, 4)]
    quarter_caps = capture_matrix(reports, "quarter", quarters_2010_11)
    quarter_freq = cr.frequencies(quarter_caps.values)
    return quarter_caps, quarter_freq, quarters_2010_11


@app.cell
def _(cr, np, pd, quarter_caps, quarter_freq):
    # Expected frequencies if every infested lot had the same catchability (M0).
    _m0, _ = cr.loglinear(quarter_caps.values, "M0")
    _t = quarter_caps.shape[1]
    _p = quarter_caps.values.sum() / (_t * _m0.n)
    _k = np.arange(1, _t + 1)
    from scipy.stats import binom as _binom

    freq_check = pd.DataFrame(
        {
            "times_reported": _k,
            "observed_lots": quarter_freq,
            "expected_if_equal": _m0.n * _binom.pmf(_k, _t, _p),
        }
    )
    return (freq_check,)


@app.cell(hide_code=True)
def _(alt, freq_check, mo, pd):
    _long = freq_check.rename(
        columns={"observed_lots": "Observed", "expected_if_equal": "Expected if all lots equally reportable"}
    ).melt("times_reported", var_name="series", value_name="lots")
    _ratio = (
        freq_check.loc[freq_check.times_reported >= 4, "observed_lots"].sum()
        / max(freq_check.loc[freq_check.times_reported >= 4, "expected_if_equal"].sum(), 1e-9)
    )
    _chart = (
        alt.Chart(_long)
        .mark_bar()
        .encode(
            x=alt.X("times_reported:O", title="Quarters (of 8) in which a lot was reported"),
            xOffset="series:N",
            y=alt.Y("lots:Q", scale=alt.Scale(type="symlog", constant=1), title="Lots (log scale)"),
            color=alt.Color("series:N", title=None),
            tooltip=["series", "times_reported", alt.Tooltip("lots", format=",.0f")],
        )
        .properties(height=220, width="container")
    )
    mo.vstack(
        [
            mo.md("### A2 · Equal catchability"),
            _chart,
            mo.md(
                f"If every infested lot were equally likely to be reported, lots reported "
                f"in 4 or more of the 8 quarters would be rare. There are "
                f"**{_ratio:,.0f}× more** than equal catchability predicts. Some lots "
                "(big apartment buildings, busy blocks) are reported again and again, "
                "while most infested lots are almost never reported. That inflates m "
                "relative to a typical lot and pushes Lincoln–Petersen **down**, the "
                "opposite direction to A1."
            ),
        ]
    )
    return


@app.cell
def _(occasion_1, occasion_2, pd, pluto_lots):
    # A2, continued: does the chance of being reported again depend on lot size?
    _lots = pluto_lots.dropna(subset=["bbl"]).set_index("bbl")
    _captured = _lots.loc[_lots.index.intersection(list(occasion_1))].copy()
    _captured["recaptured"] = _captured.index.isin(occasion_2)
    _captured["units"] = pd.cut(
        _captured.unitsres.fillna(0),
        [-1, 0, 2, 10, 50, float("inf")],
        labels=["0 (non-residential)", "1–2", "3–10", "11–50", "51+"],
    )
    recapture_by_units = (
        _captured.groupby("units", observed=True)
        .agg(lots=("recaptured", "size"), recaptured=("recaptured", "mean"))
        .reset_index()
    )
    return (recapture_by_units,)


@app.cell(hide_code=True)
def _(alt, mo, recapture_by_units):
    _lo, _hi = recapture_by_units.recaptured.min(), recapture_by_units.recaptured.max()
    _chart = (
        alt.Chart(recapture_by_units)
        .mark_bar()
        .encode(
            x=alt.X("units:N", sort=None, title="Residential units on the lot"),
            y=alt.Y("recaptured:Q", title="Reported again in H1 2011", axis=alt.Axis(format="%")),
            tooltip=["units", "lots", alt.Tooltip("recaptured", format=".1%")],
        )
        .properties(height=200, width="container")
    )
    mo.vstack(
        [
            _chart,
            mo.md(
                f"Among lots reported in H1 2010, the chance of being reported again "
                f"ranges from {_lo:.1%} to {_hi:.1%} depending on how many homes the lot "
                "holds. More residents means more potential callers, so catchability is "
                "tied to lot size. Stratifying by lot type (section 5) is the standard "
                "remedy."
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo, occasion_1, occasion_2, treated_2010_h2):
    _treated = set(treated_2010_h2.bbl)
    _t = [b for b in occasion_1 if b in _treated]
    _u = [b for b in occasion_1 if b not in _treated]
    _rt = sum(b in occasion_2 for b in _t) / max(len(_t), 1)
    _ru = sum(b in occasion_2 for b in _u) / max(len(_u), 1)
    mo.vstack(
        [
            mo.md("### A3 · Independence between occasions"),
            mo.md(
                f"A report can trigger an inspection and baiting, which could change "
                f"whether the lot is reported again. Of the {len(occasion_1):,} lots "
                f"reported in H1 2010, {len(_t):,} received a DOHMH treatment in H2 2010. "
                f"Their re-report rate in H1 2011 was **{_rt:.1%}**, against **{_ru:.1%}** "
                "for untreated lots.\n\n"
                + (
                    "Treated lots are reported *more* often afterwards. That is most "
                    "likely selection: the city treats the worst lots, which keep "
                    "attracting calls. It is not evidence that treatment fails, and it "
                    "means we cannot read a treatment effect from this comparison. What "
                    "it does show is that reports cluster on persistent problem lots, "
                    "which is heterogeneity (A2) again."
                    if _rt > _ru
                    else "Treated lots are reported less often afterwards, consistent "
                    "with treatment working or with 'trap-shy' behaviour. Either way the "
                    "second occasion under-recaptures them, which pushes N̂ **up**."
                )
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo, occasion_1, pluto_bbls, reports):
    _early = reports[reports.half.isin(["2010-H1", "2011-H1"])]
    _missing = 1 - _early.in_pluto.mean()
    _condo = _early.condo_unit.mean()
    mo.vstack(
        [
            mo.md("### A4 · Stable marks"),
            mo.md(
                f"{_missing:.1%} of the BBLs reported in the two occasions are not in "
                f"today's PLUTO (lots merged, split or renumbered since), and {_condo:.1%} "
                "are condo unit lots rather than the building's lot. Both are small; "
                "the 'Only BBLs in today's PLUTO' and 'Exclude condo unit lots' "
                "variants in section 3 bound their effect."
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(insp_2010_h1, insp_2010_h2, mo, occasion_1, pd):
    _insp = pd.concat([insp_2010_h1, insp_2010_h2]).groupby("bbl").sum()
    _captured = _insp.loc[_insp.index.intersection(list(occasion_1))]
    _pos_captured = (_captured.rat_activity > 0).mean()
    _pos_all = (_insp.rat_activity > 0).mean()
    a5_positive_share = _pos_captured
    mo.vstack(
        [
            mo.md("### A5 · Does a capture mean rats?"),
            mo.md(
                f"Of the lots reported in H1 2010, {len(_captured):,} "
                f"({len(_captured) / len(occasion_1):.0%}) also had an initial DOHMH "
                f"inspection during 2010. Inspectors found active rat signs on "
                f"**{_pos_captured:.0%}** of them, against {_pos_all:.0%} of all "
                "inspected lots. So a report is strong but imperfect evidence: "
                f"roughly {1 - _pos_captured:.0%} of inspected reported lots showed no "
                "active signs on the day. Inspections are a snapshot and rats move, so "
                "this is an upper bound on false positives, not a measurement of them."
            ),
        ]
    )
    return (a5_positive_share,)


@app.cell(hide_code=True)
def _(mo, occasion_1, reports):
    _blocks = reports[reports.bbl.isin(occasion_1)].groupby("block").bbl.nunique()
    a6_lots_per_block = _blocks.mean()
    _shared = (_blocks[_blocks > 1].sum()) / len(occasion_1)
    mo.vstack(
        [
            mo.md("### A6 · One lot, one colony"),
            mo.md(
                f"The {len(occasion_1):,} lots reported in H1 2010 sit on "
                f"{len(_blocks):,} tax blocks. {_shared:.0%} of them share a block with "
                f"another reported lot (on average {a6_lots_per_block:.2f} reported lots "
                "per affected block). Neighbouring lots on a block can be one colony's "
                "territory, so counting lots overstates colonies. Section 5.6 brackets "
                "this by repeating the estimate with blocks as the unit. Colony *size* "
                "(40–50) comes from the pest-control literature Auerbach cited and "
                "cannot be checked with these data; it is the least supported number "
                "in the whole calculation."
            ),
        ]
    )
    return (a6_lots_per_block,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## 5. Improving the estimate

    Five changes, each aimed at a failed assumption:

    1. **Honest uncertainty:** Chapman with a bootstrap, instead of a point estimate.
    2. **Stratification** (A2): estimate separately by borough and lot type, then add
       up, so lots that are always reported don't set the recapture rate for all.
    3. **Multi-occasion models** (A1, A2): use several short occasions inside one
       year (closer to closed) and fit log-linear models that allow catchability
       to vary by occasion (Mt), by lot (Mh), or both (Mth).
    4. **An open, heterogeneous model** (A1 and A2 together), fitted by
       simulation, which estimates lots infested *at any one time*.
    5. **A second, independent source:** DOHMH inspection findings as the second
       "capture", so recapture does not depend on the same residents calling twice.

    Then we translate lots into rats with the uncertainty made explicit.
    """)
    return


@app.cell
def _(cr, np, repro):
    _draws = cr.bootstrap_chapman(repro["n1"], repro["n2"], repro["m"], reps=4000)
    boot_interval = np.percentile(_draws, [2.5, 50, 97.5])
    boot_draws = _draws
    return boot_draws, boot_interval


@app.cell(hide_code=True)
def _(alt, boot_draws, boot_interval, mo, pd, repro):
    _chart = (
        alt.Chart(pd.DataFrame({"n": boot_draws}))
        .mark_bar()
        .encode(x=alt.X("n:Q", bin=alt.Bin(maxbins=50), title="Bootstrap Chapman N̂"), y=alt.Y("count()", title=None))
        .properties(height=160, width="container")
    )
    mo.vstack(
        [
            mo.md("### 5.1 · Uncertainty in the reproduction"),
            _chart,
            mo.md(
                f"Sampling uncertainty alone is narrow: 95% of bootstrap estimates fall "
                f"between **{boot_interval[0]:,.0f}** and **{boot_interval[2]:,.0f}** "
                f"(analytic interval {repro['low']:,.0f}–{repro['high']:,.0f}). The "
                "assumption tests above move the estimate by far more than this, so the "
                "real uncertainty is about the *model*, not the sample."
            ),
        ]
    )
    return


@app.cell
def _(cr, occasion_1, occasion_2, pd, pluto_lots):
    _lots = pluto_lots.dropna(subset=["bbl"]).set_index("bbl")
    _landuse = {
        "01": "1–2 family homes",
        "02": "Walk-up apartments",
        "03": "Elevator apartments",
        "04": "Mixed residential/commercial",
        "05": "Commercial & office",
    }
    # PLUTO serves land-use codes unpadded ("1"), so pad before mapping.
    _lots["lot_type"] = _lots.landuse.str.zfill(2).map(_landuse).fillna("Other (industrial, public, vacant…)")
    _lots["borough"] = _lots.index.str[0].map({"1": "Manhattan", "2": "Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island"})

    def _strata(column):
        _groups = {}
        for _value, _ids in _lots.groupby(column).groups.items():
            _ids = set(_ids)
            _groups[_value] = (occasion_1 & _ids, occasion_2 & _ids)
        return cr.stratified_chapman(_groups)

    _pooled = cr.two_occasion(occasion_1 & set(_lots.index), occasion_2 & set(_lots.index))
    strat_borough, strat_borough_rows = _strata("borough")
    strat_type, strat_type_rows = _strata("lot_type")
    _lots["borough_type"] = _lots.borough + " · " + _lots.lot_type
    strat_both, strat_both_rows = _strata("borough_type")
    stratified = pd.DataFrame(
        [
            {"stratification": "None (PLUTO lots only)", "n": _pooled["chapman"], "low": _pooled["low"], "high": _pooled["high"], "note": ""},
            {"stratification": "Borough", **{k: getattr(strat_borough, k) for k in ("n", "low", "high", "note")}},
            {"stratification": "Lot type", **{k: getattr(strat_type, k) for k in ("n", "low", "high", "note")}},
            {"stratification": "Borough × lot type", **{k: getattr(strat_both, k) for k in ("n", "low", "high", "note")}},
        ]
    )
    strat_type_table = pd.DataFrame(strat_type_rows)
    return strat_both, stratified, strat_type_table


@app.cell(hide_code=True)
def _(mo, stratified, strat_type_table):
    _base = stratified.n.iloc[0]
    _best = stratified.n.iloc[-1]
    mo.vstack(
        [
            mo.md("### 5.2 · Stratified estimates"),
            mo.ui.table(stratified.round(0), selection=None),
            mo.md(
                f"Allowing catchability to differ by borough and lot type moves the "
                f"estimate from {_base:,.0f} to **{_best:,.0f}** ({_best / _base - 1:+.0%}). "
                + (
                    "Stratification raises the estimate, as expected when some strata "
                    "are reported far more often than others: pooled, their easy "
                    "recaptures make the whole city look well-sampled."
                    if _best > _base
                    else "Stratification barely changes it, so differences *between* "
                    "these groups are not what drives the heterogeneity; it is lot-to-lot "
                    "variation within them."
                )
            ),
            mo.accordion({"Per lot type": mo.ui.table(strat_type_table.round(3), selection=None)}),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo):
    occasion_design = mo.ui.dropdown(
        {
            "Quarters of 2010 (4 occasions)": ("quarter", [f"2010-Q{q}" for q in (1, 2, 3, 4)]),
            "Months of 2010 (12 occasions)": ("month", [f"2010-{m:02d}" for m in range(1, 13)]),
            "Quarters of 2010–2011 (8 occasions)": (
                "quarter",
                [f"{y}-Q{q}" for y in (2010, 2011) for q in (1, 2, 3, 4)],
            ),
        },
        value="Quarters of 2010 (4 occasions)",
        label="Occasions",
    )
    mo.vstack(
        [
            mo.md(
                "### 5.3 · Multi-occasion models\n\nShorter occasions inside one "
                "year keep the population closer to closed (A1), and several occasions "
                "let the data say how much catchability varies (A2). Models are fit as "
                "Poisson log-linear models on the capture-history table (Rcapture "
                "naming); the never-reported cell is the unseen population."
            ),
            occasion_design,
        ]
    )
    return (occasion_design,)


@app.cell
def _(capture_matrix, cr, occasion_design, pd, reports):
    _column, _labels = occasion_design.value
    _caps = capture_matrix(reports, _column, _labels).values
    _rows = []
    for _model in ("M0", "Mt", "Mh", "Mth"):
        _est, _aic = cr.loglinear(_caps, _model)
        _rows.append({**_est.as_dict(), "aic": _aic})
    _rows.append({**cr.chao_lower_bound(_caps).as_dict(), "aic": None})
    multi = pd.DataFrame(_rows)
    _fitted = multi.dropna(subset=["aic"])
    multi_best = _fitted.loc[_fitted.aic.idxmin()]
    return multi, multi_best


@app.cell(hide_code=True)
def _(mo, multi, multi_best, occasion_design, repro):
    _chao = multi[multi.model.str.startswith("Mh Chao")].iloc[0]
    mo.vstack(
        [
            mo.ui.table(multi[["model", "n", "se", "low", "high", "observed", "aic", "note"]].round(0), selection=None),
            mo.md(
                f"With {occasion_design.selected_key.lower()}, the best-fitting model by "
                f"AIC is **{multi_best.model}**: **{multi_best.n:,.0f}** infested lots "
                f"(95% CI {multi_best.low:,.0f}–{multi_best.high:,.0f}). "
                + (
                    "Models that allow lot-to-lot heterogeneity fit far better than "
                    "those that don't, confirming A2. "
                    if multi_best.model in ("Mh", "Mth")
                    else ""
                )
                + "**But AIC cannot see turnover:** the simulation study (section 7) "
                "shows Mth overshooting badly when lots change status between "
                "occasions, and A1 says they do. "
                + f"Chao's heterogeneity lower bound is {_chao.n:,.0f}. For comparison, "
                f"the year-apart reproduction gave {repro['chapman']:,.0f}: "
                + (
                    "the short-occasion models are lower, consistent with the year-apart "
                    "design counting turnover as extra lots (A1)."
                    if multi_best.n < repro["chapman"]
                    else "the short-occasion models are higher, consistent with "
                    "heterogeneity having pulled the two-occasion estimate down (A2)."
                )
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ### 5.4 · An open, heterogeneous model fitted by simulation

    The closed-population models each fix one violation and ignore the other.
    Instead, simulate cities where **both** happen: $N$ lots infested at any one
    time, catchability varying by lot (logit-normal, SD $\sigma$), and a share
    $\tau$ of infested lots replaced each quarter. For each candidate
    $(N, \sigma, \tau)$ the per-quarter report rates are set so the expected
    lots reported each quarter match what was observed (this also absorbs
    seasonality). The simulated data are summarised the same way as the real
    data: how many lots were reported exactly 1–6 times in the eight quarters of
    2010–11, and the average overlap between quarters 1–7 apart. Overlap that
    *decays* with lag signals turnover; a *plateau* signals heterogeneity. The
    candidates that best reproduce these statistics are the estimate (a grid
    version of approximate Bayesian computation).

    Unlike Lincoln–Petersen, $N$ here is the number of lots infested **at any
    one time**, which is what a head count of rats needs.
    """)
    return


@app.cell
def _(cr, mo, np, quarter_caps):
    @mo.persistent_cache
    def _fit(captures):
        return cr.calibrate(
            captures,
            np.unique(np.geomspace(15_000, 200_000, 14).round(-3)),
            np.arange(0.0, 3.01, 0.5),
            np.arange(0.0, 0.351, 0.05),
        )

    calibration = _fit(quarter_caps.values)
    _best = calibration.iloc[0]
    # How far a dataset drawn from the best fit typically lands from the best
    # fit's own average: differences smaller than this are simulation noise.
    _rates = quarter_caps.values.sum(axis=0) / _best.n
    _stats = [
        np.log1p(cr.summary_statistics(cr.simulate(int(_best.n), 8, _rates, _best.heterogeneity, _best.turnover, seed=100 + _r)))
        for _r in range(6)
    ]
    _centre = np.mean(_stats, axis=0)
    calibration_noise = float(np.mean([np.sqrt(np.mean((_x - _centre) ** 2)) for _x in _stats]))
    plausible = calibration[calibration.distance <= _best.distance + calibration_noise]
    open_model = {
        "n": float(_best.n),
        "heterogeneity": float(_best.heterogeneity),
        "turnover": float(_best.turnover),
        "low": float(plausible.n.min()),
        "high": float(plausible.n.max()),
        "at_edge": bool(plausible.n.max() >= calibration.n.max()),
    }
    return calibration, open_model, plausible


@app.cell(hide_code=True)
def _(alt, calibration, mo, open_model, plausible):
    _slice = calibration[calibration.turnover == open_model["turnover"]]
    _heat = (
        alt.Chart(_slice)
        .mark_rect()
        .encode(
            x=alt.X("n:O", title="Infested lots at any one time"),
            y=alt.Y("heterogeneity:O", title="Heterogeneity σ", sort="descending"),
            color=alt.Color("distance:Q", scale=alt.Scale(scheme="greens", reverse=True), title="Misfit"),
            tooltip=["n", "heterogeneity", "turnover", alt.Tooltip("distance", format=".3f")],
        )
        .properties(height=200, width="container")
    )
    mo.vstack(
        [
            _heat,
            mo.md(
                f"Misfit across city size and heterogeneity, at the best turnover "
                f"({open_model['turnover']:.0%} of infested lots replaced per quarter). "
                f"The best fit is **{open_model['n']:,.0f} lots infested at any one time** "
                f"with heterogeneity σ = {open_model['heterogeneity']}. "
                f"{len(plausible)} candidates fit within simulation noise of the best, "
                f"spanning **{open_model['low']:,.0f}–{open_model['high']:,.0f}** lots"
                + (
                    ", and that range runs to the top of the grid."
                    if open_model["at_edge"]
                    else "."
                )
            ),
            mo.callout(
                mo.md(
                    "**The upper end is not pinned down, and can't be.** More "
                    "heterogeneity means more lots that are almost never reported; "
                    "they leave no trace in the data, so a larger city with more "
                    "near-invisible lots fits about as well (a ridge running up and to "
                    "the right in the chart). This is a known property of "
                    "capture-recapture, not a flaw in this fit: population size is not "
                    "identifiable under unrestricted heterogeneity (Link 2003). The data "
                    "support a **lower** bound well; any upper bound comes from what we "
                    "assume about how unequal reporting can be."
                ),
                kind="info",
            ),
            mo.accordion({"Best-fitting candidates": mo.ui.table(plausible.round(3), selection=None)}),
        ]
    )
    return


@app.cell
def _(cr, insp_2010_h1, occasion_1):
    # 5.5: 311 reports vs. DOHMH inspection findings, same window (H1 2010).
    _found = set(insp_2010_h1.loc[insp_2010_h1.rat_activity > 0, "bbl"])
    two_source = cr.two_occasion(occasion_1, _found)
    return (two_source,)


@app.cell(hide_code=True)
def _(mo, two_source):
    mo.vstack(
        [
            mo.md("### 5.5 · A second source: inspectors instead of callers"),
            mo.md(
                f"Treating DOHMH initial inspections that found active rat signs as the "
                f"second capture (same half-year, H1 2010): {two_source['n1']:,} lots "
                f"reported to 311, {two_source['n2']:,} lots with rat signs found, "
                f"{two_source['m']:,} in both → **{two_source['chapman']:,.0f}** infested "
                f"lots (95% CI {two_source['low']:,.0f}–{two_source['high']:,.0f}).\n\n"
                "**Caveat: inspections don't cover the whole city.** Section 6 shows "
                "most initial inspections are *proactive* sweeps (only about one in "
                "eight follows a 311 complaint on the lot), but sweeps happen in a "
                "few targeted neighbourhoods. Lots elsewhere can only be 'caught' by "
                "311, which is extreme heterogeneity and biases this estimate **low**. "
                "Section 6 uses the sweeps properly, as a field survey."
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ### 5.6 · From infested lots to rats

    Everything above estimates **infested lots**. Turning that into rats needs two
    numbers 311 data cannot supply: **how many colonies** those lots hold, and
    **how big a colony is**. Rather than fixing them, set ranges and propagate them
    with Monte Carlo.

    *Lots per colony* now defaults to **3–7**, from field evidence rather than
    Auerbach's 1: Norway rat home ranges in Baltimore were 30–45 m across
    (Davis et al. 1948, via Byers et al. 2019), which is 700–1,600 m², while the
    median NYC tax lot is about 234 m² (PLUTO), so one home range spans about 3–7
    lots. NYC genetics agree on the scale: rats within ~200 m are close kin
    (Combs et al. 2018). *Rats per colony* stays at Auerbach's 40–50, which has no
    traceable field source; NYC Health's own guidance is 1–12 rats per active
    burrow, and a colony can hold several burrows. Set lots per colony to 1–1 to
    reproduce Auerbach.
    """)
    return


@app.cell(hide_code=True)
def _(mo, multi_best, open_model, repro, strat_both, two_source):
    estimate_choice = mo.ui.dropdown(
        {
            "Reproduction (Lincoln–Petersen, year apart)": (repro["lincoln_petersen"], repro["se"]),
            "Open heterogeneous model (best fit, plausible range)": (
                open_model["n"],
                (open_model["high"] - open_model["low"]) / 4,
            ),
            "Stratified Chapman (borough × lot type)": (strat_both.n, strat_both.se),
            f"Best multi-occasion model ({multi_best.model})": (multi_best.n, multi_best.se),
            "Two-source, 311 × inspections (lower bound)": (two_source["chapman"], two_source["se"]),
        },
        value="Reproduction (Lincoln–Petersen, year apart)",
        label="Infested-lot estimate",
    )
    colony_size = mo.ui.range_slider(5, 100, value=[40, 50], step=5, label="Rats per colony", show_value=True)
    lots_per_colony = mo.ui.range_slider(
        1.0, 8.0, value=[3.0, 7.0], step=0.5, label="Infested lots per colony", show_value=True
    )
    mo.vstack([estimate_choice, colony_size, lots_per_colony])
    return colony_size, estimate_choice, lots_per_colony


@app.cell
def _(cr, lots_in, reports):
    # A6: the same design with tax blocks as the "animal". If every infested
    # block held one colony, this would count colonies.
    blocks = cr.two_occasion(
        set(b[:6] for b in lots_in(reports, "half", "2010-H1")),
        set(b[:6] for b in lots_in(reports, "half", "2011-H1")),
    )
    return (blocks,)


@app.cell
def _(colony_size, estimate_choice, lots_per_colony, np):
    _rng = np.random.default_rng(7)
    _n, _se = estimate_choice.value
    _draws = 100_000
    _lots = np.clip(_rng.normal(_n, _se, _draws), 0, None)
    _size = _rng.uniform(*colony_size.value, _draws)
    _share = _rng.uniform(*lots_per_colony.value, _draws)
    rat_draws = _lots / _share * _size
    rat_interval = np.percentile(rat_draws, [5, 50, 95])
    return (rat_interval,)


@app.cell(hide_code=True)
def _(a6_lots_per_block, blocks, colony_size, estimate_choice, lots_per_colony, mo, rat_interval, repro):
    mo.md(
        f"Using **{estimate_choice.selected_key}**, {colony_size.value[0]}–{colony_size.value[1]} "
        f"rats per colony and {lots_per_colony.value[0]:.1f}–{lots_per_colony.value[1]:.1f} "
        f"infested lots per colony: median **{rat_interval[1] / 1e6:.2f} million rats**, "
        f"90% interval {rat_interval[0] / 1e6:.2f}–{rat_interval[2] / 1e6:.2f} million.\n\n"
        "**How many lots per colony?** Repeating the reproduction with tax *blocks* "
        f"as the unit estimates **{blocks['chapman']:,.0f} infested blocks** (95% CI "
        f"{blocks['low']:,.0f}–{blocks['high']:,.0f}), against "
        f"{repro['chapman']:,.0f} infested lots: {repro['chapman'] / blocks['chapman']:.2f} "
        "infested lots per infested block. If a whole block were one colony's "
        "territory, 'lots per colony' would be about that; Auerbach's assumption is 1. "
        f"Reported lots alone cluster at {a6_lots_per_block:.2f} per affected block (A6). "
        "Widening either slider shows how quickly the head count stops being "
        "informative: **the colony assumptions, not the statistics, dominate the answer.**"
    )
    return


@app.cell
def _(cr, lots_in, pd, reports):
    # 5.7: the original design, repeated every year.
    _rows = []
    for _y in range(2010, 2026):
        _r = cr.two_occasion(lots_in(reports, "half", f"{_y}-H1"), lots_in(reports, "half", f"{_y + 1}-H1"))
        _rows.append({"first_half": _y, **_r})
    trend = pd.DataFrame(_rows)
    return (trend,)


@app.cell(hide_code=True)
def _(alt, mo, trend):
    _line = (
        alt.Chart(trend)
        .mark_line(point=True)
        .encode(
            x=alt.X("first_half:O", title="H1 of year → H1 of next year"),
            y=alt.Y("chapman:Q", title="Chapman N̂ (infested lots)"),
            tooltip=["first_half", "n1", "n2", "m", alt.Tooltip("chapman", format=",.0f")],
        )
    )
    _band = _line.mark_area(opacity=0.15).encode(y="low:Q", y2="high:Q")
    _reports = (
        alt.Chart(trend)
        .mark_line(strokeDash=[4, 3], color="gray")
        .encode(x="first_half:O", y=alt.Y("n1:Q", title="Lots reported in H1"))
    )
    _first, _last = trend.iloc[0], trend.iloc[-1]
    mo.vstack(
        [
            mo.md("### 5.7 · The same design, every year"),
            alt.layer(_band + _line, _reports).resolve_scale(y="independent").properties(height=230, width="container"),
            mo.md(
                f"Estimated infested lots went from {_first.chapman:,.0f} "
                f"({int(_first.first_half)}→{int(_first.first_half) + 1}) to {_last.chapman:,.0f} "
                f"({int(_last.first_half)}→{int(_last.first_half) + 1}), {_last.chapman / _first.chapman - 1:+.0%}, "
                f"while lots reported in H1 rose {_last.n1 / _first.n1 - 1:+.0%} (dashed line). "
                "Capture-recapture partly adjusts for people reporting more, because more "
                "reporting also raises m. But the A1 and A2 problems apply to every "
                "year, and if they changed over time (more 311 app use, new inspection "
                "programmes), this trend inherits that change. **Read it as direction, "
                "not as a census.**"
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## 6. Closing the gap: the city's own inspection sweeps

    Capture-recapture has to *assume* how often an infested lot gets reported.
    The Health Department's proactive **rat indexing** lets us *measure* it:
    inspectors walk targeted neighbourhoods block by block and inspect every
    property, whether or not anyone complained (CDC 2012). The public data has
    no flag for these visits, so sweeps are inferred from behaviour:

    - at least **5 lots** on one tax block inspected on the same day,
    - at most **20%** of them preceded by a 311 rodent complaint on that lot in the
      previous 60 days,
    - covering at least **70%** of the block's lots (PLUTO).

    The first such sweep of each block is used. Inside a sweep we know which lots
    and blocks had active rat signs, so sweeps act as a field survey: the design
    Baltimore used in 1949 and 2004 (stratify blocks, survey a sample, scale up;
    Davis & Fales 1950; Easterbrook et al. 2005), with the city's inspectors as
    the field team. Two periods are analysed: **2010–11**, the reproduction
    window (indexing ran in the Bronx and, from 2010, Manhattan), and **2023–24**,
    the latest complete years (the rat mitigation zones).
    """)
    return


@app.cell
def _(pd, pluto_lots):
    _lots = pluto_lots.dropna(subset=["bbl"]).assign(block=lambda d: d.bbl.str[:6])
    block_frame = _lots.groupby("block").agg(lots=("bbl", "nunique"), units=("unitsres", "sum"))
    block_frame["density"] = pd.cut(
        block_frame.units / block_frame.lots,
        [-1, 2, 10, float("inf")],
        labels=["≤2 homes per lot", "2–10 homes per lot", ">10 homes per lot"],
    )
    return (block_frame,)


@app.cell
def _(
    block_frame,
    complaints_2010,
    complaints_2023,
    cr,
    insp_records_2010,
    insp_records_2023,
    lots_in,
    pd,
    reports,
    sw,
):
    _rat_reports = reports.assign(block=lambda d: d.bbl.str[:6])
    _periods = {
        "2010–11": (insp_records_2010, complaints_2010, "2010-01-01", "2012-01-01", ("2010-H1", "2011-H1")),
        "2023–24": (insp_records_2023, complaints_2023, "2023-01-01", "2025-01-01", ("2023-H1", "2024-H1")),
    }
    sweep_results = {}
    for _name, (_ins, _complaints, _start, _end, _pair) in _periods.items():
        _ins = _ins.dropna(subset=["bbl"]).copy()
        _ins["triggered"] = sw.mark_triggered(_ins, _complaints.dropna(subset=["bbl"]))
        _sweeps = sw.find_sweeps(_ins, block_frame.lots)
        _ins["block"] = _ins.bbl.str[:6]
        _nta = _ins.groupby("block").nta.agg(lambda x: x.mode().iat[0] if x.notna().any() else "unknown")
        _sweeps["nta"] = _sweeps.block.map(_nta)
        _sweeps["infested"] = _sweeps.rat_lots > 0
        # Inspectors reach most but not all of a block's lots in a sweep; assume
        # the lots they missed look like the ones they saw.
        _sweeps["rat_lots_block"] = _sweeps.rat_lots / _sweeps.coverage.clip(upper=1)
        _sweeps["reported"] = sw.reported_near(_sweeps, _rat_reports, "block")
        # Lot level: every lot inspected on its block's sweep day.
        _day = _ins.inspection_date.dt.normalize()
        _keys = set(zip(_sweeps.block, _sweeps.day))
        _lots = (
            _ins[[k in _keys for k in zip(_ins.block, _day)]]
            .assign(day=lambda d: d.inspection_date.dt.normalize())
            .sort_values("rat_activity", ascending=False)
            .drop_duplicates("bbl")
            .reset_index(drop=True)
        )
        _lots["reported"] = sw.reported_near(_lots, _rat_reports, "bbl")
        _found = _lots[_lots.rat_activity]
        # Strata: how intensely each block reports to 311 over the period, and housing density.
        _period = _rat_reports[(_rat_reports.created_date >= _start) & (_rat_reports.created_date < _end)]
        _frame = block_frame.copy()
        _frame["intensity"] = pd.cut(
            _period.groupby("block").bbl.nunique().reindex(_frame.index).fillna(0) / _frame.lots,
            [-0.01, 0, 0.05, 0.15, float("inf")],
            labels=["no reports", "≤5% of lots", "5–15%", ">15%"],
        )
        _sample = _sweeps.join(_frame[["intensity", "density"]], on="block")
        _blocks_est = sw.stratified_total(_sample, _frame, ["intensity", "density"], "infested", "nta", reps=200)
        _lots_est = sw.stratified_total(_sample, _frame, ["intensity", "density"], "rat_lots_block", "nta", reps=200)
        _block_rates = sw.two_source_rates(_sweeps.infested, _sweeps.reported)
        _halves = _period.assign(
            h=_period.created_date.dt.year.astype(str) + (_period.created_date.dt.month > 6).astype(str)
        ).groupby("h").block.nunique()
        sweep_results[_name] = {
            "sweeps": _sweeps,
            "sample": _sample,
            "frame": _frame,
            "all_triggered": float(_ins.triggered.mean()),
            "inspections": int(len(_ins)),
            "swept_lot_inspections": int(_sweeps.lots.sum()),
            "lot_rates": sw.two_source_rates(_lots.rat_activity, _lots.reported),
            "block_rates": _block_rates,
            "blocks_est": _blocks_est,
            "lots_est": _lots_est,
            "reported_blocks_per_half": float(_halves.mean()),
            "detection_blocks": float(
                _halves.mean() * _block_rates["p_found_given_reported"] / _block_rates["p_reported_given_found"]
            ),
            "block_chapman": cr.two_occasion(
                set(b[:6] for b in lots_in(reports, "half", _pair[0])),
                set(b[:6] for b in lots_in(reports, "half", _pair[1])),
            ),
            "rat_lots_per_infested_block": _sweeps.loc[_sweeps.infested, "rat_lots"].to_numpy(),
            "burrow_share": float(_found.observations.fillna("").str.contains("Burrow").mean()),
            "top_ntas": _sweeps.groupby("nta").lots.sum().sort_values(ascending=False).head(8),
        }
    return (sweep_results,)


@app.cell(hide_code=True)
def _(mo):
    sweep_period = mo.ui.dropdown(["2010–11", "2023–24"], value="2023–24", label="Period")
    sweep_period
    return (sweep_period,)


@app.cell(hide_code=True)
def _(mo, pd, sweep_period, sweep_results):
    _r = sweep_results[sweep_period.value]
    _s = _r["sweeps"]
    _ntas = _r["top_ntas"].rename("lots inspected in sweeps").reset_index()
    mo.vstack(
        [
            mo.md(f"### 6.1 · Do the inferred sweeps look like indexing? ({sweep_period.value})"),
            mo.ui.table(
                pd.DataFrame(
                    [
                        ["Initial inspections", f"{_r['inspections']:,}"],
                        ["…preceded by a 311 complaint on the lot (60 days)", f"{_r['all_triggered']:.0%}"],
                        ["Swept blocks found", f"{len(_s):,} in {_s.nta.nunique()} neighbourhoods"],
                        ["Median share of the block's lots inspected that day", f"{_s.coverage.median():.0%}"],
                        ["Complaint-preceded share inside sweeps", f"{_s.triggered.mean():.1%}"],
                        ["Swept blocks with active rat signs", f"{_s.infested.mean():.0%}"],
                    ],
                    columns=["", "Value"],
                ),
                selection=None,
            ),
            mo.md(
                "Most initial inspections are not complaint-driven at all, and the "
                "inferred sweeps cover most of each block with almost no complaint "
                "behind them: the signature of proactive indexing. The neighbourhoods "
                "mostly match the programme's published footprint (Manhattan and the "
                "South Bronx around 2010; the Bed-Stuy/Bushwick, Harlem, Lower Manhattan "
                "and Grand Concourse rat mitigation zones today), an independent check "
                "that the inference picks out the right visits. Some swept areas sit "
                "outside those zones (other targeted sweeps, or neighbouring blocks), "
                "which the flag requested in 6.7 would sort out."
            ),
            mo.ui.table(_ntas, selection=None),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo, pd, sweep_period, sweep_results):
    _r = sweep_results[sweep_period.value]
    _lot, _blk = _r["lot_rates"], _r["block_rates"]
    _table = pd.DataFrame(
        [
            ["Lot", _lot["units"], _lot["p_found_given_reported"], _lot["p_reported_given_found"], _lot["inspector_sensitivity"]],
            ["Block", _blk["units"], _blk["p_found_given_reported"], _blk["p_reported_given_found"], _blk["inspector_sensitivity"]],
        ],
        columns=["Unit", "swept units", "P(rat signs | 311 report)", "P(311 report | rat signs)", "inspector sensitivity if independent"],
    )
    mo.vstack(
        [
            mo.md("### 6.2 · What does a 311 report actually mean?"),
            mo.ui.table(
                _table.assign(**{c: _table[c].map("{:.0%}".format) for c in _table.columns[2:]}),
                selection=None,
            ),
            mo.md(
                f"A report within three months of the sweep points to a lot with "
                f"active signs only **{_lot['p_found_given_reported']:.0%}** of the time, "
                f"but to a **block** with active signs **{_blk['p_found_given_reported']:.0%}** "
                "of the time. Reports are not mostly false alarms; they are about the "
                "right place at the scale rats live at, but often name the wrong lot "
                "(the caller's building, not the burrow next door). That is A5 and A6 "
                "together, and it is why the block is the better unit.\n\n"
                f"Going the other way, only **{_blk['p_reported_given_found']:.0%}** of "
                "infested blocks produced a 311 rat report within three months: the "
                "detection rate capture-recapture had to guess. Treating inspectors and "
                "311 as two independent captures suggests inspectors find about "
                f"**{_blk['inspector_sensitivity']:.0%}** of infested blocks. Positive "
                "dependence (bad blocks are easy for both) means true sensitivity is "
                "probably lower, so we carry a range from that value up to 100%."
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(PUBLISHED, alt, mo, pd, repro, sweep_period, sweep_results):
    _r = sweep_results[sweep_period.value]
    _b, _l = _r["blocks_est"], _r["lots_est"]
    _table = _b["table"].rename(columns={"frame_units": "blocks in city", "mean": "infested share (sweeps)", "size": "swept blocks"})
    _rows = pd.DataFrame(
        [
            {"estimate": "Stratified, sweeps as the field survey", "infested blocks": _b["total"], "low": _b["low"], "high": _b["high"]},
            {"estimate": "Detection rate (reported blocks ÷ P(report | infested))", "infested blocks": _r["detection_blocks"], "low": None, "high": None},
            {"estimate": "311 capture-recapture on blocks (H1 vs next H1)", "infested blocks": _r["block_chapman"]["chapman"], "low": _r["block_chapman"]["low"], "high": _r["block_chapman"]["high"]},
        ]
    )
    _chart = (
        alt.Chart(_table)
        .mark_bar()
        .encode(
            y=alt.Y("intensity:N", sort=None, title="311 reporting on the block"),
            x=alt.X("infested share (sweeps):Q", axis=alt.Axis(format="%"), title="Swept blocks with active rat signs"),
            color=alt.Color("density:N", title="Housing density"),
            yOffset="density:N",
            tooltip=["intensity", "density", "blocks in city", "swept blocks", alt.Tooltip("infested share (sweeps)", format=".0%")],
        )
        .properties(height=220, width="container")
    )
    _gap = _l["total"] / repro["lincoln_petersen"] - 1
    _repro_note = (
        f"For 2010–11 the stratified estimate of **infested lots** (inspector-found, "
        f"scaled for lots not reached in the sweep) is **{_l['total']:,.0f}** (95% CI "
        f"{_l['low']:,.0f}–{_l['high']:,.0f}), against Auerbach's 40,500 and our "
        f"reproduction's {repro['lincoln_petersen']:,.0f} ({_gap:+.0%}). "
        + (
            "A completely different method lands close to the same number."
            if abs(_gap) <= 0.25
            else "The methods disagree by more than a quarter, so neither should be "
            "read as confirming the other."
        )
        if sweep_period.value == "2010–11"
        else f"Stratified **infested lots** (inspector-found): **{_l['total']:,.0f}** "
        f"(95% CI {_l['low']:,.0f}–{_l['high']:,.0f}), "
        f"{_l['total'] / PUBLISHED['lots_total']:.1%} of the city's lots."
    )
    mo.vstack(
        [
            mo.md("### 6.3 · Citywide infested blocks"),
            _chart,
            mo.md(
                "Infestation rises steadily with how much a block reports to 311 and with "
                "housing density, so these two traits are the strata. Each stratum's "
                "swept share is applied to all of the city's blocks in it; uncertainty "
                "comes from a bootstrap that resamples whole neighbourhoods."
            ),
            mo.ui.table(_rows.round(0), selection=None),
            mo.md(
                f"The three methods give **{_rows['infested blocks'].min():,.0f}–"
                f"{_rows['infested blocks'].max():,.0f} infested blocks** out of "
                f"{len(_r['frame']):,}. The stratified number is the upper end: swept "
                "blocks sit in high-risk neighbourhoods, so applying their rates to, "
                "say, quiet blocks in Staten Island likely overstates those (the "
                f"'no reports, ≤2 homes per lot' stratum alone contributes "
                f"{_table.iloc[0]['blocks in city'] * _table.iloc[0]['infested share (sweeps)']:,.0f}). "
                "The detection-rate number is the lower end: it applies the swept "
                "neighbourhoods' reporting rate everywhere, and people elsewhere report "
                "less. 311-only capture-recapture sits between them.\n\n" + _repro_note
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo, sweep_period, sweep_results):
    _r = sweep_results[sweep_period.value]
    _sens = round(min(max(_r["block_rates"]["inspector_sensitivity"], 0.3), 1.0), 2)
    chain_lots_per_colony = mo.ui.range_slider(1.0, 8.0, value=[3.0, 7.0], step=0.5, label="Lots per colony territory", show_value=True)
    chain_colony_size = mo.ui.range_slider(5, 100, value=[40, 50], step=5, label="Rats per colony", show_value=True)
    chain_sensitivity = mo.ui.range_slider(0.3, 1.0, value=[_sens, 1.0], step=0.01, label="Inspector sensitivity (blocks)", show_value=True)
    chain_rats_per_block = mo.ui.range_slider(2, 220, value=[50, 124], step=1, label="Rats per infested block", show_value=True)
    mo.vstack(
        [
            mo.md(
                "### 6.4 · From infested blocks to rats\n\n"
                "Infested blocks are drawn between the detection-rate and stratified "
                "estimates (uniformly, the honest summary of 6.3) and scaled up for "
                f"blocks inspectors missed (sensitivity defaults to {_sens:.0%}–100% from "
                "6.2). Then two routes turn blocks into rats:\n\n"
                "- **Route A, colonies.** A block with *k* infested lots holds max(1, "
                "*k* ÷ lots-per-colony) colonies, using the sweeps' own distribution of "
                "*k*, times rats per colony. Colony size has no traceable field source; "
                "40–50 is Auerbach's.\n"
                "- **Route B, rats per block measured in Baltimore.** Baltimore's "
                "row-house blocks are built around a central alley, so rats per alley is "
                "rats per infested block. Removal trapping in 20 alleys of high-density "
                "neighbourhoods found **49.6 ± 12.5** rats per alley one year and "
                "**123.8 ± 42.2** the next (Glass et al. 2009), with sites ranging from 2 "
                "to 217. That replaces colony size and lots-per-colony with a field "
                "measurement, from a different city."
            ),
            chain_sensitivity,
            mo.md("**Route A**"),
            chain_lots_per_colony,
            chain_colony_size,
            mo.md("**Route B**"),
            chain_rats_per_block,
        ]
    )
    return chain_colony_size, chain_lots_per_colony, chain_rats_per_block, chain_sensitivity


@app.cell
def _(
    chain_colony_size,
    chain_lots_per_colony,
    chain_rats_per_block,
    chain_sensitivity,
    np,
    sweep_period,
    sweep_results,
):
    _r = sweep_results[sweep_period.value]
    _rng = np.random.default_rng(17)
    _draws = 20_000
    _lo = min(_r["detection_blocks"], _r["blocks_est"]["total"])
    _hi = max(_r["detection_blocks"], _r["blocks_est"]["high"])
    _blocks = _rng.uniform(_lo, _hi, _draws) / _rng.uniform(*chain_sensitivity.value, _draws)
    _per_colony = _rng.uniform(*chain_lots_per_colony.value, _draws)
    _k = _r["rat_lots_per_infested_block"]
    # Mean colonies per infested block for each draw of lots-per-colony.
    _grid = np.linspace(*chain_lots_per_colony.value, 41) if chain_lots_per_colony.value[1] > chain_lots_per_colony.value[0] else np.array([chain_lots_per_colony.value[0]])
    _colonies_at = np.array([np.maximum(1, _k / _g).mean() for _g in _grid])
    _colonies = np.interp(_per_colony, _grid, _colonies_at)
    _rats = _blocks * _colonies * _rng.uniform(*chain_colony_size.value, _draws)
    chain_interval = np.percentile(_rats, [5, 50, 95])
    chain_colonies = np.percentile(_blocks * _colonies, [5, 50, 95])
    # Route B: the same infested blocks, times Baltimore's rats per alley.
    block_route_interval = np.percentile(
        _blocks * _rng.uniform(*chain_rats_per_block.value, _draws), [5, 50, 95]
    )
    return block_route_interval, chain_colonies, chain_interval


@app.cell(hide_code=True)
def _(
    block_route_interval,
    chain_colonies,
    chain_colony_size,
    chain_interval,
    chain_rats_per_block,
    mo,
    sweep_period,
    sweep_results,
):
    _r = sweep_results[sweep_period.value]
    _l = _r["lots_est"]["total"]
    _burrow_lo = _l * _r["burrow_share"] * 1 * 1
    _burrow_hi = _l * _r["burrow_share"] * 2 * 12 / min(_r["block_rates"]["inspector_sensitivity"], 1)
    _a, _b = chain_interval, block_route_interval
    _overlap = _a[0] <= _b[2] and _b[0] <= _a[2]
    _ratio = _b[1] / _a[1]
    mo.vstack(
        [
            mo.hstack(
                [
                    mo.stat(f"{chain_colonies[1]:,.0f}", label="Route A: colonies (median)", caption=f"90%: {chain_colonies[0]:,.0f}–{chain_colonies[2]:,.0f}"),
                    mo.stat(f"{_a[1] / 1e6:.2f} M", label=f"Route A: rats, {sweep_period.value}", caption=f"90%: {_a[0] / 1e6:.2f}–{_a[2] / 1e6:.2f} million"),
                    mo.stat(f"{_b[1] / 1e6:.2f} M", label=f"Route B: rats, {sweep_period.value}", caption=f"90%: {_b[0] / 1e6:.2f}–{_b[2] / 1e6:.2f} million"),
                ],
                widths="equal",
            ),
            mo.md(
                f"**Route A** (colonies of {chain_colony_size.value[0]}–"
                f"{chain_colony_size.value[1]}) gives **{_a[0] / 1e6:.2f}–{_a[2] / 1e6:.2f} "
                f"million rats**; **Route B** ({chain_rats_per_block.value[0]}–"
                f"{chain_rats_per_block.value[1]} rats per infested block, measured in "
                f"Baltimore) gives **{_b[0] / 1e6:.2f}–{_b[2] / 1e6:.2f} million** "
                f"({sweep_period.value}). "
                + (
                    f"The two routes overlap, and their medians differ by a factor of "
                    f"{max(_ratio, 1 / _ratio):.1f}: an assumed colony size and a measured "
                    "density from another city point to the same range."
                    if _overlap
                    else "The two routes do **not** overlap, so either the colony "
                    "assumptions or the transfer from Baltimore is wrong."
                )
                + " Route B's weak points are the transfer itself (NYC blocks are larger "
                "and denser, and NYC has subways and high-rises) and removal trapping, "
                "which counts only the rats that can be trapped, so it leans low.\n\n"
                f"**Burrow cross-check.** {_r['burrow_share']:.0%} of lots with active "
                "signs in sweeps had burrows recorded. Taking NYC Health's own 1–12 rats "
                "per active burrow and 1–2 burrows per lot gives "
                f"{_burrow_lo / 1e6:.2f}–{_burrow_hi / 1e6:.2f} million rats in burrows on "
                "inspected lots, a route that doesn't use colony size at all. "
                + (
                    "That range overlaps the colony-based one above, but it is far wider, "
                    "because burrow *counts* aren't recorded (6.7). "
                    if _burrow_hi >= chain_interval[0] and _burrow_lo <= chain_interval[2]
                    else "That range does not overlap the colony-based one above, which "
                    "suggests the colony settings are off. "
                )
                + "It also misses rats in sewers, subways and building interiors."
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo):
    survey_blocks = mo.ui.slider(50, 1000, value=300, step=50, label="Blocks to survey", show_value=True)
    mo.vstack(
        [
            mo.md(
                "### 6.5 · Designing a real field survey\n\n"
                "Sweeps only cover the neighbourhoods the city chose, which is the "
                "weakness in 6.3. A survey of a **random** sample of blocks from every "
                "stratum fixes that, and if it counts rats (live trapping with marking, "
                "or camera traps with spatial capture-recapture, as in Baltimore and "
                "Vancouver) it removes colony size from the problem entirely. Below is a "
                "Neyman allocation over the same strata, planned on the sweeps' "
                "block-level variability, and a reproducible random sample."
            ),
            survey_blocks,
        ]
    )
    return (survey_blocks,)


@app.cell
def _(np, pd, survey_blocks, sweep_results, sw):
    _r = sweep_results["2023–24"]
    _t = _r["blocks_est"]["table"].set_index(["intensity", "density"])
    _sd = np.sqrt((_t["mean"] * (1 - _t["mean"])).clip(lower=0.05**2))
    survey_alloc = sw.neyman_allocation(_t.frame_units, _sd, survey_blocks.value)
    _se = sw.stratified_se(_t.frame_units, _sd, survey_alloc)
    survey_cv = _se / float((_t.frame_units * _t["mean"]).sum())
    _frame = _r["frame"].reset_index()
    _rng = np.random.default_rng(2026)
    _picks = []
    for (_i, _d), _n in survey_alloc.items():
        _pool = _frame[(_frame.intensity == _i) & (_frame.density == _d)]
        _picks.append(_pool.sample(n=min(int(_n), len(_pool)), random_state=int(_rng.integers(1e9))))
    survey_sample = pd.concat(_picks, ignore_index=True)[["block", "intensity", "density", "lots"]]
    survey_sample.insert(1, "borough", survey_sample.block.str[0].map({"1": "Manhattan", "2": "Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island"}))
    survey_sample.insert(2, "tax_block", survey_sample.block.str[1:].astype(int))
    return survey_alloc, survey_cv, survey_sample


@app.cell(hide_code=True)
def _(mo, survey_alloc, survey_cv, survey_sample):
    mo.vstack(
        [
            mo.md(
                f"Surveying **{int(survey_alloc.sum())} blocks** this way would estimate "
                f"citywide infested blocks with a coefficient of variation of about "
                f"**{survey_cv:.0%}**, from a sample drawn across all five boroughs and "
                "every stratum (planning on 2023–24 sweep variability; a rat count per "
                "block will be more variable than presence, so treat this as optimistic)."
            ),
            mo.ui.table(survey_alloc.rename("blocks to survey").reset_index(), selection=None),
            mo.download(
                survey_sample.to_csv(index=False).encode(),
                filename="ratlas-field-survey-sample.csv",
                label="Download the block sample (CSV, seed 2026)",
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(chain_interval, mo):
    ckmr_adults = mo.ui.slider(
        5_000, 2_000_000, value=int(round(chain_interval[1] / 2, -4)) or 10_000, step=5_000,
        label="Adult rats in the study area", show_value=True,
    )
    ckmr_pairs = mo.ui.slider(20, 150, value=50, step=10, label="Parent–offspring pairs wanted", show_value=True)
    mo.vstack(
        [
            mo.md(
                "### 6.6 · Genetics: close-kin mark-recapture\n\n"
                "Close-kin mark-recapture (Bravington et al. 2016) estimates abundance "
                "from how many sampled animals turn out to be parent and offspring: in "
                "a well-mixed population of *N* adults, sampling *n* adults and *n* "
                "juveniles yields about 2*n*²/*N* such pairs. It needs only tissue from "
                "rats already killed by control programmes, no recapture. I found no "
                "application to city rats yet. The default is half the median "
                "head count from 6.4."
            ),
            ckmr_adults,
            ckmr_pairs,
        ]
    )
    return ckmr_adults, ckmr_pairs


@app.cell(hide_code=True)
def _(ckmr_adults, ckmr_pairs, mo, sw):
    _n = sw.ckmr_samples(ckmr_adults.value, ckmr_pairs.value)
    mo.md(
        f"About **{_n:,.0f} adults and {_n:,.0f} juveniles** ({2 * _n:,.0f} genotyped "
        f"rats) to expect {ckmr_pairs.value} parent–offspring pairs among "
        f"{ckmr_adults.value:,} adults. Citywide that is a large but not absurd "
        "genotyping effort; for one rat mitigation zone it is a single season of "
        "carcass collection. The catch is spatial structure: NYC rats within ~200 m "
        "are close kin (Combs et al. 2018), so samples must be spread evenly or the "
        "model made spatially explicit, otherwise kin pairs are over-found and *N* "
        "comes out too small."
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ### 6.7 · What to ask the Health Department for

    The public inspection file is missing three things that would remove most of
    the remaining guesswork: **a flag for proactive vs. complaint inspections**
    (replacing the inference in 6.1), **the 0–3 severity scores** inspectors
    record for each active sign, and **counts of active burrows** (turning the
    burrow cross-check into an estimate). A draft records request is in
    `research/foil_request.md`.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## 7. Which estimator should we trust? A simulation study

    We simulate a city with a **known** number of infested lots (40,000), four
    occasions, and controllable violations: lot-to-lot heterogeneity in
    catchability (A2) and turnover of infested lots between occasions (A1). Each
    estimator is run on the simulated reports; the bias is the error against the
    truth. Move the sliders to explore. (The open model of section 5.4 is too slow
    to rerun on every slider move; `research/test_capture_recapture.py` checks
    that its calibration recovers a known simulated city exactly.)
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    sim_heterogeneity = mo.ui.slider(0.0, 2.5, value=1.5, step=0.25, label="Heterogeneity (logit SD)", show_value=True)
    sim_turnover = mo.ui.slider(0.0, 0.6, value=0.2, step=0.05, label="Turnover per occasion", show_value=True)
    sim_p = mo.ui.slider(0.02, 0.3, value=0.06, step=0.01, label="Mean chance of a report per occasion", show_value=True)
    mo.hstack([sim_heterogeneity, sim_turnover, sim_p], justify="start")
    return sim_heterogeneity, sim_p, sim_turnover


@app.cell
def _(cr, np, pd):
    def run_simulation(heterogeneity, turnover, p_mean, reps=8, n_true=40_000):
        _rows = []
        for _seed in range(reps):
            _caps = cr.simulate(n_true, 4, p_mean, heterogeneity, turnover, seed=_seed)
            _first = set(np.flatnonzero(_caps[:, 0]))
            _third = set(np.flatnonzero(_caps[:, 2]))
            _estimates = {
                "Chapman, occasions 1 & 3": cr.two_occasion(_first, _third)["chapman"],
                "Mt": cr.loglinear(_caps, "Mt")[0].n,
                "Mth": cr.loglinear(_caps, "Mth")[0].n,
                "Chao lower bound": cr.chao_lower_bound(_caps).n,
            }
            for _name, _value in _estimates.items():
                _rows.append({"estimator": _name, "seed": _seed, "error": _value / n_true - 1})
        return pd.DataFrame(_rows)

    return (run_simulation,)


@app.cell
def _(run_simulation, sim_heterogeneity, sim_p, sim_turnover):
    sim_results = run_simulation(sim_heterogeneity.value, sim_turnover.value, sim_p.value)
    return (sim_results,)


@app.cell(hide_code=True)
def _(alt, mo, sim_heterogeneity, sim_results, sim_turnover):
    _summary = sim_results.groupby("estimator").error.agg(["mean", "std"]).reset_index()
    _best = _summary.loc[_summary["mean"].abs().idxmin()]
    _chart = (
        alt.Chart(sim_results)
        .mark_boxplot()
        .encode(
            y=alt.Y("estimator:N", title=None),
            x=alt.X("error:Q", title="Error vs truth", axis=alt.Axis(format="+%")),
        )
        .properties(height=170, width="container")
    )
    _zero = alt.Chart().mark_rule(strokeDash=[3, 3]).encode(x=alt.datum(0))
    mo.vstack(
        [
            alt.layer(_chart, _zero),
            mo.md(
                f"With heterogeneity {sim_heterogeneity.value} and turnover "
                f"{sim_turnover.value:.0%} per occasion, the least biased estimator is "
                f"**{_best.estimator}** ({_best['mean']:+.0%} on average). Turnover pushes "
                "the year-apart Chapman estimate up; heterogeneity pulls it down; Mth "
                "and the Chao bound handle heterogeneity but not turnover. The real "
                "data shows both violations, so **no single estimator is safe, and the "
                "honest answer is a range**."
            ),
        ]
    )
    return


@app.cell
def _(pd, run_simulation):
    # A fixed grid, so the conclusion doesn't depend on slider positions.
    _rows = []
    for _h in (0.0, 1.0, 2.0):
        for _t in (0.0, 0.2, 0.4):
            _r = run_simulation(_h, _t, 0.06, reps=4).groupby("estimator").error.mean()
            _rows.append({"heterogeneity": _h, "turnover": _t, **_r.to_dict()})
    sim_grid = pd.DataFrame(_rows)
    return (sim_grid,)


@app.cell(hide_code=True)
def _(mo, sim_grid):
    mo.vstack(
        [
            mo.md("**Average error by scenario** (4 replicates each, mean report chance 6%):"),
            mo.ui.table(
                sim_grid.assign(
                    **{_c: sim_grid[_c].map("{:+.0%}".format) for _c in sim_grid.columns[2:]}
                ),
                selection=None,
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## 8. Results
    """)
    return


@app.cell
def _(multi_best, open_model, pd, repro, strat_both, sweep_results, two_source):
    _sweep_lots = sweep_results["2010–11"]["lots_est"]
    results = pd.DataFrame(
        [
            {"estimate": "Reproduction: Lincoln–Petersen, H1 2010 vs H1 2011", "n": repro["lincoln_petersen"], "low": repro["low"], "high": repro["high"], "main weakness": "turnover inflates; heterogeneity deflates"},
            {"estimate": "Chapman, same occasions", "n": repro["chapman"], "low": repro["low"], "high": repro["high"], "main weakness": "same as above"},
            {"estimate": "Stratified Chapman, borough × lot type", "n": strat_both.n, "low": strat_both.low, "high": strat_both.high, "main weakness": "turnover; within-stratum heterogeneity"},
            {"estimate": f"Best multi-occasion model ({multi_best.model})", "n": multi_best.n, "low": multi_best.low, "high": multi_best.high, "main weakness": "model choice; residual turnover inside the year"},
            {"estimate": "Open heterogeneous model, fitted by simulation", "n": open_model["n"], "low": open_model["low"], "high": open_model["high"], "main weakness": "upper end not identifiable; simplified simulation"},
            {"estimate": "Two-source, 311 × inspections", "n": two_source["chapman"], "low": two_source["low"], "high": two_source["high"], "main weakness": "inspections cover few neighbourhoods → biased low"},
            {"estimate": "Inspection sweeps as a field survey (stratified, 2010–11)", "n": _sweep_lots["total"], "low": _sweep_lots["low"], "high": _sweep_lots["high"], "main weakness": "swept neighbourhoods aren't random; inspectors miss some lots"},
        ]
    )
    return (results,)


@app.cell(hide_code=True)
def _(alt, mo, results):
    _chart = (
        alt.Chart(results)
        .mark_point(filled=True, size=70)
        .encode(
            y=alt.Y("estimate:N", sort=None, title=None),
            x=alt.X("n:Q", title="Infested lots"),
            tooltip=["estimate", alt.Tooltip("n", format=",.0f"), alt.Tooltip("low", format=",.0f"), alt.Tooltip("high", format=",.0f")],
        )
    )
    _bars = _chart.mark_rule().encode(x="low:Q", x2="high:Q")
    _ref = alt.Chart().mark_rule(strokeDash=[4, 3], color="firebrick").encode(x=alt.datum(40_500))
    mo.vstack(
        [
            alt.layer(_bars, _chart, _ref).properties(height=200, width="container"),
            mo.md("The dashed line is the published 40,500."),
            mo.ui.table(results.round(0), selection=None),
        ]
    )
    return


@app.cell(hide_code=True)
def _(
    block_route_interval,
    chain_interval,
    mo,
    open_model,
    repro,
    reproduction_gap,
    results,
    sim_grid,
    sweep_results,
):
    _spread = results.n.max() / results.n.min()
    _sweep_gap = sweep_results["2010–11"]["lots_est"]["total"] / repro["lincoln_petersen"] - 1
    _now = sweep_results["2023–24"]
    _block_methods = [_now["blocks_est"]["total"], _now["detection_blocks"], _now["block_chapman"]["chapman"]]
    _bracket = max(_block_methods) / min(_block_methods)
    _models_agree = results.n.iloc[:5].max() / results.n.iloc[:5].min() < 1.25
    _sim_ok = sim_grid.drop(columns=["heterogeneity", "turnover"]).abs().min(axis=1).max() < 0.15
    readiness = [
        (
            f"Reproduction within ±15% of the published 40,500 (it is {reproduction_gap:+.1%}"
            + (", borderline)" if abs(reproduction_gap) > 0.10 else ")"),
            abs(reproduction_gap) <= 0.15,
        ),
        ("Defensible estimators agree within ±25%", _models_agree),
        ("Some estimator stays within ±15% in every simulated scenario", _sim_ok),
        ("Capture-recapture alone bounds infested lots from above", not open_model["at_edge"]),
        (
            f"An independent method (inspection sweeps) agrees with the reproduction within ±25% (it is {_sweep_gap:+.0%})",
            abs(_sweep_gap) <= 0.25,
        ),
        (f"Sweep-based methods bracket today's infested blocks within a factor of 2.5 ({_bracket:.1f}×)", _bracket <= 2.5),
        ("Rats per infested block has field evidence: from a comparable city (Baltimore), not NYC", "partial"),
        ("Proactive inspections are flagged in the public data, not inferred (see 6.7)", False),
    ]
    _ready = all(not isinstance(ok, str) and bool(ok) for _, ok in readiness)
    _lines = "\n".join(
        f"- {'⚠️' if isinstance(ok, str) else '✅' if ok else '❌'} {text}" for text, ok in readiness
    )
    mo.vstack(
        [
            mo.md("### Is this ready to publish?"),
            mo.md(_lines),
            mo.callout(
                mo.md(
                    "**Recommendation: publish.** All checks pass."
                    if _ready
                    else "**Recommendation: don't publish a rat head count yet.** The "
                    "inspection sweeps close much of the gap: they give an independent "
                    f"2010–11 infested-lot figure ({_sweep_gap:+.0%} vs the reproduction) "
                    "and bracket today's infested blocks "
                    f"at {min(_block_methods):,.0f}–{max(_block_methods):,.0f}. Turning blocks "
                    "into rats now has two routes, an assumed colony size "
                    f"({chain_interval[0] / 1e6:.1f}–{chain_interval[2] / 1e6:.1f} million) "
                    "and rats per block measured in Baltimore "
                    f"({block_route_interval[0] / 1e6:.1f}–{block_route_interval[2] / 1e6:.1f} "
                    "million), but neither rests on a count of NYC rats. The most defensible thing "
                    "the site could show is the **share of blocks with active rat signs**, "
                    "labelled as an estimate from city inspections and 311 reports, not a "
                    "rat census. A field survey (6.5) or the records in 6.7 would be the "
                    "next step to a head count."
                ),
                kind="success" if _ready else "danger",
            ),
        ]
    )
    return (readiness,)


@app.cell(hide_code=True)
def _(
    PUBLISHED,
    block_route_interval,
    chain_interval,
    open_model,
    readiness,
    repro,
    reproduction_gap,
    results,
    sweep_period,
    sweep_results,
):
    _ready = all(not isinstance(ok, str) and bool(ok) for _, ok in readiness)
    _then, _now = sweep_results["2010–11"], sweep_results["2023–24"]
    _now_blocks = [_now["blocks_est"]["total"], _now["detection_blocks"], _now["block_chapman"]["chapman"]]
    summary_text = (
        "**Summary (generated from the results below).** Re-running Auerbach's "
        f"design on today's data gives **{repro['lincoln_petersen']:,.0f} infested lots** "
        f"({reproduction_gap:+.0%} vs the published {PUBLISHED['infested_lots']:,}); "
        "broader complaint definitions bracket the published figure. The data "
        "violates two key assumptions in opposite directions: infestations come and "
        "go between occasions (inflating the estimate) and some lots are reported far "
        "more than others (deflating it). Estimators built for each problem give "
        f"{results.n.min():,.0f}–{results.n.max():,.0f} infested lots. A model that "
        "handles both, fitted by simulation, puts the best fit at "
        f"**{open_model['n']:,.0f} lots infested at any one time**, plausibly "
        f"{open_model['low']:,.0f}–{open_model['high']:,.0f}, and the upper end "
        f"{'cannot be pinned down by these data' if open_model['at_edge'] else 'is reasonably constrained'}. "
        "**The city's own proactive inspection sweeps close much of the gap:** used "
        f"as a field survey they put 2010–11 infested lots at {_then['lots_est']['total']:,.0f} "
        f"({_then['lots_est']['total'] / repro['lincoln_petersen'] - 1:+.0%} vs the reproduction), "
        "and 2023–24 infested blocks at "
        f"{min(_now_blocks):,.0f}–{max(_now_blocks):,.0f}. Turning blocks into rats "
        "two ways (colony territories of 3–7 lots with 40–50 rats each, or the rats "
        "per block measured in Baltimore's alleys) gives "
        f"**{chain_interval[0] / 1e6:.1f}–{chain_interval[2] / 1e6:.1f} million** and "
        f"**{block_route_interval[0] / 1e6:.1f}–{block_route_interval[2] / 1e6:.1f} "
        f"million rats** ({sweep_period.value}). Neither rests on a count of NYC rats. "
        + ("Ready to publish." if _ready else "**Not ready to publish** (section 8).")
    )
    return (summary_text,)


@app.cell(hide_code=True)
def _(a5_positive_share, mo, repro_variants, validation):
    _clean = repro_variants[repro_variants.kind == "cleaning"].lincoln_petersen
    _cleaning = _clean.max() / _clean.min() - 1
    mo.md(
        f"""
    ## 9. Assumptions register

    Every assumption the analysis makes, where it is used, and what the data says.

    | ID | Assumption | Used in | Evidence | Effect if wrong |
    |:---|:---|:---|:---|:---|
    | D1 | 311 `Rodent` / `Rat Sighting` reports are the capture definition | all | Matches the Ratlas site and the paper's description; broader definitions bracket the published 40,500 (§3) | Broader filters raise N̂ by up to ~50% |
    | D2 | Reports without a valid BBL are uninformative, not biased | all | {'All downloads reconcile' if validation.Pass.iloc[0] else 'Download checks failed'}; BBL coverage by year shown in §2 | Biased if missing BBLs concentrate in some places |
    | D3 | Today's 311 archive is equivalent to what Auerbach used in 2014 | §3 | Unverifiable (paywalled); cleaning variants move N̂ by {_cleaning:.0%} | Reproduction gap |
    | D4 | 842,000 total lots (2014); 858k today | §1 | PLUTO release in §2 | Only affects the % of lots |
    | A1 | Closure between occasions | §3, §5 | **Violated**: N̂ grows with the gap (§4 A1) | Year-apart design inflates N̂ |
    | A2 | Equal catchability | §3 | **Violated**: repeat-report excess and units gradient (§4 A2) | Two-occasion N̂ deflated |
    | A3 | Independence between occasions | §3 | Treated lots differ in re-report rate; confounded by selection (§4 A3) | Unknown sign |
    | A4 | Stable marks (BBLs) | all | Small share missing from PLUTO or condo units (§4 A4) | Bounded by variants in §3 |
    | A5 | A report means an infestation | all | {a5_positive_share:.0%} of inspected reported lots showed active signs (§4 A5) | False positives inflate N̂ |
    | A6a | Colony territory = 3–7 lots (Auerbach: 1) | §5.6, §6.4 | Home ranges 30–45 m across (Baltimore) vs. 234 m² median NYC lot; NYC rats within ~200 m are kin; sweeps find 2–6 infested lots per infested block | Fewer lots per colony → more colonies → more rats |
    | A6b | 40–50 rats per colony (route A) | §5.6, §6.4 | Untraceable lore; NYC Health says 1–12 rats per active burrow; **no NYC colony count** | Scales the head count directly |
    | B1 | Baltimore's 50–124 rats per alley apply to an infested NYC block (route B) | §6.4 | Removal trapping in 20 high-density Baltimore alleys (Glass et al. 2009); sites range 2–217 | Bigger, denser NYC blocks → too low; trappable rats only → too low; high-density sites → too high elsewhere |
    | W1 | Proactive sweeps = ≥5 lots on a block in a day, ≤20% complaint-preceded, ≥70% coverage | §6 | Sweeps fall mostly in the programme's published neighbourhoods and cover most of each block (§6.1) | Misclassified visits blur the survey |
    | W2 | Swept blocks' infestation rates apply citywide within a stratum (311 intensity × density) | §6.3 | Swept neighbourhoods are high-risk, so likely an overstatement | Stratified estimate is an upper end |
    | W3 | Swept neighbourhoods' 311 detection rate applies citywide | §6.3 | People report less elsewhere, so likely an understatement | Detection-rate estimate is a lower end |
    | W4 | Inspector sensitivity between the two-source value and 100% | §6.2, §6.4 | Two-source assumes independence; positive dependence biases it up | Missed blocks scale the total |
    | W5 | A report within ±3 months of a sweep counts as detecting that infestation | §6.2 | Matches the half-year occasions | A wider window raises detection |
    | W6 | Colonies on a block = max(1, infested lots ÷ lots per colony) | §6.4 | Simple territory model | Clumped colonies would lower the count |
    | W7 | Burrow cross-check: 1–2 burrows per lot, 1–12 rats per burrow (NYC Health) | §6.4 | Burrow *presence* is recorded, not counts | Floor only; misses sewers and interiors |
    | W8 | Close-kin design assumes random mixing | §6.6 | Violated at <200 m (Combs et al. 2018) | Needs spatial sampling or a spatial model |
    | S5 | Infested blocks uniform between the detection-rate and stratified estimates | §6.4 | The honest summary of a two-sided bracket | Interval shape is a choice |
    | S1 | Simulation: logit-normal heterogeneity, random turnover | §7 | A simplification; real heterogeneity is skewed by lot size | Bias magnitudes are illustrative |
    | S2 | Monte Carlo: uniform ranges for colony inputs | §5.6 | A choice; no distribution is known | Interval width depends on ranges |
    | S3 | Open model: logit-normal heterogeneity, constant quarterly turnover, report rates matched per quarter | §5.4 | Reproduces the observed frequency and lag-overlap statistics | Upper bound depends on how far heterogeneity is allowed to go |
    | S4 | Calibration grid: 15k–200k lots, σ 0–3, turnover 0–35% per quarter | §5.4 | Best fit inside the grid; plausible set may reach its edge | A wider grid could raise the upper end further |
    """
    )
    return


@app.cell(hide_code=True)
def _(mo, sources):
    _fetched = sorted({m["fetched"][:10] for m in sources.manifest().values()})
    mo.md(
        f"""
    ## 10. Reproducibility and references

    **Run it:** `uvx marimo edit --sandbox research/rat_population.py` (dependencies
    are declared at the top of the file). Tests for the estimators:
    `uv run --no-project --with-requirements research/requirements.txt --with pytest pytest research`.
    Data cached in `research/data/` (not committed); fetched {", ".join(_fetched)}.

    **References**
    - Auerbach, J. (2014). Does New York City really have as many rats as people? *Significance* 11(4), 22–27. doi:10.1111/j.1740-9713.2014.00764.x
    - Chapman, D. G. (1951). Some properties of the hypergeometric distribution with applications to zoological sample censuses. *UC Publications in Statistics* 1, 131–160.
    - Seber, G. A. F. (1982). *The Estimation of Animal Abundance and Related Parameters* (2nd ed.). Griffin.
    - Chao, A. (1987). Estimating the population size for capture-recapture data with unequal catchability. *Biometrics* 43, 783–791.
    - Fienberg, S. E. (1972). The multiple recapture census for closed populations and incomplete 2^k contingency tables. *Biometrika* 59, 591–603.
    - Davis, D. E. & Fales, W. T. (1950). The rat population of Baltimore, 1949. *American Journal of Hygiene* 52, 143–146.
    - Easterbrook, J. D. et al. (2005). Norway rat population in Baltimore, Maryland, 2004. *Vector-Borne and Zoonotic Diseases* 5, 296–299.
    - Glass, G. E. et al. (2009). Trophic garnishes: cat–rat interactions in an urban environment. *PLoS ONE* 4, e5794.
    - Glass, G. E. et al. (2016). Multiple paternity in urban Norway rats: extended ranging for mates. *Vector-Borne and Zoonotic Diseases* 16, 342–348.
    - Gardner-Santana, L. C. et al. (2009). Commensal ecology, urban landscapes, and their influence on the genetic characteristics of city-dwelling Norway rats. *Molecular Ecology* 18, 2766–2778.
    - Combs, M. et al. (2018). Spatial population genomics of the brown rat (*Rattus norvegicus*) in New York City. *Molecular Ecology* 27, 83–98.
    - Byers, K. A. et al. (2019). Rats about town: a systematic review of rat movement in urban ecosystems. *Frontiers in Ecology and Evolution* 7, 13.
    - Himsworth, C. G. et al. (2014). The characteristics of wild rat populations from an inner-city neighborhood. *PLoS ONE* 9, e91654.
    - CDC (2012). Evaluation of a neighborhood rat-management program — New York City, December 2007–August 2009. *MMWR* 61(37), 733–736.
    - NYC Department of Health and Mental Hygiene. *Rat Academy* training presentation (1–12 rats per active burrow).
    - Bravington, M. V., Skaug, H. J. & Anderson, E. C. (2016). Close-kin mark-recapture. *Statistical Science* 31, 259–274.
    - Link, W. A. (2003). Nonidentifiability of population size from capture-recapture data with heterogeneous detection probabilities. *Biometrics* 59, 1123–1130.
    - Beaumont, M. A., Zhang, W. & Balding, D. J. (2002). Approximate Bayesian computation in population genetics. *Genetics* 162, 2025–2035.
    - Rivest, L.-P. & Baillargeon, S. (2007). Applications and extensions of Chao's moment estimator for the size of a closed population. *Biometrics* 63, 999–1006 (the Rcapture models).
    """
    )
    return


if __name__ == "__main__":
    app.run()
