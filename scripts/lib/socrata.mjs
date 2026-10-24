import { setTimeout as delay } from "node:timers/promises";

export function sourceWhere(id) {
  const period =
    id === "76ig-c548"
      ? "created_date >= '2010-01-01T00:00:00' AND created_date < '2020-01-01T00:00:00'"
      : "created_date >= '2020-01-01T00:00:00'";
  return `complaint_type='Rodent' AND descriptor='Rat Sighting' AND ${period}`;
}

export async function query(id, params, metadata = false) {
  const url = metadata
    ? `https://data.cityofnewyork.us/api/views/${id}.json`
    : `https://data.cityofnewyork.us/resource/${id}.json?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: process.env.SOCRATA_APP_TOKEN
          ? { "X-App-Token": process.env.SOCRATA_APP_TOKEN }
          : {},
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        const error = new Error(`NYC Open Data returned ${response.status}`);
        error.retryable =
          response.status >= 500 ||
          response.status === 429 ||
          response.status === 408;
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.retryable === false || attempt === 3) throw error;
      console.warn(`Retrying ${id} (${attempt + 1}/3): ${error.message}`);
      await delay(2000 * 2 ** attempt);
    }
  }
}

export async function queryPages(id, params, pageSize = 50000) {
  if (!params.$order)
    throw new Error("Paginated queries require a stable ordering");
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await query(id, {
      ...params,
      $limit: String(pageSize),
      $offset: String(offset),
    });
    if (!Array.isArray(page))
      throw new Error("Invalid paginated source response");
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
