import { useMemo, useState } from "react";
import { LORE, LORE_URL, loreTie } from "../lib/lore.mjs";
import Rat from "./Rat.jsx";

// The Rat Gazette: street lore clippings from Wikipedia, with our own data
// (or the fine print on a citation) alongside where it adds something.
export default function RatLore({ data }) {
  const [index, setIndex] = useState(0);
  const fact = LORE[index % LORE.length];
  const tie = useMemo(() => loreTie(fact, data), [fact, data]);
  const issue = String((index % LORE.length) + 1).padStart(2, "0");
  return (
    <article className="rat-lore" aria-label="Rat lore from Wikipedia">
      <header className="lore-masthead mono">
        <span>THE RAT GAZETTE</span>
        <span>STREET LORE · No. {issue} of {LORE.length}</span>
      </header>
      <div className="lore-body">
        <div className="lore-clipping" key={fact.id} aria-live="polite" aria-atomic="true">
          <span className="lore-era mono">{fact.era}</span>
          <h3>{fact.headline}</h3>
          <p>{fact.body}</p>
          {tie && (
            <p className={`lore-tie ${tie.kind === "Our data" ? "is-data" : ""}`}>
              <b className="mono">{tie.kind.toUpperCase()}</b>
              {tie.text}
            </p>
          )}
        </div>
        <figure className="lore-photo" aria-hidden="true">
          <div>
            <Rat />
          </div>
          <figcaption className="mono">FILE PHOTO · A LOCAL</figcaption>
        </figure>
      </div>
      <footer className="lore-foot">
        <a href={`${LORE_URL}#${fact.section}`} target="_blank" rel="noreferrer">
          From Wikipedia: {fact.section.replaceAll("_", " ")} ↗
        </a>
        <button onClick={() => setIndex((value) => value + 1)}>Next clipping ↻</button>
      </footer>
      <p className="lore-license">
        Paraphrased from Wikipedia's{" "}
        <a href={LORE_URL} target="_blank" rel="noreferrer">
          Rats in New York City
        </a>{" "}
        (CC BY-SA 4.0). Wikipedia cites its sources; follow the link to check them.
      </p>
    </article>
  );
}
