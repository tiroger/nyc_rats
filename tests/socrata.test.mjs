import test from "node:test";
import assert from "node:assert/strict";
import { staleReplica } from "../scripts/lib/socrata.mjs";

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
