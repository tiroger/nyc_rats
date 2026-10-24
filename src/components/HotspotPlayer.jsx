import { useEffect, useState } from "react";
import { useCityPlay } from "./CityPlay.jsx";

export default function HotspotPlayer({
  coverage,
  activeYear,
  onFrame,
  onReset,
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
      1200,
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
          <input
            type="range"
            min={first}
            max={last}
            value={year}
            onChange={(e) => {
              setPlaying(false);
              onFrame(Number(e.target.value));
            }}
          />
        </label>
        <output className="mono">{year}</output>
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
