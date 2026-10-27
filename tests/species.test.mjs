import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ANATOMY, SOURCES, STATS, TIMELINE, seasonalSwing, sourceLink } from "../src/lib/species.mjs";

const snapshot = JSON.parse(await readFile(new URL("../public/data/sightings.json", import.meta.url), "utf8"));

test("hotspots sit on the illustration and every fact names a known source", () => {
  assert.equal(new Set(ANATOMY.map((h) => h.id)).size, ANATOMY.length);
  for (const h of ANATOMY) {
    assert.ok(h.x > 0 && h.x < 240 && h.y > 0 && h.y < 140, h.id);
    assert.ok(SOURCES[h.source] && h.title && h.text, h.id);
  }
  for (const t of TIMELINE) assert.ok(SOURCES[t.source] && t.when && t.title && t.text, t.when);
  assert.ok(STATS.length >= 5);
  assert.match(SOURCES.wiki.url, /oldid=\d+$/);
});

test("source links point at the pinned revision's section, or the paper's DOI", () => {
  assert.match(sourceLink(ANATOMY.find((h) => h.id === "ear")), /oldid=\d+#Communication$/);
  assert.equal(sourceLink(TIMELINE[0]), "https://doi.org/10.1093/af/vfab020");
  assert.doesNotMatch(sourceLink(TIMELINE.at(-1)), /#$/);
});

test("the seasonal swing matches an independent average of complete months", () => {
  const swing = seasonalSwing(snapshot);
  const latest = snapshot.coverage.to.slice(0, 7);
  const july = new Map();
  for (const [m, , , c] of snapshot.rows) if (m < latest && m.endsWith("-07")) july.set(m, (july.get(m) || 0) + c);
  const julyMean = [...july.values()].reduce((a, b) => a + b, 0) / july.size;
  assert.equal(swing.high, 6, "July is the busiest month on average");
  assert.ok(Math.abs(swing.highMean - julyMean) < 1e-9);
  assert.ok(swing.ratio > 1);
});
