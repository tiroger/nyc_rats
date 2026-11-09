import test from "node:test";
import assert from "node:assert/strict";
import { query, retry, staleReplica } from "../scripts/lib/socrata.mjs";

const soda = (served, truth = served, outOfDate = "false") =>
  new Headers({
    "x-soda2-data-out-of-date": outOfDate,
    "x-soda2-truth-last-modified": truth,
    "x-soda2-secondary-last-modified": served,
  });

test("answers from a replica behind the newest one seen are stale", () => {
  const now = "Sat, 07 Nov 2026 02:38:20 GMT",
    old = "Thu, 05 Nov 2026 02:46:28 GMT";
  assert.equal(staleReplica("t-hwm", soda(now)), false);
  // A replica two days behind is caught even without the out-of-date flag.
  assert.equal(staleReplica("t-hwm", soda(old, old)), true);
  assert.equal(staleReplica("t-hwm", soda(now)), false);
  // Datasets are tracked separately.
  assert.equal(staleReplica("t-other", soda(old, old)), false);
});

test("replicas that report themselves behind are stale", () => {
  const now = "Sat, 07 Nov 2026 02:38:20 GMT",
    old = "Thu, 05 Nov 2026 02:46:28 GMT";
  assert.equal(staleReplica("t-self", soda(old, now)), true);
  assert.equal(staleReplica("t-flag", soda(now, now, "true")), true);
  // Seen in production: the lagging replica flags itself, but its other
  // headers carry its own (old) times.
  assert.equal(staleReplica("t-seen", soda(old, old, "true")), true);
});

test("a dataset update mid-run is accepted and becomes the new floor", () => {
  const before = "Fri, 06 Nov 2026 02:30:00 GMT",
    after = "Sat, 07 Nov 2026 02:38:20 GMT";
  assert.equal(staleReplica("t-update", soda(before)), false);
  assert.equal(staleReplica("t-update", soda(after)), false);
  assert.equal(staleReplica("t-update", soda(before, before)), true);
});

test("responses without freshness headers are not rejected", () => {
  assert.equal(staleReplica("t-bare", new Headers()), false);
});

// Replays canned responses through query() with no real waiting.
async function replay(responses) {
  const realFetch = globalThis.fetch,
    realWarn = console.warn,
    saved = { ...retry };
  Object.assign(retry, { staleDelayMs: 0, backoffMs: 0 });
  console.warn = () => {};
  let calls = 0;
  globalThis.fetch = async () => {
    const r = responses[Math.min(calls++, responses.length - 1)];
    return new Response(JSON.stringify(r.body ?? [{ n: "1" }]), {
      status: r.status ?? 200,
      headers: r.stale ? { "x-soda2-data-out-of-date": "true" } : {},
    });
  };
  try {
    return { result: await query(`t-replay-${Math.random()}`, {}), calls };
  } catch (error) {
    return { error, calls };
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
    Object.assign(retry, saved);
  }
}

test("stale answers are retried on their own budget, not the outage one", async () => {
  // Six stale answers in a row would have exhausted the old four attempts.
  const stale = Array.from({ length: 6 }, () => ({ stale: true }));
  const { result, calls } = await replay([{ status: 503 }, ...stale, { status: 429 }, {}]);
  assert.deepEqual(result, [{ n: "1" }]);
  assert.equal(calls, 9);
});

test("a source that stays stale fails with a clear message", async () => {
  const { error, calls } = await replay([{ stale: true }]);
  assert.match(error.message, /kept answering .* from a stale replica/);
  assert.equal(calls, retry.stale + 1);
});

test("outages still give up after the usual retries", async () => {
  const { error, calls } = await replay([{ status: 503 }]);
  assert.match(error.message, /returned 503/);
  assert.equal(calls, retry.failures + 1);
});

test("throttling survives a burst of 429s like the Nov 8 audit's", async () => {
  const { result } = await replay([{ status: 503 }, { status: 429 }, { status: 429 }, { status: 429 }, {}]);
  assert.deepEqual(result, [{ n: "1" }]);
});

test("no more than the allowed number of requests run at once", async () => {
  const realFetch = globalThis.fetch;
  let inFlight = 0,
    peak = 0;
  globalThis.fetch = async () => {
    peak = Math.max(peak, ++inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    return new Response("[]");
  };
  try {
    // Six at once, like the audit; each must still get its answer.
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => query(`t-limit-${i}`, {})),
    );
    assert.equal(results.length, 6);
    assert.equal(peak, retry.concurrency);
  } finally {
    globalThis.fetch = realFetch;
  }
});
