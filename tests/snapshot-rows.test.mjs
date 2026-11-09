import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SOURCE_IDS } from "../src/lib/data.mjs";
import {
  aggregateRows,
  apiRowsFromSnapshot,
  inSourcePeriod,
} from "../scripts/lib/snapshot-rows.mjs";

const snapshot = JSON.parse(
  await readFile(new URL("../public/data/sightings.json", import.meta.url), "utf8"),
);

test("reusing a source from the published snapshot reproduces its rows exactly", () => {
  for (const id of SOURCE_IDS) {
    const own = snapshot.rows.filter(([month]) => inSourcePeriod(id, month));
    assert.deepEqual(aggregateRows(apiRowsFromSnapshot(snapshot, id)), own, id);
  }
});

test("reused and fetched sources combine into the same snapshot rows", () => {
  const all = SOURCE_IDS.flatMap((id) => apiRowsFromSnapshot(snapshot, id));
  assert.deepEqual(aggregateRows(all), snapshot.rows);
});

test("reused archive totals match the recorded source count", () => {
  const archive = snapshot.sources.find((s) => s.id === SOURCE_IDS[0]);
  const rows = apiRowsFromSnapshot(snapshot, SOURCE_IDS[0]);
  assert.equal(rows.reduce((sum, r) => sum + Number(r.reports), 0), archive.reports);
});

test("unknown and unspecified boroughs keep their index on the round trip", () => {
  const rows = [
    { month: "2015-03-01T00:00:00.000", borough: "Unspecified", incident_zip: "", reports: "2" },
    { month: "2015-03-01T00:00:00.000", borough: "", incident_zip: "", reports: "1" },
    { month: "2015-03-01T00:00:00.000", borough: "BROOKLYN", incident_zip: "11211", reports: "4" },
  ];
  const once = aggregateRows(rows);
  assert.deepEqual(once, [
    ["2015-03", 1, "11211", 4],
    ["2015-03", 5, "", 3],
  ]);
  const twice = aggregateRows(
    apiRowsFromSnapshot({ rows: once, boroughs: snapshot.boroughs }, SOURCE_IDS[0]),
  );
  assert.deepEqual(twice, once);
});
