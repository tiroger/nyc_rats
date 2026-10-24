import { useCallback, useEffect, useMemo, useState } from "react";
import Rat from "./components/Rat.jsx";
import AtlasMap from "./components/AtlasMap.jsx";
import Insights from "./components/Insights.jsx";
import HotspotPlayer from "./components/HotspotPlayer.jsx";
import {
  CityCorner,
  HeroRat,
  SubwayNav,
  useCityPlay,
} from "./components/CityPlay.jsx";
import {
  detailRange,
  hotspotScale,
  summarizeBurrows,
  summarizeInspections,
  validateDetails,
} from "./lib/details.mjs";
import { Trend, RatRace, Seasonality } from "./components/Charts.jsx";
import {
  BOROUGHS,
  COLORS,
  monthLabel,
  number,
  periodMetrics,
  presetRange,
  summarize,
  validateSnapshot,
} from "./lib/data.mjs";

const dateLabel = (value) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default function App() {
  const { motion } = useCityPlay();
  const [resource, setResource] = useState({ loading: true });
  const [borough, setBorough] = useState("All NYC");
  const [preset, setPreset] = useState("12m");
  const [customRange, setCustomRange] = useState(null);
  const [selectedZip, setSelectedZip] = useState(null);
  const [copied, setCopied] = useState(false);
  const [detailResource, setDetailResource] = useState({ loading: true });
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [mapLayer, setMapLayer] = useState("reports");
  const [inspectionKind, setInspectionKind] = useState("Initial");
  const [animationYear, setAnimationYear] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const paths = [
          "data/sightings.json",
          "geo/boroughs.geojson",
          "geo/zip-codes.geojson",
        ];
        const [data, boroughs, zips] = await Promise.all(
          paths.map(async (path) => {
            const response = await fetch(`${import.meta.env.BASE_URL}${path}`, {
              signal: controller.signal,
            });
            if (!response.ok) throw new Error(`Couldn’t load ${path}`);
            return response.json();
          }),
        );
        validateSnapshot(data);
        const search = new URLSearchParams(window.location.search);
        const b = search.get("borough");
        if (["properties", "inspections"].includes(search.get("layer")))
          setMapLayer(search.get("layer"));
        if (search.get("stage") === "compliance")
          setInspectionKind("Compliance");
        if (BOROUGHS.slice(0, 5).includes(b)) setBorough(b);
        const from = search.get("from"),
          to = search.get("to");
        if (
          /^\d{4}-(0[1-9]|1[0-2])$/.test(from) &&
          /^\d{4}-(0[1-9]|1[0-2])$/.test(to) &&
          from <= to &&
          from >= data.coverage.from.slice(0, 7) &&
          to <= data.coverage.to.slice(0, 7)
        ) {
          setCustomRange([from, to]);
          setPreset("custom");
          const frame = Number(search.get("frame"));
          if (
            from === `${frame}-01` &&
            to === `${frame}-12` &&
            frame < Number(data.coverage.to.slice(0, 4)) &&
            !search.get("layer")
          )
            setAnimationYear(frame);
        }
        setResource({ data, geography: { boroughs, zips }, loading: false });
      } catch (error) {
        if (error.name !== "AbortError")
          setResource({ error: error.message, loading: false });
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const data = resource.data;
  const range = data
    ? preset === "custom" && customRange
      ? customRange
      : presetRange(preset, data.coverage)
    : ["2010-01", "2010-01"];
  const [start, end] = range;
  useEffect(() => {
    if (!data) return;
    const controller = new AbortController();
    setDetailResource({ loading: true });
    fetch(
      `${import.meta.env.BASE_URL}data/details.json?snapshot=${encodeURIComponent(data.generatedAt)}`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) throw new Error("Additional data is unavailable");
        return response.json();
      })
      .then((details) => {
        validateDetails(details, data);
        setDetailResource({ data: details, loading: false });
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setDetailResource({ error: error.message, loading: false });
      });
    return () => controller.abort();
  }, [data, detailAttempt]);
  const details = detailResource.data;
  const burrows = useMemo(
    () => (details ? summarizeBurrows(details, start, end, borough) : null),
    [details, start, end, borough],
  );
  const inspections = useMemo(
    () =>
      details
        ? summarizeInspections(details, start, end, borough, inspectionKind)
        : null,
    [details, start, end, borough, inspectionKind],
  );
  const fixedScale = useMemo(
    () =>
      data && animationYear !== null ? hotspotScale(data, borough) : undefined,
    [data, borough, animationYear !== null],
  );
  const showFrame = useCallback((year) => {
    setAnimationYear(year);
    setMapLayer("reports");
    setPreset("custom");
    setCustomRange([`${year}-01`, `${year}-12`]);
  }, []);
  const choosePeriod = (months) => {
    setAnimationYear(null);
    setCustomRange(months);
    setPreset("custom");
  };
  const chooseLayer = (layer) => {
    setAnimationYear(null);
    setMapLayer(layer);
    setSelectedZip(null);
  };
  const showInspections = () => {
    chooseLayer("inspections");
    document.getElementById("rat-map").scrollIntoView({
      behavior: motion ? "smooth" : "instant",
    });
  };
  const summary = useMemo(
    () => (data ? summarize(data, start, end, borough) : null),
    [data, start, end, borough],
  );
  const allBoroughs = useMemo(
    () => (data ? summarize(data, start, end) : null),
    [data, start, end],
  );
  const metrics = useMemo(
    () => (data ? periodMetrics(summary, data.coverage) : null),
    [data, summary],
  );
  const historicalMetrics = useMemo(
    () =>
      data
        ? periodMetrics(
            summarize(
              data,
              data.coverage.from.slice(0, 7),
              data.coverage.to.slice(0, 7),
            ),
            data.coverage,
          )
        : null,
    [data],
  );

  useEffect(() => {
    if (!data) return;
    const url = new URL(window.location.href);
    url.searchParams.set("from", start);
    url.searchParams.set("to", end);
    if (borough === "All NYC") url.searchParams.delete("borough");
    else url.searchParams.set("borough", borough);
    if (mapLayer === "reports") url.searchParams.delete("layer");
    else url.searchParams.set("layer", mapLayer);
    if (mapLayer === "inspections" && inspectionKind === "Compliance")
      url.searchParams.set("stage", "compliance");
    else url.searchParams.delete("stage");
    if (animationYear !== null)
      url.searchParams.set("frame", String(animationYear));
    else url.searchParams.delete("frame");
    window.history.replaceState(null, "", url);
    setSelectedZip(null);
    setCopied(false);
  }, [data, start, end, borough, mapLayer, inspectionKind, animationYear]);

  function download() {
    const csv = `Month,Borough,Reported sightings\n${summary.months.map((r) => `${r.month},${borough},${r.count}`).join("\n")}\n`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `ratlas-${borough.toLowerCase().replaceAll(" ", "-")}-${start}-${end}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt("Copy this view’s link:", window.location.href);
    }
  }

  if (resource.loading)
    return (
      <main className="load-screen" aria-live="polite">
        <Rat />
        <h1>Following the trail…</h1>
        <p>Loading the latest published NYC data.</p>
      </main>
    );
  if (resource.error)
    return (
      <main className="load-screen">
        <Rat />
        <h1>A little snag underground.</h1>
        <p>We couldn’t load the atlas. Your connection may be interrupted.</p>
        <button onClick={() => window.location.reload()}>Try again</button>
        <a href="https://data.cityofnewyork.us/d/erm2-nwe9">
          Visit NYC Open Data ↗
        </a>
      </main>
    );

  const years = Array.from(
    {
      length:
        Number(data.coverage.to.slice(0, 4)) -
        Number(data.coverage.from.slice(0, 4)) +
        1,
    },
    (_, i) => String(Number(data.coverage.to.slice(0, 4)) - i),
  );
  const top = Object.entries(summary.byBorough).sort((a, b) => b[1] - a[1])[0];
  const peak = metrics.peakMonths[0];
  const historicalPeak = historicalMetrics.peakMonths[0];
  const stale = Date.now() - Date.parse(data.generatedAt) > 3 * 86400_000;
  const partial = end === data.coverage.to.slice(0, 7);
  const periodText =
    start === end
      ? monthLabel(start, true)
      : `${monthLabel(start, true)} — ${monthLabel(end, true)}`;
  const mapSummary =
    mapLayer === "properties"
      ? burrows?.map
      : mapLayer === "inspections"
        ? inspections?.map
        : summary;
  const mapUnit =
    mapLayer === "properties"
      ? "distinct tax lots"
      : mapLayer === "inspections"
        ? "rat-positive inspection records"
        : "reports";
  const mapRange =
    details && mapLayer !== "reports"
      ? detailRange(
          mapLayer === "inspections"
            ? details.inspections.coverage
            : details.coverage,
          start,
          end,
        )
      : [start, end];
  const mapEmpty =
    mapLayer !== "reports" && !details
      ? detailResource.error
        ? "Additional map data is unavailable. Retry below."
        : "Loading additional map data…"
      : !mapRange
        ? "No detail coverage for these dates. Details begin in 2020."
        : mapLayer === "inspections"
          ? "No rat-positive inspection records for this selection."
          : mapLayer === "properties"
            ? "No valid property IDs for this selection."
            : undefined;

  return (
    <>
      <a href="#explore" className="skip-link">
        Skip to the atlas
      </a>
      <header className="site-header shell">
        <a
          href={import.meta.env.BASE_URL}
          className="wordmark"
          aria-label="Ratlas home"
        >
          <Rat />
          <span>
            ratlas<span className="wordmark-dot">.</span>
          </span>
        </a>
        <span className="header-tag mono">AN INDEPENDENT NYC RAT ATLAS</span>
        <nav aria-label="Main navigation">
          <a href="#explore">Explore the data</a>
          <a href="#deeper">Below the sidewalk</a>
          <a
            href="https://github.com/tiroger/nyc_rats"
            target="_blank"
            rel="noreferrer"
            className="github-link"
          >
            GitHub ↗
          </a>
        </nav>
      </header>
      <main>
        <section
          className="hero shell"
          id="street-level"
          aria-labelledby="hero-title"
        >
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> FIVE BOROUGHS. ONE VERY PERSISTENT
              NEIGHBOR.
            </div>
            <h1 id="hero-title">
              New York,
              <br />
              from the <span className="underlined">ground up.</span>
            </h1>
            <p>
              A closer look at the city’s most notorious locals.
              <br className="desktop-break" /> Follow the sightings, find the
              patterns, meet your neighbors.
            </p>
            <a href="#explore" className="primary-link">
              Down the rabbit—er, rat hole <span>↘</span>
            </a>
            <div className="hero-source mono">
              PUBLIC DATA. CURIOUS HUMANS. ABSOLUTELY NO TABLEAU.
            </div>
          </div>
          <div className="hero-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="art-coordinate mono">
              40.7128° N<br />
              74.0060° W
            </span>
            <div className="art-sun" />
            <svg viewBox="0 0 440 220" className="skyline" aria-hidden="true">
              <path d="M5 200V150H35V105H51V68H65V105H81V200H95V134H123V161H142V115H159V76H174V115H190V200H201V99H223V47H230V12H234V47H243V99H264V200H280V155H304V125H330V178H347V103H368V145H388V130H415V200" />
              <path d="M5 200H430" />
            </svg>
            <HeroRat />
            <span className="rat-stamp mono">
              EST. 2010
              <br />
              <b>STILL HERE.</b>
            </span>
            <span className="art-caption mono">
              RATTUS NORVEGICUS / UNOFFICIAL NEW YORKER
            </span>
          </div>
        </section>
        <div className="ticker">
          <div className="shell ticker-inner">
            <span>
              <span className={`live-dot ${stale ? "stale" : ""}`} />{" "}
              {stale ? "LAST PUBLISHED SNAPSHOT" : "REFRESHED DAILY"}
            </span>
            <span>NYC 311 · Rat-sighting reports</span>
            <span>Data through {dateLabel(data.coverage.to)}</span>
            <a href="#methodology">Know what you’re counting ↗</a>
          </div>
        </div>
        <SubwayNav />
        {stale && (
          <div className="stale-notice shell" role="status">
            This snapshot was last refreshed{" "}
            {dateLabel(data.generatedAt.slice(0, 10))}. Updates are delayed; the
            atlas is showing the last successful refresh.
          </div>
        )}
        <section
          id="explore"
          className="explore shell"
          aria-labelledby="explore-title"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">01 / ON THE GROUND</div>
              <h2 id="explore-title">Where the wild things are.</h2>
              <p>
                Every report leaves a little trail. Pick a borough and a time to
                follow it.
              </p>
            </div>
            <button className="text-button share-button" onClick={share}>
              {copied ? "Link copied ✓" : "Share this view ↗"}
            </button>
          </div>
          <div className="filter-bar">
            <div
              className="borough-filters"
              role="group"
              aria-label="Filter by borough"
            >
              {["All NYC", ...BOROUGHS.slice(0, 5)].map((b) => (
                <button
                  key={b}
                  aria-pressed={borough === b}
                  onClick={() => setBorough(b)}
                >
                  {b !== "All NYC" && (
                    <span
                      className="borough-dot"
                      style={{ background: COLORS[b] }}
                    />
                  )}
                  {b}
                </button>
              ))}
            </div>
            <label className="period-select">
              <span className="sr-only">Time period</span>
              <select
                value={preset}
                onChange={(e) => {
                  setAnimationYear(null);
                  setPreset(e.target.value);
                  setCustomRange(null);
                }}
              >
                <option value="12m">Latest 12 calendar months</option>
                <option value="ytd">This year so far</option>
                <option value="all">All time · since 2010</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                    {y === years[0] ? " (partial)" : ""}
                  </option>
                ))}
                {preset === "custom" && (
                  <option value="custom">Custom period</option>
                )}
              </select>
              <span aria-hidden="true">⌄</span>
            </label>
          </div>
          <div className="selection-caption mono">
            <span>
              {borough.toUpperCase()} / {periodText.toUpperCase()}
            </span>
            <span>
              {partial
                ? `Latest month is partial · through ${dateLabel(data.coverage.to)}`
                : "Complete calendar months"}
            </span>
          </div>
          <div className="stats-grid" aria-live="polite">
            <div className="stat">
              <span className="eyebrow">REPORTED SIGHTINGS</span>
              <strong data-testid="total-reports">
                {number.format(summary.total)}
              </strong>
              <span>311 reports in this selection</span>
            </div>
            <div className="stat">
              <span className="eyebrow">THE MONTHLY PACE</span>
              <strong data-testid="monthly-average">
                {metrics.monthlyAverage === null
                  ? "—"
                  : number.format(Math.round(metrics.monthlyAverage))}
                <small> / mo</small>
              </strong>
              <span>
                {metrics.completeMonths.length
                  ? `Average of ${metrics.completeMonths.length} complete month${metrics.completeMonths.length === 1 ? "" : "s"}${partial ? " · partial month excluded" : ""}`
                  : "No complete months in this selection"}
              </span>
            </div>
            <div className="stat">
              <span className="eyebrow">
                {borough === "All NYC"
                  ? "MOST REPORTED BOROUGH"
                  : "SHARE OF NYC REPORTS"}
              </span>
              <strong className={borough === "All NYC" ? "stat-word" : ""}>
                {borough === "All NYC"
                  ? summary.total
                    ? top[0]
                    : "—"
                  : `${allBoroughs.total ? ((summary.total / allBoroughs.total) * 100).toFixed(1) : "0"}%`}
              </strong>
              <span>
                {borough === "All NYC"
                  ? `${number.format(top[1])} reports · volume, not prevalence`
                  : `${borough} in the selected period`}
              </span>
            </div>
            <div className="stat">
              <span className="eyebrow">BUSIEST MONTH IN THIS PERIOD</span>
              <strong className="stat-word" data-testid="peak-month">
                {peak ? monthLabel(peak.month, true) : "—"}
                {metrics.peakMonths.length > 1
                  ? ` +${metrics.peakMonths.length - 1}`
                  : ""}
              </strong>
              <span>
                {number.format(metrics.peakCount)} reports ·{" "}
                {metrics.peakMonths.length > 1
                  ? "tied peak months"
                  : "selected dates and borough"}
              </span>
            </div>
          </div>
          <div className="historical-record" data-testid="historical-peak">
            <p>
              <strong>Citywide record since 2010:</strong>{" "}
              {historicalMetrics.peakMonths
                .map((r) => monthLabel(r.month))
                .join(" and ")}{" "}
              · {number.format(historicalMetrics.peakCount)} reports
              {historicalMetrics.peakMonths.length > 1 ? " each" : ""}. The
              cards above follow your selected dates and borough.
            </p>
            <button
              className="text-button"
              onClick={() => {
                setBorough("All NYC");
                choosePeriod([historicalPeak.month, historicalPeak.month]);
              }}
            >
              Explore record month ↗
            </button>
          </div>
          <div className="map-layout">
            <article className="panel map-panel" id="rat-map">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">THE RAT MAP</span>
                  <h3>
                    {mapLayer === "reports"
                      ? "A city of tiny footprints."
                      : mapLayer === "properties"
                        ? "How many places are being reported?"
                        : "Where inspectors found rat signs."}
                  </h3>
                </div>
                <span className="tag mono">BY ZIP CODE</span>
              </div>
              <div className="map-layer-controls">
                <label>
                  Map layer
                  <select
                    value={mapLayer}
                    onChange={(e) => chooseLayer(e.target.value)}
                  >
                    <option value="reports">Resident reports</option>
                    <option value="properties" disabled={!details}>
                      Distinct tax lots
                    </option>
                    <option value="inspections" disabled={!details}>
                      Inspection findings
                    </option>
                  </select>
                </label>
                {mapLayer === "inspections" && (
                  <label>
                    Map inspection stage
                    <select
                      value={inspectionKind}
                      onChange={(e) => {
                        setInspectionKind(e.target.value);
                        setSelectedZip(null);
                      }}
                    >
                      <option value="Initial">Initial</option>
                      <option value="Compliance">Compliance</option>
                    </select>
                  </label>
                )}
              </div>
              <p className="map-source-note">
                {mapLayer === "reports"
                  ? "311 rat-sighting reports for your selected dates and borough."
                  : mapLayer === "properties"
                    ? "Distinct reported tax lots, each assigned once to its most-reported ZIP. Detail coverage begins in 2020."
                    : `${inspectionKind} inspection records with active rat signs. Independent DOHMH findings; not a count of resident reports.`}
                {mapLayer !== "reports" &&
                  mapRange &&
                  ` Available selection: ${monthLabel(mapRange[0], true)} — ${monthLabel(mapRange[1], true)}.`}
              </p>
              <AtlasMap
                geography={resource.geography}
                summary={mapSummary || { total: 0, zips: [] }}
                borough={borough}
                selectedZip={selectedZip}
                setSelectedZip={setSelectedZip}
                unit={mapUnit}
                scaleMaximum={mapLayer === "reports" ? fixedScale : undefined}
                emptyMessage={mapEmpty}
              />
              <HotspotPlayer
                coverage={data.coverage}
                activeYear={animationYear}
                onFrame={showFrame}
                onReset={() => {
                  setAnimationYear(null);
                  setPreset("12m");
                  setCustomRange(null);
                }}
              />
            </article>
            <aside className="zip-sidebar">
              <div className="eyebrow">THE FREQUENT FLIERS</div>
              <h3>
                Small areas.
                <br />
                Big reputations.
              </h3>
              <p>Mapped ZIP codes ranked by {mapUnit} in your selection.</p>
              <ol className="zip-ranking">
                {(mapSummary?.zips || [])
                  .filter((r) =>
                    resource.geography.zips.features.some(
                      (f) => f.properties.postalCode === r.zip,
                    ),
                  )
                  .slice(0, 5)
                  .map((r, i) => (
                    <li key={`${r.borough}-${r.zip}`}>
                      <button
                        onClick={() =>
                          setSelectedZip(selectedZip === r.zip ? null : r.zip)
                        }
                        aria-pressed={selectedZip === r.zip}
                      >
                        <span className="zip-rank mono">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <strong>{r.zip}</strong>
                          <small>
                            <span
                              className="borough-dot"
                              style={{ background: COLORS[r.borough] }}
                            />
                            {r.borough}
                          </small>
                        </span>
                        <b className="mono">{number.format(r.count)}</b>
                        <span aria-hidden="true">↗</span>
                      </button>
                    </li>
                  ))}
              </ol>
              {!summary.total && <p>No reports in this selection.</p>}
              <div className="sidebar-note">
                <span className="note-symbol">↳</span>
                <p>
                  A busy ZIP isn’t necessarily a rattier ZIP. The active layer
                  counts {mapUnit}. The headline figures and charts count
                  resident reports.
                </p>
              </div>
              <button className="download-button" onClick={download}>
                Download monthly data <span>↓</span>
              </button>
              <p className="download-note">
                CSV contains resident reports for the selected period.
              </p>
            </aside>
          </div>
          <div className="chart-layout">
            <article className="panel trend-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">THE LONG TAIL</span>
                  <h3>Every month has a story.</h3>
                </div>
                <span className="tag mono">{borough.toUpperCase()}</span>
              </div>
              <Trend months={summary.months} borough={borough} />
              <p className="chart-note">
                Monthly 311 rat-sighting reports.{" "}
                {partial &&
                  `The last month is incomplete through ${dateLabel(data.coverage.to)}.`}
              </p>
            </article>
            <article className="panel race-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">THE RAT RACE</span>
                  <h3>Five boroughs. One leaderboard.</h3>
                </div>
              </div>
              <RatRace
                counts={allBoroughs.byBorough}
                borough={borough}
                setBorough={setBorough}
              />
              <p className="chart-note">
                All boroughs, same period. Select a row to filter the atlas.
              </p>
            </article>
          </div>
        </section>
        <Insights
          resource={detailResource}
          start={start}
          end={end}
          borough={borough}
          burrows={burrows}
          inspections={inspections}
          inspectionKind={inspectionKind}
          setInspectionKind={setInspectionKind}
          onMap={showInspections}
          onCoverage={() =>
            choosePeriod(["2020-01", data.coverage.to.slice(0, 7)])
          }
          onRetry={() => setDetailAttempt((n) => n + 1)}
        />
        <section
          className="field-notes shell"
          id="field-notes"
          aria-labelledby="notes-title"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">03 / THE BIGGER PICTURE</div>
              <h2 id="notes-title">Creatures of habit.</h2>
              <p>
                Step back. Look across the years. See when the city starts
                squeaking.
              </p>
            </div>
            <span className="mono small-label">
              {borough.toUpperCase()} / ALL AVAILABLE YEARS
            </span>
          </div>
          <div className="season-layout">
            <article className="panel season-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">RAT SEASON</span>
                  <h3>Some months leave more tracks.</h3>
                </div>
                <span className="tag mono">2010—{years[0]}</span>
              </div>
              <Seasonality
                data={data}
                borough={borough}
                start={start}
                end={end}
                onSelect={(month) => {
                  choosePeriod([month, month]);
                  document.getElementById("explore").scrollIntoView({
                    behavior: motion ? "smooth" : "instant",
                  });
                }}
              />
            </article>
            <aside className="field-card">
              <span className="eyebrow">A NOTE FROM THE SIDEWALK</span>
              <div className="field-card-art">
                <Rat />
                <span className="mono">
                  SMALL FEET.
                  <br />
                  LONG PAPER TRAIL.
                </span>
              </div>
              <h3>Reports tell a human story, too.</h3>
              <p>
                These are moments when someone chose to contact 311. A change in
                reports can reflect rat activity, awareness, access to
                reporting, or all three.
              </p>
              <p>
                Use this atlas to spot patterns and ask better questions.
                Counting the rats themselves is a different kind of science.
              </p>
              <a href="#methodology">
                Read the field guide <span>↘</span>
              </a>
            </aside>
          </div>
        </section>
        <CityCorner data={data} details={details} />
        <section
          className="methodology shell"
          id="methodology"
          aria-labelledby="method-title"
        >
          <div>
            <div className="eyebrow">04 / UNDER THE HOOD</div>
            <h2 id="method-title">
              Good data.
              <br />A little street sense.
            </h2>
            <p>
              An independent project built on public information.
              <br />
              Open source, open data, eyes wide open.
            </p>
          </div>
          <div className="method-details">
            <details open>
              <summary>What are we actually counting?</summary>
              <p>
                NYC 311 service requests with Problem (API:{" "}
                <code>complaint_type</code>) “Rodent” and Problem Detail (API:{" "}
                <code>descriptor</code>) “Rat Sighting.” One request is one
                report, not one rat, a confirmed infestation, or a population
                estimate. Multiple people may report the same activity.
              </p>
            </details>
            <details>
              <summary>Where does the data come from?</summary>
              <p>
                NYC’s Office of Technology and Innovation publishes the{" "}
                <a href={data.sources[0].url}>2010–2019 archive ↗</a> and{" "}
                <a href={data.sources[1].url}>2020–present dataset ↗</a>. We
                combine non-overlapping periods, retaining reports with missing
                ZIPs or boroughs in the overall totals. Habitat and property
                details cover 2020 onward. The inspection layer comes from the
                independently published{" "}
                <a href="https://data.cityofnewyork.us/d/p937-wjvj">
                  DOHMH Rodent Inspection dataset ↗
                </a>
                . Exact duplicate inspection records are removed using case,
                date, type, tax lot, result, borough, and ZIP; distinct records
                are not necessarily distinct visits or properties. The map uses
                historical ZIP and borough boundaries preserved in this project;
                boundaries and ZIP assignments may change.
              </p>
            </details>
            <details>
              <summary>How fresh is it?</summary>
              <p>
                GitHub Actions automatically refreshes the data every day at
                10:23 UTC (6:23 a.m. Eastern during daylight saving time; 5:23
                a.m. Eastern during standard time). Each refresh independently
                checks monthly, borough, ZIP, and unique-request totals against
                NYC Open Data before running tests and publishing. If a refresh
                fails, the last successful deployment stays available. Last
                successful refresh:{" "}
                <time dateTime={data.generatedAt}>
                  {new Date(data.generatedAt).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  Eastern
                </time>
                . Latest report: {dateLabel(data.coverage.to)}. Recent records
                can arrive late or be revised.
              </p>
            </details>
            <details>
              <summary>How should I compare neighborhoods?</summary>
              <p>
                These are raw counts, without adjustment for population, land
                area, foot traffic, or willingness to report. ZIP bubbles are
                placed at ZIP reference locations and do not identify exact
                sightings. Missing or unmatched ZIPs appear in totals but cannot
                be mapped. Partial months are labeled and excluded from the
                monthly average. The peak-month card follows the selected dates
                and borough; the citywide historical record is shown separately.
              </p>
            </details>
          </div>
        </section>
        <section className="closing shell">
          <Rat />
          <div>
            <h2>Seen something scurrying?</h2>
            <p>Put it on the city’s radar. Report rat activity to NYC 311.</p>
          </div>
          <a
            href="https://portal.311.nyc.gov/article/?kanumber=KA-01107"
            target="_blank"
            rel="noreferrer"
          >
            Make a 311 report <span>↗</span>
          </a>
        </section>
      </main>
      <footer className="site-footer shell">
        <a href={import.meta.env.BASE_URL} className="wordmark">
          <span>ratlas.</span>
        </a>
        <span>Made for the city. And its other residents.</span>
        <div>
          <a href="https://github.com/tiroger/nyc_rats">Source code ↗</a>
          <a href="https://data.cityofnewyork.us/">NYC Open Data ↗</a>
          <a href="#hero-title">Back to street level ↑</a>
        </div>
        <p>
          Website created by Roger Lefort. Original research by Roger Lefort,
          Mina Bansal, Hansen Xu, and Chi-Kuang Chen. Independent project; not
          affiliated with the City of New York.
        </p>
      </footer>
    </>
  );
}
