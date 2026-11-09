import { setTimeout as delay } from "node:timers/promises";

export function sourceWhere(id) {
  const period =
    id === "76ig-c548"
      ? "created_date >= '2010-01-01T00:00:00' AND created_date < '2020-01-01T00:00:00'"
      : "created_date >= '2020-01-01T00:00:00'";
  return `complaint_type='Rodent' AND descriptor='Rat Sighting' AND ${period}`;
}

// NYC Open Data sometimes answers from a lagging replica (seen Nov 2026: a
// count two days old between current ones). Mixing replicas breaks every
// reconciliation check, so reject answers older than the newest one seen.
const newest = new Map();
export function staleReplica(id, headers) {
  if (headers.get("x-soda2-data-out-of-date") === "true") return true;
  const time = (name) => Date.parse(headers.get(name) ?? "") || 0;
  const served =
    time("x-soda2-secondary-last-modified") || time("last-modified");
  const known = Math.max(
    newest.get(id) || 0,
    time("x-soda2-truth-last-modified"),
  );
  newest.set(id, Math.max(known, served));
  return served > 0 && served < known;
}

// Replicas answer at random (about half were stale on Nov 7, 2026), so a
// stale answer gets its own quick retries instead of using up the backoff
// meant for outages. Outages and throttling (Nov 8: the audit's six parallel
// queries drew 429s after 503s) back off 5s, 15s, 45s, then 90s.
export const retry = {
  stale: 8,
  staleDelayMs: 3000,
  failures: 5,
  backoffMs: 5000,
  maxBackoffMs: 90_000,
  concurrency: 2,
};

// At most `retry.concurrency` requests in flight per process, whichever
// script sends them. A finished request hands its slot straight to the next.
let active = 0;
const waiting = [];
async function fetchText(url, init) {
  if (active < retry.concurrency) active++;
  else await new Promise((resolve) => waiting.push(resolve));
  try {
    const response = await fetch(url, init);
    return { response, text: await response.text() };
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

function backoff(failures, error) {
  const wait = Math.min(retry.maxBackoffMs, retry.backoffMs * 3 ** (failures - 1));
  return Math.max(error.retryAfterMs || 0, wait * (1 + Math.random() / 4));
}

export async function query(id, params, metadata = false) {
  const url = metadata
    ? `https://data.cityofnewyork.us/api/views/${id}.json`
    : `https://data.cityofnewyork.us/resource/${id}.json?${new URLSearchParams(params)}`;
  let failures = 0,
    stale = 0;
  for (;;) {
    try {
      const { response, text } = await fetchText(url, {
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
        error.retryAfterMs = Number(response.headers.get("retry-after")) * 1000 || 0;
        throw error;
      }
      if (!metadata && staleReplica(id, response.headers)) {
        if (++stale > retry.stale) {
          const error = new Error(
            `NYC Open Data kept answering ${id} from a stale replica`,
          );
          error.retryable = false;
          throw error;
        }
        console.warn(`Retrying ${id} (stale replica ${stale}/${retry.stale})`);
        await delay(retry.staleDelayMs);
        continue;
      }
      return JSON.parse(text);
    } catch (error) {
      if (error.retryable === false || ++failures > retry.failures) throw error;
      const wait = backoff(failures, error);
      console.warn(
        `Retrying ${id} in ${Math.round(wait / 1000)}s (${failures}/${retry.failures}): ${error.message}`,
      );
      await delay(wait);
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
