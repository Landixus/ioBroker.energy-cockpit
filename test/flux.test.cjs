const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildFlux, parseFlux } = require("../build/lib/flux");
const m = {
  dimension: "energy",
  unit: "kWh",
  staleSeconds: 120,
  maxGapSeconds: 60,
};
test("Flux compiler escapes identifiers and contains only read operations", () => {
  const q = buildFlux('test"bucket', 'test"id', m, 0, 3600000, "hour");
  assert.ok(q.includes('test\\"bucket'));
  assert.ok(q.includes("Europe/Berlin"));
  assert.ok(q.includes("difference("));
  assert.ok(!q.includes("|> to("));
  assert.throws(() => buildFlux("b", "i", m, NaN, 1, "hour"));
});
test("Flux gaps and resets do not become energy facts", () => {
  const r = {
    _start: "1970-01-01T00:00:00Z",
    _stop: "1970-01-01T01:00:00Z",
    count: 60,
    coverage: 3600000,
    first: 0,
    last: 3600000,
    energy: 2,
    state: 100,
    invalid: 0,
  };
  assert.equal(parseFlux([r], m, 0, 3600000, "hour")[0].change, 2);
  assert.equal(
    parseFlux([{ ...r, invalid: 1 }], m, 0, 3600000, "hour")[0].change,
    null,
  );
  assert.equal(parseFlux([], m, 0, 3600000, "hour")[0].missing, true);
});
