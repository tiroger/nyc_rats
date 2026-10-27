"""Checks for sweep detection and the survey-design helpers."""

import numpy as np
import pandas as pd
import pytest

from sweeps import (
    ckmr_samples,
    find_sweeps,
    mark_triggered,
    neyman_allocation,
    reported_near,
    stratified_se,
    stratified_total,
    two_source_rates,
)


def test_mark_triggered_uses_a_preceding_window_only():
    ins = pd.DataFrame({"bbl": ["1000010001"] * 3, "inspection_date": pd.to_datetime(["2010-03-01", "2010-06-01", "2010-01-01"])})
    cmp = pd.DataFrame({"bbl": ["1000010001"], "created_date": pd.to_datetime(["2010-02-15"])})
    assert mark_triggered(ins, cmp, days=60).tolist() == [True, False, False]


def make_block(block, day, n, triggered=0, rats=0):
    return pd.DataFrame(
        {
            "bbl": [f"{block}{i:04d}" for i in range(1, n + 1)],
            "inspection_date": pd.Timestamp(day),
            "triggered": [i < triggered for i in range(n)],
            "rat_activity": [i < rats for i in range(n)],
        }
    )


def test_find_sweeps_keeps_big_unprompted_well_covered_days():
    ins = pd.concat(
        [
            make_block("100001", "2010-03-01", 8, rats=2),  # a sweep
            make_block("100002", "2010-03-01", 8, triggered=6),  # complaint-driven
            make_block("100003", "2010-03-01", 2),  # too small
            make_block("100004", "2010-03-01", 6),  # poor coverage (6 of 20)
            make_block("100001", "2010-09-01", 8),  # later sweep of the same block
        ],
        ignore_index=True,
    )
    lots = pd.Series({"100001": 10, "100002": 10, "100003": 2, "100004": 20})
    sweeps = find_sweeps(ins, lots)
    assert sweeps.block.tolist() == ["100001"]
    assert sweeps.day.iloc[0] == pd.Timestamp("2010-03-01")
    assert sweeps.rat_lots.iloc[0] == 2


def test_reported_near_is_symmetric_in_time():
    units = pd.DataFrame({"block": ["a", "b"], "day": pd.to_datetime(["2010-06-01", "2010-06-01"])})
    reports = pd.DataFrame({"block": ["a", "b"], "created_date": pd.to_datetime(["2010-04-01", "2011-01-01"])})
    assert reported_near(units, reports, "block", days=91).tolist() == [True, False]


def test_two_source_rates_match_hand_calculation():
    found = pd.Series([1, 1, 1, 1, 0, 0])
    reported = pd.Series([1, 1, 0, 0, 1, 0])
    r = two_source_rates(found, reported)
    assert r["both"] == 2 and r["p_found_given_reported"] == pytest.approx(2 / 3)
    assert r["infested_if_independent"] == pytest.approx(4 * 3 / 2)
    assert r["inspector_sensitivity"] == pytest.approx(4 / 6)


def test_stratified_total_scales_stratum_means_to_the_frame():
    sample = pd.DataFrame({"s": ["a", "a", "b", "b"], "v": [1, 0, 1, 1], "c": [1, 2, 3, 4]})
    frame = pd.DataFrame({"s": ["a"] * 10 + ["b"] * 4 + ["z"] * 5})
    out = stratified_total(sample, frame, ["s"], "v", "c", reps=50)
    assert out["total"] == pytest.approx(10 * 0.5 + 4 * 1.0)
    assert out["uncovered_units"] == 5


def test_neyman_allocation_favours_big_variable_strata_and_shrinks_error():
    size = pd.Series({"a": 1000, "b": 100})
    sd = pd.Series({"a": 2.0, "b": 0.5})
    alloc = neyman_allocation(size, sd, 100)
    assert alloc["a"] > alloc["b"] >= 5
    assert stratified_se(size, sd, alloc * 2) < stratified_se(size, sd, alloc)


def test_ckmr_sample_size_formula():
    n = ckmr_samples(10_000, target_pairs=50)
    assert 2 * n**2 / 10_000 == pytest.approx(50)
