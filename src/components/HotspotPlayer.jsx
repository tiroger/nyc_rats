import { useEffect, useState } from "react";
import { useCityPlay } from "./CityPlay.jsx";

// Each year holds the stage long enough for the map to blend into it.
const DWELL = 1700;

// Every month across the playable years, with the current year lit up and a
// playhead that sweeps through its months while the animation runs.
function YearTrack({ months, first, last, year, playing, active }) {
  const width = 300,
    height = 34;
  const span = (last - first + 1) * 12;
  const peak = Math.max(1, ...months.map((m) => m.count));
  const x = (i) => (i / (span - 1)) * width;
  const line = months
    .map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${(height - 3 - (m.count / peak) * (height - 8)).toFixed(1)}`)
    .join("");
  const bandX = x((year - first) * 12),
    bandW = x(11) - x(0);
  return (
    <svg
      className={`year-track ${active ? "is-active" : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect
        className="year-band"
        x={bandX}
        width={bandW}
        height={height}
        rx="2"
      />
      <path d={line} className="year-line" vectorEffect="non-scaling-stroke" />
      {active && (
        <line
          key={`${year}-${playing}`}
          className={`year-playhead ${playing ? "is-sweeping" : ""}`}
          x1={bandX}
          x2={bandX}
          y1="0"
          y2={height}
          style={{ "--sweep": `${bandW}px`, "--dwell": `${DWELL}ms` }}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

// The year slider drawn as a subway line: every year a station, a few
// labeled like express stops, and a train that pulls in to the current one.
// The native range input sits on top, invisible, so it keeps its keyboard and
// screen-reader behavior; stations sit where its thumb would.
function YearLine({ first, last, year, active }) {
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const at = (y) => (last === first ? 0.5 : (y - first) / (last - first));
  const place = (y) => ({
    left: `calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${at(y)})`,
  });
  return (
    <span className="year-stations" aria-hidden="true">
      <span className="year-stations-track" />
      {years.map((y) => (
        <span
          key={y}
          className={`year-station ${y === year ? "is-current" : ""} ${y === first || y === last || y % 5 === 0 ? "is-express" : ""}`}
          style={place(y)}
        >
          <i />
          {(y === first || y === last || y % 5 === 0) && y !== year && (
            <small>{y}</small>
          )}
        </span>
      ))}
      <span
        className={`year-train ${active ? "is-active" : ""}`}
        style={place(year)}
      >
        <span className="year-train-car">
          <i />
          <i />
          <i />
        </span>
        <b>’{String(year).slice(2)}</b>
      </span>
    </span>
  );
}

export default function HotspotPlayer({
  coverage,
  activeYear,
  onFrame,
  onReset,
  months = [],
}) {
  const first = Number(coverage.from.slice(0, 4));
  const last = Number(coverage.to.slice(0, 4)) - 1;
  const [playing, setPlaying] = useState(false);
  const { motion, reduced } = useCityPlay();
  useEffect(() => {
    if (!motion) setPlaying(false);
  }, [motion]);
  useEffect(() => {
    if (activeYear === null) setPlaying(false);
  }, [activeYear]);
  useEffect(() => {
    if (!playing || !motion) return;
    if (activeYear >= last) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(
      () => onFrame((activeYear ?? first - 1) + 1),
      DWELL,
    );
    return () => clearTimeout(timer);
  }, [playing, motion, activeYear, first, last, onFrame]);
  const year = activeYear ?? last;
  return (
    <div className="hotspot-player">
      <div className="player-title">
        <span className="eyebrow">THE HOTSPOT TIME MACHINE</span>
        <strong>
          {activeYear === null
            ? "A city that keeps changing."
            : `${activeYear} / resident reports`}
        </strong>
        <small>
          Complete years only · fixed map scale · changes in reports, not
          tracked rat movement
        </small>
      </div>
      <div className="player-controls">
        <button
          aria-label={
            playing ? "Pause hotspot animation" : "Play hotspot animation"
          }
          aria-pressed={playing}
          disabled={!motion || last < first}
          onClick={() => {
            if (playing) setPlaying(false);
            else {
              onFrame(
                activeYear === null || activeYear >= last ? first : activeYear,
              );
              setPlaying(true);
            }
          }}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <label>
          <span className="sr-only">Hotspot year</span>
          {months.length > 0 && (
            <YearTrack
              months={months}
              first={first}
              last={last}
              year={year}
              playing={playing && motion}
              active={activeYear !== null}
            />
          )}
          <span className="year-rail">
            <YearLine
              first={first}
              last={last}
              year={year}
              active={activeYear !== null}
            />
            <input
              type="range"
              className="year-input"
              min={first}
              max={last}
              value={year}
              onChange={(e) => {
                setPlaying(false);
                onFrame(Number(e.target.value));
              }}
            />
          </span>
        </label>
        <output className="mono">
          {activeYear === null && (
            <span className="year-preview">Year preview </span>
          )}
          {year}
        </output>
        <button
          aria-label="Next hotspot year"
          onClick={() => {
            setPlaying(false);
            onFrame(year >= last ? first : year + 1);
          }}
        >
          →
        </button>
      </div>
      {activeYear !== null && (
        <button
          className="player-reset text-button"
          onClick={() => {
            setPlaying(false);
            onReset();
          }}
        >
          Back to latest 12 months
        </button>
      )}
      {!motion && (
        <p className="player-reduced">
          {reduced ? "Reduced motion is on." : "Motion is paused."} Use the year
          slider or next-year button to explore.
        </p>
      )}
    </div>
  );
}
