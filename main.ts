import * as utils from "@iobroker/adapter-core";
import path from "node:path";
import {
  defaults,
  validateSettings,
  Settings,
  reading,
  baseUnit,
} from "./lib/model.js";
import { HistoryService } from "./lib/history.js";
import { DashboardServer, passwordMatches } from "./lib/server.js";
export class EnergyCockpit extends utils.Adapter {
  private settingsValue: Settings = structuredClone(defaults);
  private values = new Map<string, any>();
  private server?: DashboardServer;
  private timer?: ioBroker.Interval;
  private ids = new Set<string>();
  private historyService = new HistoryService(this, () => this.settingsValue);
  private browsing?: { time: number; objects: any[] };
  constructor(options: Partial<utils.AdapterOptions> = {}) {
    super({ ...options, name: "energy-cockpit" });
    this.on("ready", () =>
      this.ready().catch((e) => {
        this.log.error(`Startup failed: ${e.message}`);
        this.setState("info.connection", false, true);
      }),
    );
    this.on("stateChange", (id, state) => {
      if (this.ids.has(id)) this.values.set(id, state);
    });
    this.on("unload", (callback) => {
      this.shutdown().finally(callback);
    });
    this.on("message", (msg) => this.message(msg));
  }
  private async ready() {
    const native = this.config as any;
    this.settingsValue = validateSettings({ ...defaults, ...native.settings });
    await this.setStateAsync("info.connection", false, true);
    await this.subscribeMappings();
    this.server = new DashboardServer(
      {
        authenticate: async (user: string, pw: string) => {
          if (user === "cockpit" && native.dashboardPasswordHash)
            return passwordMatches(pw, native.dashboardPasswordHash);
          if (user !== "admin") return false;
          return this.checkPasswordAsync(user, pw);
        },
        snapshot: () => this.snapshot(),
        settings: () => this.settingsValue,
        save: (x: any) => this.save(x),
        browse: (q: string) => this.browse(q),
        history: (r: any) => this.historyService.query(r),
      },
      path.join(__dirname, "../www"),
    );
    let tls: any;
    if (native.secure !== false) {
      const certs = await this.getForeignObjectAsync("system.certificates");
      const c = certs?.native?.certificates;
      if (!c?.defaultPrivate || !c?.defaultPublic)
        throw Error(
          "TLS certificates missing; configure ioBroker certificates",
        );
      tls = { key: c.defaultPrivate, cert: c.defaultPublic };
    }
    await this.server.start({
      port: native.port || 8082,
      bind: native.bind || "127.0.0.1",
      tls,
    });
    this.timer = this.setInterval(() => {
      const data = this.snapshot();
      this.setState(
        "info.connection",
        data.readings.some((r: any) => r.quality === "ok"),
        true,
      );
    }, 10000);
    this.log.info(
      `Dashboard listening on port ${native.port || 8082}; authentication required`,
    );
  }
  private async subscribeMappings() {
    const next = new Set(
      this.settingsValue.mappings.flatMap((m) =>
        m.availabilityId ? [m.id, m.availabilityId] : [m.id],
      ),
    );
    for (const id of this.ids)
      if (!next.has(id)) {
        await this.unsubscribeForeignStatesAsync(id);
        this.values.delete(id);
      }
    for (const id of next) {
      if (!this.ids.has(id)) await this.subscribeForeignStatesAsync(id);
      this.values.set(id, await this.getForeignStateAsync(id));
    }
    this.ids = next;
  }
  snapshot() {
    const readings = this.settingsValue.mappings.map((m) =>
      reading(
        this.values.get(m.id),
        m,
        Date.now(),
        m.availabilityId ? this.values.get(m.availabilityId) : undefined,
      ),
    );
    const states: Record<string, any> = {};
    for (const [i, r] of readings.entries()) {
      const m = this.settingsValue.mappings[i];
      states["sensor." + m.key] = {
        state: r.quality === "ok" ? String(r.value) : "unavailable",
        attributes: {
          friendly_name: m.name,
          unit_of_measurement: baseUnit[m.dimension],
          device_class: m.dimension === "soc" ? "battery" : m.dimension,
          state_class:
            m.dimension === "energy" ? "total_increasing" : "measurement",
        },
        last_updated: r.timestamp ? new Date(r.timestamp).toISOString() : null,
      };
    }
    return {
      timestamp: Date.now(),
      states,
      readings,
      version: this.version,
      timezone: "Europe/Berlin",
      demo: false,
    };
  }
  async save(input: any) {
    const settings = validateSettings(input);
    for (const m of settings.mappings) {
      const o = await this.getForeignObjectAsync(m.id);
      if (!o || o.type !== "state" || o.common.read === false)
        throw Error(`Datenpunkt nicht lesbar: ${m.key}`);
    }
    this.settingsValue = settings;
    this.historyService.clear();
    await this.subscribeMappings();
    // Persist only the adapter-owned configuration object. Controller restarts this instance.
    await this.extendForeignObjectAsync("system.adapter." + this.namespace, {
      native: { settings },
    });
    return { ok: true };
  }
  async browse(query: string) {
    if (!this.browsing || Date.now() - this.browsing.time > 60000) {
      const objs = await this.getForeignObjectsAsync("*", "state");
      this.browsing = {
        time: Date.now(),
        objects: Object.values(objs).filter(
          (o: any) =>
            !o._id.startsWith("system.") &&
            !o._id.startsWith("admin.") &&
            o.common?.read !== false &&
            !/(password|secret|token|credential)/i.test(o._id),
        ),
      };
    }
    const q = query.toLocaleLowerCase("de");
    const matches = this.browsing.objects
      .filter((o) => {
        const n =
          typeof o.common.name === "object"
            ? o.common.name.de || o.common.name.en
            : o.common.name;
        return (o._id + " " + n).toLocaleLowerCase("de").includes(q);
      })
      .slice(0, 80);
    const result = [];
    for (const o of matches) {
      const s = await this.getForeignStateAsync(o._id);
      const c = o.common;
      result.push({
        id: o._id,
        name: typeof c.name === "object" ? c.name.de || c.name.en : c.name,
        unit: c.unit || "",
        role: c.role || "",
        value: typeof s?.val === "string" ? s.val.slice(0, 100) : s?.val,
        ts: s?.ts,
        q: s?.q,
        history: !!c.custom?.[this.settingsValue.historyInstance]?.enabled,
        suggestion: this.suggest(o),
      });
    }
    return result;
  }
  private suggest(o: any) {
    const text = (
      o._id +
      " " +
      JSON.stringify(o.common.name) +
      " " +
      o.common.role
    ).toLowerCase();
    if (/soc|state.of.charge/.test(text)) return "soc";
    if (/temperature|temperatur/.test(text)) return "temperature";
    if (/yield|energy|energie|verbrauch.*gesamt/.test(text)) return "energy";
    if (/power|leistung|watt/.test(text)) return "power";
    return "";
  }
  private async message(msg: any) {
    if (!msg?.callback) return;
    try {
      if (msg.command === "browse")
        this.sendTo(
          msg.from,
          msg.command,
          await this.browse(msg.message?.query || ""),
          msg.callback,
        );
      else if (msg.command === "snapshot")
        this.sendTo(msg.from, msg.command, this.snapshot(), msg.callback);
      else
        this.sendTo(
          msg.from,
          msg.command,
          { error: "Unsupported command" },
          msg.callback,
        );
    } catch {
      this.sendTo(
        msg.from,
        msg.command,
        { error: "Request failed" },
        msg.callback,
      );
    }
  }
  private async shutdown() {
    if (this.timer) this.clearInterval(this.timer);
    await this.server?.stop();
    for (const id of this.ids) await this.unsubscribeForeignStatesAsync(id);
    await this.setStateAsync("info.connection", false, true);
  }
}
if (require.main === module) new EnergyCockpit();
else module.exports = (options: any) => new EnergyCockpit(options);
