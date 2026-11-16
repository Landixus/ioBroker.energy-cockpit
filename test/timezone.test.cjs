const { test } = require("node:test");
const assert = require("node:assert/strict");
test("frontend calendar uses Berlin independent of process timezone", async () => {
  const { BerlinDate } = await import("../frontend/timezone.mjs");
  const d = new BerlinDate("2026-07-01T22:30:00Z");
  assert.equal(d.getDate(), 2);
  assert.equal(d.getHours(), 0);
  assert.equal(d.getTimezoneOffset(), -120);
  for (const [month, day, hours] of [
    [2, 29, 23],
    [9, 25, 25],
  ]) {
    const a = new BerlinDate(2026, month, day);
    const b = new BerlinDate(a.getTime());
    b.setDate(b.getDate() + 1);
    assert.equal((b - a) / 3600000, hours);
  }
});
