import { readFile } from "node:fs/promises";
import {
  validateDetails,
  INSPECTION_ID,
  boroughIndex,
} from "../src/lib/details.mjs";
import { query, queryPages, sourceWhere } from "./lib/socrata.mjs";
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
const data = JSON.parse(
  await readFile(
    new URL("../public/data/details.json", import.meta.url),
    "utf8",
  ),
);
validateDetails(data, base);
const cutoff = nextDay(base.coverage.to);
const limit = "50000";
const [habitats, properties, inspections] = await Promise.all([
  query("erm2-nwe9", {
    $select:
      "date_trunc_ym(created_date) as month,borough,location_type,count(*) as reports",
    $where: `${sourceWhere("erm2-nwe9")} AND created_date < '${cutoff}T00:00:00'`,
    $group: "date_trunc_ym(created_date),borough,location_type",
    $limit: limit,
  }),
  queryPages("erm2-nwe9", {
    $select: "bbl,count(*) as reports",
    $where: `${sourceWhere("erm2-nwe9")} AND created_date < '${cutoff}T00:00:00'`,
    $group: "bbl",
    $order: "bbl ASC",
  }),
  query(INSPECTION_ID, {
    $select: `date_trunc_ym(inspection_date) as month,borough,inspection_type,${inspectionRecordCount} as events`,
    $where: inspectionWhere("2020-01-01", cutoff),
    $group: "date_trunc_ym(inspection_date),borough,inspection_type",
    $limit: limit,
  }),
]);
if (
  [habitats, properties, inspections].some((rows) => !Array.isArray(rows)) ||
  [habitats, inspections].some((rows) => rows.length >= Number(limit))
)
  throw new Error("Incomplete expanded-data audit");
const { normalizeBBL } = await import("../src/lib/details.mjs");
equalGroups(
  grouped(
    data.habitatRows,
    (r) => [r[0], r[1], data.locations[r[2]]],
    (r) => r[3],
  ),
  grouped(
    habitats,
    (r) => [
      r.month.slice(0, 7),
      boroughIndex(r.borough),
      r.location_type?.trim() || "Unknown",
    ],
    (r) => Number(r.reports),
  ),
  "Habitat audit",
);
equalGroups(
  grouped(
    data.propertyRows,
    (r) => [r[3]],
    (r) => r[4],
  ),
  grouped(
    properties,
    (r) => [normalizeBBL(r.bbl)],
    (r) => Number(r.reports),
  ),
  "Property audit",
);
equalGroups(
  grouped(
    data.inspections.rows,
    (r) => [r[0], r[1], data.inspections.types[r[3]]],
    (r) => r[5],
  ),
  grouped(
    inspections,
    (r) => [
      r.month.slice(0, 7),
      boroughIndex(r.borough),
      r.inspection_type || "Unknown",
    ],
    (r) => Number(r.events),
  ),
  "Inspection audit",
);
console.log(
  `Independent habitat, tax-lot, and inspection-record audits passed (${data.inspections.events.toLocaleString()} inspection/action records).`,
);
