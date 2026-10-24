import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { BOROUGHS, SOURCE_IDS, validateSnapshot } from '../src/lib/data.mjs';

const output = new URL('../public/data/sightings.json', import.meta.url);
const filter = "complaint_type='Rodent' AND descriptor='Rat Sighting'";

async function query(id, params, metadata = false) {
  const url = metadata ? `https://data.cityofnewyork.us/api/views/${id}.json` : `https://data.cityofnewyork.us/resource/${id}.json?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers: process.env.SOCRATA_APP_TOKEN ? { 'X-App-Token': process.env.SOCRATA_APP_TOKEN } : {}, signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error(`NYC Open Data returned ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`Retrying ${id} (${attempt + 1}/3): ${error.message}`);
      await delay(2000 * 2 ** attempt);
    }
  }
}

async function fetchSource(id) {
  // Fixed source periods prevent overlaps if the City's archive arrangement changes.
  const period = id === '76ig-c548' ? "created_date >= '2010-01-01T00:00:00' AND created_date < '2020-01-01T00:00:00'" : "created_date >= '2020-01-01T00:00:00'";
  const where = `${filter} AND ${period}`;
  const [metadata, totals] = await Promise.all([
    query(id, {}, true),
    query(id, { '$select': 'count(*) as reports,min(created_date) as first_report,max(created_date) as last_report', '$where': where }),
  ]);
  const rows = [];
  // Explicit pagination and a total order avoid SODA's default truncated responses.
  const pageSize = 10_000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await query(id, {
      '$select': 'date_trunc_ym(created_date) as month,borough,incident_zip,count(*) as reports',
      '$where': where,
      '$group': 'date_trunc_ym(created_date),borough,incident_zip',
      '$order': 'month ASC,borough ASC,incident_zip ASC',
      '$limit': String(pageSize), '$offset': String(offset),
    });
    if (!Array.isArray(page)) throw new Error(`Invalid response for ${id}`);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  const expected = Number(totals[0]?.reports);
  if (!expected || rows.reduce((sum, r) => sum + Number(r.reports), 0) !== expected) throw new Error(`Source ${id} changed during pagination or is incomplete; keeping the previous snapshot`);
  console.log(`${metadata.name}: ${expected.toLocaleString()} reports, ${rows.length.toLocaleString()} aggregates`);
  return { rows, source: { id, name: metadata.name, url: `https://data.cityofnewyork.us/d/${id}`, updatedAt: new Date(metadata.rowsUpdatedAt * 1000).toISOString(), reports: expected }, from: totals[0].first_report.slice(0, 10), to: totals[0].last_report.slice(0, 10) };
}

const fetched = await Promise.all(SOURCE_IDS.map(fetchSource));
const aggregates = new Map();
for (const source of fetched) for (const r of source.rows) {
  const b = BOROUGHS.findIndex(b => b.toUpperCase() === (r.borough || '').toUpperCase());
  const row = [r.month.slice(0, 7), b < 0 ? 5 : b, r.incident_zip || '', Number(r.reports)];
  const key = JSON.stringify(row.slice(0, 3));
  if (aggregates.has(key)) aggregates.get(key)[3] += row[3];
  else aggregates.set(key, row);
}
const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  coverage: { from: fetched.map(s => s.from).sort()[0], to: fetched.map(s => s.to).sort().at(-1) },
  filter: { complaint_type: 'Rodent', descriptor: 'Rat Sighting' },
  boroughs: BOROUGHS,
  sources: fetched.map(s => s.source),
  totalReports: fetched.reduce((sum, s) => sum + s.source.reports, 0),
  rows: [...aggregates.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1] || a[2].localeCompare(b[2])),
};
validateSnapshot(snapshot);
// Reject a suspiciously large loss of coverage rather than silently publishing it.
let previous;
try { previous = JSON.parse(await readFile(output, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (previous && (snapshot.totalReports < previous.totalReports * 0.98 || snapshot.coverage.to < previous.coverage.to)) throw new Error('New snapshot loses coverage; manual investigation required');
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(new URL(`${output.href}.tmp`), JSON.stringify(snapshot) + '\n');
await rename(new URL(`${output.href}.tmp`), output);
console.log(`Published ${snapshot.totalReports.toLocaleString()} reports through ${snapshot.coverage.to}`);
