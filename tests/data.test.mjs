import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { geoArea, geoMercator, geoPath } from 'd3';
import { BOROUGHS, monthOffset, monthSequence, presetRange, summarize, validateSnapshot, forD3 } from '../src/lib/data.mjs';

const fixture = () => ({
  schemaVersion: 1, generatedAt: '2026-10-23T12:00:00Z',
  coverage: { from: '2025-12-01', to: '2026-02-12' }, boroughs: BOROUGHS,
  sources: [{ id: '76ig-c548', url: 'https://data.cityofnewyork.us/d/76ig-c548', reports: 0 }, { id: 'erm2-nwe9', url: 'https://data.cityofnewyork.us/d/erm2-nwe9', reports: 15 }],
  totalReports: 15,
  rows: [['2025-12', 1, '11221', 7], ['2026-02', 1, '', 3], ['2026-02', 2, '10025', 4], ['2026-02', 5, 'invalid', 1]],
});

test('missing geography remains in totals and zero-report months remain on the timeline', () => {
  const result = summarize(fixture(), '2025-12', '2026-02');
  assert.equal(result.total, 15);
  assert.deepEqual(result.months.map(r => r.count), [7, 0, 8]);
  assert.equal(result.zips.reduce((sum, r) => sum + r.count, 0), 11);
  assert.equal(Object.values(result.byBorough).reduce((a, b) => a + b, 0), 15);
});

test('borough and date filters apply together without leaking other boroughs', () => {
  const result = summarize(fixture(), '2026-01', '2026-02', 'Brooklyn');
  assert.equal(result.total, 3);
  assert.deepEqual(result.months.map(r => r.count), [0, 3]);
  assert.equal(result.byBorough.Manhattan, 0);
  assert.equal(result.zips.length, 0);
});

test('ZIPs reported under multiple boroughs appear once with the combined count', () => {
  const data = fixture();
  data.rows.push(['2026-02', 2, '11221', 2]);
  const result = summarize(data, '2025-12', '2026-02');
  const zip = result.zips.find(r => r.zip === '11221');
  assert.equal(zip.count, 9);
  assert.equal(zip.borough, 'Brooklyn');
  assert.equal(result.zips.filter(r => r.zip === '11221').length, 1);
  assert.equal(result.byBorough.Manhattan, 6);
});

test('month arithmetic handles year boundaries and leap years without local timezone shifts', () => {
  assert.equal(monthOffset('2024-01', -1), '2023-12');
  assert.equal(monthOffset('2024-02', 12), '2025-02');
  assert.deepEqual(monthSequence('2023-12', '2024-03'), ['2023-12', '2024-01', '2024-02', '2024-03']);
  const coverage = { from: '2010-01-01', to: '2026-10-23' };
  assert.deepEqual(presetRange('12m', coverage), ['2025-11', '2026-10']);
  assert.deepEqual(presetRange('2026', coverage), ['2026-01', '2026-10']);
  assert.deepEqual(presetRange('2019', coverage), ['2019-01', '2019-12']);
});

test('snapshot validation rejects duplicate groups, invalid counts and unreconciled sources', () => {
  assert.equal(validateSnapshot(fixture()), 15);
  const duplicate = fixture(); duplicate.rows.push([...duplicate.rows[0]]);
  assert.throws(() => validateSnapshot(duplicate), /Duplicate/);
  const count = fixture(); count.rows[0][3] = -1;
  assert.throws(() => validateSnapshot(count), /Invalid aggregate/);
  const source = fixture(); source.sources[1].reports = 14;
  assert.throws(() => validateSnapshot(source), /Source totals/);
  const total = fixture(); total.totalReports = 16;
  assert.throws(() => validateSnapshot(total), /Snapshot totals/);
});

test('production snapshot reconciles all reports and both historical sources', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../public/data/sightings.json', import.meta.url), 'utf8'));
  assert.ok(validateSnapshot(snapshot) > 130_000);
  const all = summarize(snapshot, snapshot.coverage.from.slice(0, 7), snapshot.coverage.to.slice(0, 7));
  assert.equal(all.total, snapshot.totalReports);
  assert.equal(all.months[0].month, '2010-01');
});

test('local geography projects NYC instead of the polygon complement', async () => {
  const source = JSON.parse(await readFile(new URL('../public/geo/boroughs.geojson', import.meta.url), 'utf8'));
  const boroughs = forD3(source);
  assert.equal(boroughs.features.length, 5);
  assert.ok(geoArea(boroughs) > 0 && geoArea(boroughs) < 0.001);
  const projection = geoMercator().fitSize([720, 555], boroughs);
  const bounds = geoPath(projection).bounds(boroughs);
  assert.ok(bounds[1][0] - bounds[0][0] > 300);
  assert.ok(bounds[1][1] - bounds[0][1] > 300);
});
