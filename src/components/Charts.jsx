import { useMemo, useState } from 'react';
import { area, line, curveMonotoneX, scaleLinear, scalePoint, max, scaleSequential, interpolateYlGn, pointer } from 'd3';
import { BOROUGHS, COLORS, number, compact, monthLabel, summarize } from '../lib/data.mjs';
import Rat from './Rat.jsx';

export function Trend({ months, borough }) {
  const [active, setActive] = useState(null);
  const width = 650, height = 230, left = 42, right = 15, top = 24, bottom = 35;
  const x = scalePoint().domain(months.map(r => r.month)).range([left, width - right]);
  const y = scaleLinear().domain([0, max(months, r => r.count) || 1]).nice(4).range([height - bottom, top]);
  const shape = line().x(r => x(r.month)).y(r => y(r.count)).curve(curveMonotoneX);
  const fill = area().x(r => x(r.month)).y0(height - bottom).y1(r => y(r.count)).curve(curveMonotoneX);
  const current = active === null ? null : months[Math.min(active, months.length - 1)];
  const tickStep = Math.max(1, Math.ceil((months.length - 1) / 5));
  const ticks = months.filter((_, i) => i % tickStep === 0 || i === months.length - 1);
  function move(e) {
    const [px] = pointer(e, e.currentTarget);
    const i = months.length === 1 ? 0 : Math.round((px - left) / (width - left - right) * (months.length - 1));
    setActive(Math.max(0, Math.min(months.length - 1, i)));
  }
  return <div className="trend-wrap">
    <div className="chart-readout mono" aria-live="polite">{current ? `${monthLabel(current.month, true)} · ${number.format(current.count)} reports` : 'Hover or focus to explore the monthly counts'}</div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Monthly rat-sighting reports for ${borough}. Use left and right arrow keys to inspect values.`} tabIndex={0} onPointerMove={move} onPointerLeave={() => setActive(null)} onFocus={() => setActive(0)} onBlur={() => setActive(null)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); setActive(Math.max(0, Math.min(months.length - 1, (active ?? 0) + (e.key === 'ArrowRight' ? 1 : -1)))); } }}>
      <defs><linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#799e70" stopOpacity=".35" /><stop offset="1" stopColor="#799e70" stopOpacity=".02" /></linearGradient></defs>
      {y.ticks(4).map(t => <g key={t}><line x1={left} x2={width - right} y1={y(t)} y2={y(t)} className="chart-grid" /><text x={left - 9} y={y(t) + 4} textAnchor="end" className="axis-label">{compact.format(t)}</text></g>)}
      <path d={fill(months)} fill="url(#trend-fill)" />
      <path d={shape(months)} fill="none" stroke="#345f47" strokeWidth="2.5" />
      {months.length === 1 && <circle cx={x(months[0].month)} cy={y(months[0].count)} r="5" fill="#345f47" />}
      {ticks.map((r, i) => <text key={r.month} x={x(r.month)} y={height - 10} textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} className="axis-label">{monthLabel(r.month, true)}</text>)}
      {current && <g><line x1={x(current.month)} x2={x(current.month)} y1={top} y2={height - bottom} stroke="#345f47" strokeDasharray="3 4" /><circle cx={x(current.month)} cy={y(current.count)} r="5" fill="#dcf080" stroke="#263c2e" strokeWidth="2" /></g>}
    </svg>
    <details className="data-table"><summary>View monthly data table</summary><div className="table-scroll"><table><caption>Monthly reports for {borough}</caption><thead><tr><th scope="col">Month</th><th scope="col">Reports</th></tr></thead><tbody>{months.map(r => <tr key={r.month}><th scope="row">{monthLabel(r.month)}</th><td>{number.format(r.count)}</td></tr>)}</tbody></table></div></details>
  </div>;
}

export function RatRace({ counts, borough, setBorough }) {
  const sorted = BOROUGHS.slice(0, 5).map(name => ({ name, count: counts[name] })).sort((a, b) => b.count - a.count);
  const peak = max(sorted, r => r.count) || 1;
  return <div className="rat-race">{sorted.map((r, i) => <button key={r.name} className={`race-row ${borough === r.name ? 'race-selected' : ''}`} onClick={() => setBorough(borough === r.name ? 'All NYC' : r.name)} aria-pressed={borough === r.name}>
    <span className="race-label"><span className="rank mono" aria-hidden="true">0{i + 1}</span><strong>{r.name}</strong><span className="mono">{number.format(r.count)}</span></span>
    <span className="race-track"><span className="race-fill" style={{ width: `${r.count / peak * 86}%`, backgroundColor: COLORS[r.name] }} /><Rat className="race-rat" style={{ left: `calc(${r.count / peak * 86}% - 8px)`, color: COLORS[r.name] }} /></span>
  </button>)}{counts.Unspecified > 0 && <p className="chart-note">Also includes {number.format(counts.Unspecified)} reports with an unspecified borough.</p>}</div>;
}

export function Seasonality({ data, borough, start, end, onSelect }) {
  const all = useMemo(() => summarize(data, data.coverage.from.slice(0, 7), data.coverage.to.slice(0, 7), borough), [data, borough]);
  const counts = new Map(all.months.map(r => [r.month, r.count]));
  const years = [...new Set(all.months.map(r => r.month.slice(0, 4)))];
  const color = scaleSequential(interpolateYlGn).domain([0, max(all.months, r => r.count) || 1]);
  const [hovered, setHovered] = useState(null);
  return <div className="seasonality">
    <div className="heatmap-readout mono" aria-live="polite">{hovered ? `${monthLabel(hovered)} · ${number.format(counts.get(hovered))} reports` : 'A whole city. A seasonal rhythm. Select a month to take a closer look.'}</div>
    <div className="heatmap-scroll"><div className="heatmap-grid"><span />{['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => <span className="heatmap-label mono" key={i}>{m}</span>)}
      {years.map(year => <div className="heatmap-year" key={year}><span className="heatmap-label mono">{year}</span>{Array.from({ length: 12 }, (_, i) => {
        const month = `${year}-${String(i + 1).padStart(2, '0')}`, exists = counts.has(month), selected = month >= start && month <= end;
        return <button key={month} className={`heatmap-cell ${selected ? 'in-range' : ''}`} disabled={!exists} style={{ backgroundColor: exists ? color(counts.get(month)) : undefined }} aria-label={exists ? `${monthLabel(month)}, ${number.format(counts.get(month))} reports. Explore month.` : `${monthLabel(month)}, no coverage`} aria-pressed={selected} onMouseEnter={() => exists && setHovered(month)} onMouseLeave={() => setHovered(null)} onFocus={() => exists && setHovered(month)} onBlur={() => setHovered(null)} onClick={() => onSelect(month)}><span className="sr-only">{exists ? number.format(counts.get(month)) : 'No data'}</span></button>;
      })}</div>)}
    </div></div>
    <div className="heatmap-key mono"><span>Fewer reports</span><span className="green-ramp" /><span>More</span><span className="heatmap-key-note">Outlined cells = selected period</span></div>
  </div>;
}
