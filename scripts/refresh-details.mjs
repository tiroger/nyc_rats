import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { SOURCE_IDS, validateSnapshot } from "../src/lib/data.mjs";
import {
  boroughIndex,
  INSPECTION_ID,
  normalizeBBL,
  validateDetails,
} from "../src/lib/details.mjs";
import { query as sourceQuery, sourceWhere } from "./lib/socrata.mjs";
import { grouped, equalGroups } from "./lib/audit.mjs";
import {
  inspectionRecordCount,
  inspectionWhere,
  nextDay,
} from "./lib/detail-source.mjs";

const base = JSON.parse(
  await readFile(
    new URL("../public/data/sightings.json", import.meta.url),
    "utf8",
  ),
);
validateSnapshot(base);
const cutoff = nextDay(base.coverage.to);

// Optional developer-only response cache. CI always fetches current source data.
async function query(id, params, metadata = false) {
  const directory = process.env.RATLAS_DETAIL_CACHE;
  if (!directory || metadata) return sourceQuery(id, params, metadata);
  const key = createHash("sha256")
    .update(JSON.stringify([base.generatedAt, id, params]))
    .digest("hex");
  const path = join(directory, `${key}.json`);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const result = await sourceQuery(id, params);
  await mkdir(directory, { recursive: true });
  await writeFile(path, JSON.stringify(result));
  return result;
}

function add(map, key, count = 1) {
  const k = JSON.stringify(key);
  const row = map.get(k);
  if (row) row[row.length - 1] += count;
  else map.set(k, [...key, count]);
}
const sortRows = (rows) =>
  rows.sort((a, b) =>
    JSON.stringify(a.slice(0, -1)).localeCompare(
      JSON.stringify(b.slice(0, -1)),
    ),
  );

async function reportDetails() {
  const habitats = new Map(),
    properties = new Map(),
    totals = new Map(),
    ids = new Set();
  let offset = 0;
  for (;;) {
    const page = await query(SOURCE_IDS[1], {
      $select: "unique_key,created_date,borough,incident_zip,location_type,bbl",
      $where: `${sourceWhere(SOURCE_IDS[1])} AND created_date < '${cutoff}T00:00:00'`,
      $order: "unique_key ASC",
      $limit: "50000",
      $offset: String(offset),
    });
    if (!Array.isArray(page)) throw new Error("Invalid report detail response");
    for (const r of page) {
      if (!r.unique_key || ids.has(r.unique_key))
        throw new Error(
          "Missing or duplicate 311 request ID while fetching details",
        );
      ids.add(r.unique_key);
      const month = r.created_date.slice(0, 7),
        borough = boroughIndex(r.borough),
        zip = r.incident_zip || "";
      add(habitats, [month, borough, r.location_type?.trim() || "Unknown"]);
      add(properties, [month, borough, zip, normalizeBBL(r.bbl)]);
      const key = JSON.stringify([month, borough, zip]);
      totals.set(key, (totals.get(key) || 0) + 1);
    }
    console.log(`Fetched ${ids.size.toLocaleString()} unique report details`);
    if (page.length < 50000) break;
    offset += page.length;
  }
  const expected = grouped(
    base.rows.filter((r) => r[0] >= "2020-01"),
    (r) => r.slice(0, 3),
    (r) => r[3],
  );
  equalGroups(expected, totals, "Detailed 311 records");
  const locations = [
    ...new Set([...habitats.values()].map((r) => r[2])),
  ].sort();
  const locationIndex = new Map(locations.map((s, i) => [s, i]));
  return {
    locations,
    habitatRows: sortRows(
      [...habitats.values()].map((r) => [
        r[0],
        r[1],
        locationIndex.get(r[2]),
        r[3],
      ]),
    ),
    propertyRows: sortRows([...properties.values()]),
  };
}

async function inspectionDetails() {
  const metadata = await query(INSPECTION_ID, {}, true);
  const rows = [],
    totals = [];
  const years = Array.from(
    { length: Number(cutoff.slice(0, 4)) - 2020 + 1 },
    (_, i) => 2020 + i,
  ).filter((y) => `${y}-01-01` < cutoff);
  // Two source scans at a time; each year is small enough for one aggregate page.
  for (let i = 0; i < years.length; i += 2) {
    await Promise.all(
      years.slice(i, i + 2).map(async (year) => {
        const end = `${year + 1}-01-01` < cutoff ? `${year + 1}-01-01` : cutoff;
        const where = inspectionWhere(`${year}-01-01`, end);
        const [groups, counts] = await Promise.all([
          query(INSPECTION_ID, {
            $select: `date_trunc_ym(inspection_date) as month,borough,zip_code,inspection_type,result,${inspectionRecordCount} as events`,
            $where: where,
            $group:
              "date_trunc_ym(inspection_date),borough,zip_code,inspection_type,result",
            $limit: "50000",
          }),
          query(INSPECTION_ID, {
            $select: `count(*) as raw_records,count(job_id) as known_jobs,${inspectionRecordCount} as events,min(inspection_date) as first_event,max(inspection_date) as last_event`,
            $where: where,
          }),
        ]);
        if (
          !Array.isArray(groups) ||
          groups.length >= 50000 ||
          !counts[0]?.first_event
        )
          throw new Error(`Incomplete inspection aggregate for ${year}`);
        const sum = groups.reduce((s, r) => s + Number(r.events), 0);
        if (sum !== Number(counts[0].events))
          throw new Error(
            `Inspection record totals conflict in ${year}: groups=${sum}, source=${counts[0].events}`,
          );
        rows.push(...groups);
        totals.push(counts[0]);
        console.log(
          `Verified ${year}: ${sum.toLocaleString()} deduplicated inspection/action records`,
        );
      }),
    );
  }
  const types = [
    ...new Set(rows.map((r) => r.inspection_type || "Unknown")),
  ].sort();
  const results = [...new Set(rows.map((r) => r.result || "Unknown"))].sort();
  const aggregates = new Map();
  for (const r of rows)
    add(
      aggregates,
      [
        r.month.slice(0, 7),
        boroughIndex(r.borough),
        r.zip_code || "",
        types.indexOf(r.inspection_type || "Unknown"),
        results.indexOf(r.result || "Unknown"),
      ],
      Number(r.events),
    );
  const rawRecords = totals.reduce((s, r) => s + Number(r.raw_records), 0),
    events = totals.reduce((s, r) => s + Number(r.events), 0);
  return {
    source: {
      id: INSPECTION_ID,
      name: metadata.name,
      url: `https://data.cityofnewyork.us/d/${INSPECTION_ID}`,
      updatedAt: new Date(metadata.rowsUpdatedAt * 1000).toISOString(),
    },
    coverage: {
      from: totals.map((r) => r.first_event.slice(0, 10)).sort()[0],
      to: totals
        .map((r) => r.last_event.slice(0, 10))
        .sort()
        .at(-1),
    },
    types,
    results,
    rawRecords,
    events,
    identityVersion: 1,
    unkeyedRecords: totals.reduce(
      (s, r) => s + Number(r.raw_records) - Number(r.known_jobs),
      0,
    ),
    duplicateRecords: rawRecords - events,
    rows: sortRows([...aggregates.values()]),
  };
}

const [reports, inspections] = await Promise.all([
  reportDetails(),
  inspectionDetails(),
]);
const details = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  baseGeneratedAt: base.generatedAt,
  coverage: { from: "2020-01-01", to: base.coverage.to },
  reportSource: {
    id: SOURCE_IDS[1],
    url: `https://data.cityofnewyork.us/d/${SOURCE_IDS[1]}`,
  },
  ...reports,
  inspections,
};
console.log("Validated expanded snapshot:", validateDetails(details, base));
const output = new URL("../public/data/details.json", import.meta.url);
await writeFile(new URL(`${output.href}.tmp`), JSON.stringify(details) + "\n");
await rename(new URL(`${output.href}.tmp`), output);
console.log("Published habitat, property, and inspection details.");
