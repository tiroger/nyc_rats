import { BOROUGHS } from "../../src/lib/data.mjs";

export function grouped(rows, key, count) {
  const groups = new Map();
  for (const row of rows) {
    const k = JSON.stringify(key(row));
    groups.set(k, (groups.get(k) || 0) + count(row));
  }
  return groups;
}

export function equalGroups(expected, actual, label) {
  for (const key of new Set([...expected.keys(), ...actual.keys()])) {
    if (expected.get(key) !== actual.get(key))
      throw new Error(
        `${label} mismatch at ${key}: snapshot=${expected.get(key) ?? 0}, NYC=${actual.get(key) ?? 0}. Refresh the snapshot before publishing.`,
      );
  }
}

export function verifySourceAudit(snapshot, id, audit) {
  const rows = snapshot.rows.filter((r) =>
    id === "76ig-c548" ? r[0] < "2020-01" : r[0] >= "2020-01",
  );
  const expected = rows.reduce((sum, r) => sum + r[3], 0);
  const total = audit.totals[0];
  const source = snapshot.sources.find((s) => s.id === id);
  if (
    Number(total.reports) !== expected ||
    Number(total.distinct_reports) !== expected ||
    source.reports !== expected
  )
    throw new Error(`Request count or unique-ID count mismatch in ${id}`);
  const normalizeBorough = (r) => {
    const i = BOROUGHS.findIndex(
      (b) => b.toUpperCase() === (r.borough || "").trim().toUpperCase(),
    );
    return i < 0 ? 5 : i;
  };
  equalGroups(
    grouped(
      rows,
      (r) => [r[0], r[1]],
      (r) => r[3],
    ),
    grouped(
      audit.monthlyBorough,
      (r) => [r.month.slice(0, 7), normalizeBorough(r)],
      (r) => Number(r.reports),
    ),
    `${id} monthly/borough totals`,
  );
  equalGroups(
    grouped(
      rows,
      (r) => [r[0], r[2]],
      (r) => r[3],
    ),
    grouped(
      audit.monthlyZip,
      (r) => [r.month.slice(0, 7), r.incident_zip || ""],
      (r) => Number(r.reports),
    ),
    `${id} monthly/ZIP totals`,
  );
  return {
    id,
    reports: expected,
    monthlyBoroughGroups: audit.monthlyBorough.length,
    monthlyZipGroups: audit.monthlyZip.length,
  };
}
