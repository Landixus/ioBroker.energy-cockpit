import { DateTime } from "luxon";
import { Mapping, normalize, extract } from "./model.js";
import { buildFlux, parseFlux } from "./flux.js";
export const zone = "Europe/Berlin";
export function periodRange(period: string, now = Date.now()) {
  const d = DateTime.fromMillis(now, { zone });
  const unit =
    period === "week"
      ? "week"
      : period === "month"
        ? "month"
        : period === "year"
          ? "year"
          : "day";
  const start = d.startOf(unit);
  return {
    start: start.toMillis(),
    end: start.plus({ [unit + "s"]: 1 }).toMillis(),
  };
}
export function bucketStart(ts: number, period: string) {
  const d = DateTime.fromMillis(ts, { zone });
  if (period === "5minute")
    return d
      .startOf("minute")
      .minus({ minutes: d.minute % 5 })
      .toMillis();
  return d
    .startOf(period === "month" ? "month" : period === "day" ? "day" : "hour")
    .toMillis();
}
export interface Sample {
  ts: number;
  val: any;
  q?: number;
}
export function summarize(
  samples: Sample[],
  m: Mapping,
  start: number,
  end: number,
  period: string,
) {
  const rows = new Map<number, any>();
  const sorted = [
    ...new Map(
      samples.filter((s) => Number.isFinite(s.ts)).map((s) => [s.ts, s]),
    ).values(),
  ].sort((a, b) => a.ts - b.ts);
  const gap = (m.maxGapSeconds ?? 3600) * 1000;
  const row = (ts: number) => {
    const b = bucketStart(ts, period);
    if (!rows.has(b))
      rows.set(b, {
        start: b,
        end: nextBucket(b, period),
        change: null,
        state: null,
        mean: null,
        coverageMs: 0,
        missing: true,
        resets: 0,
        _sum: 0,
      });
    return rows.get(b);
  };
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    let v: number | null = null;
    try {
      v = s.q ? null : normalize(extract(s.val, m.jsonPath), m);
    } catch {
      v = null;
    }
    if (s.ts >= start && s.ts < end && v !== null) row(s.ts).state = v;
    if (i === 0) continue;
    const p = sorted[i - 1];
    let prev: number | null = null;
    try {
      prev = p.q ? null : normalize(extract(p.val, m.jsonPath), m);
    } catch {
      prev = null;
    }
    if (v === null || prev === null || s.ts - p.ts > gap || s.ts <= p.ts)
      continue;
    let delta = v - prev;
    if (m.dimension === "energy" && delta < 0) {
      if (m.rollover && prev > m.rollover * 0.9 && v < m.rollover * 0.1)
        delta = m.rollover - prev + v;
      else {
        if (s.ts >= start && s.ts < end) row(s.ts).resets++;
        continue;
      }
    }
    let cursor = Math.max(start, p.ts);
    const stop = Math.min(end, s.ts);
    while (cursor < stop) {
      const r = row(cursor),
        until = Math.min(stop, r.end),
        duration = until - cursor;
      const ratio = duration / (s.ts - p.ts);
      r.coverageMs += duration;
      if (m.dimension === "energy") r.change = (r.change ?? 0) + delta * ratio;
      else r._sum += prev * duration;
      cursor = until;
    }
  }
  return [...rows.values()]
    .sort((a, b) => a.start - b.start)
    .map((r) => {
      const required = Math.min(end, r.end) - Math.max(start, r.start);
      r.missing = r.coverageMs < required * 0.99 || r.resets > 0;
      r.mean =
        m.dimension === "power" && r.coverageMs ? r._sum / r.coverageMs : null;
      if (r.missing) r.change = null;
      delete r._sum;
      return r;
    });
}
function nextBucket(ts: number, period: string) {
  return DateTime.fromMillis(ts, { zone })
    .plus(
      period === "5minute"
        ? { minutes: 5 }
        : period === "month"
          ? { months: 1 }
          : period === "day"
            ? { days: 1 }
            : { hours: 1 },
    )
    .toMillis();
}
export class HistoryService {
  private cache = new Map<string, { time: number; data: any }>();
  private inFlight = new Map<string, Promise<any>>();
  private running = 0;
  private queue: Array<() => void> = [];
  private influxMetadata?: { instance: string; bucket: string | null };
  constructor(
    private adapter: any,
    private config: () => any,
  ) {}
  async query(request: any) {
    if (request.type !== "recorder/statistics_during_period")
      throw Error("Diese Funktion ist in ioBroker nicht verfügbar");
    const start = Date.parse(request.start_time),
      end = request.end_time ? Date.parse(request.end_time) : Date.now();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      end - start > 366 * 86400000 * 3
    )
      throw Error("Historienzeitraum ungültig (maximal 3 Jahre)");
    if (
      !["5minute", "hour", "day", "month"].includes(request.period) ||
      !Array.isArray(request.statistic_ids) ||
      request.statistic_ids.length > 30
    )
      throw Error("Historienanfrage ungültig");
    const result: Record<string, any> = {};
    for (const alias of new Set<string>(request.statistic_ids)) {
      const m = this.config().mappings.find(
        (x: Mapping) => "sensor." + x.key === alias,
      );
      if (!m?.history) {
        result[alias] = [];
        continue;
      }
      const key = JSON.stringify([
        this.config().historyInstance,
        m,
        start,
        Math.floor(end / 60000),
        request.period,
      ]);
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.time < 60000) {
        result[alias] = cached.data;
        continue;
      }
      let promise = this.inFlight.get(key);
      if (!promise) {
        promise = this.load(m, start, end, request.period);
        this.inFlight.set(key, promise);
      }
      try {
        result[alias] = await promise;
        if (this.cache.size > 128)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { time: Date.now(), data: result[alias] });
      } finally {
        this.inFlight.delete(key);
      }
    }
    return result;
  }
  private async load(m: Mapping, start: number, end: number, period: string) {
    if (this.running >= 2) {
      if (this.queue.length >= 30) throw Error("Zu viele Historienanfragen");
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else this.running++;
    try {
      const instance = this.config().historyInstance;
      if (
        instance.startsWith("influxdb.") &&
        this.adapter.getForeignObjectAsync &&
        !m.jsonPath &&
        ["power", "energy"].includes(m.dimension)
      ) {
        if (this.influxMetadata?.instance !== instance) {
          const o = await this.adapter.getForeignObjectAsync(
            "system.adapter." + instance,
          );
          this.influxMetadata = {
            instance,
            bucket: o?.native?.dbversion === "2.x" ? o.native.dbname : null,
          };
        }
        const bucket = this.influxMetadata?.bucket;
        if (bucket) {
          const object = await this.adapter.getForeignObjectAsync(m.id);
          const id = object?.common?.custom?.[instance]?.aliasId || m.id;
          const query = buildFlux(bucket, id, m, start, end, period);
          const answer: any = await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(Error("InfluxDB-Abfragezeit überschritten")),
              15000,
            );
            this.adapter.sendTo(instance, "query", query, (r: any) => {
              clearTimeout(timer);
              resolve(r);
            });
          });
          if (answer?.error || !Array.isArray(answer?.result))
            throw Error("InfluxDB-Auswertung fehlgeschlagen");
          return parseFlux(answer.result.flat(), m, start, end, period);
        }
      }
      // Exact raw samples; refuse truncated responses rather than invent totals.
      const response: any = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("Historienadapter antwortet nicht")),
          15000,
        );
        this.adapter.sendTo(
          this.config().historyInstance,
          "getHistory",
          {
            id: m.id,
            options: {
              start: start - (m.maxGapSeconds ?? 3600) * 1000,
              end,
              aggregate: "none",
              count: 10001,
              limit: 10001,
              ignoreNull: false,
              returnNewestEntries: false,
              removeBorderValues: true,
            },
          },
          (r: any) => {
            clearTimeout(timer);
            resolve(r);
          },
        );
      });
      if (response?.error) throw Error("Historie konnte nicht gelesen werden");
      if (!Array.isArray(response?.result))
        throw Error("Ungültige Historienantwort");
      if (response.result.length >= 10000)
        throw Error("Zu viele Historienpunkte; Zeitraum verkürzen");
      return summarize(response.result, m, start, end, period);
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.running--;
    }
  }
  clear() {
    this.cache.clear();
  }
}
