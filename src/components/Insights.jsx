import { useMemo, useRef, useState } from "react";
import { hierarchy, pack, scaleLinear } from "d3";
import { COLORS, monthLabel, number } from "../lib/data.mjs";
import {
  detailRange,
  HABITATS,
  lotLabel,
  percent,
  propertyTimeline,
  summarizeHabitats,
} from "../lib/details.mjs";
import Rat from "./Rat.jsx";
import { Trend } from "./Charts.jsx";

const dateLabel = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function StreetScene({ active }) {
  const buildings = [
    { id: "apartments", x: 20, w: 110, y: 25, h: 145 },
    { id: "homes", x: 155, w: 80, y: 80, h: 90 },
    { id: "streets", x: 260, w: 65, y: 135, h: 35 },
    { id: "vacant", x: 350, w: 75, y: 90, h: 80 },
    { id: "sewers", x: 455, w: 70, y: 150, h: 20 },
    { id: "other", x: 555, w: 90, y: 70, h: 100 },
  ];
  const current = buildings.find((b) => b.id === active) || { x: 285, w: 100 };
  return (
    <svg viewBox="0 0 670 230" className="habitat-scene" aria-hidden="true">
      <path d="M0 172H670M0 205H670" stroke="#aebaa0" strokeWidth="1.5" />
      {buildings.map((b) => (
        <g
          key={b.id}
          opacity={active === b.id ? 1 : 0.48}
          className="street-building"
        >
          {b.id === "homes" && (
            <path
              d={`M${b.x - 8} ${b.y}l48-36 48 36`}
              fill="#dcf080"
              stroke="#526b44"
            />
          )}
          {b.id === "streets" ? (
            <>
              <path
                d={`M${b.x + 10} 170V80q0-17 20-17h15`}
                fill="none"
                stroke="#526b44"
                strokeWidth="3"
              />
              <path d={`M${b.x + 30} 58h22v8h-22z`} fill="#526b44" />
            </>
          ) : b.id === "sewers" ? (
            <>
              <ellipse
                cx={b.x + 35}
                cy="168"
                rx="35"
                ry="9"
                fill="#d8dccb"
                stroke="#526b44"
              />
              {[0, 1, 2, 3].map((i) => (
                <path
                  key={i}
                  d={`M${b.x + 12 + i * 15} 162v12`}
                  stroke="#526b44"
                />
              ))}
            </>
          ) : b.id === "vacant" ? (
            <>
              <path
                d={`M${b.x} 170v-67m75 67v-67m-75 20h75m-75 21h75`}
                stroke="#8b7845"
                strokeWidth="3"
              />
              {[1, 2, 3, 4].map((i) => (
                <path key={i} d={`M${b.x + i * 15} 104v65`} stroke="#8b7845" />
              ))}
              <path
                d={`M${b.x + 25} 163q-12-28 8-39m8 39q20-25 23-12`}
                fill="none"
                stroke="#64764d"
                strokeWidth="3"
              />
            </>
          ) : (
            <>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill={active === b.id ? "#dcf080" : "#e7ebdc"}
                stroke="#526b44"
                strokeWidth="1.5"
              />
              {Array.from({ length: b.id === "apartments" ? 4 : 2 }, (_, row) =>
                [0, 1, 2].map((col) => (
                  <rect
                    key={`${row}-${col}`}
                    x={b.x + 13 + (col * (b.w - 25)) / 3}
                    y={b.y + 15 + row * 28}
                    width="12"
                    height="16"
                    fill="#f5f3e9"
                    stroke="#718362"
                  />
                )),
              )}
              <rect
                x={b.x + b.w / 2 - 8}
                y="145"
                width="16"
                height="25"
                fill="#526b44"
              />
            </>
          )}
          <text
            x={b.x + b.w / 2}
            y="223"
            textAnchor="middle"
            className="scene-label"
          >
            {HABITATS.find((h) => h.id === b.id).name.split(" &")[0]}
          </text>
        </g>
      ))}
      <Rat
        x={current.x + current.w / 2 - 27}
        y="163"
        width="60"
        height="38"
        className="scene-rat"
      />
    </svg>
  );
}

function Habitats({ details, start, end, borough }) {
  const summary = useMemo(
    () => summarizeHabitats(details, start, end, borough),
    [details, start, end, borough],
  );
  const [active, setActive] = useState("apartments");
  const current = summary.groups.find((g) => g.id === active);
  const bar = scaleLinear()
    .domain([0, summary.total || 1])
    .range([0, 100]);
  return (
    <div className="habitat-panel" data-testid="habitats-panel">
      <div className="habitat-illustration">
        <span className="eyebrow">RAT HABITATS / REPORTED LOCATION TYPES</span>
        <h3>Every neighborhood has its niches.</h3>
        <StreetScene active={active} />
        <div className="habitat-selected">
          <span className="eyebrow">{current.name.toUpperCase()}</span>
          <strong>
            {number.format(current.count)}
            <small> reports</small>
          </strong>
          <span>
            {percent(summary.total ? current.count / summary.total : null)} of{" "}
            {number.format(summary.total)} reports with detail coverage
          </span>
        </div>
        <p className="chart-note">
          A reported location type describes the complaint location. These
          counts do not measure rats per building or a preference for a
          particular habitat.
        </p>
      </div>
      <div className="habitat-bars" role="group" aria-label="Reported habitats">
        {summary.groups.map((g) => (
          <button
            key={g.id}
            onClick={() => setActive(g.id)}
            aria-pressed={active === g.id}
            className="habitat-row"
          >
            <span>
              <strong>{g.name}</strong>
              <b className="mono">{number.format(g.count)}</b>
              <small>
                {percent(summary.total ? g.count / summary.total : null)}
              </small>
            </span>
            <span className="habitat-track">
              <span
                style={{ width: `${bar(g.count)}%`, background: g.color }}
              />
            </span>
          </button>
        ))}
        <div className="habitat-breakdown">
          <span className="eyebrow">{current.description}</span>
          {current.locations.length ? (
            current.locations.map((l) => (
              <div key={l.name}>
                <span>{l.name}</span>
                <b className="mono">{number.format(l.count)}</b>
              </div>
            ))
          ) : (
            <p>No reports in this category for the selected period.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Burrows({ details, summary, start, end }) {
  const [selected, setSelected] = useState(null);
  const current =
    summary.properties.find((p) => p.bbl === selected) || summary.properties[0];
  const range = detailRange(details.coverage, start, end);
  const circles = useMemo(() => {
    const root = hierarchy({ children: summary.properties.slice(0, 30) }).sum(
      (d) => d.count || 0,
    );
    return root.children
      ? pack().size([640, 265]).padding(6)(root).leaves()
      : [];
  }, [summary]);
  return (
    <div className="burrows-panel" data-testid="burrows-panel">
      <div className="insight-stats">
        <div>
          <span className="eyebrow">DISTINCT TAX LOTS</span>
          <strong data-testid="distinct-lots">
            {number.format(summary.propertyCount)}
          </strong>
          <small>Lots with a valid property ID</small>
        </div>
        <div>
          <span className="eyebrow">REPEATEDLY REPORTED</span>
          <strong>{number.format(summary.repeatProperties)}</strong>
          <small>Lots with two or more reports</small>
        </div>
        <div>
          <span className="eyebrow">PROPERTY ID COVERAGE</span>
          <strong>
            {percent(
              summary.totalReports
                ? summary.matchedReports / summary.totalReports
                : null,
            )}
          </strong>
          <small>
            {number.format(summary.missingReports)} reports without a valid ID
          </small>
        </div>
      </div>
      <div className="burrow-layout">
        <div>
          <span className="eyebrow">
            THE 30 MOST-REPORTED LOTS / CIRCLE AREA = REPORTS
          </span>
          <svg
            viewBox="0 0 640 280"
            className="burrow-pack"
            aria-label="Most-reported tax lots; select one to inspect its timeline"
          >
            {circles.map((n) => (
              <g
                key={n.data.bbl}
                role="button"
                tabIndex={0}
                aria-pressed={current?.bbl === n.data.bbl}
                aria-label={`Tax lot ${n.data.bbl}, ${number.format(n.data.count)} reports`}
                onClick={() => setSelected(n.data.bbl)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(n.data.bbl);
                  }
                }}
                className={`burrow-node ${current?.bbl === n.data.bbl ? "burrow-selected" : ""}`}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={COLORS[n.data.borough]}
                  fillOpacity=".17"
                  stroke={COLORS[n.data.borough]}
                  strokeWidth="1.5"
                />
                {n.r > 29 && (
                  <Rat
                    x={n.x - n.r * 0.65}
                    y={n.y - n.r * 0.65}
                    width={n.r * 1.3}
                    height={n.r * 0.8}
                  />
                )}
                {n.r > 14 && (
                  <text x={n.x} y={n.y + n.r * 0.28} textAnchor="middle">
                    {number.format(n.data.count)}
                  </text>
                )}
                <title>
                  {lotLabel(n.data.bbl)}: {number.format(n.data.count)} reports
                </title>
              </g>
            ))}
          </svg>
          <p className="chart-note">
            A tax lot is a parcel, which may contain multiple buildings. Repeat
            reports do not count distinct rats or prove a persistent
            infestation.
          </p>
        </div>
        <div className="burrow-selection">
          {current ? (
            <>
              <span className="eyebrow">A CLOSER LOOK / BBL {current.bbl}</span>
              <h3>{lotLabel(current.bbl)}</h3>
              <strong>
                {number.format(current.count)}
                <small> reports in this selection</small>
              </strong>
              <p>
                Reported ZIP: {current.zip || "Unavailable"}. The map assigns
                each lot to its most frequently reported ZIP in the selected
                period, so a lot is counted once.
              </p>
              <ol>
                {summary.properties.slice(0, 5).map((p) => (
                  <li key={p.bbl}>
                    <button
                      onClick={() => setSelected(p.bbl)}
                      aria-pressed={current.bbl === p.bbl}
                    >
                      <span>{p.bbl}</span>
                      <b>{number.format(p.count)}</b>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p>No valid property IDs in this selection.</p>
          )}
        </div>
      </div>
      {current && range && (
        <div className="burrow-trend">
          <h3>The reporting trail for this lot.</h3>
          <Trend
            months={propertyTimeline(current, ...range)}
            borough={`tax lot ${current.bbl}`}
          />
        </div>
      )}
    </div>
  );
}

export function InspectionPanel({ details, summary, kind, setKind, onMap }) {
  const labels = {
    passed: "Passed",
    rats: "Rat signs found",
    other: "Failed for other reasons",
    unknown: "Unclassified result",
  };
  const colors = {
    passed: "#497564",
    rats: "#a76245",
    other: "#8b7845",
    unknown: "#687065",
  };
  return (
    <div className="inspection-panel" data-testid="inspection-panel">
      <div className="inspection-intro">
        <div>
          <span className="eyebrow">THE INSPECTOR’S EYE</span>
          <h3>Reports are a starting point. Findings add context.</h3>
          <p>
            Initial inspections can follow complaints or proactive surveys.
            Compliance inspections revisit properties after failed inspections.
            These are different groups of visits.
          </p>
        </div>
        <div role="group" aria-label="Inspection stage" className="segmented">
          {["Initial", "Compliance"].map((type) => (
            <button
              key={type}
              onClick={() => setKind(type)}
              aria-pressed={kind === type}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
      <div className="insight-stats">
        <div>
          <span className="eyebrow">
            {kind.toUpperCase()} INSPECTION RECORDS
          </span>
          <strong data-testid="inspection-total">
            {number.format(summary.total)}
          </strong>
          <small>Exact duplicate records removed</small>
        </div>
        <div>
          <span className="eyebrow">WITH ACTIVE RAT SIGNS</span>
          <strong data-testid="inspection-positive">
            {number.format(summary.positive)}
          </strong>
          <small>Includes combined rat and other failures</small>
        </div>
        <div>
          <span className="eyebrow">RAT-POSITIVE SHARE</span>
          <strong>{percent(summary.rate)}</strong>
          <small>
            Of {number.format(summary.classified)} classified{" "}
            {kind.toLowerCase()} records
          </small>
        </div>
      </div>
      <div className="inspection-results">
        {Object.entries(labels)
          .filter(([key]) => key !== "unknown" || summary.outcomes.unknown > 0)
          .map(([key, label]) => (
            <div className="inspection-result" key={key}>
              <div>
                <span>
                  <i style={{ background: colors[key] }} />
                  {label}
                </span>
                <b className="mono">{number.format(summary.outcomes[key])}</b>
              </div>
              <span className="habitat-track">
                <span
                  style={{
                    width: `${summary.total ? (summary.outcomes[key] / summary.total) * 100 : 0}%`,
                    background: colors[key],
                  }}
                />
              </span>
            </div>
          ))}
      </div>
      <div className="inspection-actions">
        <span className="eyebrow">
          SEPARATELY RECORDED ACTIONS / SAME DATES AND BOROUGH
        </span>
        <div>
          <span>
            <b>{number.format(summary.actions.bait)}</b> bait applications
          </span>
          <span>
            <b>{number.format(summary.actions.monitoring)}</b> monitoring visits
          </span>
          <span>
            <b>{number.format(summary.actions.cleanup)}</b> cleanups
          </span>
        </div>
        <p>
          Actions are not a conversion funnel from the reports above. Several
          visits may concern the same property, and not every rat report has a
          linked inspection.
        </p>
      </div>
      <div className="inspection-foot">
        <p>
          Inspection data through {dateLabel(details.inspections.coverage.to)}.
          More inspection activity can produce more findings; this is not a
          citywide estimate of infestation prevalence.
        </p>
        <button onClick={onMap} className="primary-link">
          Show findings on the map <span>↗</span>
        </button>
      </div>
    </div>
  );
}

export default function Insights({
  resource,
  start,
  end,
  borough,
  burrows,
  inspections,
  inspectionKind,
  setInspectionKind,
  onMap,
  onCoverage,
  onRetry,
}) {
  const [tab, setTab] = useState(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    return ["habitats", "burrows", "inspections"].includes(view)
      ? view
      : "habitats";
  });
  const buttons = useRef([]);
  const tabs = [
    ["habitats", "Rat habitats"],
    ["burrows", "Repeat burrows"],
    ["inspections", "Inspection findings"],
  ];
  const details = resource.data;
  const range = details
    ? detailRange(
        tab === "inspections" ? details.inspections.coverage : details.coverage,
        start,
        end,
      )
    : null;
  function selectTab(id) {
    setTab(id);
    const url = new URL(window.location.href);
    if (id === "habitats") url.searchParams.delete("view");
    else url.searchParams.set("view", id);
    window.history.replaceState(null, "", url);
  }
  function moveTab(e, index) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? 2
          : (index + (e.key === "ArrowRight" ? 1 : 2)) % 3;
    selectTab(tabs[next][0]);
    buttons.current[next].focus();
  }
  return (
    <section
      className="insights shell"
      id="deeper"
      aria-labelledby="insight-title"
    >
      <div className="section-heading">
        <div>
          <div className="eyebrow">02 / BELOW THE SIDEWALK</div>
          <h2 id="insight-title">There’s more to the story.</h2>
          <p>
            Where reports happen. How often places reappear. What inspectors
            find.
          </p>
        </div>
        <span className="mono small-label">
          LINKED TO YOUR DATES AND BOROUGH
        </span>
      </div>
      <div
        className="insight-tabs"
        role="tablist"
        aria-label="Additional data views"
      >
        {tabs.map(([id, label], i) => (
          <button
            key={id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            role="tab"
            id={`tab-${id}`}
            aria-controls={`panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => selectTab(id)}
            onKeyDown={(e) => moveTab(e, i)}
          >
            <span className="mono">0{i + 1}</span>
            {label}
          </button>
        ))}
      </div>
      <div
        className="insight-content panel"
        role="tabpanel"
        tabIndex={0}
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {resource.loading ? (
          <div className="detail-message" aria-live="polite">
            <Rat />
            <h3>Following a few more trails…</h3>
            <p>Loading the published habitat, tax-lot, and inspection data.</p>
          </div>
        ) : resource.error ? (
          <div className="detail-message">
            <h3>The extra data couldn’t load.</h3>
            <p>
              The sightings atlas is still available. Retry loading these
              additional views.
            </p>
            <button className="primary-link" onClick={onRetry}>
              Retry additional data
            </button>
          </div>
        ) : !range ? (
          <div className="detail-message">
            <h3>This view begins in 2020.</h3>
            <p>
              Your selected dates do not overlap the available detail coverage.
            </p>
            <button className="primary-link" onClick={onCoverage}>
              Explore available detail dates
            </button>
          </div>
        ) : (
          <>
            <div className="detail-coverage mono">
              {borough.toUpperCase()} / {monthLabel(range[0], true)} —{" "}
              {monthLabel(range[1], true)}
              <span>
                {start < range[0] || end > range[1]
                  ? "Selection clipped to available data"
                  : "Detail coverage begins in 2020"}
              </span>
            </div>
            {tab === "habitats" ? (
              <Habitats
                details={details}
                start={start}
                end={end}
                borough={borough}
              />
            ) : tab === "burrows" ? (
              <Burrows
                details={details}
                summary={burrows}
                start={start}
                end={end}
              />
            ) : (
              <InspectionPanel
                details={details}
                summary={inspections}
                kind={inspectionKind}
                setKind={setInspectionKind}
                onMap={onMap}
              />
            )}
          </>
        )}
      </div>
      {tabs
        .filter(([id]) => id !== tab)
        .map(([id]) => (
          <div
            key={id}
            role="tabpanel"
            id={`panel-${id}`}
            aria-labelledby={`tab-${id}`}
            hidden
          />
        ))}
    </section>
  );
}
