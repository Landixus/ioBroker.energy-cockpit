const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalize,
  reading,
  balance,
  aggregate,
  batterySoc,
  validateSettings,
  defaults,
} = require("../build/lib/model");
const m = {
  key: "pv",
  id: "test.power",
  name: "PV",
  dimension: "power",
  unit: "kW",
  staleSeconds: 60,
};
test("units and strict numeric validation", () => {
  assert.equal(normalize("1.23", m), 1230);
  for (const v of [null, undefined, "", "1kW", NaN, Infinity, true])
    assert.equal(normalize(v, m), null);
  assert.equal(normalize(1200, { ...m, dimension: "energy", unit: "Wh" }), 1.2);
  assert.equal(normalize(101, { ...m, dimension: "soc", unit: "%" }), null);
});
test("sign conventions and missing aggregation", () => {
  assert.equal(normalize(2, { ...m, invert: true }), -2000);
  assert.equal(aggregate([1, null]), null);
  assert.equal(aggregate([0.1, 0.2]), 0.1 + 0.2);
  assert.deepEqual(balance(2000, 300, 500, 1800, [500, 700]), {
    calculatedHouse: 1800,
    residual: 0,
    unmeasured: 600,
  });
  assert.equal(balance(null, 300, 0, 1800, [500]).calculatedHouse, null);
});
test("battery aggregate requires verified capacities", () => {
  assert.equal(
    batterySoc([
      { soc: 50, capacity: 10 },
      { soc: 100, capacity: 5 },
    ]),
    200 / 3,
  );
  assert.equal(batterySoc([{ soc: 50, capacity: null }]), null);
});
test("stale, future, missing, invalid quality and source timestamp", () => {
  assert.equal(reading(null, m, 100000).quality, "fehlt");
  assert.equal(reading({ val: 4, ts: 100 }, m, 100000).value, null);
  assert.equal(reading({ val: 4, ts: 200000 }, m, 100000).value, null);
  assert.equal(reading({ val: 4, ts: 99000, q: 64 }, m, 100000).value, null);
  assert.equal(
    reading(
      { val: JSON.stringify({ v: 2, at: "1970-01-01T00:00:01Z" }), ts: 99000 },
      { ...m, jsonPath: "v", timestampPath: "at" },
      100000,
    ).quality,
    "veraltet",
  );
  assert.equal(
    reading({ val: "{broken", ts: 99000 }, { ...m, jsonPath: "v" }, 100000)
      .quality,
    "ungültiges JSON",
  );
});
test("configuration rejects duplicates, secret IDs and incompatible units", () => {
  assert.throws(() => validateSettings({ ...defaults, mappings: [m, m] }));
  assert.throws(() =>
    validateSettings({
      ...defaults,
      mappings: [{ ...m, id: "system.user.admin" }],
    }),
  );
  assert.throws(() =>
    validateSettings({ ...defaults, mappings: [{ ...m, unit: "kWh" }] }),
  );
  assert.throws(() =>
    validateSettings({
      ...defaults,
      cards: { flow: { image: "https://example.org/a" } },
    }),
  );
  assert.equal(
    validateSettings({ ...defaults, mappings: [m] }).mappings.length,
    1,
  );
});
test("offline source dependency hides a recently cached value and recovers", () => {
  const mapping = { ...m, availabilityId: "source.0.info.connection" };
  const state = { val: 4, ts: 99000 };
  assert.equal(reading(state, mapping, 100000, { val: false }).value, null);
  assert.equal(
    reading(state, mapping, 100000, { val: false }).quality,
    "Quelle offline",
  );
  assert.equal(reading(state, mapping, 100000, { val: true }).quality, "ok");
});
