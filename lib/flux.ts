import { Mapping, normalize } from "./model.js";
import { DateTime } from "luxon";
const duration: Record<string, string> = {
  "5minute": "5m",
  hour: "1h",
  day: "1d",
  month: "1mo",
};
/** Read-only, server-generated Flux. No client-supplied query fragments are accepted. */
export function buildFlux(
  bucket: string,
  id: string,
  m: Mapping,
  start: number,
  end: number,
  period: string,
) {
  if (!duration[period] || ![start, end].every(Number.isFinite))
    throw Error("Invalid query bounds");
  const gap = (m.maxGapSeconds ?? 3600) * 1000,
    from = new Date(start - gap).toISOString(),
    to = new Date(end).toISOString();
  const isEnergy = m.dimension === "energy";
  const rollover = m.rollover ? m.rollover / (normalize(1, m) ?? 1) : 0;
  const f = (n: number) => n.toFixed(8);
  if (
    (end - start) /
      {
        "5minute": 300000,
        hour: 3600000,
        day: 23 * 3600000,
        month: 28 * 86400000,
      }[period]! >
    3000
  )
    throw Error("Zu viele Zeitfenster");
  return `import "timezone"
option location = timezone.location(name: "Europe/Berlin")
from(bucket: ${JSON.stringify(bucket)})
 |> range(start: ${from}, stop: ${to})
 |> filter(fn: (r) => r._measurement == ${JSON.stringify(id)} and r._field == "value")
 |> keep(columns: ["_time", "_value", "_start", "_stop"])
 |> group(columns: ["_start", "_stop"])
 |> sort(columns: ["_time"])
 |> map(fn: (r) => ({r with _value: float(v:r._value), state:float(v:r._value), stamp:float(v:uint(v:r._time))/1000000.0}))
 |> difference(columns: ["_value", "stamp"], nonNegative: false)
 |> map(fn:(r)=>({r with delta: if ${isEnergy && rollover > 0 ? "true" : "false"} and r._value < 0.0 and r.state - r._value > ${f(rollover * 0.9)} and r.state < ${f(rollover * 0.1)} then ${f(rollover)} + r._value else r._value}))
 |> window(every: ${duration[period]}, createEmpty: false)
 |> reduce(identity: {energy:0.0, coverage:0.0, weighted:0.0, invalid:0.0, state:0.0, first:0.0, last:0.0, count:0.0}, fn:(r,accumulator)=>({
  energy: accumulator.energy + (if r.stamp > ${gap}.0 or ${isEnergy ? "r.delta < 0.0" : "false"} then 0.0 else r.delta),
  coverage: accumulator.coverage + (if r.stamp > ${gap}.0 then 0.0 else r.stamp),
  weighted: accumulator.weighted + (r.state-r._value)*r.stamp,
  invalid: accumulator.invalid + (if r.stamp > ${gap}.0 or ${isEnergy ? "r.delta < 0.0" : "false"} then 1.0 else 0.0),
  state:r.state,
  first:if accumulator.count == 0.0 then float(v:uint(v:r._time))/1000000.0-r.stamp else accumulator.first,
  last:float(v:uint(v:r._time))/1000000.0,
  count:accumulator.count+1.0
 }))
 |> filter(fn:(r)=>r._stop > time(v:${JSON.stringify(new Date(start).toISOString())}))
 |> limit(n:3001)`;
}
export function parseFlux(
  rows: any[],
  m: Mapping,
  start: number,
  end: number,
  period: string,
) {
  if (rows.length > 3000) throw Error("Historienantwort zu groß");
  const gap = (m.maxGapSeconds ?? 3600) * 1000;
  const byStart = new Map<number, any>();
  for (const r of rows) {
    const ts = Date.parse(r._start),
      stop = Date.parse(r._stop);
    if (!Number.isFinite(ts) || !Number.isFinite(stop))
      throw Error("Ungültige InfluxDB-Zeitfenster");
    const missing =
      !r.count ||
      r.invalid > 0 ||
      r.first > Math.max(start, ts) + gap ||
      r.last < Math.min(end, stop) - gap;
    byStart.set(ts, {
      start: ts,
      end: stop,
      change:
        m.dimension === "energy" && !missing ? normalize(r.energy, m) : null,
      state: normalize(r.state, m),
      mean:
        m.dimension === "power" && !missing && r.coverage
          ? normalize(r.weighted / r.coverage, m)
          : null,
      coverageMs: r.coverage,
      missing,
      resets: r.invalid,
      estimatedBoundaries: true,
    });
  }
  let d = DateTime.fromMillis(start, { zone: "Europe/Berlin" });
  d =
    period === "5minute"
      ? d.startOf("minute").minus({ minutes: d.minute % 5 })
      : d.startOf(
          period === "month" ? "month" : period === "day" ? "day" : "hour",
        );
  const result = [];
  while (d.toMillis() < end) {
    const next = d.plus(
      period === "5minute"
        ? { minutes: 5 }
        : period === "month"
          ? { months: 1 }
          : period === "day"
            ? { days: 1 }
            : { hours: 1 },
    );
    result.push(
      byStart.get(d.toMillis()) || {
        start: d.toMillis(),
        end: next.toMillis(),
        change: null,
        state: null,
        mean: null,
        coverageMs: 0,
        missing: true,
        resets: 0,
        estimatedBoundaries: true,
      },
    );
    if (result.length > 3000) throw Error("Zu viele Zeitfenster");
    d = next;
  }
  return result;
}
