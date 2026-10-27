import { useMemo, useState } from "react";
import Rat from "./Rat.jsx";
import { ANATOMY, SOURCES, STATS, TIMELINE, seasonalSwing, sourceLink } from "../lib/species.mjs";
import { number } from "../lib/data.mjs";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Know your neighbour: a field-guide specimen sheet for Rattus norvegicus.
export default function Species({ data }) {
  const [active, setActive] = useState(ANATOMY[0].id);
  const index = ANATOMY.findIndex((h) => h.id === active);
  const fact = ANATOMY[index];
  const swing = useMemo(() => seasonalSwing(data), [data]);
  return (
    <section className="species" id="species" aria-labelledby="species-title">
      <div className="species-head">
        <span className="eyebrow">KNOW YOUR NEIGHBOR / SPECIMEN No. 1</span>
        <h3 id="species-title">
          <i>Rattus norvegicus</i>
        </h3>
        <p>
          The brown rat, also called the Norway, sewer, wharf or street rat. Every
          rat in the atlas is one of these.
        </p>
      </div>
      <div className="species-sheet">
        <div className="anatomy">
          <div className="anatomy-figure">
            <Rat className="anatomy-rat" />
            {ANATOMY.map((h, i) => (
              <button
                key={h.id}
                className="anatomy-pin"
                style={{ left: `${(h.x / 240) * 100}%`, top: `${(h.y / 140) * 100}%` }}
                aria-pressed={active === h.id}
                aria-label={`${i + 1}. ${h.label}`}
                onClick={() => setActive(h.id)}
              >
                <span aria-hidden="true">{i + 1}</span>
              </button>
            ))}
          </div>
          <p className="anatomy-hint mono">Tap a number to examine the specimen.</p>
        </div>
        <div className="anatomy-note" key={fact.id} aria-live="polite" aria-atomic="true">
          <span className="mono">
            {String(index + 1).padStart(2, "0")} · {fact.label.toUpperCase()}
          </span>
          <h4>{fact.title}</h4>
          <p>{fact.text}</p>
          <a href={sourceLink(fact)} target="_blank" rel="noreferrer">
            Source: {SOURCES[fact.source].label} ↗
          </a>
        </div>
      </div>
      <dl className="species-stats">
        {STATS.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
        <div className="is-data">
          <dt>
            NYC reports, {MONTHS[swing.high].slice(0, 3)} vs {MONTHS[swing.low].slice(0, 3)}
          </dt>
          <dd>{swing.ratio.toFixed(1)}×</dd>
        </div>
      </dl>
      <p className="species-swing">
        <b className="mono">OUR DATA</b> The species can breed year-round when
        conditions allow, but New York's reports follow the seasons: {MONTHS[swing.high]}{" "}
        averages {number.format(Math.round(swing.highMean))} rat-sighting reports,{" "}
        {MONTHS[swing.low]} {number.format(Math.round(swing.lowMean))}. Reports
        measure people noticing rats as much as rats themselves.
      </p>
      <h4 className="timeline-title">How it got here</h4>
      <ol className="species-timeline" aria-label="Origin timeline of the brown rat">
        {TIMELINE.map((t) => (
          <li key={t.when}>
            <span className="station" aria-hidden="true" />
            <span className="when mono">{t.when}</span>
            <b>{t.title}</b>
            <p>{t.text}</p>
            <a href={sourceLink(t)} target="_blank" rel="noreferrer">
              {t.source === "paper" ? "Hulme-Beaman et al. 2021" : "Wikipedia"} ↗
            </a>
          </li>
        ))}
      </ol>
      <p className="species-credits">
        Facts paraphrased from Wikipedia's{" "}
        <a href={SOURCES.wiki.url} target="_blank" rel="noreferrer">
          Brown rat
        </a>{" "}
        (CC BY-SA 4.0) and Hulme-Beaman, Orton & Cucchi, “The origins of the
        domesticate brown rat (<i>Rattus norvegicus</i>) and its pathways to
        domestication,” <i>Animal Frontiers</i> 11(3): 78–86, 2021,{" "}
        <a href={SOURCES.paper.url} target="_blank" rel="noreferrer">
          doi:10.1093/af/vfab020
        </a>{" "}
        (CC BY 4.0).
      </p>
    </section>
  );
}
