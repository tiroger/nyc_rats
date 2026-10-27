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
import { COLORS, compact, forD3, number } from "../lib/data.mjs";
import { easeInOutCubic } from "../lib/motion.mjs";
import { useCityPlay } from "./CityPlay.jsx";
import { useInView, useTween } from "./Motion.jsx";
import Rat from "./Rat.jsx";
import { BoroughBullet } from "./Wayfinding.jsx";

const W = 720,
  H = 555;
const EMPTY = {};
// Upper New York Harbor: where a rat sets off when nothing was selected yet.
const HARBOR = [-74.045, 40.672];

function Sparkline({ values }) {
  const peak = Math.max(1, ...values);
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * 116 + 2,
    26 - (v / peak) * 22,
  ]);
  const last = points.at(-1);
  return (
    <svg viewBox="0 0 120 30" className="hover-spark" aria-hidden="true">
      <polyline points={points.map((p) => p.join(",")).join(" ")} />
      <circle cx={last[0]} cy={last[1]} r="2.6" />
    </svg>
  );
}

function RatOMeter({ level }) {
  return (
    <span className="rat-o-meter" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Rat key={i} className={i < level ? "is-on" : undefined} />
      ))}
    </span>
  );
}

// A small rat that scurries along a hop-shaped curve to the chosen ZIP,
// leaving a dotted trail behind it.
function MapRunner({ run, scale, onDone }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let frame;
    const begin = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - begin) / run.duration);
      setT(p);
      if (p < 1) frame = requestAnimationFrame(step);
      else onDone();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
  const [[x0, y0], [x2, y2]] = [run.from, run.to];
  const dist = Math.hypot(x2 - x0, y2 - y0);
  const [x1, y1] = [(x0 + x2) / 2, (y0 + y2) / 2 - Math.max(28, dist * 0.35)];
  const e = easeInOutCubic(t),
    u = 1 - e;
  const x = u * u * x0 + 2 * u * e * x1 + e * e * x2;
  const y =
    u * u * y0 +
    2 * u * e * y1 +
    e * e * y2 -
    Math.abs(Math.sin(t * Math.PI * 7)) * 2.5 * (1 - t);
  const dx = 2 * u * (x1 - x0) + 2 * e * (x2 - x1),
    dy = 2 * u * (y1 - y0) + 2 * e * (y2 - y1);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const facing =
    dx >= 0 ? `rotate(${angle})` : `rotate(${angle - 180}) scale(-1,1)`;
  const w = 42 / scale,
    h = (w * 140) / 240;
  return (
    <g className="map-runner" aria-hidden="true">
      <path
        className="run-trail"
        d={`M${x0},${y0}Q${x1},${y1} ${x2},${y2}`}
        pathLength="1"
        strokeDasharray={`${e} 1`}
        strokeWidth={1.6 / scale}
      />
      <g transform={`translate(${x},${y}) ${facing}`}>
        <Rat x={-w / 2} y={-h * 0.85} width={w} height={h} />
      </g>
    </g>
  );
}

// Label each ringed ZIP beside its ring, nudging labels down so neighbours
// never print on top of each other.
function placeJumps(jumps, points, ringRadius, scale) {
  const placed = [];
  for (const j of jumps) {
    const p = points.get(j.zip);
    if (!p) continue;
    const r = ringRadius(j.zip);
    const lx = p[0] + r + 3 / scale;
    let ly = p[1] - r * 0.6;
    while (
      placed.some(
        (o) => Math.abs(o.lx - lx) < 46 / scale && Math.abs(o.ly - ly) < 11 / scale,
      )
    )
      ly += 11 / scale;
    placed.push({ ...j, p, r, lx, ly });
  }
  return placed;
}

export default function AtlasMap({
  geography,
  summary,
  borough,
  selectedZip,
  setSelectedZip,
  unit = "reports",
  scaleMaximum,
  emptyMessage,
  frame = null,
  quiet = false,
  trail,
}) {
  const { motion, night, setNight } = useCityPlay();
  const [mode, setMode] = useState("bubbles");
  const [transform, setTransform] = useState(zoomIdentity);
  const [hover, setHover] = useState(null);
  const [run, setRun] = useState(null);
  const [arrived, setArrived] = useState(null);
  const [jumps, setJumps] = useState([]);
  const [subway, setSubway] = useState({ on: false, data: null, error: false });
  const svgRef = useRef(null),
    zoomRef = useRef(null),
    canvasRef = useRef(null),
    lastPoint = useRef(null),
    lastFrame = useRef({ frame: null, counts: null }),
    lastBorough = useRef(new Map());
  const inView = useInView(canvasRef, { enabled: motion });
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
  // Shapes never change, so their path strings are built once, not per frame.
  const boroughShapes = useMemo(
    () =>
      boroughs.features.map((f) => ({
        name: f.properties.boro_name,
        d: path(f),
        bounds: path.bounds(f),
        centroid: path.centroid(f),
      })),
    [boroughs, path],
  );
  const zipShapes = useMemo(
    () =>
      zips.features.map((f, i) => ({
        key: `${f.properties.postalCode}-${i}`,
        zip: f.properties.postalCode,
        borough: f.properties.borough,
        d: path(f),
      })),
    [zips, path],
  );
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
  const points = useMemo(() => {
    const result = new Map();
    for (const [zip, info] of zipInfo) {
      const lon = Number(info.longitude),
        lat = Number(info.latitude);
      if (Number.isFinite(lon) && Number.isFinite(lat))
        result.set(zip, projection([lon, lat]));
    }
    return result;
  }, [zipInfo, projection]);
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
  const mapped = useMemo(
    () =>
      [...byZip.values()]
        .filter((r) => points.has(r.zip))
        .sort((a, b) => b.count - a.count),
    [byZip, points],
  );
  const ranks = useMemo(
    () => new Map(mapped.map((r, i) => [r.zip, i + 1])),
    [mapped],
  );
  const counts = useMemo(
    () => Object.fromEntries(mapped.map((r) => [r.zip, r.count])),
    [mapped],
  );
  for (const r of mapped) lastBorough.current.set(r.zip, r.borough);
  const mappedCount = mapped.reduce((s, r) => s + r.count, 0);
  const peak = scaleMaximum || max(mapped, (r) => r.count) || 1;
  const selected = selectedZip ? byZip.get(selectedZip) : null;

  // Bubbles ripple outward from the chosen borough (or the middle of the city).
  const rippleFrom =
    boroughShapes.find((b) => b.name === borough)?.centroid || [W / 2, H / 2];
  const shown = useTween(inView ? counts : EMPTY, {
    duration: 750,
    enabled: motion,
    initial: motion ? EMPTY : undefined,
    delay: (zip) => {
      const p = points.get(zip);
      if (!p) return 0;
      const d = Math.hypot(p[0] - rippleFrom[0], p[1] - rippleFrom[1]);
      return Math.min(1, d / 420) * 280;
    },
  });
  const shownPeak = useTween(peak, { duration: 750, enabled: motion });
  const scale = Math.sqrt(transform.k);
  const radius = scaleSqrt().domain([0, shownPeak]).range([0, 24]);
  const color = scaleSequential(interpolateYlOrBr).domain([0, shownPeak]);
  const ringRadius = (zip) => radius(counts[zip] || 0) / scale + 5 / scale;
  const ghosts = Object.keys(shown).filter(
    (zip) => !(zip in counts) && shown[zip] > 0 && points.has(zip),
  );

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

  // Choosing a borough flies the map over to it; All NYC pulls back out.
  useEffect(() => {
    const shape = boroughShapes.find((b) => b.name === borough);
    let target = zoomIdentity;
    if (shape) {
      const [[x0, y0], [x1, y1]] = shape.bounds;
      const k = Math.max(
        1,
        Math.min(4, 0.82 / Math.max((x1 - x0) / W, (y1 - y0) / H)),
      );
      target = zoomIdentity
        .translate(W / 2, H / 2)
        .scale(k)
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    }
    const svg = select(svgRef.current);
    if (motion)
      svg
        .transition()
        .duration(900)
        .ease(easeInOutCubic)
        .call(zoomRef.current.transform, target);
    else svg.interrupt().call(zoomRef.current.transform, target);
  }, [borough, boroughShapes]);

  // Send a rat from the last chosen ZIP (or the harbor) to the new one.
  useEffect(() => {
    const to = selectedZip && points.get(selectedZip);
    if (!to) {
      setRun(null);
      return;
    }
    const from = lastPoint.current || projection(HARBOR);
    lastPoint.current = to;
    if (!motion) return;
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    setRun({
      id: `${selectedZip}-${Date.now()}`,
      zip: selectedZip,
      from,
      to,
      duration: Math.round(Math.min(1000, Math.max(450, 350 + dist * 1.4))),
    });
  }, [selectedZip]);

  // Time Machine frames: ring the ZIPs with the biggest rise since last year.
  useEffect(() => {
    const previous = lastFrame.current;
    if (
      frame !== null &&
      previous.frame !== null &&
      previous.frame !== frame &&
      previous.counts
    )
      setJumps(
        Object.entries(counts)
          .map(([zip, count]) => ({
            zip,
            delta: count - (previous.counts[zip] || 0),
          }))
          .filter((j) => j.delta > 0)
          .sort((a, b) => b.delta - a.delta)
          .slice(0, 3)
          .map((j) => ({ ...j, frame })),
      );
    else setJumps([]);
    lastFrame.current = { frame, counts };
  }, [frame, counts]);

  // The subway layer is optional, so its geometry loads on first use.
  useEffect(() => {
    if (!subway.on || subway.data) return;
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}geo/subway.geojson`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Subway layer unavailable");
        return response.json();
      })
      .then((data) =>
        setSubway((value) => ({ ...value, data, error: false })),
      )
      .catch((error) => {
        if (error.name !== "AbortError")
          setSubway((value) => ({ ...value, error: true }));
      });
    return () => controller.abort();
  }, [subway.on, subway.data]);
  const subwayShapes = useMemo(() => {
    if (!subway.data) return null;
    const lines = subway.data.features.find(
      (f) => f.properties.kind === "lines",
    );
    return {
      d: path(lines),
      stations: subway.data.features
        .filter((f) => f.properties.kind === "station")
        .map((f) => projection(f.geometry.coordinates)),
    };
  }, [subway.data, path, projection]);

  const changeZoom = (factor) =>
    select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  const choose = (zip) => setSelectedZip(selectedZip === zip ? null : zip);
  // The compass is a shortcut to the site-wide Night shift.
  const toggleNight = () => setNight((value) => !value);
  const showHover = (zip) => (event) => {
    if (event.type === "pointerenter" && event.pointerType !== "mouse") return;
    if (byZip.has(zip) && points.has(zip)) setHover(zip);
  };
  const hideHover = () => setHover(null);
  const hoverRow = hover ? byZip.get(hover) : null;
  const hoverTrail = useMemo(
    () => (hover && trail ? trail(hover) : null),
    [hover, trail],
  );
  // The SVG letterboxes inside the canvas, so place the card from its real box.
  const hoverAt = (() => {
    const p = hover && points.get(hover);
    if (!p || !svgRef.current || !canvasRef.current) return null;
    const [x, y] = transform.apply(p);
    const box = svgRef.current.getBoundingClientRect(),
      canvas = canvasRef.current.getBoundingClientRect();
    const k = Math.min(box.width / W, box.height / H);
    return {
      x: box.left - canvas.left + (box.width - W * k) / 2 + x * k,
      y: box.top - canvas.top + (box.height - H * k) / 2 + y * k,
      width: canvas.width,
    };
  })();
  // The detail card and sniff ring wait for the rat to arrive.
  const arrivalDelay = `${run && run.zip === selectedZip ? run.duration : 0}ms`;
  const labels = [
    { name: "BRONX", pos: [-73.86, 40.865] },
    { name: "MANHATTAN", pos: [-74.025, 40.79], rotate: -61 },
    { name: "QUEENS", pos: [-73.8, 40.75] },
    { name: "BROOKLYN", pos: [-73.98, 40.64] },
    { name: "STATEN ISLAND", pos: [-74.15, 40.55] },
  ];
  const keyChoose = (zip) => (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(zip);
    }
  };

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
        <button
          className="subway-toggle"
          aria-pressed={subway.on}
          onClick={() => setSubway((value) => ({ ...value, on: !value.on }))}
        >
          <span className="subway-toggle-icon" aria-hidden="true">
            <i />
          </span>
          Subway lines
        </button>
        <span className="mono map-hint">Drag to explore · select a ZIP</span>
      </div>
      <p className="map-counts mono" data-testid="map-counts">
        {number.format(mappedCount)} {unit} mapped ·{" "}
        {number.format(summary.total - mappedCount)} without a matching ZIP
      </p>
      <div
        className={`map-canvas ${night ? "night-shift" : ""}`}
        ref={canvasRef}
      >
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
              <circle cx="1" cy="1" r=".65" className="water-dot" />
            </pattern>
            <radialGradient id="night-bubble">
              <stop offset="0" stopColor="#f4ffc4" />
              <stop offset="0.55" stopColor="#dcf080" />
              <stop offset="1" stopColor="#dcf080" stopOpacity="0.15" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#water)" />
          {frame !== null && (
            <text
              key={frame}
              x="32"
              y="98"
              className="ghost-year"
              aria-hidden="true"
            >
              {frame}
            </text>
          )}
          <g transform={transform.toString()}>
            {boroughShapes.map((b) => (
              <path
                key={b.name}
                d={b.d}
                className={`borough-shape ${borough === "All NYC" || borough === b.name ? "" : "is-muted"}`}
                fill={
                  borough === "All NYC" || borough === b.name
                    ? "#f6f4e9"
                    : "#d8e2da"
                }
              />
            ))}
            <g key={mode} className="layer-enter">
              {zipShapes.map(({ key, zip, borough: home, d }) => {
                const row = byZip.get(zip);
                const active = borough === "All NYC" || borough === home;
                const value = shown[zip] ?? 0;
                return (
                  <path
                    key={key}
                    d={d}
                    className={`zip-shape ${selectedZip === zip ? "zip-selected" : ""}`}
                    fill={
                      mode === "areas" && active && (row || value > 0)
                        ? color(value)
                        : "transparent"
                    }
                    fillOpacity={mode === "areas" ? 0.8 : 1}
                    onClick={() => row && choose(zip)}
                    role={mode === "areas" && row ? "button" : undefined}
                    tabIndex={mode === "areas" && row ? 0 : undefined}
                    onKeyDown={(e) => row && keyChoose(zip)(e)}
                    onPointerEnter={
                      mode === "areas" ? showHover(zip) : undefined
                    }
                    onPointerLeave={mode === "areas" ? hideHover : undefined}
                    onFocus={mode === "areas" ? showHover(zip) : undefined}
                    onBlur={mode === "areas" ? hideHover : undefined}
                    aria-label={
                      mode === "areas" && row
                        ? `ZIP ${zip}, ${number.format(row.count)} ${unit}`
                        : undefined
                    }
                  />
                );
              })}
              {mode === "bubbles" && (
                <g className="bubble-layer">
                  {ghosts.map((zip) => {
                    const [cx, cy] = points.get(zip);
                    return (
                      <circle
                        key={`ghost-${zip}`}
                        cx={cx}
                        cy={cy}
                        r={radius(shown[zip]) / scale}
                        fill={COLORS[lastBorough.current.get(zip)]}
                        className="bubble-ghost"
                        aria-hidden="true"
                      />
                    );
                  })}
                  {mapped.map((row) => {
                    const [cx, cy] = points.get(row.zip);
                    const r = radius(shown[row.zip] ?? 0) / scale;
                    return (
                      <circle
                        key={row.zip}
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={COLORS[row.borough]}
                        className={`report-bubble ${selectedZip === row.zip ? "bubble-selected" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => choose(row.zip)}
                        onKeyDown={keyChoose(row.zip)}
                        onPointerEnter={showHover(row.zip)}
                        onPointerLeave={hideHover}
                        onFocus={showHover(row.zip)}
                        onBlur={hideHover}
                        aria-label={`ZIP ${row.zip}, ${number.format(row.count)} ${unit}`}
                      />
                    );
                  })}
                </g>
              )}
            </g>
            {subway.on && subwayShapes && (
              <g className="subway-layer" aria-hidden="true">
                <path
                  d={subwayShapes.d}
                  pathLength="1"
                  className="subway-casing"
                />
                <path
                  d={subwayShapes.d}
                  pathLength="1"
                  className="subway-line"
                />
                {/* Stations appear once zoomed in; city-wide they crowd the lines. */}
                {transform.k >= 1.8 &&
                  subwayShapes.stations.map(([x, y], i) => (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={1.8 / scale}
                    strokeWidth={0.9 / scale}
                    className="subway-station"
                  />
                  ))}
              </g>
            )}
            {placeJumps(jumps, points, ringRadius, scale).map((j) => {
              const { p, r } = j;
              return (
                <g
                  key={`${j.frame}-${j.zip}`}
                  className="hotspot-jump"
                  aria-hidden="true"
                >
                  <circle cx={p[0]} cy={p[1]} r={r} className="jump-echo" />
                  <circle
                    cx={p[0]}
                    cy={p[1]}
                    r={r}
                    className="jump-ring"
                    strokeWidth={1.8 / scale}
                  />
                  <text
                    x={j.lx}
                    y={j.ly}
                    className="jump-label"
                    fontSize={9 / scale}
                  >
                    ▲ {compact.format(j.delta)}
                  </text>
                </g>
              );
            })}
            {selected && motion && points.has(selected.zip) && (
              <circle
                key={`sniff-${selected.zip}`}
                className="sniff-ring"
                cx={points.get(selected.zip)[0]}
                cy={points.get(selected.zip)[1]}
                r={radius(counts[selected.zip] || 0) / scale + 6 / scale}
                strokeWidth={2 / scale}
                style={{ "--sniff-delay": arrivalDelay }}
                aria-hidden="true"
              />
            )}
            {run && arrived !== run.id && (
              <MapRunner
                key={run.id}
                run={run}
                scale={scale}
                onDone={() => setArrived(run.id)}
              />
            )}
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
                  style={{
                    fontSize: 10 / transform.k,
                    letterSpacing: 2 / transform.k,
                    strokeWidth: 3 / transform.k,
                  }}
                >
                  {l.name}
                </text>
              );
            })}
          </g>
          <text x="25" y={H - 22} className="water-label">
            N E W Y O R K H A R B O R
          </text>
        </svg>
        <button
          className="compass-button"
          aria-pressed={night}
          aria-label="Night-shift map"
          title={night ? "Back to daylight" : "Night shift"}
          onClick={toggleNight}
        >
          <svg viewBox="-12 -20 24 36" aria-hidden="true">
            <text textAnchor="middle" y="-9">
              N
            </text>
            <path d="M0 0-5 14 0 10 5 14Z" fill="currentColor" />
          </svg>
        </button>
        {quiet && motion && (
          <div className="quiet-stretch" key={borough} aria-hidden="true">
            <span className="quiet-caption mono">
              QUIET STRETCH · FEWEST REPORTS OF THE FIVE · RAW COUNTS
            </span>
            <Rat className="lonely-rat" />
            <svg className="tumbleweed" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" />
              <path d="M7 15c9 6 18-8 26 2M6 24c10-3 17 9 28-1M14 6c-3 11 10 18 4 29M26 6c4 10-9 17-2 29M10 31c6-9 15-13 23-21" />
            </svg>
          </div>
        )}
        {hoverRow && hoverAt && (
          <div
            className={`hover-card ${hoverAt.y < 300 ? "below" : "above"} ${hoverAt.x > hoverAt.width - 160 ? "align-end" : hoverAt.x < 160 ? "align-start" : ""}`}
            style={{ left: hoverAt.x, top: hoverAt.y }}
            aria-hidden="true"
            data-testid="map-hover-card"
          >
            <span className="eyebrow hover-eyebrow">
              <BoroughBullet borough={hoverRow.borough} size="xs" />
              ZIP {hoverRow.zip} · {hoverRow.borough}
            </span>
            <strong>{hoverRow.info?.PO_NAME || hoverRow.borough}</strong>
            <span>
              <b>{number.format(hoverRow.count)}</b> {unit}
            </span>
            <span className="mono hover-rank">
              #{ranks.get(hoverRow.zip)} of {mapped.length} mapped ZIPs
            </span>
            {hoverTrail && hoverTrail.length > 2 && (
              <span className="hover-trail">
                <Sparkline values={hoverTrail} />
                <small className="mono">
                  LAST {hoverTrail.length} MONTHS OF THIS PERIOD
                </small>
              </span>
            )}
            <span className="hover-meter">
              <RatOMeter
                level={Math.max(
                  1,
                  Math.ceil(
                    ((mapped.length - ranks.get(hoverRow.zip) + 1) /
                      mapped.length) *
                      5,
                  ),
                )}
              />
              <small>
                Busier than{" "}
                {Math.round(
                  ((mapped.length - ranks.get(hoverRow.zip)) / mapped.length) *
                    100,
                )}
                % of mapped ZIPs
              </small>
            </span>
          </div>
        )}
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
            key={selected.zip}
            className="map-detail"
            role="status"
            aria-label="Selected ZIP details"
            style={{ "--detail-delay": arrivalDelay }}
          >
            <button
              className="detail-close"
              onClick={() => setSelectedZip(null)}
              aria-label="Close ZIP details"
            >
              ×
            </button>
            <span className="eyebrow detail-eyebrow">
              <BoroughBullet borough={selected.borough} size="xs" />
              ZIP {selected.zip}
            </span>
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
          {jumps.length
            ? " · rings mark the biggest rises since the last year shown"
            : ""}
          {subway.on &&
            (subway.error
              ? " · the subway layer couldn’t load"
              : " · subway lines are for orientation; nearness to a line doesn’t explain a ZIP’s reports")}
        </span>
      </div>
    </>
  );
}
