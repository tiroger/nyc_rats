import { useEffect, useMemo, useRef, useState } from "react";
import { useCityPlay } from "./CityPlay.jsx";
import { number } from "../lib/data.mjs";
import { blend, clamp01, easeOutCubic, tweenKeys } from "../lib/motion.mjs";

// True once the element has scrolled into view. Without motion (or without
// IntersectionObserver) everything counts as seen, so nothing waits to appear.
export function useInView(ref, { enabled = true, rootMargin = "0px 0px -12% 0px" } = {}) {
  const [seen, setSeen] = useState(
    () => !enabled || typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    if (seen || !enabled || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setSeen(true);
        observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [seen, enabled, rootMargin]);
  return seen || !enabled;
}

// Animate toward `target` (a number, number array, or record of numbers).
// `target` must keep its identity between renders unless it really changed.
// `delay(key)` staggers record keys or array indexes for ripple effects.
export function useTween(
  target,
  { duration = 700, delay, enabled = true, ease = easeOutCubic, initial } = {},
) {
  const [value, setValue] = useState(initial ?? target);
  const valueRef = useRef(initial ?? target);
  useEffect(() => {
    const from = valueRef.current;
    if (!enabled || from === target) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    const offsets = new Map(
      tweenKeys(from, target).map((key) => [key, delay ? delay(key) : 0]),
    );
    const longest = duration + Math.max(0, ...offsets.values());
    const begin = performance.now();
    let frame;
    const step = (now) => {
      const elapsed = now - begin;
      const next =
        elapsed >= longest
          ? target
          : blend(from, target, (key) =>
              ease(clamp01((elapsed - (offsets.get(key) || 0)) / duration)),
            );
      valueRef.current = next;
      setValue(next);
      if (elapsed < longest) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // The delay and easing are read when a new target arrives.
  }, [target, enabled, duration]);
  return enabled ? value : target;
}

// A subway-counter number: digits that change roll into place. The element's
// text is always the final value, so assistive tech and tests read it as-is.
export function Odometer({ value, text }) {
  const { motion } = useCityPlay();
  const label = text ?? (value === null ? "—" : number.format(value));
  const [roll, setRoll] = useState({ label, value, from: label, up: true });
  if (roll.label !== label)
    setRoll({
      label,
      value,
      from: roll.label,
      up: value === null || roll.value === null || value >= roll.value,
    });
  const chars = [...label],
    previous = [...roll.from];
  return (
    <span className="odometer">
      {chars.map((char, i) => {
        const place = chars.length - 1 - i;
        const before = previous[previous.length - 1 - place];
        const rolls =
          motion && roll.from !== label && before !== char && /\d/.test(char);
        return (
          <span
            key={`${place}-${char}`}
            className={
              rolls ? `odo-char ${roll.up ? "odo-up" : "odo-down"}` : "odo-char"
            }
            data-prev={rolls && before && /\d/.test(before) ? before : undefined}
            style={rolls ? { "--odo-delay": `${place * 40}ms` } : undefined}
          >
            <span>{char}</span>
          </span>
        );
      })}
    </span>
  );
}

// Words (a borough, a month) flip in when they change. Not on first paint.
export function FlipText({ text }) {
  const { motion } = useCityPlay();
  const [state, setState] = useState({ text, changes: 0 });
  if (state.text !== text) setState({ text, changes: state.changes + 1 });
  return (
    <span
      key={state.changes}
      className={motion && state.changes ? "flip-text" : undefined}
    >
      {text}
    </span>
  );
}

function Slice() {
  return (
    <svg viewBox="0 0 65 70" aria-hidden="true">
      <path
        d="M7 12Q30-3 55 10L32 64Z"
        fill="var(--lime)"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M7 12Q30-3 55 10"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <g fill="#c96747">
        <circle cx="25" cy="21" r="4" />
        <circle cx="39" cy="25" r="4" />
        <circle cx="30" cy="40" r="4" />
      </g>
    </svg>
  );
}

// A celebratory shower of imaginary pizza. Decorative; removed after landing.
export function PizzaConfetti({ count = 16 }) {
  const { motion } = useCityPlay();
  const [done, setDone] = useState(false);
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: `${(i / count) * 100 + Math.random() * 5}%`,
        delay: `${Math.round(Math.random() * 450)}ms`,
        spin: `${Math.round(Math.random() * 540 - 270)}deg`,
        drift: `${Math.round(Math.random() * 60 - 30)}px`,
        size: `${14 + Math.round(Math.random() * 12)}px`,
      })),
    [count],
  );
  useEffect(() => {
    const timer = setTimeout(() => setDone(true), 2600);
    return () => clearTimeout(timer);
  }, []);
  if (!motion || done) return null;
  return (
    <div className="pizza-confetti" aria-hidden="true">
      {pieces.map((piece, i) => (
        <span
          key={i}
          style={{
            left: piece.x,
            width: piece.size,
            "--delay": piece.delay,
            "--spin": piece.spin,
            "--drift": piece.drift,
          }}
        >
          <Slice />
        </span>
      ))}
    </div>
  );
}
