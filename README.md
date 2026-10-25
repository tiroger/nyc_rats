# Ratlas — New York, from the ground up.

An independent, interactive atlas of NYC 311 rat-sighting reports. Built with React, Vite, and D3; deployed to **https://tiroger.github.io/nyc_rats/** through GitHub Actions.

## Explore

- Linked borough and period filters, with shareable URLs.
- The default is the latest 12 calendar months, including the provisional latest month; the monthly average excludes that month. The map displays its own date window and mapped/unmatched counts. Resident-report map counts and headline figures use the same dates and borough.
- Shared links preserve exact selected months and the preset label. Older date-only links recognize matching presets. If a later snapshot moves a relative preset beyond the saved dates, that link keeps its original dates and correctly becomes a custom period.
- Zoomable ZIP map with proportional bubbles, ZIP choropleth, and report details.
- Monthly trends with keyboard exploration and a data-table alternative.
- Borough “rat race” and a monthly heatmap spanning 2010 to the latest report.
- Illustrated rat habitats with source location categories, counts, and percentages.
- Repeat-burrow exploration: distinct tax lots, repeat-report counts, proportional circles, and a selected lot’s timeline.
- Independent DOHMH inspection layer, with separate initial/compliance outcomes and recorded actions.
- Year-by-year hotspot playback and a keyboard-accessible slider, using complete years and a fixed count scale.
- Monthly CSV downloads, responsive layouts, reduced-motion support, and locally hosted fonts.
- Freshness labels and an explicit warning when the published snapshot is over three days old.
- A subway-inspired Rat Local route, an interactive pizza rat, a hidden sewer club, and three collectible souvenir stamps saved on your device. Open “Need a clue?” at the Local stop for hints.
- Citywide fact tickets drawn from the verified snapshots, with explicit coverage dates, plus a persistent motion toggle that also pauses hotspot playback. System reduced-motion settings are always respected.

## Run locally

Use Node 24 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

Open the printed URL, normally `http://127.0.0.1:5173/nyc_rats/`.

```sh
npm run check       # data tests, snapshot/geography validation, production build
npx playwright install chromium
npm run test:e2e    # desktop and mobile interactions, recovery, accessibility
npm run preview    # serve the production build
npm run data:refresh
npm run data:audit   # independently verify counts against NYC APIs
npm run geo:subway   # rebuild the optional subway layer from MTA open data
```

`BASE_PATH` overrides the default `/nyc_rats/` build prefix. Set it to `/` for a root-domain deployment. The optional `SOCRATA_APP_TOKEN` shell environment variable gives data refreshes a dedicated API request pool. No token is required to run the site. `.env.example` documents the setting; the Node script reads the process environment, so export the variable before running it.

## Data and definitions

The snapshot combines the City's authoritative sources over non-overlapping periods:

- [311 Service Requests from 2010 to 2019](https://data.cityofnewyork.us/d/76ig-c548): 2010 through 2019.
- [311 Service Requests from 2020 to Present](https://data.cityofnewyork.us/d/erm2-nwe9): 2020 onward.

Both are filtered to `complaint_type = 'Rodent' AND descriptor = 'Rat Sighting'`. A report is a **311 service request**, not a count of rats, a confirmed infestation, or an estimate of prevalence. Report creation dates use the source's NYC local date fields, without shifting months across time zones. Multiple requests can describe the same underlying activity.

`scripts/refresh-data.mjs` rebuilds all monthly/borough/ZIP aggregates, including historical corrections. Requests use explicit pagination and ordering. Each source's aggregate totals must reconcile with its independent count query. Invalid rows, duplicate aggregate groups, reversed coverage, lost recent coverage, or a greater-than-2% fall in total reports reject the refresh. Snapshot replacement is atomic. If the source changes during pagination, the job fails and retains the prior snapshot.

`public/data/sightings.json` is a small, versioned snapshot. Its rows are `[YYYY-MM, boroughIndex, ZIP, reportCount]`; the borough order, coverage, source totals, source update times, and refresh timestamp are included in the file. Records with missing or invalid ZIPs and unspecified boroughs remain in totals. Only ZIPs that match the local geography can appear on the map. Bubble positions are ZIP reference points, not individual sighting coordinates. Counts are not normalized for population or area.

ZIP boundaries come from the original project's `resources/nyc_zip_bounderies.geojson`. Borough geography was converted from the original project's WGS84 shapefile in `resources/Borough Boundaries/`. These historical boundaries are preserved in `public/geo/`, rather than silently implying current boundaries. D3 rendering normalizes ring winding without mutating the source files.

The optional subway layer (`public/geo/subway.geojson`) is built by `scripts/refresh-subway.mjs` from the MTA's [Subway Service Lines](https://data.ny.gov/d/s692-irgq) and [Subway Stations](https://data.ny.gov/d/39hk-dx4f) on Open NY. Service lines are merged into one simplified network (about 8 m tolerance; duplicate trunk runs kept once) and stations are reduced to one point per complex. The network changes rarely, so the file is rebuilt by hand rather than in the daily refresh. It loads only when the layer is switched on, is drawn without route colors or letters, and is for orientation only. The atlas's bullets, lines, and signage are its own borough and section styling, not MTA wayfinding, and the project is not affiliated with the MTA.

The current month is partial and clearly marked. Monthly averages exclude the latest provisional month and include zero-report complete months. A selection containing only the provisional month has no complete-month average. Peak-month cards follow the selected period and borough; a separate citywide record always uses the full historical series. Tied peak months are identified. Future months have no coverage, rather than being presented as zero-report months. The heatmap shows all available years for the selected borough, outlines the selected period, and lets a visitor select an individual month.

## Habitat, property, and inspection data

`public/data/details.json` expands the atlas with 2020–present records. These views follow the global dates and borough, clipping to their supported dates. Earlier periods show unavailable coverage rather than zero activity. Inspection availability has its own latest date, since publication can lag behind sightings.

`scripts/refresh-details.mjs` fetches each 311 rat-sighting request once, validates unique request IDs, and reconciles every month/borough/ZIP with the primary snapshot before creating:

- `locations` and `habitatRows`: raw location labels plus `[month, boroughIndex, locationIndex, reports]`.
- `propertyRows`: `[month, boroughIndex, ZIP, BBL, reports]`. Invalid or missing BBLs use an empty ID, retaining their reports in coverage totals.

Habitat groups are explicit: apartments include 3+ family apartment/mixed-use buildings; smaller homes include 1–2 family dwelling/mixed-use locations; streets include sidewalks and public stairs; vacant properties and sewers have their own groups; other and unknown labels remain visible. Group percentages use all covered reports, not only known categories.

A BBL identifies a tax lot, which can contain several buildings. Distinct lots are counted once across the selected period. Repeat lots have at least two reports in that period. For map placement, each lot is assigned to its most frequently reported valid ZIP (ties break by ZIP); the circles count distinct lots, not reports. These measures do not estimate rat populations or confirm persistent infestations. Property-ID coverage and excluded report counts are shown explicitly.

The [DOHMH Rodent Inspection source](https://data.cityofnewyork.us/d/p937-wjvj) supplies independent initial, compliance, treatment, stoppage, and cleanup records. `inspections.rows` stores `[month, boroughIndex, ZIP, typeIndex, resultIndex, count]`, with dictionaries in `types` and `results`. Its identity definition removes duplicates on case, inspection timestamp, type, BBL, result, borough, and ZIP. Rows without a case ID are retained individually. Raw, deduplicated, and missing-case-ID totals remain in the snapshot. Distinct records are not necessarily distinct physical visits or distinct properties.

Rat-positive results include both “Failed for Rat Activity” and “Failed for Rat Activity and Other Reason.” Initial and compliance results have separate denominators; unclassified outcomes are shown and excluded from the classified-result rate. Treatments and cleanups are displayed separately, without implying a complaint-to-treatment conversion funnel. Proactive inspections and targeted follow-ups mean inspection positivity is not a representative prevalence estimate for all NYC properties.

`baseGeneratedAt` binds the expanded snapshot to its exact sightings snapshot. Data validation rejects mismatched generations, omitted counts, and inconsistent monthly/geographic totals. `scripts/audit-details.mjs` independently verifies habitats, property totals, and inspection records against NYC APIs, with explicit pagination for property lists. The daily workflow commits and deploys both snapshots together only after all checks pass. An additional-data loading failure leaves the main sightings atlas usable and provides a retry control.

Hotspot playback covers complete calendar years from 2010 through the year before the latest reported year. Bubble and choropleth scales use one annual ZIP maximum across the series for the selected borough. This shows changing report patterns, not tracked rat migration. Reduced-motion preferences disable autoplay while preserving manual year selection. Shared URLs retain dates, borough, map layer, inspection stage, selected insight tab, and fixed-scale year frames.

## GitHub CI/CD

`.github/workflows/pages.yml` runs on:

- Pushes to `master`: validate, test desktop/mobile/accessibility, build, and deploy.
- Pull requests targeting `master`: validate, test, and build without deployment.
- A daily schedule at **10:23 UTC**: fetch current public data, independently audit it against NYC, run the checks, preserve the verified snapshot with an unsigned bot commit, and deploy.
- Manual workflow dispatch: deploy, optionally refreshing the data first.

In repository **Settings → Pages → Build and deployment**, the source must be **GitHub Actions**. The `github-pages` environment must allow deployments from `master`. The workflow uses the built `dist/` artifact and the standard GitHub Pages deployment action; no Heroku service or external hosting is needed.

Optional: add a repository Actions secret named `SOCRATA_APP_TOKEN`. It is passed only to the scheduled/manual refresh step, never to the browser build.

`npm run data:audit` queries distinct request IDs, monthly/borough counts, and monthly/ZIP counts independently from the pipeline’s three-dimensional aggregates. It reconciles every month and borough and every month and ZIP, including missing geography, so all displayed totals, trends, rankings, and peaks can be checked at their displayed grain. The refresh fails if these independent source checks disagree. Source updates during the audit can cause a safe failure; rerun with a fresh snapshot in that case.

The source audit, build, and browser checks must pass before the scheduled snapshot is committed or a deployment runs. GitHub suppresses follow-on push workflows for commits made with `GITHUB_TOKEN`; the scheduled workflow itself proceeds to deploy the tested artifact. Non-fast-forward snapshot pushes fail safely rather than overwriting another developer's work. Failed refreshes leave the last successful deployment live. Check the Actions tab for failure details and rerun the workflow after resolving them. GitHub may disable scheduled workflows after 60 days without repository activity; successful daily snapshot commits normally keep activity current.

## Project layout

- `src/App.jsx`: page, linked filters, sharing, and CSV export.
- `src/components/`: custom map, trend, race, heatmap, and original SVG rat mascot.
- `src/lib/data.mjs`: aggregation, date helpers, snapshot validation, and geometry normalization.
- `scripts/`: data refresh and validation.
- `tests/`: data/geography checks and Playwright browser/accessibility tests.
- `public/`: only the assets and snapshots needed by the deployed app.
- `src/lib/details.mjs`: habitat grouping, distinct-lot counting, inspection classification, and expanded-snapshot validation.
- `legacy/`: the original HTML page and research README, preserved as source history.

The original notebooks, CSVs, Tableau workbook, and figures remain in the repository for research reference. They are not part of the deployed frontend and are not used as the refresh pipeline. Restaurant and weather analyses are historical research, not current dashboard layers.

## Credits

Website created by Roger Lefort. Original research by Roger Lefort, Mina Bansal, Hansen Xu, and Chi-Kuang Chen. Source data: City of New York, Office of Technology and Innovation. This is an independent project and is not affiliated with the City of New York.
