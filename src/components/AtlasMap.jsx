import { useEffect, useMemo, useRef, useState } from "react";
import {
  geoMercator,
  geoPath,
  max,
  scaleSqrt,
  scaleSequential,
  interpolateYlOrBr,
  select,
  zoom,
  zoomIdentity,
} from "d3";
import { COLORS, forD3, number } from "../lib/data.mjs";

const W = 720,
  H = 555;
export default function AtlasMap({
  geography,
  summary,
  borough,
  selectedZip,
  setSelectedZip,
  unit = "reports",
  scaleMaximum,
  emptyMessage,
}) {
  const [mode, setMode] = useState("bubbles");
  const [transform, setTransform] = useState(zoomIdentity);
  const svgRef = useRef(null),
    zoomRef = useRef(null);
  const boroughs = useMemo(() => forD3(geography.boroughs), [geography]);
  const zips = useMemo(() => forD3(geography.zips), [geography]);
  const projection = useMemo(
    () =>
      geoMercator().fitExtent(
        [
          [55, 25],
          [W - 35, H - 35],
        ],
        boroughs,
      ),
    [boroughs],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const zipInfo = useMemo(
    () =>
      new Map(
        geography.zips.features.map((f) => [
          f.properties.postalCode,
          f.properties,
        ]),
      ),
    [geography],
  );
  const byZip = useMemo(() => {
    const entries = new Map();
    for (const r of summary.zips) {
      const prev = entries.get(r.zip);
      entries.set(r.zip, {
        ...r,
        count: (prev?.count || 0) + r.count,
        inspected: (prev?.inspected || 0) + (r.inspected || 0),
        classified: (prev?.classified || 0) + (r.classified || 0),
        info: zipInfo.get(r.zip),
      });
    }
    return entries;
  }, [summary, zipInfo]);
  const mapped = [...byZip.values()].filter(
    (r) =>
      r.info &&
      Number.isFinite(Number(r.info.longitude)) &&
      Number.isFinite(Number(r.info.latitude)),
  );
  const mappedCount = mapped.reduce((s, r) => s + r.count, 0);
  const peak = scaleMaximum || max(mapped, (r) => r.count) || 1;
  const radius = scaleSqrt().domain([0, peak]).range([0, 24]);
  const color = scaleSequential(interpolateYlOrBr).domain([0, peak]);
  const selected = selectedZip ? byZip.get(selectedZip) : null;

  useEffect(() => {
    const behavior = zoom()
      .scaleExtent([1, 5])
      .translateExtent([
        [-W * 0.3, -H * 0.3],
        [W * 1.3, H * 1.3],
      ])
      .filter(
        (event) => !event.ctrlKey && event.type !== "wheel" && !event.button,
      )
      .on("zoom", (event) => setTransform(event.transform));
    zoomRef.current = behavior;
    select(svgRef.current).call(behavior).on("dblclick.zoom", null);
    return () => {
      select(svgRef.current).on(".zoom", null);
    };
  }, []);

  const changeZoom = (factor) =>
    select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  const choose = (zip) => setSelectedZip(selectedZip === zip ? null : zip);
  const labels = [
    { name: "BRONX", pos: [-73.86, 40.865] },
    { name: "MANHATTAN", pos: [-74.025, 40.79], rotate: -61 },
    { name: "QUEENS", pos: [-73.8, 40.75] },
    { name: "BROOKLYN", pos: [-73.98, 40.64] },
    { name: "STATEN ISLAND", pos: [-74.15, 40.55] },
  ];

  return (
    <>
      <div className="map-toolbar">
        <div className="segmented" aria-label="Map style">
          {[
            ["bubbles", "Bubbles"],
            ["areas", "ZIP areas"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="mono map-hint">Drag to explore · select a ZIP</span>
      </div>
      <p className="map-counts mono" data-testid="map-counts">
        {number.format(mappedCount)} {unit} mapped ·{" "}
        {number.format(summary.total - mappedCount)} without a matching ZIP
      </p>
      <div className="map-canvas">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="atlas-svg"
          aria-label={`Map of ${borough} ${unit} by ZIP code`}
        >
          <defs>
            <pattern
              id="water"
              width="13"
              height="13"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".65" fill="#b1c9c4" opacity=".5" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#water)" />
          <g transform={transform.toString()}>
            {boroughs.features.map((f) => (
              <path
                key={f.properties.boro_name}
                d={path(f)}
                className="borough-shape"
                fill={
                  borough === "All NYC" || borough === f.properties.boro_name
                    ? "#f6f4e9"
                    : "#d8e2da"
                }
              />
            ))}
            {zips.features.map((f, i) => {
              const zip = f.properties.postalCode,
                row = byZip.get(zip);
              const active =
                borough === "All NYC" || borough === f.properties.borough;
              return (
                <path
                  key={`${zip}-${i}`}
                  d={path(f)}
                  className={`zip-shape ${selectedZip === zip ? "zip-selected" : ""}`}
                  fill={
                    mode === "areas" && active && row
                      ? color(row.count)
                      : "transparent"
                  }
                  fillOpacity={mode === "areas" ? 0.8 : 1}
                  onClick={() => row && choose(zip)}
                  role={mode === "areas" && row ? "button" : undefined}
                  tabIndex={mode === "areas" && row ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (row && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      choose(zip);
                    }
                  }}
                  aria-label={
                    row
                      ? `ZIP ${zip}, ${number.format(row.count)} ${unit}`
                      : undefined
                  }
                >
                  <title>
                    {zip}: {row ? number.format(row.count) : "0"} {unit}
                  </title>
                </path>
              );
            })}
            {mode === "bubbles" &&
              mapped
                .sort((a, b) => b.count - a.count)
                .map((row) => {
                  const [cx, cy] = projection([
                    Number(row.info.longitude),
                    Number(row.info.latitude),
                  ]);
                  return (
                    <circle
                      key={row.zip}
                      cx={cx}
                      cy={cy}
                      r={radius(row.count)}
                      fill={COLORS[row.borough]}
                      className={`report-bubble ${selectedZip === row.zip ? "bubble-selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => choose(row.zip)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          choose(row.zip);
                        }
                      }}
                      aria-label={`ZIP ${row.zip}, ${number.format(row.count)} ${unit}`}
                    >
                      <title>
                        {row.info.PO_NAME} · {row.zip}:{" "}
                        {number.format(row.count)} {unit}
                      </title>
                    </circle>
                  );
                })}
            {labels.map((l) => {
              const [x, y] = projection(l.pos);
              return (
                <text
                  key={l.name}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  transform={
                    l.rotate ? `rotate(${l.rotate},${x},${y})` : undefined
                  }
                  className="map-label"
                >
                  {l.name}
                </text>
              );
            })}
          </g>
          <g className="compass" transform={`translate(${W - 35},35)`}>
            <text textAnchor="middle" y="-9">
              N
            </text>
            <path d="M0 0-5 14 0 10 5 14Z" fill="currentColor" />
          </g>
          <text x="25" y={H - 22} className="water-label">
            N E W Y O R K H A R B O R
          </text>
        </svg>
        <div className="zoom-controls">
          <button aria-label="Zoom in" onClick={() => changeZoom(1.35)}>
            +
          </button>
          <button aria-label="Zoom out" onClick={() => changeZoom(1 / 1.35)}>
            −
          </button>
          <button
            aria-label="Reset map zoom"
            onClick={() =>
              select(svgRef.current).call(
                zoomRef.current.transform,
                zoomIdentity,
              )
            }
          >
            ↺
          </button>
        </div>
        {selected && (
          <div
            className="map-detail"
            role="status"
            aria-label="Selected ZIP details"
          >
            <button
              className="detail-close"
              onClick={() => setSelectedZip(null)}
              aria-label="Close ZIP details"
            >
              ×
            </button>
            <span className="eyebrow">ZIP {selected.zip}</span>
            <strong>{selected.info?.PO_NAME || selected.borough}</strong>
            <span>
              <b>{number.format(selected.count)}</b>{" "}
              {unit === "reports" ? "reported sightings" : unit}
            </span>
            {selected.inspected > 0 && (
              <span>
                Across {number.format(selected.inspected)} inspection records in
                this ZIP
              </span>
            )}
            <small>These totals do not count individual rats.</small>
          </div>
        )}
        {!summary.total && (
          <div className="map-empty">
            {emptyMessage || "No reports for this selection."}
          </div>
        )}
      </div>
      <div className="map-legend">
        {mode === "bubbles" ? (
          <>
            <svg viewBox="0 0 86 35" width="86" height="35" aria-hidden="true">
              <circle cx="18" cy="23" r="5" />
              <circle cx="43" cy="19" r="10" />
              <circle cx="72" cy="16" r="14" />
            </svg>
            <span>
              Circle area = {unit === "reports" ? "report count" : unit}
            </span>
          </>
        ) : (
          <>
            <span className="color-ramp" />
            <span>Fewer → more {unit}</span>
          </>
        )}
        <span className="legend-note">
          {number.format(mappedCount)} mapped ·{" "}
          {number.format(summary.total - mappedCount)} without a matching ZIP
          {scaleMaximum ? " · fixed year scale" : ""}
        </span>
      </div>
    </>
  );
}
