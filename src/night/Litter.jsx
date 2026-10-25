import { useMemo } from "react";
import { useCityPlay } from "../components/CityPlay.jsx";

// Hand-drawn curbside props for the Night shift. Decorative only (aria-hidden);
// piles marked data-hideout are where the street rats duck for cover.

function Bag({ tone = "#1c1f1b", x = 0, scale = 1, tilt = 0 }) {
  return (
    <svg
      className="litter-bag"
      viewBox="0 0 70 64"
      style={{ "--x": `${x}px`, "--s": scale, "--tilt": `${tilt}deg` }}
    >
      <path
        d="M10 60C2 52 4 34 14 26c6-5 12-6 16-9l-3-8c4-3 9-3 12 0l-2 8c5 3 12 4 18 10 10 10 10 28 3 33Z"
        fill={tone}
      />
      <path d="M27 9c4-3 9-3 12 0" stroke="#4d5146" strokeWidth="2.5" fill="none" />
      <path d="M18 33c3-5 8-8 13-9" stroke="#e8e0c4" strokeOpacity=".28" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M44 40c4 4 5 10 3 15" stroke="#000" strokeOpacity=".35" strokeWidth="2" fill="none" />
    </svg>
  );
}

function Can({ x = 0, tilt = 80 }) {
  return (
    <svg className="litter-can" viewBox="0 0 30 46" style={{ "--x": `${x}px`, "--tilt": `${tilt}deg` }}>
      <rect x="3" y="4" width="24" height="38" rx="4" fill="#9aa19a" />
      <rect x="3" y="14" width="24" height="16" fill="#b6402f" />
      <ellipse cx="15" cy="5" rx="12" ry="3.5" fill="#cfd3cc" />
      <path d="M8 10v30" stroke="#fff" strokeOpacity=".35" strokeWidth="2" />
      <path d="M19 24l5 7-4 3" stroke="#6a706a" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function PizzaBox({ x = 0 }) {
  return (
    <svg className="litter-box" viewBox="0 0 90 40" style={{ "--x": `${x}px` }}>
      <path d="M4 30 46 18l40 12-42 8Z" fill="#a77a48" />
      <path d="M4 30v4l40 6v-4Z" fill="#8a6239" />
      <path d="M44 36v4l42-6v-4Z" fill="#76532f" />
      <path d="M46 18 40 2 4 12l0 18Z" fill="#b98a55" />
      <ellipse cx="50" cy="29" rx="9" ry="3" fill="#5a3b1f" fillOpacity=".55" />
      <ellipse cx="22" cy="17" rx="6" ry="2.5" fill="#5a3b1f" fillOpacity=".4" transform="rotate(-14 22 17)" />
    </svg>
  );
}

function Newspaper({ x = 0 }) {
  return (
    <svg className="litter-paper" viewBox="0 0 60 26" style={{ "--x": `${x}px` }}>
      <path d="M2 18 30 6l28 10-26 8Z" fill="#cfc8b2" />
      <path d="M10 16 28 9M14 18l18-7M20 19l14-5" stroke="#6d6857" strokeWidth="1.5" />
    </svg>
  );
}

function Puddle({ width = 160 }) {
  return (
    <svg className="litter-puddle" viewBox="0 0 160 30" style={{ width }}>
      <defs>
        <radialGradient id="puddle-shine" cx="40%" cy="40%" r="70%">
          <stop offset="0" stopColor="#ffb257" stopOpacity=".45" />
          <stop offset=".45" stopColor="#2e3a3a" stopOpacity=".55" />
          <stop offset="1" stopColor="#0f1312" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="80" cy="15" rx="78" ry="12" fill="url(#puddle-shine)" />
      <ellipse className="puddle-ripple" cx="64" cy="14" rx="10" ry="2.5" fill="none" stroke="#ffcf8a" strokeOpacity=".4" />
    </svg>
  );
}

function Dumpster() {
  return (
    <div className="litter-dumpster">
      <svg viewBox="0 0 220 130" className="dumpster-body">
        <path d="M14 34h192l-12 86H26Z" fill="#2f4a3a" />
        <path d="M14 34h192l-2 12H16Z" fill="#3c5c49" />
        <path d="M40 50v58M80 50v58M120 50v58M160 50v58" stroke="#22362a" strokeWidth="5" />
        <path d="M30 70c20 10 48 4 70 12s70-2 90 6" stroke="#7a5a2c" strokeOpacity=".45" strokeWidth="9" fill="none" />
        <rect x="88" y="78" width="44" height="18" rx="2" fill="#1b2a21" />
        <text x="110" y="91" textAnchor="middle" fontFamily="Space Mono, monospace" fontSize="8" fill="#9db58d">NO RATS</text>
        <circle cx="40" cy="124" r="6" fill="#111" />
        <circle cx="180" cy="124" r="6" fill="#111" />
      </svg>
      <div className="dumpster-peek">
        <i />
        <i />
      </div>
      <svg viewBox="0 0 220 40" className="dumpster-lid">
        <path d="M8 30 110 8l102 22Z" fill="#26392d" />
        <path d="M8 30h204v6H8Z" fill="#1b2a21" />
      </svg>
    </div>
  );
}

function Steam() {
  return (
    <div className="litter-steam" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  );
}

const SPOTS = {
  hero: () => (
    <>
      <Bag tone="#191c18" x={0} scale={1.15} tilt={-6} />
      <Bag tone="#263425" x={46} scale={0.9} tilt={9} />
      <Can x={104} tilt={84} />
    </>
  ),
  map: () => (
    <>
      <Newspaper x={0} />
      <Can x={58} tilt={-78} />
    </>
  ),
  race: () => (
    <>
      <Bag tone="#1c1f1b" x={0} scale={0.85} tilt={7} />
      <PizzaBox x={50} />
    </>
  ),
  manhole: () => <Steam />,
  closing: () => <Dumpster />,
  footer: () => (
    <>
      <Puddle width={180} />
      <Can x={150} tilt={92} />
    </>
  ),
};

export function Litter({ spot }) {
  const { night } = useCityPlay();
  if (!night) return null;
  const Props = SPOTS[spot];
  return (
    <div
      className={`litter litter-${spot}`}
      aria-hidden="true"
      data-hideout={spot === "manhole" ? undefined : ""}
    >
      <Props />
    </div>
  );
}

// Buildings in the hero skyline (x0, x1, roof) from its path, so lit windows
// land on real facades.
const BUILDINGS = [
  [5, 35, 150], [35, 51, 105], [51, 65, 68], [65, 81, 105], [95, 123, 134],
  [123, 142, 161], [142, 159, 115], [159, 174, 76], [174, 190, 115],
  [201, 223, 99], [223, 243, 47], [243, 264, 99], [280, 304, 155],
  [304, 330, 125], [330, 347, 178], [347, 368, 103], [368, 388, 145], [388, 415, 130],
];

export function NightWindows() {
  const { night } = useCityPlay();
  const windows = useMemo(() => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const lit = [];
    for (const [x0, x1, top] of BUILDINGS)
      for (let y = top + 6; y < 192; y += 9)
        for (let x = x0 + 4; x < x1 - 4; x += 7)
          if (random() < 0.3)
            lit.push({ x, y, flicker: random() < 0.12, delay: random() * 6 });
    return lit;
  }, []);
  if (!night) return null;
  return (
    <g className="night-windows" aria-hidden="true">
      {windows.map((w, i) => (
        <rect
          key={i}
          x={w.x}
          y={w.y}
          width="3.4"
          height="4.4"
          className={w.flicker ? "window-flicker" : undefined}
          style={w.flicker ? { animationDelay: `${w.delay}s` } : undefined}
        />
      ))}
    </g>
  );
}
