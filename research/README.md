# Research: how many rats live in New York City?

A [marimo](https://marimo.io) notebook that reproduces Jonathan Auerbach's 2014
capture-recapture estimate (about 40,500 infested lots and 2 million rats) from
today's public 311 data, then tests its assumptions and tries better estimators.
Section 6 uses the Health Department's proactive inspection sweeps, inferred
from the public inspection data, as a field survey that measures how often
infested blocks get reported to 311.

**This is research, not a published result.** Nothing here appears on the
Ratlas site unless the notebook's "Is this ready to publish?" checks pass.

## Run it

```sh
uvx marimo edit --sandbox research/rat_population.py   # interactive
uvx marimo export html --sandbox research/rat_population.py -o rat_population.html
```

The notebook declares its own dependencies, so `--sandbox` builds an isolated
environment; nothing is installed into the Node project. The first run
downloads about 40 MB from NYC Open Data into `research/data/` (not committed).
Every download must reconcile with the API's own `count(*)`, or it fails.
After that, runs use the cache; the notebook's button re-downloads.

## Files

- `rat_population.py`: the notebook (narrative, analysis, interactive controls).
- `capture_recapture.py`: estimators (Lincoln–Petersen, Chapman, stratified,
  log-linear M0/Mt/Mh/Mth, Chao), the city simulator, and the open-population
  calibration.
- `sweeps.py`: finding proactive inspection sweeps, lot- and block-level
  detection rates, Baltimore-style stratified estimation, field-survey
  allocation, and close-kin mark-recapture sample sizes.
- `sources.py`: cached, validated Socrata downloads and BBL normalization.
- `test_capture_recapture.py`, `test_sweeps.py`: checks against hand
  calculations, exact identities and simulations with a known answer.
- `foil_request.md`: a draft records request for the inspection fields the
  public data leaves out (not submitted).

```sh
cd research && uv run --no-project --with-requirements requirements.txt --with pytest pytest
```
