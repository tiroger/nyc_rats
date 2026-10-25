import test from "node:test";
import assert from "node:assert/strict";
import {
  blend,
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  tweenKeys,
} from "../src/lib/motion.mjs";

test("easing curves start at rest and land exactly", () => {
  for (const ease of [easeOutCubic, easeInOutCubic]) {
    assert.equal(ease(0), 0);
    assert.equal(ease(1), 1);
  }
  assert.equal(clamp01(-2), 0);
  assert.equal(clamp01(3), 1);
});

test("records grow entering keys from zero and shrink leaving keys", () => {
  const mid = blend({ a: 10, gone: 8 }, { a: 20, fresh: 4 }, 0.5);
  assert.deepEqual(mid, { a: 15, gone: 4, fresh: 2 });
  assert.deepEqual(blend({ a: 10 }, { a: 20 }, 1), { a: 20 });
  assert.deepEqual(tweenKeys({ a: 1 }, { b: 2 }), ["a", "b"]);
});

test("per-key progress staggers a ripple", () => {
  const out = blend({}, { early: 10, late: 10 }, (key) =>
    key === "early" ? 1 : 0,
  );
  assert.deepEqual(out, { early: 10, late: 0 });
});

test("arrays morph only when their shape matches", () => {
  assert.deepEqual(blend([0, 10], [10, 20], 0.5), [5, 15]);
  const replaced = [1, 2, 3];
  assert.equal(blend([0, 10], replaced, 0.5), replaced);
  assert.equal(blend(undefined, 8, 0.25), 2);
});
