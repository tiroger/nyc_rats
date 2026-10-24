import { useEffect, useMemo, useState } from 'react';
import Rat from './components/Rat.jsx';
import AtlasMap from './components/AtlasMap.jsx';
import { Trend, RatRace, Seasonality } from './components/Charts.jsx';
import { BOROUGHS, COLORS, monthLabel, number, presetRange, summarize, validateSnapshot } from './lib/data.mjs';

const dateLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export default function App() {
  const [resource, setResource] = useState({ loading: true });
  const [borough, setBorough] = useState('All NYC');
  const [preset, setPreset] = useState('12m');
  const [customRange, setCustomRange] = useState(null);
  const [selectedZip, setSelectedZip] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const paths = ['data/sightings.json', 'geo/boroughs.geojson', 'geo/zip-codes.geojson'];
        const [data, boroughs, zips] = await Promise.all(paths.map(async path => {
          const response = await fetch(`${import.meta.env.BASE_URL}${path}`, { signal: controller.signal });
          if (!response.ok) throw new Error(`Couldn’t load ${path}`);
          return response.json();
        }));
        validateSnapshot(data);
        const search = new URLSearchParams(window.location.search);
        const b = search.get('borough');
        if (BOROUGHS.slice(0, 5).includes(b)) setBorough(b);
        const from = search.get('from'), to = search.get('to');
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(from) && /^\d{4}-(0[1-9]|1[0-2])$/.test(to) && from <= to && from >= data.coverage.from.slice(0, 7) && to <= data.coverage.to.slice(0, 7)) { setCustomRange([from, to]); setPreset('custom'); }
        setResource({ data, geography: { boroughs, zips }, loading: false });
      } catch (error) { if (error.name !== 'AbortError') setResource({ error: error.message, loading: false }); }
    }
    load();
    return () => controller.abort();
  }, []);

  const data = resource.data;
  const range = data ? (preset === 'custom' && customRange ? customRange : presetRange(preset, data.coverage)) : ['2010-01', '2010-01'];
  const [start, end] = range;
  const summary = useMemo(() => data ? summarize(data, start, end, borough) : null, [data, start, end, borough]);
  const allBoroughs = useMemo(() => data ? summarize(data, start, end) : null, [data, start, end]);

  useEffect(() => {
    if (!data) return;
    const url = new URL(window.location.href);
    url.searchParams.set('from', start); url.searchParams.set('to', end);
    if (borough === 'All NYC') url.searchParams.delete('borough'); else url.searchParams.set('borough', borough);
    window.history.replaceState(null, '', url);
    setSelectedZip(null);
    setCopied(false);
  }, [data, start, end, borough]);

  function download() {
    const csv = `Month,Borough,Reported sightings\n${summary.months.map(r => `${r.month},${borough},${r.count}`).join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `ratlas-${borough.toLowerCase().replaceAll(' ', '-')}-${start}-${end}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); }
    catch { window.prompt('Copy this view’s link:', window.location.href); }
  }

  if (resource.loading) return <main className="load-screen" aria-live="polite"><Rat /><h1>Following the trail…</h1><p>Loading the latest published NYC data.</p></main>;
  if (resource.error) return <main className="load-screen"><Rat /><h1>A little snag underground.</h1><p>We couldn’t load the atlas. Your connection may be interrupted.</p><button onClick={() => window.location.reload()}>Try again</button><a href="https://data.cityofnewyork.us/d/erm2-nwe9">Visit NYC Open Data ↗</a></main>;

  const years = Array.from({ length: Number(data.coverage.to.slice(0, 4)) - Number(data.coverage.from.slice(0, 4)) + 1 }, (_, i) => String(Number(data.coverage.to.slice(0, 4)) - i));
  const top = Object.entries(summary.byBorough).sort((a, b) => b[1] - a[1])[0];
  const peak = summary.months.reduce((best, r) => r.count > best.count ? r : best, summary.months[0]);
  const stale = Date.now() - Date.parse(data.generatedAt) > 3 * 86400_000;
  const partial = end === data.coverage.to.slice(0, 7);
  const periodText = start === end ? monthLabel(start, true) : `${monthLabel(start, true)} — ${monthLabel(end, true)}`;

  return <>
    <a href="#explore" className="skip-link">Skip to the atlas</a>
    <header className="site-header shell"><a href={import.meta.env.BASE_URL} className="wordmark" aria-label="Ratlas home"><Rat /><span>ratlas<span className="wordmark-dot">.</span></span></a><span className="header-tag mono">AN INDEPENDENT NYC RAT ATLAS</span><nav aria-label="Main navigation"><a href="#explore">Explore the data</a><a href="#field-notes">Field notes</a><a href="https://github.com/tiroger/nyc_rats" target="_blank" rel="noreferrer" className="github-link">GitHub ↗</a></nav></header>
    <main>
      <section className="hero shell" aria-labelledby="hero-title">
        <div className="hero-copy"><div className="eyebrow"><span className="live-dot" /> FIVE BOROUGHS. ONE VERY PERSISTENT NEIGHBOR.</div><h1 id="hero-title">New York,<br />from the <span className="underlined">ground up.</span></h1><p>A closer look at the city’s most notorious locals.<br className="desktop-break" /> Follow the sightings, find the patterns, meet your neighbors.</p><a href="#explore" className="primary-link">Down the rabbit—er, rat hole <span>↘</span></a><div className="hero-source mono">PUBLIC DATA. CURIOUS HUMANS. ABSOLUTELY NO TABLEAU.</div></div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="art-coordinate mono">40.7128° N<br />74.0060° W</span><div className="art-sun" /><svg viewBox="0 0 440 220" className="skyline"><path d="M5 200V150H35V105H51V68H65V105H81V200H95V134H123V161H142V115H159V76H174V115H190V200H201V99H223V47H230V12H234V47H243V99H264V200H280V155H304V125H330V178H347V103H368V145H388V130H415V200" /><path d="M5 200H430" /></svg><Rat className="hero-rat" /><span className="rat-stamp mono">EST. 2010<br /><b>STILL HERE.</b></span><span className="art-caption mono">RATTUS NORVEGICUS / UNOFFICIAL NEW YORKER</span></div>
      </section>
      <div className="ticker"><div className="shell ticker-inner"><span><span className={`live-dot ${stale ? 'stale' : ''}`} /> {stale ? 'LAST PUBLISHED SNAPSHOT' : 'REFRESHED DAILY'}</span><span>NYC 311 · Rat-sighting reports</span><span>Data through {dateLabel(data.coverage.to)}</span><a href="#methodology">Know what you’re counting ↗</a></div></div>
      {stale && <div className="stale-notice shell" role="status">This snapshot was last refreshed {dateLabel(data.generatedAt.slice(0, 10))}. Updates are delayed; the atlas is showing the last successful refresh.</div>}
      <section id="explore" className="explore shell" aria-labelledby="explore-title">
        <div className="section-heading"><div><div className="eyebrow">01 / ON THE GROUND</div><h2 id="explore-title">Where the wild things are.</h2><p>Every report leaves a little trail. Pick a borough and a time to follow it.</p></div><button className="text-button share-button" onClick={share}>{copied ? 'Link copied ✓' : 'Share this view ↗'}</button></div>
        <div className="filter-bar"><div className="borough-filters" role="group" aria-label="Filter by borough">{['All NYC', ...BOROUGHS.slice(0, 5)].map(b => <button key={b} aria-pressed={borough === b} onClick={() => setBorough(b)}>{b !== 'All NYC' && <span className="borough-dot" style={{ background: COLORS[b] }} />}{b}</button>)}</div><label className="period-select"><span className="sr-only">Time period</span><select value={preset} onChange={e => { setPreset(e.target.value); setCustomRange(null); }}><option value="12m">Last 12 months</option><option value="ytd">This year so far</option><option value="all">All time · since 2010</option>{years.map(y => <option key={y} value={y}>{y}{y === years[0] ? ' (partial)' : ''}</option>)}{preset === 'custom' && <option value="custom">Custom period</option>}</select><span aria-hidden="true">⌄</span></label></div>
        <div className="selection-caption mono"><span>{borough.toUpperCase()} / {periodText.toUpperCase()}</span><span>{partial ? `Latest month is partial · through ${dateLabel(data.coverage.to)}` : 'Complete calendar months'}</span></div>
        <div className="stats-grid" aria-live="polite">
          <div className="stat"><span className="eyebrow">REPORTED SIGHTINGS</span><strong data-testid="total-reports">{number.format(summary.total)}</strong><span>311 reports in this selection</span></div>
          <div className="stat"><span className="eyebrow">THE MONTHLY PACE</span><strong>{number.format(Math.round(summary.total / summary.months.length))}<small> / mo</small></strong><span>Average across {summary.months.length} calendar months{partial ? ' · latest partial' : ''}</span></div>
          <div className="stat"><span className="eyebrow">{borough === 'All NYC' ? 'MOST REPORTED BOROUGH' : 'SHARE OF NYC REPORTS'}</span><strong className={borough === 'All NYC' ? 'stat-word' : ''}>{borough === 'All NYC' ? (summary.total ? top[0] : '—') : `${allBoroughs.total ? (summary.total / allBoroughs.total * 100).toFixed(1) : '0'}%`}</strong><span>{borough === 'All NYC' ? `${number.format(top[1])} reports · volume, not prevalence` : `${borough} in the selected period`}</span></div>
          <div className="stat"><span className="eyebrow">THE BUSIEST MONTH</span><strong className="stat-word">{summary.total ? monthLabel(peak.month, true) : '—'}</strong><span>{number.format(peak.count)} reported sightings</span></div>
        </div>
        <div className="map-layout"><article className="panel map-panel"><div className="panel-heading"><div><span className="eyebrow">THE RAT MAP</span><h3>A city of tiny footprints.</h3></div><span className="tag mono">BY ZIP CODE</span></div><AtlasMap geography={resource.geography} summary={summary} borough={borough} setBorough={setBorough} selectedZip={selectedZip} setSelectedZip={setSelectedZip} /></article>
          <aside className="zip-sidebar"><div className="eyebrow">THE FREQUENT FLIERS</div><h3>Small areas.<br />Big reputations.</h3><p>The ZIP codes with the most reports in your selection.</p><ol className="zip-ranking">{summary.zips.filter(r => resource.geography.zips.features.some(f => f.properties.postalCode === r.zip)).slice(0, 5).map((r, i) => <li key={`${r.borough}-${r.zip}`}><button onClick={() => setSelectedZip(selectedZip === r.zip ? null : r.zip)} aria-pressed={selectedZip === r.zip}><span className="zip-rank mono">{String(i + 1).padStart(2, '0')}</span><span><strong>{r.zip}</strong><small><span className="borough-dot" style={{ background: COLORS[r.borough] }} />{r.borough}</small></span><b className="mono">{number.format(r.count)}</b><span aria-hidden="true">↗</span></button></li>)}</ol>{!summary.total && <p>No reports in this selection.</p>}<div className="sidebar-note"><span className="note-symbol">↳</span><p>A busy ZIP isn’t necessarily a rattier ZIP. Population, reporting habits, and neighborhood size all matter.</p></div><button className="download-button" onClick={download}>Download monthly data <span>↓</span></button></aside>
        </div>
        <div className="chart-layout"><article className="panel trend-panel"><div className="panel-heading"><div><span className="eyebrow">THE LONG TAIL</span><h3>Every month has a story.</h3></div><span className="tag mono">{borough.toUpperCase()}</span></div><Trend months={summary.months} borough={borough} /><p className="chart-note">Monthly 311 rat-sighting reports. {partial && `The last month is incomplete through ${dateLabel(data.coverage.to)}.`}</p></article><article className="panel race-panel"><div className="panel-heading"><div><span className="eyebrow">THE RAT RACE</span><h3>Five boroughs. One leaderboard.</h3></div></div><RatRace counts={allBoroughs.byBorough} borough={borough} setBorough={setBorough} /><p className="chart-note">All boroughs, same period. Select a row to filter the atlas.</p></article></div>
      </section>
      <section className="field-notes shell" id="field-notes" aria-labelledby="notes-title"><div className="section-heading"><div><div className="eyebrow">02 / THE BIGGER PICTURE</div><h2 id="notes-title">Creatures of habit.</h2><p>Step back. Look across the years. See when the city starts squeaking.</p></div><span className="mono small-label">{borough.toUpperCase()} / ALL AVAILABLE YEARS</span></div><div className="season-layout"><article className="panel season-panel"><div className="panel-heading"><div><span className="eyebrow">RAT SEASON</span><h3>Some months leave more tracks.</h3></div><span className="tag mono">2010—{years[0]}</span></div><Seasonality data={data} borough={borough} start={start} end={end} onSelect={month => { setCustomRange([month, month]); setPreset('custom'); document.getElementById('explore').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }} /></article><aside className="field-card"><span className="eyebrow">A NOTE FROM THE SIDEWALK</span><div className="field-card-art"><Rat /><span className="mono">SMALL FEET.<br />LONG PAPER TRAIL.</span></div><h3>Reports tell a human story, too.</h3><p>These are moments when someone chose to contact 311. A change in reports can reflect rat activity, awareness, access to reporting, or all three.</p><p>Use this atlas to spot patterns and ask better questions. Counting the rats themselves is a different kind of science.</p><a href="#methodology">Read the field guide <span>↘</span></a></aside></div></section>
      <section className="methodology shell" id="methodology" aria-labelledby="method-title"><div><div className="eyebrow">03 / UNDER THE HOOD</div><h2 id="method-title">Good data.<br />A little street sense.</h2><p>An independent project built on public information.<br />Open source, open data, eyes wide open.</p></div><div className="method-details"><details open><summary>What are we actually counting?</summary><p>NYC 311 service requests with Problem (API: <code>complaint_type</code>) “Rodent” and Problem Detail (API: <code>descriptor</code>) “Rat Sighting.” One request is one report, not one rat, a confirmed infestation, or a population estimate. Multiple people may report the same activity.</p></details><details><summary>Where does the data come from?</summary><p>NYC’s Office of Technology and Innovation publishes the <a href={data.sources[0].url}>2010–2019 archive ↗</a> and <a href={data.sources[1].url}>2020–present dataset ↗</a>. We combine non-overlapping periods, retaining reports with missing ZIPs or boroughs in the overall totals. The map uses the historical ZIP and borough boundaries preserved in this project; boundaries and ZIP assignments may change.</p></details><details><summary>How fresh is it?</summary><p>GitHub Actions fetches both sources daily, reconciles totals, runs tests, and publishes a new snapshot. If a refresh fails, the last successful deployment stays available. Last successful refresh: <time dateTime={data.generatedAt}>{new Date(data.generatedAt).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} Eastern</time>. Latest report: {dateLabel(data.coverage.to)}. Recent records can arrive late or be revised.</p></details><details><summary>How should I compare neighborhoods?</summary><p>These are raw counts, without adjustment for population, land area, foot traffic, or willingness to report. ZIP bubbles are placed at ZIP reference locations and do not identify exact sightings. Missing or unmatched ZIPs appear in totals but cannot be mapped. Partial months are labeled and should not be compared directly with full months.</p></details></div></section>
      <section className="closing shell"><Rat /><div><h2>Seen something scurrying?</h2><p>Put it on the city’s radar. Report rat activity to NYC 311.</p></div><a href="https://portal.311.nyc.gov/article/?kanumber=KA-01107" target="_blank" rel="noreferrer">Make a 311 report <span>↗</span></a></section>
    </main>
    <footer className="site-footer shell"><a href={import.meta.env.BASE_URL} className="wordmark"><span>ratlas.</span></a><span>Made for the city. And its other residents.</span><div><a href="https://github.com/tiroger/nyc_rats">Source code ↗</a><a href="https://data.cityofnewyork.us/">NYC Open Data ↗</a><a href="#hero-title">Back to street level ↑</a></div><p>Originally researched by Mina Bansal, Roger Lefort, Hansen Xu, and Chi-Kuang Chen. Independent project; not affiliated with the City of New York.</p></footer>
  </>;
}
