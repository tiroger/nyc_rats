import test from "node:test";
import assert from "node:assert/strict";
import { untilRefresh } from "../src/lib/schedule.mjs";

const at = (iso) => new Date(iso);

test("counts down to the next Monday 10:23 UTC refresh", () => {
  // Sunday evening: the refresh is the next morning.
  assert.equal(untilRefresh(at("2026-11-08T20:00:00Z")), "14 hr 23 min");
  // Monday just before the run.
  assert.equal(untilRefresh(at("2026-11-09T10:00:00Z")), "23 min");
  // Wednesday: several days out.
  assert.equal(untilRefresh(at("2026-11-11T10:23:00Z")), "5 days 0 hr");
});

test("right after Monday's refresh, the next one is a week away", () => {
  assert.equal(untilRefresh(at("2026-11-09T10:23:00Z")), "7 days 0 hr");
  assert.equal(untilRefresh(at("2026-11-09T11:00:00Z")), "6 days 23 hr");
});

test("one day out is singular", () => {
  assert.equal(untilRefresh(at("2026-11-15T10:00:00Z")), "1 day 0 hr");
});
