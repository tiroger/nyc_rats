import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  area,
  line,
  curveMonotoneX,
  scaleLinear,
  scalePoint,
  max,
  scaleSequential,
  interpolateYlGn,
  pointer,
} from "d3";
import {
  BOROUGHS,
  COLORS,
  number,
  compact,
  monthLabel,
  summarize,
} from "../lib/data.mjs";
import Rat from "./Rat.jsx";
import { useCityPlay } from "./CityPlay.jsx";
import { Odometer, useInView, useTween } from "./Motion.jsx";
import { BoroughBullet } from "./Wayfinding.jsx";

// Points a callout at the busiest month in view, and at the citywide record
// when it falls inside the period.
function peakCallouts(months, record) {
  if (months.length < 3) return [];
  const peak = months.reduce((a, b) => (b.count > a.count ? b : a));
  if (!peak.count) return [];
  const notes = [];
  const recordMonth = record && months.find((r) => r.month === record);
  if (recordMonth)
    notes.push({ month: record, text: "Citywide record", count: recordMonth.count });
  if (!recordMonth || recordMonth.month !== peak.month)
    notes.push({ month: peak.month, text: "Busiest month in view", count: peak.count });
  return notes;
}

export function Trend({ months, borough, record }) {
  const gradientId = useId();
  const { motion } = useCityPlay();
  const [active, setActive] = useState(null);
  const [heading, setHeading] = useState(1);
  const wrapRef = useRef(null);
  const drawn = useInView(wrapRef, { enabled: motion });
  const width = 650,
    height = 230,
    left = 42,
    right = 15,
    top = 38,
    bottom = 35;
  // The line morphs between selections of the same length; a new length
  // (another period) redraws it from the left instead.
  const series = useMemo(() => months.map((r) => r.count), [months]);
  const shownSeries = useTween(series, { duration: 650, enabled: motion });
  const values =
    shownSeries.length === months.length ? shownSeries : series;
  // Round the destination axis once and tween toward it. Rounding ("nice")
  // the tweened value every frame made the axis snap between scales and the
  // line jump each time it did.
  const target = scaleLinear()
    .domain([0, max(months, (r) => r.count) || 1])
    .nice(4);
  const shownTop = useTween(target.domain()[1], {
    duration: 650,
    enabled: motion,
  });
  const points = months.map((r, i) => ({ month: r.month, count: values[i] }));
  const x = scalePoint()
    .domain(months.map((r) => r.month))
    .range([left, width - right]);
  const y = scaleLinear()
    .domain([0, shownTop])
    .range([height - bottom, top]);
  // Final tick labels throughout; they glide into place as the axis settles.
  // Labels too close to the one below stay hidden until there is room.
  const ticksY = [];
  for (const t of target.ticks(4))
    if (t <= shownTop * 1.001 && (!ticksY.length || y(ticksY.at(-1)) - y(t) >= 14))
      ticksY.push(t);
  const shape = line()
    .x((r) => x(r.month))
    .y((r) => y(r.count))
    .curve(curveMonotoneX);
  const fill = area()
    .x((r) => x(r.month))
    .y0(height - bottom)
    .y1((r) => y(r.count))
    .curve(curveMonotoneX);
  const current =
    active === null ? null : months[Math.min(active, months.length - 1)];
  const currentIndex = current ? months.indexOf(current) : -1;
  // The rat leans with the slope under its feet.
  const lean = (() => {
    if (currentIndex < 0 || months.length < 2) return 0;
    const a = points[Math.max(0, currentIndex - 1)],
      b = points[Math.min(points.length - 1, currentIndex + 1)];
    const angle =
      (Math.atan2(y(b.count) - y(a.count), x(b.month) - x(a.month)) * 180) /
      Math.PI;
    return Math.max(-35, Math.min(35, angle));
  })();
  const callouts = peakCallouts(months, record);
  const drawKey = `${months.length}-${months[0]?.month}`;
  const tickStep = Math.max(1, Math.ceil((months.length - 1) / 5));
  const ticks = months.filter(
    (_, i) => i % tickStep === 0 || i === months.length - 1,
  );
  function move(e) {
    const [px] = pointer(e, e.currentTarget);
    const i =
      months.length === 1
        ? 0
        : Math.round(
            ((px - left) / (width - left - right)) * (months.length - 1),
          );
    const next = Math.max(0, Math.min(months.length - 1, i));
    if (active !== null && next !== active) setHeading(next > active ? 1 : -1);
    setActive(next);
  }
  return (
    <div className={`trend-wrap ${drawn ? "is-drawn" : "is-waiting"}`} ref={wrapRef}>
      <div className="chart-readout mono" aria-live="polite">
        {current
          ? `${monthLabel(current.month, true)} · ${number.format(current.count)} reports`
          : "Hover or focus to explore the monthly counts"}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Monthly rat-sighting reports for ${borough}. Use left and right arrow keys to inspect values.`}
        tabIndex={0}
        onPointerMove={move}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(0)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            setHeading(e.key === "ArrowRight" ? 1 : -1);
            setActive(
              Math.max(
                0,
                Math.min(
                  months.length - 1,
                  (active ?? 0) + (e.key === "ArrowRight" ? 1 : -1),
                ),
              ),
            );
          }
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#799e70" stopOpacity=".35" />
            <stop offset="1" stopColor="#799e70" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {ticksY.map((t) => (
          <g key={t}>
            <line
              x1={left}
              x2={width - right}
              y1={y(t)}
              y2={y(t)}
              className="chart-grid"
            />
            <text
              x={left - 9}
              y={y(t) + 4}
              textAnchor="end"
              className="axis-label"
            >
              {compact.format(t)}
            </text>
          </g>
        ))}
        <g key={drawKey} className="trend-ink">
          <path
            d={fill(points)}
            fill={`url(#${gradientId})`}
            className="trend-area"
          />
          <path
            d={shape(points)}
            fill="none"
            stroke="#345f47"
            strokeWidth="2.5"
            pathLength="1"
            className="trend-line"
          />
        </g>
        {callouts.map((note, i) => {
          const px = x(note.month),
            py = y(values[months.findIndex((r) => r.month === note.month)]);
          const leftSide = px > width * 0.62;
          const tx = px + (leftSide ? -26 : 26),
            ty = Math.max(12, py - 16 - i * 14);
          return (
            <g
              key={`${note.month}-${note.text}`}
              className="trend-callout"
              style={{ "--callout-delay": `${0.9 + i * 0.2}s` }}
              aria-hidden="true"
            >
              <path
                d={`M${tx + (leftSide ? 4 : -4)},${ty + 3}Q${px + (leftSide ? -4 : 4)},${ty + 2} ${px},${py - 6}`}
                pathLength="1"
                className="callout-arrow"
              />
              <text
                x={tx + (leftSide ? 6 : -6)}
                y={ty}
                textAnchor={leftSide ? "end" : "start"}
                dx={leftSide ? -6 : 6}
                className="callout-text"
              >
                {note.text} · {compact.format(note.count)}
              </text>
            </g>
          );
        })}
        {months.length === 1 && (
          <circle
            cx={x(months[0].month)}
            cy={y(months[0].count)}
            r="5"
            fill="#345f47"
          />
        )}
        {ticks.map((r, i) => (
          <text
            key={r.month}
            x={x(r.month)}
            y={height - 10}
            textAnchor={
              i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"
            }
            className="axis-label"
          >
            {monthLabel(r.month, true)}
          </text>
        ))}
        {current && (
          <g>
            <line
              x1={x(current.month)}
              x2={x(current.month)}
              y1={top}
              y2={height - bottom}
              stroke="#345f47"
              strokeDasharray="3 4"
            />
            <circle
              cx={x(current.month)}
              cy={y(values[currentIndex])}
              r="3.5"
              fill="#dcf080"
              stroke="#263c2e"
              strokeWidth="1.5"
            />
            <g
              className="trend-rat"
              style={{
                transform: `translate(${x(current.month)}px, ${y(values[currentIndex])}px) rotate(${lean}deg) scaleX(${heading})`,
              }}
            >
              <Rat x="-17" y="-22" width="34" height="20" />
            </g>
          </g>
        )}
      </svg>
      <details className="data-table">
        <summary>View monthly data table</summary>
        <div className="table-scroll">
          <table>
            <caption>Monthly reports for {borough}</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Reports</th>
              </tr>
            </thead>
            <tbody>
              {months.map((r) => (
                <tr key={r.month}>
                  <th scope="row">{monthLabel(r.month)}</th>
                  <td>{number.format(r.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// Each rat has its own racing style, so they jostle before settling in.
const PACES = {
  Bronx: "cubic-bezier(.55,0,.25,1)",
  Brooklyn: "cubic-bezier(.3,.75,.3,1)",
  Manhattan: "cubic-bezier(.15,.95,.45,1)",
  Queens: "cubic-bezier(.7,.05,.3,1)",
  "Staten Island": "cubic-bezier(.4,.4,.2,1)",
};
const RACE_MS = 1500;

export function RatRace({ counts, borough, setBorough }) {
  const { motion } = useCityPlay();
  const raceRef = useRef(null);
  const started = useInView(raceRef, { enabled: motion });
  const [running, setRunning] = useState(false);
  const rows = useRef(new Map()),
    tops = useRef(new Map());
  const sorted = BOROUGHS.slice(0, 5)
    .map((name) => ({ name, count: counts[name] }))
    .sort((a, b) => b.count - a.count);
  const peak = max(sorted, (r) => r.count) || 1;
  const standings = sorted.map((r) => `${r.name}:${r.count}`).join();
  useEffect(() => {
    if (!motion || !started) return;
    setRunning(true);
    const timer = setTimeout(() => setRunning(false), RACE_MS);
    return () => clearTimeout(timer);
  }, [standings, started, motion]);
  // Rows that change rank glide to their new place (FLIP).
  useLayoutEffect(() => {
    for (const [name, node] of rows.current) {
      if (!node) continue;
      const top = node.offsetTop,
        before = tops.current.get(name);
      tops.current.set(name, top);
      if (motion && before !== undefined && before !== top)
        node.animate(
          [{ transform: `translateY(${before - top}px)` }, { transform: "none" }],
          { duration: 650, easing: "cubic-bezier(.2,.7,.2,1)" },
        );
    }
  }, [standings, motion]);
  const motionStyle = (name) =>
    motion
      ? { transitionDuration: `${RACE_MS}ms`, transitionTimingFunction: PACES[name] }
      : undefined;
  return (
    <div
      className={`rat-race ${running ? "is-racing" : ""} ${started ? "has-started" : ""}`}
      ref={raceRef}
    >
      {sorted.map((r, i) => {
        const share = started ? (r.count / peak) * 86 : 0;
        return (
          <button
            key={r.name}
            ref={(node) => rows.current.set(r.name, node)}
            className={`race-row ${borough === r.name ? "race-selected" : ""} ${i === 0 && r.count ? "race-leader" : ""}`}
            onClick={() => setBorough(borough === r.name ? "All NYC" : r.name)}
            aria-pressed={borough === r.name}
          >
            <span className="race-label">
              <span className="rank mono" aria-hidden="true">
                0{i + 1}
              </span>
              <BoroughBullet borough={r.name} size="sm" />
              <strong>{r.name}</strong>
              <span className="mono">
                <Odometer value={r.count} />
              </span>
            </span>
            <span className="race-track">
              <span
                className="race-fill"
                style={{
                  width: `${share}%`,
                  backgroundColor: COLORS[r.name],
                  ...motionStyle(r.name),
                }}
              />
              <span
                className="race-runner"
                style={{
                  left: `calc(${share}% - 8px)`,
                  color: COLORS[r.name],
                  ...motionStyle(r.name),
                }}
              >
                <Rat className="race-rat" />
                {i === 0 && r.count > 0 && (
                  <span className="race-flag" aria-hidden="true" />
                )}
              </span>
            </span>
          </button>
        );
      })}
      {counts.Unspecified > 0 && (
        <p className="chart-note">
          Also includes {number.format(counts.Unspecified)} reports with an
          unspecified borough.
        </p>
      )}
    </div>
  );
}

export function Seasonality({ data, borough, start, end, onSelect }) {
  const all = useMemo(
    () =>
      summarize(
        data,
        data.coverage.from.slice(0, 7),
        data.coverage.to.slice(0, 7),
        borough,
      ),
    [data, borough],
  );
  const counts = new Map(all.months.map((r) => [r.month, r.count]));
  const years = [...new Set(all.months.map((r) => r.month.slice(0, 4)))];
  const color = scaleSequential(interpolateYlGn).domain([
    0,
    max(all.months, (r) => r.count) || 1,
  ]);
  const [hovered, setHovered] = useState(null);
  const { motion } = useCityPlay();
  const gridRef = useRef(null);
  const revealed = useInView(gridRef, { enabled: motion });
  // Hovering one month lights up the same month in every year.
  const column = hovered?.slice(5);
  const columnPeak = column
    ? all.months
        .filter((r) => r.month.endsWith(`-${column}`))
        .reduce((a, b) => (b.count > a.count ? b : a))
    : null;
  return (
    <div className="seasonality">
      <div className="heatmap-readout mono" aria-live="polite">
        {hovered
          ? `${monthLabel(hovered)} · ${number.format(counts.get(hovered))} reports · busiest ${monthLabel(columnPeak.month).split(" ")[0]}: ${columnPeak.month.slice(0, 4)}`
          : "A whole city. A seasonal rhythm. Select a month to take a closer look."}
      </div>
      <div className="heatmap-scroll">
        <div
          ref={gridRef}
          className={`heatmap-grid ${motion ? (revealed ? "is-revealed" : "is-waiting") : ""} ${column ? "has-column" : ""}`}
        >
          <span />
          {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map(
            (m, i) => (
              <span className="heatmap-label mono" key={i}>
                {m}
              </span>
            ),
          )}
          {years.map((year, row) => (
            <div className="heatmap-year" key={year}>
              <span className="heatmap-label mono">{year}</span>
              {Array.from({ length: 12 }, (_, i) => {
                const month = `${year}-${String(i + 1).padStart(2, "0")}`,
                  exists = counts.has(month),
                  selected = month >= start && month <= end;
                return (
                  <button
                    key={month}
                    className={`heatmap-cell ${selected ? "in-range" : ""} ${column === month.slice(5) ? "same-month" : ""}`}
                    disabled={!exists}
                    style={{
                      backgroundColor: exists
                        ? color(counts.get(month))
                        : undefined,
                      "--wave": `${row * 45 + i * 14}ms`,
                    }}
                    aria-label={
                      exists
                        ? `${monthLabel(month)}, ${number.format(counts.get(month))} reports. Explore month.`
                        : `${monthLabel(month)}, no coverage`
                    }
                    aria-pressed={selected}
                    onMouseEnter={() => exists && setHovered(month)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => exists && setHovered(month)}
                    onBlur={() => setHovered(null)}
                    onClick={() => onSelect(month)}
                  >
                    <span className="sr-only">
                      {exists ? number.format(counts.get(month)) : "No data"}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="heatmap-key mono">
        <span>Fewer reports</span>
        <span className="green-ramp" />
        <span>More</span>
        <span className="heatmap-key-note">
          Outlined cells = selected period
        </span>
      </div>
    </div>
  );
}
