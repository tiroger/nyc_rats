import test from "node:test";
import assert from "node:assert/strict";
import {
  boroughIndex,
  detailRange,
  habitatFor,
  hotspotScale,
  inspectionOutcome,
  lotLabel,
  normalizeBBL,
  propertyTimeline,
  summarizeBurrows,
  summarizeHabitats,
  summarizeInspections,
  validateDetails,
} from "../src/lib/details.mjs";

const base = () => ({
  generatedAt: "2026-10-24T07:00:00Z",
  coverage: { from: "2010-01-01", to: "2026-10-23" },
  rows: [
    ["2019-01", 1, "11221", 100],
    ["2026-08", 1, "11221", 8],
    ["2026-09", 1, "11221", 6],
    ["2026-09", 2, "10025", 2],
    ["2026-10", 1, "", 3],
  ],
});
const fixture = () => ({
  schemaVersion: 1,
  generatedAt: "2026-10-24T07:10:00Z",
  baseGeneratedAt: base().generatedAt,
  coverage: { from: "2020-01-01", to: "2026-10-23" },
  locations: ["3+ Family Apt. Building", "Sidewalk", "Unknown"],
  habitatRows: [
    ["2026-08", 1, 0, 8],
    ["2026-09", 1, 1, 6],
    ["2026-09", 2, 0, 2],
    ["2026-10", 1, 2, 3],
  ],
  propertyRows: [
    ["2026-08", 1, "11221", "3000010001", 8],
    ["2026-09", 1, "11221", "3000010001", 4],
    ["2026-09", 1, "11221", "3000010002", 2],
    ["2026-09", 2, "10025", "1000010001", 2],
    ["2026-10", 1, "", "", 3],
  ],
  inspections: {
    source: { id: "p937-wjvj" },
    identityVersion: 1,
    coverage: { from: "2020-01-01", to: "2026-10-21" },
    types: ["Initial", "Compliance", "Treatments"],
    results: [
      "Passed",
      "Failed for Rat Activity",
      "Failed for Other Reason",
      "Unknown",
      "Failed for Rat Activity and Other Reason",
      "Bait applied",
    ],
    rawRecords: 120,
    events: 118,
    duplicateRecords: 2,
    unkeyedRecords: 1,
    rows: [
      ["2026-09", 1, "11221", 0, 0, 80],
      ["2026-09", 1, "11221", 0, 1, 10],
      ["2026-09", 1, "11221", 0, 2, 5],
      ["2026-09", 1, "11221", 0, 3, 5],
      ["2026-09", 1, "11221", 0, 4, 5],
      ["2026-09", 1, "11221", 1, 0, 2],
      ["2026-09", 1, "11221", 1, 1, 8],
      ["2026-09", 1, "11221", 2, 5, 3],
    ],
  },
});

test("habitat categories retain unknown and unrecognized locations without dropping reports", () => {
  const summary = summarizeHabitats(fixture(), "2026-08", "2026-10");
  assert.equal(summary.total, 19);
  assert.equal(summary.groups.find((g) => g.id === "apartments").count, 10);
  assert.equal(summary.groups.find((g) => g.id === "unknown").count, 3);
  assert.equal(
    summary.groups.reduce((s, g) => s + g.count, 0),
    summary.total,
  );
  assert.equal(habitatFor("3+ Family Mixed Use Building"), "apartments");
  assert.equal(habitatFor("1-2 Family Dwelling"), "homes");
  assert.equal(habitatFor("Catch Basin or Sewer"), "sewers");
  assert.equal(habitatFor("Future category"), "other");
  assert.equal(
    summarizeHabitats(fixture(), "2026-08", "2026-10", "Brooklyn").total,
    17,
  );
});

test("repeat-lot counts deduplicate across months and retain missing IDs in report coverage", () => {
  const summary = summarizeBurrows(fixture(), "2026-08", "2026-10");
  assert.equal(summary.totalReports, 19);
  assert.equal(summary.matchedReports, 16);
  assert.equal(summary.missingReports, 3);
  assert.equal(summary.propertyCount, 3);
  assert.equal(summary.repeatProperties, 3);
  assert.equal(summary.properties[0].count, 12);
  assert.deepEqual(
    propertyTimeline(summary.properties[0], "2026-08", "2026-10").map(
      (r) => r.count,
    ),
    [8, 4, 0],
  );
  assert.equal(
    summary.map.zips.reduce((s, z) => s + z.count, 0),
    3,
  );
  assert.equal(
    summarizeBurrows(fixture(), "2026-08", "2026-10", "Brooklyn").propertyCount,
    2,
  );
});

test("a lot reported in several ZIPs is assigned once to its dominant ZIP in the selected dates", () => {
  const details = fixture();
  details.propertyRows.push(["2026-09", 1, "11222", "3000010001", 5]);
  const all = summarizeBurrows(details, "2026-08", "2026-10");
  assert.equal(all.properties[0].zip, "11221");
  assert.equal(
    all.map.zips.reduce((s, z) => s + z.count, 0),
    all.propertyCount,
  );
  const september = summarizeBurrows(details, "2026-09", "2026-09");
  assert.equal(september.properties[0].zip, "11222");
  assert.equal(september.propertyCount, 3);
});

test("inspection rates include combined rat failures, exclude unclassified results, and separate stages", () => {
  const details = fixture();
  const initial = summarizeInspections(
    details,
    "2026-08",
    "2026-10",
    "Brooklyn",
    "Initial",
  );
  assert.equal(initial.total, 105);
  assert.equal(initial.positive, 15);
  assert.equal(initial.classified, 100);
  assert.equal(initial.rate, 0.15);
  assert.equal(initial.outcomes.other, 5);
  assert.equal(initial.outcomes.unknown, 5);
  assert.equal(initial.actions.bait, 3);
  assert.equal(initial.map.zips[0].count, 15);
  assert.equal(initial.map.zips[0].inspected, 105);
  assert.deepEqual(
    initial.months.map((r) => r.rats),
    [0, 15, 0],
  );
  const compliance = summarizeInspections(
    details,
    "2026-08",
    "2026-10",
    "Brooklyn",
    "Compliance",
  );
  assert.equal(compliance.total, 10);
  assert.equal(compliance.rate, 0.8);
  assert.equal(
    summarizeInspections(details, "2026-08", "2026-10", "Queens").rate,
    null,
  );
  assert.equal(inspectionOutcome("Active Rat Signs"), "rats");
  assert.equal(inspectionOutcome("Monitoring visit"), "unknown");
});

test("unsupported dates are unavailable rather than zero activity and property IDs are validated", () => {
  assert.equal(detailRange(fixture().coverage, "2010-01", "2019-12"), null);
  assert.deepEqual(detailRange(fixture().coverage, "2010-01", "2026-10"), [
    "2020-01",
    "2026-10",
  ]);
  assert.equal(normalizeBBL("3000010001.0"), "3000010001");
  assert.equal(normalizeBBL("0"), "");
  assert.equal(normalizeBBL("9000010001"), "");
  assert.equal(lotLabel("3000010001"), "Brooklyn · block 1, lot 1");
  assert.equal(boroughIndex("3"), boroughIndex("Brooklyn"));
});

test("hotspot map uses one annual ZIP scale across frames and combines borough fragments", () => {
  const sightings = {
    rows: [
      ["2020-01", 1, "11221", 5],
      ["2020-02", 1, "11221", 3],
      ["2021-01", 1, "11221", 2],
      ["2020-01", 5, "11221", 1],
      ["2020-01", 2, "10025", 12],
    ],
  };
  assert.equal(hotspotScale(sightings), 12);
  assert.equal(hotspotScale(sightings, "Brooklyn"), 8);
  assert.equal(hotspotScale(sightings, "Queens"), 1);
});

test("detail validation rejects stale snapshots, balanced geographic errors, and missing records", () => {
  assert.deepEqual(validateDetails(fixture(), base()), {
    reports: 19,
    inspectionEvents: 118,
  });
  const stale = fixture();
  stale.baseGeneratedAt = "2026-10-23T00:00:00Z";
  assert.throws(() => validateDetails(stale, base()), /does not match/);
  const geography = fixture();
  geography.propertyRows[0][2] = "11222";
  assert.throws(
    () => validateDetails(geography, base()),
    /month\/borough\/ZIP totals/,
  );
  const missing = fixture();
  missing.habitatRows[0][3]--;
  assert.throws(() => validateDetails(missing, base()), /Habitat totals/);
  const inspection = fixture();
  inspection.inspections.rows[0][5]--;
  assert.throws(() => validateDetails(inspection, base()), /Inspection totals/);
});
