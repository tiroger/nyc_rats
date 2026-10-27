"""Closed-population capture-recapture estimators, plus a simulator to test them.

The "animals" are tax lots and a "capture" is at least one 311 rat-sighting
report on the lot during an occasion (a window of time). Everything here is
plain NumPy/SciPy/statsmodels so each formula can be checked by hand.

References
- Chapman (1951), Seber (1982): two-occasion estimator and variance.
- Chao (1987, 1989): heterogeneity lower bound and log-normal intervals.
- Fienberg (1972), Cormack (1989), Rivest & Baillargeon (2007, Rcapture):
  log-linear models M0, Mt, Mh, Mth for multi-occasion capture histories.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, asdict

import numpy as np
import statsmodels.api as sm

Z95 = 1.959963984540054


@dataclass
class Estimate:
    model: str
    n: float  # estimated population (infested lots)
    se: float
    low: float
    high: float
    observed: int  # distinct lots seen at least once
    note: str = ""

    def as_dict(self) -> dict:
        return asdict(self)


def lognormal_interval(n_hat: float, var: float, observed: int) -> tuple[float, float]:
    """Chao (1987) interval: the unseen part f0 = N - observed is log-normal,
    so the interval never dips below the lots actually seen."""
    f0 = max(n_hat - observed, 1e-9)
    c = np.exp(Z95 * np.sqrt(np.log1p(max(var, 0.0) / f0**2)))
    return observed + f0 / c, observed + f0 * c


def lincoln_petersen(n1: int, n2: int, m: int) -> float:
    """The textbook estimator N = n1 * n2 / m (undefined when m = 0)."""
    return n1 * n2 / m if m else float("inf")


def chapman(n1: int, n2: int, m: int) -> Estimate:
    """Chapman's nearly unbiased version of Lincoln-Petersen, with Seber's
    variance and a log-normal 95% interval."""
    n_hat = (n1 + 1) * (n2 + 1) / (m + 1) - 1
    var = (n1 + 1) * (n2 + 1) * (n1 - m) * (n2 - m) / ((m + 1) ** 2 * (m + 2))
    observed = n1 + n2 - m
    low, high = lognormal_interval(n_hat, var, observed)
    return Estimate("Chapman", n_hat, float(np.sqrt(var)), low, high, observed)


def two_occasion(first: set, second: set) -> dict:
    """Counts and estimates for two sets of captured lots."""
    n1, n2 = len(first), len(second)
    m = len(first & second)
    est = chapman(n1, n2, m)
    return {
        "n1": n1,
        "n2": n2,
        "m": m,
        "observed": n1 + n2 - m,
        "recapture_rate": m / n1 if n1 else float("nan"),
        "lincoln_petersen": lincoln_petersen(n1, n2, m),
        "chapman": est.n,
        "se": est.se,
        "low": est.low,
        "high": est.high,
    }


def bootstrap_chapman(n1: int, n2: int, m: int, reps: int = 2000, seed: int = 1) -> np.ndarray:
    """Parametric bootstrap: redraw the four capture cells (both, first only,
    second only, never) from a multinomial with the estimated population."""
    rng = np.random.default_rng(seed)
    n_hat = max(chapman(n1, n2, m).n, n1 + n2 - m)
    size = int(round(n_hat))
    probs = np.array([m, n1 - m, n2 - m, size - (n1 + n2 - m)], dtype=float)
    probs = np.clip(probs, 0, None) / probs.clip(0, None).sum()
    draws = rng.multinomial(size, probs, size=reps)
    both, only1, only2 = draws[:, 0], draws[:, 1], draws[:, 2]
    a, b = both + only1, both + only2
    return (a + 1) * (b + 1) / (both + 1) - 1


def stratified_chapman(strata: dict[str, tuple[set, set]]) -> tuple[Estimate, list[dict]]:
    """Sum of per-stratum Chapman estimates. Strata soak up differences in
    catchability between groups of lots (e.g. boroughs, land uses)."""
    rows = []
    for name, (first, second) in strata.items():
        row = two_occasion(first, second)
        row["stratum"] = name
        rows.append(row)
    n_hat = sum(r["chapman"] for r in rows)
    var = sum(r["se"] ** 2 for r in rows)
    observed = sum(r["observed"] for r in rows)
    low, high = lognormal_interval(n_hat, var, observed)
    thin = sum(1 for r in rows if r["m"] < 7)
    note = f"{thin} strata with fewer than 7 recaptures" if thin else ""
    return Estimate("Stratified Chapman", n_hat, float(np.sqrt(var)), low, high, observed, note), rows


def histories(captures: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Collapse a lots x occasions 0/1 matrix to the observed capture-history
    patterns and how many lots share each one."""
    captures = np.asarray(captures, dtype=np.int8)
    seen = captures[captures.any(axis=1)]
    patterns, counts = np.unique(seen, axis=0, return_counts=True)
    return patterns, counts


def frequencies(captures: np.ndarray) -> np.ndarray:
    """f[k] = number of lots captured on exactly k occasions (k = 1..T)."""
    k = np.asarray(captures).sum(axis=1)
    t = np.asarray(captures).shape[1]
    return np.array([(k == j).sum() for j in range(1, t + 1)])


def chao_lower_bound(captures: np.ndarray) -> Estimate:
    """Chao's (1987) bias-corrected lower bound under heterogeneous capture
    probability: N >= S + f1(f1 - 1) / (2 (f2 + 1))."""
    f = frequencies(captures)
    observed = int(f.sum())
    f1, f2 = float(f[0]), float(f[1]) if len(f) > 1 else 0.0
    f0 = f1 * (f1 - 1) / (2 * (f2 + 1))
    # Chao (1987) variance for the bias-corrected form.
    var = (
        f1 * (f1 - 1) / (2 * (f2 + 1))
        + f1 * (2 * f1 - 1) ** 2 / (4 * (f2 + 1) ** 2)
        + f1**2 * f2 * (f1 - 1) ** 2 / (4 * (f2 + 1) ** 4)
    )
    low, high = lognormal_interval(observed + f0, var, observed)
    return Estimate("Mh Chao (lower bound)", observed + f0, float(np.sqrt(var)), low, high, observed)


def _all_patterns(t: int) -> np.ndarray:
    grid = np.array(np.meshgrid(*[[0, 1]] * t, indexing="ij")).reshape(t, -1).T
    return grid[grid.any(axis=1)]


def loglinear(captures: np.ndarray, model: str) -> tuple[Estimate, float]:
    """Fit a closed-population log-linear model to multi-occasion histories.

    Every possible non-empty history is a Poisson cell. The never-captured
    cell has all covariates zero, so its expected count is exp(intercept),
    and N = observed + exp(intercept). Models (Rcapture naming):
      M0   one capture probability for every lot and occasion
      Mt   capture probability varies by occasion
      Mh   lots differ in catchability (Darroch's k^2/2 heterogeneity term)
      Mth  both
    Returns the estimate and the model's AIC (comparable across models,
    since every model is fit to the same cells).
    """
    captures = np.asarray(captures, dtype=np.int8)
    t = captures.shape[1]
    patterns, counts = histories(captures)
    lookup = {tuple(p): c for p, c in zip(patterns, counts)}
    cells = _all_patterns(t)
    y = np.array([lookup.get(tuple(c), 0) for c in cells], dtype=float)
    k = cells.sum(axis=1).astype(float)
    columns = []
    if model in ("M0", "Mh"):
        columns.append(k)
    if model in ("Mt", "Mth"):
        columns.extend(cells.T.astype(float))
    if model in ("Mh", "Mth"):
        columns.append(k**2 / 2)
    x = sm.add_constant(np.column_stack(columns), has_constant="add")
    with warnings.catch_warnings():
        # Saturated fits (e.g. Mt with two occasions) have no residual
        # degrees of freedom; statsmodels warns, but the estimate is exact.
        warnings.simplefilter("ignore")
        fit = sm.GLM(y, x, family=sm.families.Poisson()).fit()
    f0 = float(np.exp(fit.params[0]))
    observed = int(y.sum())
    # Delta method for the unseen cell plus its own Poisson noise.
    var = f0 + f0**2 * float(fit.cov_params()[0, 0])
    low, high = lognormal_interval(observed + f0, var, observed)
    note = ""
    if model in ("Mh", "Mth") and fit.params[-1] < 0:
        note = "heterogeneity term is negative (no evidence of heterogeneity)"
    return Estimate(model, observed + f0, float(np.sqrt(var)), low, high, observed, note), float(fit.aic)


def _logit_centre(p: float, heterogeneity: float) -> float:
    """Logit-scale centre whose logit-normal mean catchability equals p."""
    from scipy.optimize import brentq
    from scipy.special import expit

    if heterogeneity == 0:
        return float(np.log(p / (1 - p)))
    nodes, weights = np.polynomial.hermite_e.hermegauss(40)
    weights = weights / weights.sum()
    return brentq(
        lambda c: float(weights @ expit(c + heterogeneity * nodes)) - p, -30, 30
    )


def simulate(
    n_true: int,
    occasions: int,
    p_mean,
    heterogeneity: float,
    turnover: float,
    seed: int = 0,
) -> np.ndarray:
    """Simulate capture histories for a city with `n_true` infested lots.

    - p_mean: average chance an infested lot is reported in an occasion, one
      number or one per occasion (to mimic seasons).
    - heterogeneity: SD of lot catchability on the logit scale (0 = equal).
    - turnover: share of infested lots replaced by newly infested lots between
      consecutive occasions (0 = closed population). The number infested at
      any moment stays n_true; the identities change.
    Rows are every lot that was ever infested, so the result can be fed to the
    same estimators as real data.
    """
    from scipy.special import expit

    rng = np.random.default_rng(seed)
    rates = np.broadcast_to(np.asarray(p_mean, dtype=float), (occasions,))
    centres = [_logit_centre(float(p), heterogeneity) for p in rates]
    # Enough identities for every lot to be replaced on every occasion.
    capacity = n_true * (occasions + 1)
    lot_effect = heterogeneity * rng.normal(size=capacity)
    history = np.zeros((capacity, occasions), dtype=np.int8)
    ever = np.zeros(capacity, dtype=bool)
    present, next_id = np.arange(n_true), n_true
    for occasion in range(occasions):
        if occasion and turnover:
            leaving = rng.random(len(present)) < turnover
            arrivals = np.arange(next_id, next_id + leaving.sum())
            next_id += int(leaving.sum())
            present = np.concatenate([present[~leaving], arrivals])
        ever[present] = True
        chance = expit(centres[occasion] + lot_effect[present])
        history[present, occasion] = rng.random(len(present)) < chance
    return history[ever]


def summary_statistics(captures: np.ndarray) -> np.ndarray:
    """What the calibration matches: how many lots were caught exactly
    1..6 times (heterogeneity shows in the tail) and the average overlap
    between occasions 1..T-1 apart (turnover shows as decay with lag,
    heterogeneity as a plateau)."""
    captures = np.asarray(captures, dtype=bool)
    t = captures.shape[1]
    f = frequencies(captures)[:6]
    lags = [
        np.mean([(captures[:, i] & captures[:, i + lag]).sum() for i in range(t - lag)])
        for lag in range(1, t)
    ]
    return np.concatenate([f, lags]).astype(float)


def calibrate(
    observed: np.ndarray,
    n_grid,
    heterogeneity_grid,
    turnover_grid,
    seed: int = 11,
    reps: int = 3,
) -> "pd.DataFrame":
    """Fit an open, heterogeneous population by simulation (a grid version of
    approximate Bayesian computation).

    For every candidate (infested lots, heterogeneity, turnover), the
    per-occasion report rates are set so the expected lots reported in each
    occasion equal what was observed. The candidate's simulated summary
    statistics are compared with the observed ones on a log scale; smaller
    distance means a better account of the data.
    """
    import pandas as pd

    observed = np.asarray(observed, dtype=np.int8)
    t = observed.shape[1]
    per_occasion = observed.sum(axis=0)
    target = np.log1p(summary_statistics(observed))
    rows = []
    for n in n_grid:
        rates = np.clip(per_occasion / n, 1e-6, 0.95)
        for h in heterogeneity_grid:
            for turnover in turnover_grid:
                # Average a few replicates so simulation noise doesn't pick the winner.
                stats = np.mean(
                    [
                        np.log1p(summary_statistics(simulate(int(n), t, rates, h, turnover, seed=seed + r)))
                        for r in range(reps)
                    ],
                    axis=0,
                )
                distance = float(np.sqrt(np.mean((stats - target) ** 2)))
                rows.append({"n": int(n), "heterogeneity": h, "turnover": turnover, "distance": distance})
    return pd.DataFrame(rows).sort_values("distance", ignore_index=True)
