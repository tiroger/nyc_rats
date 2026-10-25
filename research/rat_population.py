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

    _ = alt.data_transformers.disable_max_rows()
    return alt, cr, mo, np, pd, sources


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
    return (
        insp_2010_h1,
        insp_2010_h2,
        insp_2011_h1,
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
                + "**But AIC cannot see turnover:** the simulation study (section 6) "
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
                "**Caveat: the sources are not independent.** Many inspections are "
                "*triggered* by 311 complaints, which forces overlap and biases this "
                "estimate **low**. Proactive inspections (the rat-indexing programme) "
                "would be the clean second source, but the public data does not say "
                "which inspections were proactive. Treat this as a lower-bound "
                "cross-check."
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ### 5.6 · From infested lots to rats

    Everything above estimates **infested lots**. Turning that into rats needs two
    numbers the data cannot supply: **how many colonies** those lots hold, and
    **how big a colony is**. Rather than fixing them, set ranges and propagate them
    with Monte Carlo. The defaults reproduce Auerbach's assumptions.
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
        1.0, 6.0, value=[1.0, 1.0], step=0.1, label="Infested lots per colony", show_value=True
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
    ## 6. Which estimator should we trust? A simulation study

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
    ## 7. Results
    """)
    return


@app.cell
def _(multi_best, open_model, pd, repro, strat_both, two_source):
    results = pd.DataFrame(
        [
            {"estimate": "Reproduction: Lincoln–Petersen, H1 2010 vs H1 2011", "n": repro["lincoln_petersen"], "low": repro["low"], "high": repro["high"], "main weakness": "turnover inflates; heterogeneity deflates"},
            {"estimate": "Chapman, same occasions", "n": repro["chapman"], "low": repro["low"], "high": repro["high"], "main weakness": "same as above"},
            {"estimate": "Stratified Chapman, borough × lot type", "n": strat_both.n, "low": strat_both.low, "high": strat_both.high, "main weakness": "turnover; within-stratum heterogeneity"},
            {"estimate": f"Best multi-occasion model ({multi_best.model})", "n": multi_best.n, "low": multi_best.low, "high": multi_best.high, "main weakness": "model choice; residual turnover inside the year"},
            {"estimate": "Open heterogeneous model, fitted by simulation", "n": open_model["n"], "low": open_model["low"], "high": open_model["high"], "main weakness": "upper end not identifiable; simplified simulation"},
            {"estimate": "Two-source, 311 × inspections", "n": two_source["chapman"], "low": two_source["low"], "high": two_source["high"], "main weakness": "sources are dependent → biased low"},
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
def _(mo, open_model, reproduction_gap, results, sim_grid):
    _spread = results.n.max() / results.n.min()
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
        ("The data bound infested lots from above", not open_model["at_edge"]),
        ("Colony size and lots-per-colony are supported by NYC evidence", False),
        ("Independent second source available (proactive inspections)", False),
    ]
    _ready = all(ok for _, ok in readiness)
    _lines = "\n".join(f"- {'✅' if ok else '❌'} {text}" for text, ok in readiness)
    mo.vstack(
        [
            mo.md("### Is this ready to publish?"),
            mo.md(_lines),
            mo.callout(
                mo.md(
                    "**Recommendation: publish.** All checks pass."
                    if _ready
                    else f"**Recommendation: don't publish a rat head count.** Estimates "
                    f"of infested lots span a factor of {_spread:.1f} across reasonable "
                    "methods, the data cannot bound them from above, and the step from "
                    "lots to rats rests on colony assumptions with no local evidence. "
                    "If anything goes on the site, it should be a *lower bound on "
                    f"infested lots* (about {open_model['low']:,.0f}, from the open "
                    "model's plausible range), clearly labelled as an estimate from 311 "
                    "reports, not a rat census."
                ),
                kind="success" if _ready else "danger",
            ),
        ]
    )
    return (readiness,)


@app.cell(hide_code=True)
def _(PUBLISHED, open_model, readiness, repro, reproduction_gap, results):
    _ready = all(ok for _, ok in readiness)
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
        "Converting lots to rats adds colony assumptions with no local evidence. "
        + ("Ready to publish." if _ready else "**Not ready to publish** (section 7).")
    )
    return (summary_text,)


@app.cell(hide_code=True)
def _(a5_positive_share, mo, repro_variants, validation):
    _clean = repro_variants[repro_variants.kind == "cleaning"].lincoln_petersen
    _cleaning = _clean.max() / _clean.min() - 1
    mo.md(
        f"""
    ## 8. Assumptions register

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
    | A6a | One colony per infested lot | §5.6 | Reported lots cluster on blocks (§4 A6) | Too many colonies → too many rats |
    | A6b | 40–50 rats per colony | §5.6 | Literature value; **no NYC evidence here** | Scales the head count directly |
    | S1 | Simulation: logit-normal heterogeneity, random turnover | §6 | A simplification; real heterogeneity is skewed by lot size | Bias magnitudes are illustrative |
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
    ## 9. Reproducibility and references

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
    - Link, W. A. (2003). Nonidentifiability of population size from capture-recapture data with heterogeneous detection probabilities. *Biometrics* 59, 1123–1130.
    - Beaumont, M. A., Zhang, W. & Balding, D. J. (2002). Approximate Bayesian computation in population genetics. *Genetics* 162, 2025–2035.
    - Rivest, L.-P. & Baillargeon, S. (2007). Applications and extensions of Chao's moment estimator for the size of a closed population. *Biometrics* 63, 999–1006 (the Rcapture models).
    """
    )
    return


if __name__ == "__main__":
    app.run()
