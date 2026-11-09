import { BOROUGHS, SOURCE_IDS } from "../../src/lib/data.mjs";

// Each source covers a fixed period (see sourceWhere): the archive before
// 2020, the current dataset from 2020 on.
export function inSourcePeriod(id, month) {
  return id === SOURCE_IDS[0] ? month < "2020-01" : month >= "2020-01";
}

// API aggregate rows ({month, borough, incident_zip, reports}) into the
// snapshot's sorted [month, boroughIndex, zip, count] rows.
export function aggregateRows(apiRows) {
  const aggregates = new Map();
  for (const r of apiRows) {
    const b = BOROUGHS.findIndex(
      (b) => b.toUpperCase() === (r.borough || "").toUpperCase(),
    );
    const row = [
      r.month.slice(0, 7),
      b < 0 ? 5 : b,
      r.incident_zip || "",
      Number(r.reports),
    ];
    const key = JSON.stringify(row.slice(0, 3));
    if (aggregates.has(key)) aggregates.get(key)[3] += row[3];
    else aggregates.set(key, row);
  }
  return [...aggregates.values()].sort(
    (a, b) =>
      a[0].localeCompare(b[0]) || a[1] - b[1] || a[2].localeCompare(b[2]),
  );
}

// The inverse, for reusing one source's rows from a published snapshot.
export function apiRowsFromSnapshot(snapshot, id) {
  return snapshot.rows
    .filter(([month]) => inSourcePeriod(id, month))
    .map(([month, b, zip, count]) => ({
      month: `${month}-01T00:00:00.000`,
      borough: snapshot.boroughs[b] ?? "",
      incident_zip: zip,
      reports: String(count),
    }));
}
