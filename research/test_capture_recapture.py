"""Checks for the estimators and helpers the notebook relies on.

Run with:  uv run --with-requirements research/requirements.txt pytest research
"""

import numpy as np
import pandas as pd
import pytest

from capture_recapture import (
    bootstrap_chapman,
    chao_lower_bound,
    chapman,
    frequencies,
    lincoln_petersen,
    loglinear,
    simulate,
    stratified_chapman,
    two_occasion,
)
from sources import normalize_bbl


def test_chapman_matches_hand_calculation():
    est = chapman(100, 100, 20)
    assert est.n == pytest.approx(101 * 101 / 21 - 1)
    # Seber's variance, written out.
    var = 101 * 101 * 80 * 80 / (21**2 * 22)
    assert est.se == pytest.approx(var**0.5)
    assert est.low > est.observed  # interval never below lots actually seen
    assert est.low < est.n < est.high


def test_lincoln_petersen_and_two_occasion_counts():
    assert lincoln_petersen(100, 80, 20) == 400
    result = two_occasion({1, 2, 3, 4}, {3, 4, 5})
    assert (result["n1"], result["n2"], result["m"], result["observed"]) == (4, 3, 2, 5)


def test_two_occasion_mt_is_lincoln_petersen():
    # With two occasions Mt is saturated, so it must reproduce n1*n2/m.
    rng = np.random.default_rng(3)
    caps = (rng.random((5000, 2)) < [0.3, 0.4]).astype(np.int8)
    caps = caps[caps.any(axis=1)]
    n1, n2 = caps[:, 0].sum(), caps[:, 1].sum()
    m = (caps[:, 0] & caps[:, 1]).sum()
    est, _ = loglinear(caps, "Mt")
    assert est.n == pytest.approx(lincoln_petersen(n1, n2, m), rel=1e-6)


def test_frequencies_count_lots_by_captures():
    caps = np.array([[1, 0, 0], [1, 1, 0], [1, 1, 1], [0, 0, 0]])
    assert frequencies(caps).tolist() == [1, 1, 1]


def mean_relative_error(estimator, reps=12, **scenario):
    errors = []
    for seed in range(reps):
        caps = simulate(seed=seed, **scenario)
        errors.append(estimator(caps) / scenario["n_true"] - 1)
    return float(np.mean(errors))


def chapman_first_two(caps):
    first = set(np.flatnonzero(caps[:, 0]))
    second = set(np.flatnonzero(caps[:, 1]))
    return two_occasion(first, second)["chapman"]


def test_closed_homogeneous_city_is_recovered():
    scenario = dict(n_true=20_000, occasions=4, p_mean=0.1, heterogeneity=0, turnover=0)
    assert abs(mean_relative_error(chapman_first_two, **scenario)) < 0.03
    assert abs(mean_relative_error(lambda c: loglinear(c, "Mt")[0].n, **scenario)) < 0.03


def test_heterogeneity_biases_chapman_low_and_chao_helps():
    scenario = dict(n_true=20_000, occasions=4, p_mean=0.1, heterogeneity=1.5, turnover=0)
    chapman_bias = mean_relative_error(chapman_first_two, **scenario)
    chao_bias = mean_relative_error(lambda c: chao_lower_bound(c).n, **scenario)
    assert chapman_bias < -0.1
    assert chao_bias > chapman_bias


def test_turnover_biases_chapman_high():
    scenario = dict(n_true=20_000, occasions=2, p_mean=0.1, heterogeneity=0, turnover=0.5)
    assert mean_relative_error(chapman_first_two, **scenario) > 0.3


def test_bootstrap_is_centred_on_the_estimate():
    draws = bootstrap_chapman(400, 420, 40, reps=4000)
    assert np.median(draws) == pytest.approx(chapman(400, 420, 40).n, rel=0.05)


def test_stratified_chapman_sums_strata():
    est, rows = stratified_chapman({"a": ({1, 2, 3}, {2, 3, 4}), "b": ({5, 6}, {6, 7})})
    assert est.n == pytest.approx(sum(r["chapman"] for r in rows))


def test_normalize_bbl_accepts_text_and_decimals_and_rejects_junk():
    values = pd.Series(["1000010010", "1000010010.00000000", "0", "6000010010", "1000000010", "abc", None])
    out = normalize_bbl(values)
    assert out.iloc[:2].tolist() == ["1000010010", "1000010010"]
    assert out.iloc[2:].isna().all()


def test_simulate_matches_requested_mean_catchability():
    caps = simulate(50_000, 3, [0.05, 0.1, 0.2], heterogeneity=1.5, turnover=0, seed=4)
    assert caps.sum(axis=0) / 50_000 == pytest.approx([0.05, 0.1, 0.2], rel=0.05)


def test_calibration_recovers_a_known_city():
    from capture_recapture import calibrate

    truth = simulate(30_000, 8, 0.08, heterogeneity=1.0, turnover=0.1, seed=21)
    fits = calibrate(truth, [15_000, 30_000, 60_000], [0.0, 1.0, 2.0], [0.0, 0.1, 0.3])
    best = fits.iloc[0]
    assert best.n == 30_000
    assert best.heterogeneity == 1.0
    assert best.turnover == 0.1
