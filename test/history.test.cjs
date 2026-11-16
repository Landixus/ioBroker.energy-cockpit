const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  periodRange,
  summarize,
  HistoryService,
} = require("../build/lib/history");
const m = {
  key: "energy",
  id: "test.energy",
  dimension: "energy",
  unit: "kWh",
  staleSeconds: 100,
  history: true,
  maxGapSeconds: 7200,
};
test("Berlin calendar days handle both DST transitions", () => {
  for (const [date, hours] of [
    ["2026-03-29T12:00:00Z", 23],
    ["2026-10-25T12:00:00Z", 25],
  ]) {
    const r = periodRange("day", Date.parse(date));
    assert.equal((r.end - r.start) / 3600000, hours);
  }
});
test("energy interpolation preserves sum and flags incomplete buckets", () => {
  const start = Date.parse("2026-01-01T00:00:00Z");
  const r = summarize(
    [
      { ts: start, val: 10 },
      { ts: start + 7200000, val: 12 },
    ],
    m,
    start,
    start + 7200000,
    "hour",
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].change, 1);
  assert.equal(r[1].change, 1);
  assert.equal(r[0].missing, false);
});
test("resets, gaps and missing values are not silently counted", () => {
  const r = summarize(
    [
      { ts: 0, val: 9 },
      { ts: 3600000, val: 1 },
    ],
    m,
    0,
    3600000,
    "hour",
  );
  assert.equal(r[0].change, null);
  assert.equal(r[0].missing, true);
  const g = summarize(
    [
      { ts: 0, val: 1 },
      { ts: 9000000, val: 2 },
    ],
    m,
    0,
    9000000,
    "hour",
  );
  assert.ok(g.every((x) => x.change === null));
});
test("explicit meter rollover is handled", () => {
  const r = summarize(
    [
      { ts: 0, val: 999 },
      { ts: 3600000, val: 1 },
    ],
    { ...m, rollover: 1000 },
    0,
    3600000,
    "hour",
  );
  assert.equal(r[0].change, 2);
});
test("getHistory is bounded, cached and rejects truncation", async () => {
  let count = 0;
  const a = {
    sendTo(i, c, r, cb) {
      count++;
      assert.equal(c, "getHistory");
      assert.equal(r.options.limit, 10001);
      cb({
        result: [
          { ts: 0, val: 1 },
          { ts: 3600000, val: 2 },
        ],
      });
    },
  };
  const h = new HistoryService(a, () => ({
    mappings: [m],
    historyInstance: "influxdb.0",
  }));
  const req = {
    type: "recorder/statistics_during_period",
    start_time: new Date(0).toISOString(),
    end_time: new Date(3600000).toISOString(),
    period: "hour",
    statistic_ids: ["sensor.energy"],
  };
  await h.query(req);
  await h.query(req);
  assert.equal(count, 1);
  await assert.rejects(() =>
    h.query({ ...req, statistic_ids: Array(31).fill("sensor.energy") }),
  );
});
