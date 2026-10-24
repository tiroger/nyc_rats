# Ratlas — New York, from the ground up.

An independent, interactive atlas of NYC 311 rat-sighting reports. Built with React, Vite, and D3; deployed to **https://tiroger.github.io/nyc_rats/** through GitHub Actions.

## Explore

- Linked borough and period filters, with shareable URLs.
- Zoomable ZIP map with proportional bubbles, ZIP choropleth, and report details.
- Monthly trends with keyboard exploration and a data-table alternative.
- Borough “rat race” and a monthly heatmap spanning 2010 to the latest report.
- Monthly CSV downloads, responsive layouts, reduced-motion support, and locally hosted fonts.
- Freshness labels and an explicit warning when the published snapshot is over three days old.

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

The current month is partial and clearly marked. Monthly averages include that partial calendar month when it is selected. Future months have no coverage, rather than being presented as zero-report months. The heatmap shows all available years for the selected borough, outlines the selected period, and lets a visitor select an individual month.

## GitHub CI/CD

`.github/workflows/pages.yml` runs on:

- Pushes to `master`: validate, test desktop/mobile/accessibility, build, and deploy.
- Pull requests targeting `master`: validate, test, and build without deployment.
- A daily schedule at **10:23 UTC**: fetch current public data, run the checks, preserve the verified snapshot with an unsigned bot commit, and deploy.
- Manual workflow dispatch: deploy, optionally refreshing the data first.

In repository **Settings → Pages → Build and deployment**, the source must be **GitHub Actions**. The `github-pages` environment must allow deployments from `master`. The workflow uses the built `dist/` artifact and the standard GitHub Pages deployment action; no Heroku service or external hosting is needed.

Optional: add a repository Actions secret named `SOCRATA_APP_TOKEN`. It is passed only to the scheduled/manual refresh step, never to the browser build.

The build and browser checks must pass before the scheduled snapshot is committed or a deployment runs. GitHub suppresses follow-on push workflows for commits made with `GITHUB_TOKEN`; the scheduled workflow itself proceeds to deploy the tested artifact. Non-fast-forward snapshot pushes fail safely rather than overwriting another developer's work. Failed refreshes leave the last successful deployment live. Check the Actions tab for failure details and rerun the workflow after resolving them. GitHub may disable scheduled workflows after 60 days without repository activity; successful daily snapshot commits normally keep activity current.

No commit signing, sign-off trailers, or AI attribution trailers are added by this workflow.

## Project layout

- `src/App.jsx`: page, linked filters, sharing, and CSV export.
- `src/components/`: custom map, trend, race, heatmap, and original SVG rat mascot.
- `src/lib/data.mjs`: aggregation, date helpers, snapshot validation, and geometry normalization.
- `scripts/`: data refresh and validation.
- `tests/`: data/geography checks and Playwright browser/accessibility tests.
- `public/`: only the assets and snapshots needed by the deployed app.
- `legacy/`: the original HTML page and research README, preserved as source history.

The original notebooks, CSVs, Tableau workbook, and figures remain in the repository for research reference. They are not part of the deployed frontend and are not used as the refresh pipeline. Restaurant and weather analyses are historical research, not current dashboard layers.

## Credits

Original research: Mina Bansal, Roger Lefort, Hansen Xu, and Chi-Kuang Chen. Source data: City of New York, Office of Technology and Innovation. This is an independent project and is not affiliated with the City of New York.
