const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateBatteryTelemetry } = require("../build/lib/battery");
const { reading } = require("../build/lib/model");
const sample = {
  protocol: "Daly D2 Modbus function 03",
  crc_valid: true,
  timestamp: "2026-01-01T00:00:00Z",
  cell_count: 4,
  cell_voltages_v: [3.2, 3.2, 3.2, 3.2],
  voltage_v: 12.8,
  current_a: 2,
  soc_bms_percent: 50,
  temperatures_c: [21],
  plausibility_concerns: [],
};
test("verified gateway envelope, malformed and inconsistent packets", () => {
  assert.equal(validateBatteryTelemetry(sample).soc, 50);
  for (const edit of [
    { crc_valid: false },
    { cell_count: 16 },
    { voltage_v: 51.2 },
    { soc_bms_percent: 101 },
    { plausibility_concerns: ["error"] },
  ])
    assert.throws(() => validateBatteryTelemetry({ ...sample, ...edit }));
  assert.throws(() => validateBatteryTelemetry("{bad"));
});
test("retained battery data remains stale until fresh source timestamp arrives", () => {
  const m = {
    key: "soc",
    id: "test.battery",
    dimension: "soc",
    unit: "%",
    staleSeconds: 120,
    jsonPath: "soc_bms_percent",
    timestampPath: "timestamp",
  };
  const now = Date.parse("2026-01-01T01:00:00Z");
  assert.equal(
    reading({ val: JSON.stringify(sample), ts: now }, m, now).value,
    null,
  );
  assert.equal(
    reading(
      {
        val: JSON.stringify({
          ...sample,
          timestamp: new Date(now).toISOString(),
        }),
        ts: now,
      },
      m,
      now,
    ).value,
    50,
  );
});
