import { validateBatteryTelemetry } from "./battery.js";
export type Dimension =
  "power" | "energy" | "soc" | "voltage" | "current" | "temperature" | "status";
export interface Mapping {
  key: string;
  id: string;
  name: string;
  dimension: Dimension;
  unit: string;
  scale?: number;
  invert?: boolean;
  staleSeconds: number;
  jsonPath?: string;
  timestampPath?: string;
  group?: string;
  role?: string;
  history?: boolean;
  maxGapSeconds?: number;
  rollover?: number;
  batteryEnvelope?: boolean;
  availabilityId?: string;
}
export interface Settings {
  mappings: Mapping[];
  cards: Record<string, any>;
  historyInstance: string;
  importPrice: number | null;
  exportPrice: number | null;
}
export const defaults: Settings = {
  mappings: [],
  cards: { flow: { style: "3d", why: true }, devices: {}, stats: {}, room: {} },
  historyInstance: "influxdb.0",
  importPrice: null,
  exportPrice: null,
};
const units: Record<string, Record<string, number>> = {
  power: { W: 1, kW: 1000, MW: 1e6 },
  energy: { Wh: 0.001, kWh: 1, MWh: 1000 },
  soc: { "%": 1 },
  voltage: { V: 1, mV: 0.001 },
  current: { A: 1, mA: 0.001 },
  temperature: { "°C": 1, C: 1 },
  status: { "": 1 },
};
export const baseUnit: Record<Dimension, string> = {
  power: "W",
  energy: "kWh",
  soc: "%",
  voltage: "V",
  current: "A",
  temperature: "°C",
  status: "",
};
export function validateSettings(input: any): Settings {
  if (!input || !Array.isArray(input.mappings) || input.mappings.length > 200)
    throw Error("Maximal 200 Zuordnungen erlaubt");
  const keys = new Set<string>();
  const sources = new Set<string>();
  const mappings = input.mappings.map((m: any) => {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(m.key) || keys.has(m.key))
      throw Error("Ungültiger oder doppelter Schlüssel");
    keys.add(m.key);
    const source = String(m.id) + "|" + String(m.jsonPath || "");
    if (sources.has(source))
      throw Error(
        "Doppelte Messquelle: verwenden Sie denselben Schlüssel in mehreren Karten",
      );
    sources.add(source);
    if (
      typeof m.id !== "string" ||
      !m.id ||
      m.id.length > 512 ||
      /[\x00-\x1f*]/.test(m.id) ||
      m.id.startsWith("system.")
    )
      throw Error("Ungültiger Datenpunkt");
    if (
      m.availabilityId &&
      (typeof m.availabilityId !== "string" ||
        /[\x00-\x1f*]/.test(m.availabilityId) ||
        m.availabilityId.startsWith("system.") ||
        m.availabilityId.length > 512)
    )
      throw Error("Ungültiger Verfügbarkeitsdatenpunkt");
    if (!units[m.dimension] || !Object.hasOwn(units[m.dimension], m.unit))
      throw Error("Einheit passt nicht zum Messwert");
    if (
      !Number.isFinite(m.staleSeconds) ||
      m.staleSeconds < 5 ||
      m.staleSeconds > 604800
    )
      throw Error("Ungültige Gültigkeitsdauer");
    if (
      m.scale !== undefined &&
      (!Number.isFinite(m.scale) || m.scale <= 0 || m.scale > 1e6)
    )
      throw Error("Ungültiger Faktor");
    for (const path of [m.jsonPath, m.timestampPath])
      if (
        path &&
        (!/^[a-zA-Z0-9_.]+$/.test(path) ||
          path
            .split(".")
            .some((p: string) =>
              ["__proto__", "constructor", "prototype"].includes(p),
            ))
      )
        throw Error("Ungültiger JSON-Pfad");
    if (
      m.maxGapSeconds !== undefined &&
      (!Number.isFinite(m.maxGapSeconds) ||
        m.maxGapSeconds < 1 ||
        m.maxGapSeconds > 604800)
    )
      throw Error("Ungültige Historienlücke");
    if (
      m.rollover !== undefined &&
      (!Number.isFinite(m.rollover) || m.rollover <= 0)
    )
      throw Error("Ungültiger Zählerüberlauf");
    return {
      key: m.key,
      id: m.id,
      name: String(m.name || m.key).slice(0, 120),
      dimension: m.dimension,
      unit: m.unit,
      staleSeconds: m.staleSeconds,
      scale: m.scale,
      invert: !!m.invert,
      jsonPath: m.jsonPath,
      timestampPath: m.timestampPath,
      role: String(m.role || "").slice(0, 40),
      group: String(m.group || "").slice(0, 80),
      history: !!m.history,
      maxGapSeconds: m.maxGapSeconds,
      rollover: m.rollover,
      batteryEnvelope: !!m.batteryEnvelope,
      availabilityId: m.availabilityId,
    } as Mapping;
  });
  if (!/^(influxdb|history|sql)\.\d+$/.test(input.historyInstance))
    throw Error("Ungültiger Historienadapter");
  for (const k of ["importPrice", "exportPrice"])
    if (
      input[k] !== null &&
      (!Number.isFinite(input[k]) || input[k] < 0 || input[k] > 10)
    )
      throw Error("Preis muss EUR/kWh oder leer sein");
  const cards = JSON.parse(JSON.stringify(input.cards || defaults.cards));
  if (JSON.stringify(cards).length > 100000)
    throw Error("Kartenkonfiguration zu groß");
  function check(value: any): void {
    if (
      typeof value === "string" &&
      (/(?:https?:|javascript:|data:|\/\/)/i.test(value) || /[<>]/.test(value))
    )
      throw Error("Externe Inhalte und HTML sind nicht erlaubt");
    if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(k))
          throw Error("Ungültiger Schlüssel");
        check(v);
      }
  }
  check(cards);
  return {
    mappings,
    cards,
    historyInstance: input.historyInstance,
    importPrice: input.importPrice,
    exportPrice: input.exportPrice,
  };
}
export function extract(value: any, path?: string): any {
  if (!path) return value;
  const obj = typeof value === "string" ? JSON.parse(value) : value;
  return path
    .split(".")
    .reduce((v, k) => (v && Object.hasOwn(v, k) ? v[k] : undefined), obj);
}
export function normalize(value: any, m: Mapping): number | null {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const v =
    n * units[m.dimension][m.unit] * (m.scale ?? 1) * (m.invert ? -1 : 1);
  if (!Number.isFinite(v) || (m.dimension === "soc" && (v < 0 || v > 100)))
    return null;
  return v;
}
export function reading(
  state: any,
  m: Mapping,
  now = Date.now(),
  availability?: any,
) {
  let ts = state?.ts;
  let value: any = null;
  let reason = "nicht verfügbar";
  try {
    if (m.timestampPath && state) {
      const raw = extract(state.val, m.timestampPath);
      ts = typeof raw === "number" ? raw : Date.parse(raw);
    }
    if (m.availabilityId && (availability?.val !== true || availability?.q))
      reason = "Quelle offline";
    else if (!state) reason = "fehlt";
    else if (!Number.isFinite(ts) || ts > now + 60000)
      reason = "ungültiger Zeitstempel";
    else if (now - ts > m.staleSeconds * 1000) reason = "veraltet";
    else if (state.q) reason = "Qualitätsfehler";
    else {
      if (m.batteryEnvelope) validateBatteryTelemetry(state.val, now);
      value =
        m.dimension === "status"
          ? extract(state.val, m.jsonPath)
          : normalize(extract(state.val, m.jsonPath), m);
      reason = value === null ? "ungültiger Wert" : "ok";
    }
  } catch {
    reason = m.batteryEnvelope
      ? "ungültige Batterie-Telemetrie"
      : "ungültiges JSON";
  }
  return {
    key: m.key,
    id: m.id,
    name: m.name,
    value,
    unit: baseUnit[m.dimension],
    timestamp: Number.isFinite(ts) ? ts : null,
    quality: reason,
    role: m.role,
    group: m.group,
  };
}
export function aggregate(values: (number | null)[]): number | null {
  return !values.length || values.some((v) => v === null)
    ? null
    : values.reduce<number>((a, v) => a + v!, 0);
}
export function balance(
  pv: number | null,
  grid: number | null,
  battery: number | null,
  house: number | null,
  consumers: (number | null)[],
) {
  // Grid positive = import; battery positive = charging.
  const supply =
    pv === null || grid === null || battery === null
      ? null
      : pv + grid - battery;
  const measured = aggregate(consumers);
  return {
    calculatedHouse: supply,
    residual: house === null || supply === null ? null : supply - house,
    unmeasured: house === null || measured === null ? null : house - measured,
  };
}
export function batterySoc(
  items: { soc: number | null; capacity: number | null }[],
): number | null {
  if (
    !items.length ||
    items.some((x) => x.soc === null || x.capacity === null || x.capacity <= 0)
  )
    return null;
  return (
    items.reduce((a, b) => a + b.soc! * b.capacity!, 0) /
    items.reduce((a, b) => a + b.capacity!, 0)
  );
}
