import { setTimeout as delay } from 'node:timers/promises';

export function sourceWhere(id) {
  const period = id === '76ig-c548'
    ? "created_date >= '2010-01-01T00:00:00' AND created_date < '2020-01-01T00:00:00'"
    : "created_date >= '2020-01-01T00:00:00'";
  return `complaint_type='Rodent' AND descriptor='Rat Sighting' AND ${period}`;
}

export async function query(id, params, metadata = false) {
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
