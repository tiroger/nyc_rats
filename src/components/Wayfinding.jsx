import { useEffect, useState } from "react";
import { COLORS } from "../lib/data.mjs";

// Our own wayfinding, in the spirit of the city's: bullets, lines, signs.
// Colors and letters are the atlas's (boroughs and sections), not MTA routes.
const ABBREVIATIONS = {
  "All NYC": "ALL",
  Bronx: "Bx",
  Brooklyn: "Bk",
  Manhattan: "M",
  Queens: "Q",
  "Staten Island": "SI",
  Unspecified: "?",
};
// Bullets use slightly deeper shades of the borough colors so their white
// letters meet contrast; pale Manhattan takes dark lettering instead.
const BULLET_COLORS = {
  ...COLORS,
  "All NYC": "#263c2e",
  Bronx: "#a8492b",
  Queens: "#67649a",
  "Staten Island": "#4b7385",
  Unspecified: "#6b6c61",
};
const DARK_TEXT = new Set(["Manhattan"]);

export function BoroughBullet({ borough, size = "md", out = false }) {
  const letters = ABBREVIATIONS[borough] || "?";
  return (
    <span
      className={`bullet bullet-${size} ${out ? "is-out" : ""}`}
      data-letters={letters.length}
      style={{
        "--bullet": BULLET_COLORS[borough] || "#263c2e",
        "--bullet-ink": DARK_TEXT.has(borough) ? "var(--ink)" : "#fff",
      }}
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}

// Each section of the page is a line with its own bullet.
export const LINES = {
  "street-level": { bullet: "0", color: "#f5f3e9", ink: "#263c2e" },
  explore: { bullet: "1", color: "#263c2e", ink: "#fff" },
  deeper: { bullet: "2", color: "#8a5a2b", ink: "#fff" },
  "field-notes": { bullet: "3", color: "#3d7c87", ink: "#fff" },
  "city-corner": { bullet: "R", color: "#dcf080", ink: "#263c2e" },
  methodology: { bullet: "4", color: "#5d6b78", ink: "#fff" },
};

// Stops on the Rat Local, with transfers to the views inside each section.
export const STOPS = [
  { id: "street-level", label: "Street level" },
  {
    id: "explore",
    label: "Sightings",
    transfers: [
      { href: "rat-map", label: "Map" },
      { href: "trend", label: "Trend" },
      { href: "race", label: "Race" },
    ],
  },
  {
    id: "deeper",
    label: "Below ground",
    transfers: [
      { href: "deeper", label: "Habitats", tab: "habitats" },
      { href: "deeper", label: "Burrows", tab: "burrows" },
      { href: "deeper", label: "Inspections", tab: "inspections" },
    ],
  },
  {
    id: "field-notes",
    label: "Field notes",
    transfers: [{ href: "season", label: "Rat season" }],
  },
  { id: "city-corner", label: "Local stop" },
  { id: "methodology", label: "Field guide" },
];

export function LineBullet({ id, size = "md" }) {
  const line = LINES[id];
  return (
    <span
      className={`bullet bullet-${size} line-bullet line-${id}`}
      data-letters="1"
      style={{ "--bullet": line.color, "--bullet-ink": line.ink }}
      aria-hidden="true"
    >
      {line.bullet}
    </span>
  );
}

// Below-ground transfers also switch the tab they lead to.
export function TransferLink({ transfer, ...props }) {
  return (
    <a
      href={`#${transfer.href}`}
      onClick={() => {
        if (transfer.tab)
          window.dispatchEvent(
            new CustomEvent("ratlas:tab", { detail: transfer.tab }),
          );
      }}
      {...props}
    >
      {transfer.label}
    </a>
  );
}

// A section header styled as station signage: black band, white rule,
// the section's bullet, and transfers to what's inside.
export function StationSign({ line, eyebrow, title, titleId, intro, aside }) {
  const stop = STOPS.find((s) => s.id === line);
  return (
    <div className="section-heading station-sign">
      <LineBullet id={line} size="lg" />
      <div className="sign-copy">
        <div className="eyebrow">{eyebrow}</div>
        <h2 id={titleId}>{title}</h2>
        {intro && <p>{intro}</p>}
      </div>
      {(stop?.transfers || aside) && (
        <div className="sign-aside">
          {stop?.transfers && (
            <p className="transfers mono">
              <span>TRANSFER</span>
              {stop.transfers.map((t) => (
                <TransferLink key={t.label} transfer={t} />
              ))}
            </p>
          )}
          {aside}
        </div>
      )}
    </div>
  );
}

// The daily data refresh is scheduled at 10:23 UTC (see the Pages workflow).
function untilRefresh(now) {
  const next = new Date(now);
  next.setUTCHours(10, 23, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const minutes = Math.ceil((next - now) / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
}

// The data ticker, as a platform countdown board.
export function CountdownBoard({ stale, through }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="ticker countdown-board">
      <div className="shell ticker-inner">
        <span className="board-route">
          <span className="route-bullet" aria-hidden="true">
            R
          </span>
          <span className={`live-dot ${stale ? "stale" : ""}`} />
          {stale ? "LAST PUBLISHED SNAPSHOT" : "REFRESHED DAILY"}
        </span>
        <span>NYC 311 · Rat-sighting reports</span>
        <span>Data through {through}</span>
        {!stale && (
          <span className="board-next">
            Next scheduled refresh <b>{untilRefresh(now)}</b>
          </span>
        )}
        <a href="#methodology">Know what you’re counting ↗</a>
      </div>
    </div>
  );
}
