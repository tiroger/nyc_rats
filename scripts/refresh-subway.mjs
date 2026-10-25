// Builds public/geo/subway.geojson from MTA open data: every service line
// merged into one simplified network, plus one point per station complex.
// The network changes rarely, so this runs by hand, not in the daily refresh.
import { writeFile, rename } from "node:fs/promises";

const LINES_ID = "s692-irgq",
  STATIONS_ID = "39hk-dx4f";
const LINES = `https://data.ny.gov/api/geospatial/${LINES_ID}?method=export&format=GeoJSON`;
const STATIONS = `https://data.ny.gov/resource/${STATIONS_ID}.json?$limit=5000`;
// About 8 m at NYC's latitude: invisible at atlas zoom, a fraction of the size.
const TOLERANCE = 0.00008;

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function simplify(points) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a],
      [bx, by] = points[b];
    const dx = bx - ax,
      dy = by - ay,
      length = Math.hypot(dx, dy) || 1;
    let far = -1,
      farthest = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / length;
      if (d > farthest) [far, farthest] = [i, d];
    }
    if (farthest > TOLERANCE) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = ([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))];
const inNyc = ([x, y]) => x > -74.3 && x < -73.6 && y > 40.45 && y < 40.95;

const [lines, stations, lineMeta, stationMeta] = await Promise.all([
  getJson(LINES),
  getJson(STATIONS),
  getJson(`https://data.ny.gov/api/views/${LINES_ID}.json`),
  getJson(`https://data.ny.gov/api/views/${STATIONS_ID}.json`),
]);

// Services share trunk track, so identical simplified runs are kept once.
const seen = new Set(),
  network = [];
for (const feature of lines.features) {
  const parts =
    feature.geometry.type === "LineString"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  for (const part of parts) {
    const run = simplify(part.map(round));
    const key = JSON.stringify(run);
    const reverse = JSON.stringify([...run].reverse());
    if (run.length < 2 || seen.has(key) || seen.has(reverse)) continue;
    seen.add(key);
    network.push(run);
  }
}

const complexes = new Map();
for (const s of stations) {
  const point = [Number(s.gtfs_longitude), Number(s.gtfs_latitude)];
  if (!point.every(Number.isFinite)) continue;
  const entry = complexes.get(s.complex_id) || { name: s.stop_name, points: [] };
  entry.points.push(point);
  complexes.set(s.complex_id, entry);
}
const stationFeatures = [...complexes.values()].map(({ name, points }) => ({
  type: "Feature",
  properties: { kind: "station", name },
  geometry: {
    type: "Point",
    coordinates: round([
      points.reduce((sum, p) => sum + p[0], 0) / points.length,
      points.reduce((sum, p) => sum + p[1], 0) / points.length,
    ]),
  },
}));

const points = network.flat().concat(stationFeatures.map((f) => f.geometry.coordinates));
if (network.length < 20 || stationFeatures.length < 300 || !points.every(inNyc))
  throw new Error("Subway geometry looks incomplete or outside NYC; keeping the old file.");

const out = {
  type: "FeatureCollection",
  sources: [
    {
      id: LINES_ID,
      name: lineMeta.name,
      url: `https://data.ny.gov/d/${LINES_ID}`,
      updatedAt: new Date(lineMeta.rowsUpdatedAt * 1000).toISOString(),
    },
    {
      id: STATIONS_ID,
      name: stationMeta.name,
      url: `https://data.ny.gov/d/${STATIONS_ID}`,
      updatedAt: new Date(stationMeta.rowsUpdatedAt * 1000).toISOString(),
    },
  ],
  features: [
    {
      type: "Feature",
      properties: { kind: "lines" },
      geometry: { type: "MultiLineString", coordinates: network },
    },
    ...stationFeatures,
  ],
};
const target = new URL("../public/geo/subway.geojson", import.meta.url);
const temporary = new URL("../public/geo/subway.geojson.tmp", import.meta.url);
await writeFile(temporary, JSON.stringify(out));
await rename(temporary, target);
console.log(
  `Wrote ${network.length} line runs (${network.flat().length} points) and ${stationFeatures.length} station complexes.`,
);
