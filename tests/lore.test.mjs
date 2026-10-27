import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LORE, LORE_URL, loreTie } from "../src/lib/lore.mjs";

const snapshot = JSON.parse(await readFile(new URL("../public/data/sightings.json", import.meta.url), "utf8"));
// Section anchors that exist in the pinned Wikipedia revision.
const SECTIONS = new Set(["Species", "Genetics", "Habits", "Food_and_shelter", "Public_health", "Control", "Governmental_attempts_to_mitigate_infestations", "Viral_videos", "Hurricane_Ida_depopulation_event", "Destruction_of_infrastructure"]);

test("every clipping is complete, unique and points at a real section", () => {
  assert.ok(LORE.length >= 10);
  assert.equal(new Set(LORE.map((f) => f.id)).size, LORE.length);
  for (const fact of LORE) {
    assert.ok(fact.headline && fact.body && fact.era, fact.id);
    assert.ok(SECTIONS.has(fact.section), `${fact.id}: ${fact.section}`);
  }
  assert.match(LORE_URL, /oldid=\d+$/);
});

test("data tie-ins are computed from the snapshot", () => {
  const year = (y) => snapshot.rows.filter((r) => r[0].startsWith(y)).reduce((n, r) => n + r[3], 0);
  const tie = loreTie(LORE.find((f) => f.id === "seventy-one"), snapshot);
  assert.match(tie.text, new RegExp(new Intl.NumberFormat("en-US").format(year("2020"))));
  assert.match(tie.text, new RegExp(new Intl.NumberFormat("en-US").format(year("2023"))));
  const ida = loreTie(LORE.find((f) => f.id === "ida"), snapshot).text;
  const sept = snapshot.rows.filter((r) => r[0] === "2021-09").reduce((n, r) => n + r[3], 0);
  assert.match(ida, new RegExp(new Intl.NumberFormat("en-US").format(sept)));
});
