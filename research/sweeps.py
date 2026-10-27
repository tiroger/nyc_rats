"""Proactive inspection sweeps: finding them, and using them as field surveys.

The Health Department's rat indexing inspects every property on targeted
blocks, whether or not anyone complained. The public data has no flag for
it, so sweeps are inferred: many initial inspections on one block on one
day, almost none preceded by a 311 complaint on that lot, covering most of
the block's lots. Inside a sweep we know which lots and blocks inspectors
found active rat signs on, which lets us measure 311's detection rate
directly instead of assuming it.

Also here: block-level stratified estimation (the Baltimore design, with
sweeps as the field sample), sample allocation for a real field survey, and
a close-kin mark-recapture feasibility calculation.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def mark_triggered(inspections: pd.DataFrame, complaints: pd.DataFrame, days: int = 60) -> pd.Series:
    """True for inspections preceded by a 311 Rodent complaint on the same
    lot within `days` (complaint-driven); False suggests a proactive visit."""
    pairs = (
        inspections[["bbl", "inspection_date"]]
        .reset_index()
        .merge(complaints[["bbl", "created_date"]], on="bbl")
    )
    lag = pairs.inspection_date - pairs.created_date
    hit = pairs.loc[(lag >= pd.Timedelta(0)) & (lag <= pd.Timedelta(days=days)), "index"]
    return pd.Series(inspections.index.isin(hit), index=inspections.index)


def find_sweeps(
    inspections: pd.DataFrame,
    lots_per_block: pd.Series,
    min_lots: int = 5,
    max_triggered: float = 0.2,
    min_coverage: float = 0.7,
) -> pd.DataFrame:
    """Block-days that look like a proactive sweep, first sweep per block.

    `inspections` needs bbl, inspection_date, rat_activity and triggered.
    Returns one row per swept block: the sweep day, lots inspected, lots
    with active rat signs, the triggered share and the block coverage.
    """
    frame = inspections.dropna(subset=["bbl"]).assign(
        block=lambda d: d.bbl.str[:6], day=lambda d: d.inspection_date.dt.normalize()
    )
    lots = frame.drop_duplicates(["block", "day", "bbl"])
    days = (
        lots.groupby(["block", "day"])
        .agg(lots=("bbl", "size"), rat_lots=("rat_activity", "sum"), triggered=("triggered", "mean"))
        .reset_index()
    )
    days["block_lots"] = days.block.map(lots_per_block)
    days["coverage"] = days.lots / days.block_lots
    keep = (days.lots >= min_lots) & (days.triggered <= max_triggered) & (days.coverage >= min_coverage)
    return days[keep].sort_values("day").drop_duplicates("block").reset_index(drop=True)


def reported_near(units: pd.DataFrame, reports: pd.DataFrame, key: str, days: int = 91) -> pd.Series:
    """True where the unit (lot or block, named by `key`) had a 311 report
    within +/- `days` of its `day`."""
    pairs = units[[key, "day"]].reset_index().merge(reports[[key, "created_date"]], on=key)
    near = (pairs.created_date - pairs.day).abs() <= pd.Timedelta(days=days)
    return pd.Series(units.index.isin(pairs.loc[near, "index"]), index=units.index)


def two_source_rates(found: pd.Series, reported: pd.Series) -> dict:
    """Inspectors vs. 311 inside swept units: how often each finds what the
    other found, and the Lincoln-Petersen size of the infested set if the two
    were independent (positive dependence makes it an underestimate)."""
    found, reported = found.astype(bool), reported.astype(bool)
    both = int((found & reported).sum())
    n_found, n_reported = int(found.sum()), int(reported.sum())
    infested = n_found * n_reported / both if both else float("inf")
    return {
        "units": int(len(found)),
        "found": n_found,
        "reported": n_reported,
        "both": both,
        "p_found_given_reported": both / n_reported if n_reported else float("nan"),
        "p_reported_given_found": both / n_found if n_found else float("nan"),
        "infested_if_independent": infested,
        "inspector_sensitivity": n_found / infested if both else float("nan"),
    }


def stratified_total(
    sample: pd.DataFrame,
    frame: pd.DataFrame,
    strata: list[str],
    value: str,
    cluster: str,
    reps: int = 400,
    seed: int = 3,
) -> dict:
    """Baltimore-style estimate: mean of `value` per stratum in the sample,
    times the number of units per stratum in the frame, summed. Uncertainty
    from a cluster bootstrap over `cluster` (e.g. neighbourhood), because
    sweeps arrive in geographic clumps, not as independent blocks.

    Strata missing from the sample contribute nothing and are reported.
    """
    sizes = frame.groupby(strata, observed=True).size().rename("frame_units")

    def total(s: pd.DataFrame) -> tuple[float, pd.DataFrame]:
        means = s.groupby(strata, observed=True)[value].agg(["mean", "size"])
        table = sizes.to_frame().join(means, how="left")
        return float((table.frame_units * table["mean"]).sum()), table

    point, table = total(sample)
    rng = np.random.default_rng(seed)
    clusters = sample[cluster].dropna().unique()
    groups = {c: g for c, g in sample.groupby(cluster)}
    draws = []
    for _ in range(reps):
        pick = rng.choice(clusters, size=len(clusters), replace=True)
        draws.append(total(pd.concat([groups[c] for c in pick], ignore_index=True))[0])
    low, high = np.percentile(draws, [2.5, 97.5])
    missing = table[table["mean"].isna()]
    return {
        "total": point,
        "low": float(low),
        "high": float(high),
        "table": table.reset_index(),
        "uncovered_units": int(missing.frame_units.sum()),
    }


def neyman_allocation(frame_units: pd.Series, sd: pd.Series, n: int, minimum: int = 5) -> pd.Series:
    """Split a field sample of `n` blocks across strata in proportion to
    stratum size x within-stratum SD (Neyman), with a floor per stratum."""
    weight = (frame_units * sd).clip(lower=0)
    alloc = np.maximum(minimum, np.round(n * weight / weight.sum())).astype(int)
    return np.minimum(alloc, frame_units.astype(int))


def stratified_se(frame_units: pd.Series, sd: pd.Series, alloc: pd.Series) -> float:
    """Standard error of a stratified total with finite-population correction."""
    n, size = alloc.astype(float), frame_units.astype(float)
    return float(np.sqrt((size**2 * (1 - n / size) * sd**2 / n).sum()))


def ckmr_samples(adults: float, target_pairs: float = 50) -> float:
    """Close-kin mark-recapture: sampling n adults and n juveniles from a
    well-mixed population of `adults` gives about 2 n^2 / adults
    parent-offspring pairs. Returns the n of each needed for `target_pairs`."""
    return float(np.sqrt(target_pairs * adults / 2))
