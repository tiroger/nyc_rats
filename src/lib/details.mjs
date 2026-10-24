import { BOROUGHS, monthSequence, number } from "./data.mjs";

export const DETAIL_START = "2020-01";
export const INSPECTION_ID = "p937-wjvj";
export const HABITATS = [
  {
    id: "apartments",
    name: "Apartment buildings",
    color: "#497564",
    description: "3+ family apartment and mixed-use buildings",
  },
  {
    id: "homes",
    name: "Smaller homes",
    color: "#8b7845",
    description: "1–2 family dwellings and mixed-use buildings",
  },
  {
    id: "streets",
    name: "Streets & sidewalks",
    color: "#608a9c",
    description: "Streets, sidewalks, and public stairs",
  },
  {
    id: "vacant",
    name: "Vacant properties",
    color: "#a76245",
    description: "Vacant lots and vacant buildings",
  },
  {
    id: "sewers",
    name: "Sewers & drainage",
    color: "#706e9b",
    description: "Catch basins and sewers",
  },
  {
    id: "other",
    name: "Other locations",
    color: "#64764d",
    description:
      "Businesses, gardens, schools, parking, and other reported locations",
  },
  {
    id: "unknown",
    name: "Unknown location",
    color: "#687065",
    description: "No location type supplied",
  },
];

export function boroughIndex(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  const numeric = {
    1: "MANHATTAN",
    2: "BRONX",
    3: "BROOKLYN",
    4: "QUEENS",
    5: "STATEN ISLAND",
  };
  const i = BOROUGHS.findIndex(
    (b) => b.toUpperCase() === (numeric[text] || text),
  );
  return i < 0 ? 5 : i;
}

export function normalizeBBL(value) {
  const text = String(value || "").replace(/\.0+$/, "");
  return /^[1-5]\d{9}$/.test(text) ? text : "";
}

export function habitatFor(value) {
  const text = (value || "").trim().toLowerCase();
  if (!text || ["unknown", "unspecified"].includes(text)) return "unknown";
  if (/^3\+ family/.test(text)) return "apartments";
  if (/^1-2 family/.test(text)) return "homes";
  if (/sidewalk|^street$|public stairs/.test(text)) return "streets";
  if (/vacant/.test(text)) return "vacant";
  if (/sewer|catch basin/.test(text)) return "sewers";
  return "other";
}

export function detailRange(coverage, start, end) {
  const from =
    start > coverage.from.slice(0, 7) ? start : coverage.from.slice(0, 7);
  const to = end < coverage.to.slice(0, 7) ? end : coverage.to.slice(0, 7);
  return from <= to ? [from, to] : null;
}

export function summarizeHabitats(details, start, end, borough = "All NYC") {
  const groups = HABITATS.map((h) => ({
    ...h,
    count: 0,
    locations: new Map(),
  }));
  const byId = new Map(groups.map((h) => [h.id, h]));
  let total = 0;
  for (const [month, b, category, count] of details.habitatRows) {
    if (
      month < start ||
      month > end ||
      (borough !== "All NYC" && BOROUGHS[b] !== borough)
    )
      continue;
    const label = details.locations[category];
    const group = byId.get(habitatFor(label));
    group.count += count;
    group.locations.set(label, (group.locations.get(label) || 0) + count);
    total += count;
  }
  return {
    total,
    groups: groups.map((h) => ({
      ...h,
      locations: [...h.locations]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    })),
  };
}

function dominant(counts) {
  return (
    [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] || ""
  );
}

export function summarizeBurrows(details, start, end, borough = "All NYC") {
  const properties = new Map();
  let totalReports = 0,
    missingReports = 0;
  for (const [month, b, zip, bbl, count] of details.propertyRows) {
    if (
      month < start ||
      month > end ||
      (borough !== "All NYC" && BOROUGHS[b] !== borough)
    )
      continue;
    totalReports += count;
    if (!bbl) {
      missingReports += count;
      continue;
    }
    const entry = properties.get(bbl) || {
      bbl,
      count: 0,
      months: new Map(),
      zipCounts: new Map(),
      boroughCounts: new Map(),
    };
    entry.count += count;
    entry.months.set(month, (entry.months.get(month) || 0) + count);
    if (/^\d{5}$/.test(zip))
      entry.zipCounts.set(zip, (entry.zipCounts.get(zip) || 0) + count);
    entry.boroughCounts.set(
      BOROUGHS[b],
      (entry.boroughCounts.get(BOROUGHS[b]) || 0) + count,
    );
    properties.set(bbl, entry);
  }
  const ranked = [...properties.values()]
    .map((p) => ({
      ...p,
      zip: dominant(p.zipCounts),
      borough: dominant(p.boroughCounts),
    }))
    .sort((a, b) => b.count - a.count || a.bbl.localeCompare(b.bbl));
  const zips = new Map();
  for (const p of ranked) {
    if (!p.zip) continue;
    const z = zips.get(p.zip) || { zip: p.zip, borough: p.borough, count: 0 };
    z.count += 1;
    zips.set(p.zip, z);
  }
  return {
    totalReports,
    missingReports,
    matchedReports: totalReports - missingReports,
    propertyCount: ranked.length,
    repeatProperties: ranked.filter((p) => p.count >= 2).length,
    properties: ranked,
    map: {
      total: ranked.length,
      zips: [...zips.values()].sort((a, b) => b.count - a.count),
    },
  };
}

export function lotLabel(bbl) {
  const borough =
    {
      1: "Manhattan",
      2: "Bronx",
      3: "Brooklyn",
      4: "Queens",
      5: "Staten Island",
    }[bbl[0]] || "NYC";
  return `${borough} · block ${Number(bbl.slice(1, 6))}, lot ${Number(bbl.slice(6))}`;
}

export function propertyTimeline(property, start, end) {
  return monthSequence(start, end).map((month) => ({
    month,
    count: property?.months.get(month) || 0,
  }));
}

export function inspectionOutcome(result) {
  const text = (result || "").toLowerCase();
  if (/rat activity|active rat signs/.test(text)) return "rats";
  if (/^pass/.test(text)) return "passed";
  if (/other reason|problem conditions/.test(text)) return "other";
  return "unknown";
}

export function summarizeInspections(
  details,
  start,
  end,
  borough = "All NYC",
  kind = "Initial",
) {
  const source = details.inspections;
  const outcomes = { passed: 0, rats: 0, other: 0, unknown: 0 };
  const zips = new Map();
  const months = new Map(
    monthSequence(start, end).map((month) => [
      month,
      { month, count: 0, rats: 0 },
    ]),
  );
  const actions = { bait: 0, monitoring: 0, cleanup: 0 };
  for (const [month, b, zip, t, r, count] of source.rows) {
    if (
      month < start ||
      month > end ||
      (borough !== "All NYC" && BOROUGHS[b] !== borough)
    )
      continue;
    const type = source.types[t],
      result = source.results[r];
    if (result === "Bait applied") actions.bait += count;
    if (result === "Monitoring visit") actions.monitoring += count;
    if (result === "Cleanup done") actions.cleanup += count;
    if (type !== kind) continue;
    const outcome = inspectionOutcome(result);
    outcomes[outcome] += count;
    const m = months.get(month);
    m.count += count;
    if (outcome === "rats") m.rats += count;
    if (/^\d{5}$/.test(zip)) {
      const z = zips.get(zip) || {
        zip,
        borough: BOROUGHS[b],
        count: 0,
        inspected: 0,
        classified: 0,
      };
      z.inspected += count;
      if (outcome !== "unknown") z.classified += count;
      if (outcome === "rats") z.count += count;
      zips.set(zip, z);
    }
  }
  const classified = outcomes.passed + outcomes.rats + outcomes.other;
  const total = classified + outcomes.unknown;
  return {
    total,
    classified,
    outcomes,
    positive: outcomes.rats,
    rate: classified ? outcomes.rats / classified : null,
    months: [...months.values()],
    actions,
    map: {
      total: outcomes.rats,
      zips: [...zips.values()]
        .filter((z) => z.count > 0)
        .sort((a, b) => b.count - a.count),
    },
  };
}

function validateRows(rows, keyLength, countIndex, indexes, coverage) {
  if (!Array.isArray(rows) || !rows.length)
    throw new Error("Missing detail aggregates");
  const seen = new Set();
  let total = 0;
  for (const row of rows) {
    if (
      row.length !== countIndex + 1 ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(row[0]) ||
      row[0] < coverage.from.slice(0, 7) ||
      row[0] > coverage.to.slice(0, 7)
    )
      throw new Error("Invalid detail date or row shape");
    if (
      !Number.isInteger(row[1]) ||
      row[1] < 0 ||
      row[1] >= BOROUGHS.length ||
      !Number.isSafeInteger(row[countIndex]) ||
      row[countIndex] <= 0
    )
      throw new Error("Invalid detail count or borough");
    for (const [position, size] of indexes)
      if (
        !Number.isInteger(row[position]) ||
        row[position] < 0 ||
        row[position] >= size
      )
        throw new Error("Invalid detail category index");
    const key = JSON.stringify(row.slice(0, keyLength));
    if (seen.has(key)) throw new Error("Duplicate detail aggregate");
    seen.add(key);
    total += row[countIndex];
  }
  return total;
}

export function validateDetails(details, sightings) {
  if (
    details.schemaVersion !== 1 ||
    details.baseGeneratedAt !== sightings.generatedAt
  )
    throw new Error("Additional data does not match this sightings snapshot");
  if (
    !Number.isFinite(Date.parse(details.generatedAt)) ||
    details.coverage.from !== "2020-01-01" ||
    details.coverage.to !== sightings.coverage.to
  )
    throw new Error("Invalid detail coverage");
  if (
    !Array.isArray(details.locations) ||
    new Set(details.locations).size !== details.locations.length
  )
    throw new Error("Invalid habitat categories");
  const expected = sightings.rows
    .filter((r) => r[0] >= DETAIL_START)
    .reduce((sum, r) => sum + r[3], 0);
  if (
    validateRows(
      details.habitatRows,
      3,
      3,
      [[2, details.locations.length]],
      details.coverage,
    ) !== expected
  )
    throw new Error("Habitat totals do not reconcile");
  if (
    validateRows(details.propertyRows, 4, 4, [], details.coverage) !== expected
  )
    throw new Error("Property totals do not reconcile");
  const baseZips = new Map(),
    baseBoroughs = new Map(),
    propertyZips = new Map(),
    habitatBoroughs = new Map();
  const add = (map, key, count) => {
    const k = JSON.stringify(key);
    map.set(k, (map.get(k) || 0) + count);
  };
  for (const r of sightings.rows)
    if (r[0] >= DETAIL_START) {
      add(baseZips, r.slice(0, 3), r[3]);
      add(baseBoroughs, r.slice(0, 2), r[3]);
    }
  for (const r of details.propertyRows) add(propertyZips, r.slice(0, 3), r[4]);
  for (const r of details.habitatRows)
    add(habitatBoroughs, r.slice(0, 2), r[3]);
  for (const [reference, actual] of [
    [baseZips, propertyZips],
    [baseBoroughs, habitatBoroughs],
  ]) {
    if (
      reference.size !== actual.size ||
      [...reference].some(([key, count]) => actual.get(key) !== count)
    )
      throw new Error("Detail month/borough/ZIP totals do not match sightings");
  }
  for (const row of details.propertyRows)
    if (
      typeof row[2] !== "string" ||
      typeof row[3] !== "string" ||
      (row[3] && !normalizeBBL(row[3]))
    )
      throw new Error("Invalid property ID or ZIP");
  const inspections = details.inspections;
  if (inspections.identityVersion !== 1)
    throw new Error("Unsupported inspection identity definition");
  if (
    inspections.source?.id !== INSPECTION_ID ||
    !Number.isFinite(Date.parse(inspections.coverage?.to)) ||
    inspections.coverage.from < "2020-01-01" ||
    inspections.coverage.to > details.coverage.to
  )
    throw new Error("Invalid inspection coverage");
  if (
    validateRows(
      inspections.rows,
      5,
      5,
      [
        [3, inspections.types.length],
        [4, inspections.results.length],
      ],
      inspections.coverage,
    ) !== inspections.events
  )
    throw new Error("Inspection totals do not reconcile");
  if (
    !Number.isSafeInteger(inspections.rawRecords) ||
    inspections.rawRecords < inspections.events ||
    inspections.duplicateRecords !== inspections.rawRecords - inspections.events
  )
    throw new Error("Invalid inspection duplicate accounting");
  return { reports: expected, inspectionEvents: inspections.events };
}

export function hotspotScale(sightings, borough = "All NYC") {
  const groups = new Map();
  for (const [month, b, zip, count] of sightings.rows) {
    if (borough !== "All NYC" && BOROUGHS[b] !== borough) continue;
    if (!/^\d{5}$/.test(zip)) continue;
    const key = `${month.slice(0, 4)}:${zip}`;
    groups.set(key, (groups.get(key) || 0) + count);
  }
  return Math.max(1, ...groups.values());
}

export const percent = (value) =>
  value === null ? "—" : `${number.format(Math.round(value * 1000) / 10)}%`;
