export const BOROUGHS = [
  "Bronx",
  "Brooklyn",
  "Manhattan",
  "Queens",
  "Staten Island",
  "Unspecified",
];
export const COLORS = {
  Bronx: "#c96747",
  Brooklyn: "#497564",
  Manhattan: "#d3a444",
  Queens: "#7b78a5",
  "Staten Island": "#608a9c",
  Unspecified: "#8a8b7e",
};
export const SOURCE_IDS = ["76ig-c548", "erm2-nwe9"];
export const SIGHTING_FILTER = {
  complaint_type: "Rodent",
  descriptor: "Rat Sighting",
};
export const number = new Intl.NumberFormat("en-US");
export const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function monthLabel(month, short = false) {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthOffset(month, offset) {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function monthSequence(start, end) {
  const result = [];
  for (let m = start; m <= end; m = monthOffset(m, 1)) result.push(m);
  return result;
}

export function presetRange(preset, coverage) {
  const end = coverage.to.slice(0, 7);
  if (preset === "all") return [coverage.from.slice(0, 7), end];
  if (preset === "ytd") return [`${end.slice(0, 4)}-01`, end];
  if (/^\d{4}$/.test(preset))
    return [`${preset}-01`, `${preset}-12` > end ? end : `${preset}-12`];
  return [monthOffset(end, -11), end];
}

// Shared-link dates stay authoritative; the preset preserves their label.
// Recognize older links without an explicit period parameter, too.
export function presetForRange([start, end], coverage, preferred) {
  const firstYear = Number(coverage.from.slice(0, 4));
  const lastYear = Number(coverage.to.slice(0, 4));
  const presets = [
    "12m",
    "ytd",
    "all",
    ...Array.from({ length: lastYear - firstYear + 1 }, (_, i) =>
      String(lastYear - i),
    ),
  ];
  const matches = (preset) => {
    const range = presetRange(preset, coverage);
    return range[0] === start && range[1] === end;
  };
  if (preferred === "custom") return "custom";
  if (presets.includes(preferred))
    return matches(preferred) ? preferred : "custom";
  return presets.find(matches) || "custom";
}

export function summarize(data, start, end, borough = "All NYC") {
  const months = monthSequence(start, end).map((month) => ({
    month,
    count: 0,
  }));
  const byMonth = new Map(months.map((x) => [x.month, x]));
  const byBorough = Object.fromEntries(BOROUGHS.map((b) => [b, 0]));
  const zips = new Map();
  let total = 0;
  for (const [month, b, zip, count] of data.rows) {
    if (
      month < start ||
      month > end ||
      (borough !== "All NYC" && BOROUGHS[b] !== borough)
    )
      continue;
    total += count;
    byMonth.get(month).count += count;
    byBorough[BOROUGHS[b]] += count;
    if (/^\d{5}$/.test(zip)) {
      const key = zip;
      const entry = zips.get(key) || {
        zip,
        borough: BOROUGHS[b],
        count: 0,
        boroughCounts: {},
      };
      entry.count += count;
      entry.boroughCounts[BOROUGHS[b]] =
        (entry.boroughCounts[BOROUGHS[b]] || 0) + count;
      zips.set(key, entry);
    }
  }
  return {
    total,
    months,
    byBorough,
    zips: [...zips.values()]
      .map(({ boroughCounts, ...entry }) => ({
        ...entry,
        borough: Object.entries(boroughCounts).sort(
          (a, b) => b[1] - a[1],
        )[0][0],
      }))
      .sort((a, b) => b.count - a.count),
  };
}

export function periodMetrics(summary, coverage) {
  // Treat the latest source month as provisional, including late-arriving records.
  const completeMonths = summary.months.filter(
    (r) => r.month < coverage.to.slice(0, 7),
  );
  const peakCount = Math.max(0, ...summary.months.map((r) => r.count));
  const peakMonths = peakCount
    ? summary.months.filter((r) => r.count === peakCount)
    : [];
  return {
    completeMonths,
    monthlyAverage: completeMonths.length
      ? completeMonths.reduce((sum, r) => sum + r.count, 0) /
        completeMonths.length
      : null,
    peakCount,
    peakMonths,
  };
}

export function validateSnapshot(data) {
  if (
    data.schemaVersion !== 1 ||
    !Array.isArray(data.rows) ||
    !data.rows.length
  )
    throw new Error("Missing or unsupported data snapshot");
  if (
    !Number.isFinite(Date.parse(data.generatedAt)) ||
    !Number.isFinite(Date.parse(data.coverage?.from)) ||
    !Number.isFinite(Date.parse(data.coverage?.to))
  )
    throw new Error("Invalid snapshot dates");
  if (data.coverage.from > data.coverage.to)
    throw new Error("Reversed coverage dates");
  if (JSON.stringify(data.filter) !== JSON.stringify(SIGHTING_FILTER))
    throw new Error("Unexpected report definition");
  if (JSON.stringify(data.boroughs) !== JSON.stringify(BOROUGHS))
    throw new Error("Unexpected borough index");
  const keys = new Set();
  let total = 0;
  for (const row of data.rows) {
    const [month, borough, zip, count] = row;
    if (
      row.length !== 4 ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      !Number.isInteger(borough) ||
      borough < 0 ||
      borough >= BOROUGHS.length ||
      typeof zip !== "string" ||
      !Number.isSafeInteger(count) ||
      count <= 0
    )
      throw new Error(`Invalid aggregate: ${JSON.stringify(row)}`);
    if (
      month < data.coverage.from.slice(0, 7) ||
      month > data.coverage.to.slice(0, 7)
    )
      throw new Error("Aggregate outside coverage");
    const key = JSON.stringify(row.slice(0, 3));
    if (keys.has(key)) throw new Error(`Duplicate aggregate: ${key}`);
    keys.add(key);
    total += count;
  }
  if (total !== data.totalReports)
    throw new Error("Snapshot totals do not reconcile");
  if (
    !Array.isArray(data.sources) ||
    data.sources.length !== SOURCE_IDS.length ||
    new Set(data.sources.map((s) => s.id)).size !== SOURCE_IDS.length
  )
    throw new Error("Unexpected source list");
  for (const id of SOURCE_IDS)
    if (
      !data.sources.some(
        (s) =>
          s.id === id &&
          s.url?.startsWith("https://data.cityofnewyork.us/") &&
          Number.isSafeInteger(s.reports) &&
          s.reports >= 0,
      )
    )
      throw new Error(`Missing or invalid source ${id}`);
  if (data.sources.reduce((sum, s) => sum + s.reports, 0) !== total)
    throw new Error("Source totals do not reconcile");
  return total;
}

// D3 uses clockwise exterior rings for polygons smaller than a hemisphere.
export function forD3(collection) {
  function ringArea(ring) {
    return ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
  }
  const polygon = (rings) =>
    rings.map((ring, i) =>
      ringArea(ring) > 0 === (i === 0) ? [...ring].reverse() : ring,
    );
  return {
    ...collection,
    features: collection.features.map((f) => ({
      ...f,
      geometry: {
        ...f.geometry,
        coordinates:
          f.geometry.type === "MultiPolygon"
            ? f.geometry.coordinates.map(polygon)
            : polygon(f.geometry.coordinates),
      },
    })),
  };
}
