# Research: how many rats live in New York City?

A [marimo](https://marimo.io) notebook that reproduces Jonathan Auerbach's 2014
capture-recapture estimate (about 40,500 infested lots and 2 million rats) from
today's public 311 data, then tests its assumptions and tries better estimators.

**This is research, not a published result.** Nothing here appears on the
Ratlas site unless the notebook's "Is this ready to publish?" checks pass.

## Run it

```sh
uvx marimo edit --sandbox research/rat_population.py   # interactive
uvx marimo export html --sandbox research/rat_population.py -o rat_population.html
```

The notebook declares its own dependencies, so `--sandbox` builds an isolated
environment; nothing is installed into the Node project. The first run
downloads about 25 MB from NYC Open Data into `research/data/` (not committed).
Every download must reconcile with the API's own `count(*)`, or it fails.
After that, runs use the cache; the notebook's button re-downloads.

## Files

- `rat_population.py`: the notebook (narrative, analysis, interactive controls).
- `capture_recapture.py`: estimators (Lincoln–Petersen, Chapman, stratified,
  log-linear M0/Mt/Mh/Mth, Chao), the city simulator, and the open-population
  calibration.
- `sources.py`: cached, validated Socrata downloads and BBL normalization.
- `test_capture_recapture.py`: checks against hand calculations, exact
  identities and simulations with a known answer.

```sh
cd research && uv run --no-project --with-requirements requirements.txt --with pytest pytest
```
