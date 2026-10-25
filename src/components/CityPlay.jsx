import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Rat from "./Rat.jsx";
import {
  monthLabel,
  monthOffset,
  number,
  periodMetrics,
  presetRange,
  summarize,
} from "../lib/data.mjs";
import {
  detailRange,
  summarizeBurrows,
  summarizeHabitats,
  summarizeInspections,
} from "../lib/details.mjs";

const CityContext = createContext(null);
const stamps = {
  pizza: "Pizza patron",
  sewer: "Sewer socialite",
  express: "Secret express",
  night: "Night-shift regular",
};
function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
const STAMP_COUNT = Object.keys(stamps).length;
export const useCityPlay = () => useContext(CityContext);

export function CityProvider({ children }) {
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [enabled, setEnabled] = useState(
    () => readStored("ratlas-motion", true) !== false,
  );
  const [found, setFound] = useState(() => {
    const stored = readStored("ratlas-secrets", []);
    return Array.isArray(stored)
      ? [...new Set(stored.filter((key) => Object.hasOwn(stamps, key)))]
      : [];
  });
  const [toast, setToast] = useState(null);
  const [express, setExpress] = useState(0);
  const motion = enabled && !reduced;
  const discover = (key) => {
    setFound((previous) =>
      previous.includes(key) ? previous : [...previous, key],
    );
    setToast({
      key,
      text: {
        pizza: "Pizza patron! One imaginary slice. One very happy local.",
        sewer: "Sewer socialite! Welcome to the club. Mind the tiny feet.",
        express:
          "Secret express! The Rat Local is making an unscheduled joyride.",
        night:
          "Night-shift regular! The map just clocked in after dark. The locals glow.",
      }[key],
    });
    if (key === "express") setExpress((previous) => previous + 1);
  };
  // Keyboard handling reads the latest callback without re-registering on every render.
  const discoverRef = useRef(discover);
  discoverRef.current = discover;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = motion ? "on" : "off";
    try {
      localStorage.setItem("ratlas-motion", JSON.stringify(enabled));
    } catch {
      /* Storage is optional. */
    }
  }, [enabled, motion]);
  useEffect(() => {
    try {
      localStorage.setItem("ratlas-secrets", JSON.stringify(found));
    } catch {
      /* Storage is optional. */
    }
  }, [found]);
  useEffect(() => {
    let buffer = "",
      last = 0;
    const onKey = (event) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        event.isComposing ||
        event.target.closest?.(
          "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
        )
      ) {
        buffer = "";
        return;
      }
      if (event.key.length !== 1) {
        buffer = "";
        return;
      }
      const now = Date.now();
      buffer = (
        (now - last < 5000 ? buffer : "") + event.key.toLowerCase()
      ).slice(-3);
      last = now;
      if (buffer === "rat") {
        discoverRef.current("express");
        buffer = "";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <CityContext.Provider
      value={{ motion, reduced, enabled, setEnabled, found, discover, express }}
    >
      {children}
      {toast && (
        <aside className="city-toast" aria-label="Rat Local discovery">
          <span className="route-bullet" aria-hidden="true">
            R
          </span>
          <div role="status" aria-live="polite" key={toast.key}>
            <strong>STAMP COLLECTED</strong>
            <p>{toast.text}</p>
            <a href="#city-corner">See your souvenir ticket ↗</a>
          </div>
          <button aria-label="Dismiss discovery" onClick={() => setToast(null)}>
            ×
          </button>
        </aside>
      )}
    </CityContext.Provider>
  );
}

export function MotionSwitch() {
  const { motion, reduced, setEnabled } = useCityPlay();
  return (
    <button
      className="motion-switch mono"
      aria-pressed={motion}
      disabled={reduced}
      onClick={() => setEnabled((value) => !value)}
    >
      <span aria-hidden="true">{motion ? "Ⅱ" : "▶"}</span> Motion{" "}
      {motion ? "on" : "off"}
      {reduced && (
        <span className="sr-only">
          ; follows your reduced-motion preference
        </span>
      )}
    </button>
  );
}

export function HeroRat() {
  const { discover } = useCityPlay();
  const [bites, setBites] = useState(0);
  return (
    <button
      className={`hero-rat-button ${bites ? "has-pizza" : ""}`}
      aria-label={
        bites
          ? "A slice of the good life. Feed the rat another imaginary slice ↗"
          : "Psst. Got pizza? Feed the rat an imaginary slice ↗"
      }
      onClick={() => {
        setBites((value) => value + 1);
        discover("pizza");
      }}
    >
      <span className="hero-rat-scene" key={bites}>
        <Rat className="hero-rat" />
        <svg className="pizza-slice" viewBox="0 0 65 70" aria-hidden="true">
          <path
            d="M7 12Q30-3 55 10L32 64Z"
            fill="var(--lime)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M7 12Q30-3 55 10"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <g fill="currentColor">
            <circle cx="25" cy="21" r="3" />
            <circle cx="39" cy="25" r="3" />
            <circle cx="30" cy="40" r="3" />
          </g>
        </svg>
      </span>
      <span className="pizza-hint mono">
        {bites ? "A SLICE OF THE GOOD LIFE. ↗" : "PSST. GOT PIZZA? ↗"}
      </span>
    </button>
  );
}

const stops = [
  ["street-level", "Street level"],
  ["explore", "Sightings"],
  ["deeper", "Below ground"],
  ["field-notes", "Field notes"],
  ["city-corner", "Local stop"],
  ["methodology", "Field guide"],
];
export function SubwayNav() {
  const [active, setActive] = useState(0);
  const { express } = useCityPlay();
  useEffect(() => {
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let next = 0;
        const marker = Math.min(window.innerHeight / 2, 500);
        stops.forEach(([id], index) => {
          if (
            document.getElementById(id)?.getBoundingClientRect().top <= marker
          )
            next = index;
        });
        setActive(next);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(document.querySelector("main"));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);
  return (
    <div className="rat-local">
      <div className="shell local-inner">
        <div className="local-brand">
          <span className="route-bullet" aria-hidden="true">
            R
          </span>
          <span className="mono">
            RAT LOCAL<small>A TOUR OF THE ATLAS</small>
          </span>
        </div>
        <nav className="local-stops" aria-label="Rat Local page stops">
          <span
            className={`local-train ${express ? "express-run" : ""}`}
            key={express}
            style={{ left: `${((active + 0.5) / stops.length) * 100}%` }}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </span>
          {stops.map(([id, label], index) => (
            <a
              href={`#${id}`}
              key={id}
              aria-current={active === index ? "location" : undefined}
            >
              <span className="station-dot" aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
        <MotionSwitch />
      </div>
    </div>
  );
}

function cityFacts(data, details) {
  const history = periodMetrics(
    summarize(data, ...presetRange("all", data.coverage)),
    data.coverage,
  );
  const facts = [
    {
      title: "A very long paper trail.",
      value: number.format(data.totalReports),
      text: "311 rat-sighting reports in the atlas. One report is a service request, not one rat.",
      dates: `${data.coverage.from} → ${data.coverage.to}`,
      link: "explore",
    },
    {
      title: "The record on the books.",
      value: number.format(history.peakCount),
      text: `${history.peakMonths.map((item) => monthLabel(item.month)).join(" and ")} ${history.peakMonths.length > 1 ? "share the" : "holds the"} citywide monthly reporting record in this snapshot.`,
      dates: `${data.coverage.from} → ${data.coverage.to}`,
      link: "explore",
    },
  ];
  if (!details) return facts;
  const end = monthOffset(data.coverage.to.slice(0, 7), -1),
    start = monthOffset(end, -11);
  const dates = `${monthLabel(start, true)} → ${monthLabel(end, true)} · complete months`;
  const habitats = summarizeHabitats(details, start, end);
  const top = habitats.groups.toSorted((a, b) => b.count - a.count)[0];
  const burrows = summarizeBurrows(details, start, end);
  if (habitats.total)
    facts.push({
      title: "Location, location, location.",
      value: `${Math.round((top.count / habitats.total) * 100)}%`,
      text: `Of covered reports listed ${top.name.toLowerCase()}, the largest location group. Unknown locations remain in the denominator.`,
      dates,
      link: "deeper",
    });
  facts.push({
    title: "Some addresses ring twice.",
    value: number.format(burrows.repeatProperties),
    text: `Tax lots with at least two reports, among ${number.format(burrows.propertyCount)} distinct lots with valid property IDs. Repeat reports do not confirm an infestation.`,
    dates,
    link: "deeper",
  });
  const range = detailRange(details.inspections.coverage, start, end);
  if (range) {
    const inspections = summarizeInspections(details, ...range);
    facts.push({
      title: "A different set of eyes.",
      value: number.format(inspections.positive),
      text: `Initial inspection records with rat activity, out of ${number.format(inspections.total)} initial records. Targeted inspections are not a citywide prevalence survey.`,
      dates: `${monthLabel(range[0], true)} → ${monthLabel(range[1], true)}${range[1] === details.inspections.coverage.to.slice(0, 7) ? " · latest inspection month may be partial" : ""}`,
      link: "deeper",
    });
  }
  return facts;
}

export function CityCorner({ data, details }) {
  const { found, discover } = useCityPlay();
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState(0);
  const facts = useMemo(() => cityFacts(data, details), [data, details]);
  const fact = facts[ticket % facts.length];
  return (
    <section
      className="city-corner shell"
      id="city-corner"
      aria-labelledby="city-title"
    >
      <div className="section-heading">
        <div>
          <div className="eyebrow">NEXT STOP / A LITTLE LOCAL COLOR</div>
          <h2 id="city-title">Only in New York.</h2>
          <p>
            Big city. Tiny neighbors. Take a fact, find a secret, enjoy the
            ride.
          </p>
        </div>
        <span className="local-sign mono">
          NO FARE.
          <br />
          PLENTY OF CHARACTER.
        </span>
      </div>
      <div className="city-play-grid">
        <article className="fact-ticket" aria-label="Citywide fact ticket">
          <div className="ticket-top mono">
            <span>RAT LOCAL / FACT TICKET</span>
            <span aria-hidden="true">
              № {String(ticket + 1).padStart(4, "0")}
            </span>
          </div>
          <div
            className="ticket-fact"
            key={`${ticket}-${facts.length}`}
            aria-live="polite"
            aria-atomic="true"
          >
            <h3>{fact.title}</h3>
            <strong>{fact.value}</strong>
            <p>{fact.text}</p>
            <span className="ticket-dates mono">
              CITYWIDE · ALL BOROUGHS
              <br />
              {fact.dates}
            </span>
          </div>
          <div className="ticket-bottom">
            <a href={`#${fact.link}`}>Explore the evidence ↗</a>
            <button onClick={() => setTicket((value) => value + 1)}>
              Another city fact ↻
            </button>
          </div>
        </article>
        <div className="sewer-club">
          <span className="eyebrow">SOMETHING’S HAPPENING UNDER HERE.</span>
          <div className={`manhole-scene ${open ? "is-open" : ""}`}>
            <div
              className="sewer-residents"
              id="sewer-residents"
              hidden={!open}
            >
              <Rat />
              <Rat />
              <span className="mono">
                SEWER SOCIAL CLUB
                <br />
                YOU’RE ON THE LIST.
              </span>
            </div>
            <button
              className="manhole-button"
              aria-label={`${open ? "Close the manhole" : "Lift the manhole"}: RATLAS NYC · LOCAL ACCESS`}
              aria-expanded={open}
              aria-controls="sewer-residents"
              onClick={() => {
                setOpen((value) => !value);
                if (!open) discover("sewer");
              }}
            >
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <defs>
                  <pattern
                    id="cover-grid"
                    width="16"
                    height="16"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M0 0H16V16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      opacity=".3"
                    />
                  </pattern>
                </defs>
                <circle
                  cx="100"
                  cy="100"
                  r="94"
                  fill="var(--paper)"
                  stroke="currentColor"
                  strokeWidth="5"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="83"
                  fill="url(#cover-grid)"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path d="M45 70H155V130H45Z" fill="var(--paper)" />
                <text x="100" y="94" textAnchor="middle">
                  RATLAS
                </text>{" "}
                <text
                  x="100"
                  y="117"
                  textAnchor="middle"
                  className="cover-small"
                >
                  NYC · LOCAL ACCESS
                </text>
                <path
                  d="M58 48H73M127 152H142"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <span className="manhole-caption mono">
            {open ? "SAY HELLO. THEN MIND THE GAP." : "LIFT FOR LOCAL ACCESS ↑"}
          </span>
        </div>
      </div>
      <div className="souvenir-ticket">
        <div>
          <span className="eyebrow">YOUR SOUVENIR / SAVED ON THIS DEVICE</span>
          <h3>
            {found.length === STAMP_COUNT
              ? "Honorary Rat Local rider."
              : "A few secrets between stops."}
          </h3>
          <p>
            {found.length === STAMP_COUNT
              ? "Four stamps. Unlimited curiosity. Welcome aboard."
              : `${found.length} of ${STAMP_COUNT} stamps collected. The atlas has a playful side.`}
          </p>
        </div>
        <ul aria-label="Collected stamps">
          {Object.entries(stamps).map(([key, label]) => (
            <li key={key} className={found.includes(key) ? "collected" : ""}>
              <span aria-hidden="true">{found.includes(key) ? "✓" : "?"}</span>
              {label}
              <span className="sr-only">
                : {found.includes(key) ? "collected" : "undiscovered"}
              </span>
            </li>
          ))}
        </ul>
        <details>
          <summary>Need a clue?</summary>
          <p>
            A skyline local is hungry. A round cover has a secret. The map’s
            compass knows the way to the night shift. And typing{" "}
            <kbd>R</kbd> <kbd>A</kbd> <kbd>T</kbd> outside a form control calls
            the express.
          </p>
          <button
            className="express-button text-button"
            onClick={() => discover("express")}
          >
            No keyboard? Call the secret express ↗
          </button>
        </details>
      </div>
    </section>
  );
}
