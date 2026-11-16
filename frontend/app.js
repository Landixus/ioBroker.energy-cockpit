/* Standalone ioBroker host for the original Energy-Cockpit custom elements. */
import { mountHistory } from "./history-view.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let csrf = "",
  settings,
  snapshot,
  card,
  draft,
  step = 0,
  demo = false,
  authenticated = false,
  stopped = false;
let theme = localStorage.getItem("ec-theme") || "dunkel";
const steps = [
  "Solaranlagen",
  "Netzzähler",
  "Batterien",
  "Hausverbrauch",
  "Verbraucher & Räume",
  "InfluxDB-Historie",
  "Strompreise",
  "Aussehen",
  "Batter4802",
  "Diagnose & Speichern",
];
const roleOptions = {
  pv: "Solar 1 Leistung",
  pv2: "Solar 2 Leistung",
  pv_total: "Solar Gesamtzähler",
  pv_today: "Solar Tagesertrag",
  grid: "Netzleistung (+ Bezug)",
  grid_import_total: "Bezug Gesamtzähler",
  grid_export_total: "Einspeisung Gesamtzähler",
  battery_power: "Batterie (+ Laden)",
  battery_charge: "Ladegerät: AC-Aufnahme (W)",
  battery_discharge: "Batterie-Wechselrichter: Abgabe (W)",
  battery_soc: "Batterie Ladestand",
  battery_voltage: "Batterie Spannung",
  battery_current: "Batterie Strom",
  battery_temperature: "Batterie Temperatur",
  house: "Hausleistung (gemessen)",
  home_total: "Haus Gesamtzähler",
  consumer: "Verbraucherleistung",
  consumer_energy: "Verbraucher Gesamtzähler",
  extra: "Zusatzwert",
};
const stepRoles = [
  ["pv", "pv2", "pv_total", "pv_today"],
  ["grid", "grid_import_total", "grid_export_total"],
  [
    "battery_power",
    "battery_charge",
    "battery_discharge",
    "battery_soc",
    "battery_voltage",
    "battery_current",
    "battery_temperature",
  ],
  ["house", "home_total"],
  ["consumer", "consumer_energy"],
  [],
  [],
  [],
  [
    "battery_power",
    "battery_charge",
    "battery_discharge",
    "battery_soc",
    "battery_voltage",
    "battery_current",
    "battery_temperature",
  ],
  [],
];
async function api(url, method = "GET", body) {
  const r = await fetch("api/" + url, {
    method,
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const error = Error(data.error || "Verbindung fehlgeschlagen");
    error.status = r.status;
    throw error;
  }
  return data;
}
function notice(text) {
  $("#notice").textContent = text;
}
function facade() {
  return {
    states: snapshot?.states || {},
    language: "de",
    locale: { language: "de", time_zone: "Europe/Berlin" },
    config: { currency: "EUR", time_zone: "Europe/Berlin" },
    themes: { darkMode: theme !== "hell" },
    callWS: async (r) => {
      if (demo) return {};
      try {
        const result = await api("history", "POST", r);
        if (
          Object.values(result).some(
            (rows) => !rows.length || rows.some((x) => x.missing),
          )
        ) {
          if (card && ["#stats", "#room"].includes(location.hash))
            card.hidden = true;
          throw Error(
            "Historie unvollständig. Die Original-Gesamtauswertung bleibt ausgeblendet; verfügbare Intervalle können einzeln geprüft werden.",
          );
        }
        return result;
      } catch (e) {
        notice(e.message);
        throw e;
      }
    },
    callApi: async () => {
      throw Error("Home-Assistant-Kalender sind nicht verfügbar");
    },
    callService: async () => {
      throw Error("Gerätesteuerung ist deaktiviert");
    },
  };
}
function generatedCards(config) {
  const a = (role) =>
    "sensor." + config.mappings.find((x) => x.role === role)?.key;
  const has = (role) => config.mappings.some((x) => x.role === role);
  const common = {
    theme,
    grid_price: config.importPrice ?? undefined,
    feed_in: config.exportPrice ?? undefined,
  };
  const flow = {
    ...common,
    style: "3d",
    why: true,
    strict_data: true,
    pv: has("pv")
      ? { entity: a("pv"), daily: has("pv_today") ? a("pv_today") : undefined }
      : undefined,
    pv2: has("pv2") ? { entity: a("pv2") } : undefined,
    grid: has("grid") ? { entity: a("grid") } : undefined,
    home: has("house")
      ? { entity: a("house") }
      : {
          name: has("battery_charge")
            ? "Hausverbrauch inkl. Ladegerät"
            : "Hausverbrauch (berechnet)",
        },
    batteries: [],
    consumers: [],
    rest: { name: "Weitere Hausverbraucher" },
  };
  const groups = new Map();
  for (const m of config.mappings.filter((m) =>
    m.role?.startsWith("battery_"),
  )) {
    const g = m.group || "Speicher";
    if (!groups.has(g)) groups.set(g, { name: g });
    const b = groups.get(g);
    const fields = {
      battery_power: "power",
      battery_charge: "power_charge",
      battery_discharge: "power_discharge",
      battery_soc: "soc",
      battery_voltage: "voltage",
      battery_current: "current",
      battery_temperature: "temp",
    };
    if (m.role === "battery_voltage" || m.role === "battery_current") {
      (b.extra ??= []).push({ entity: "sensor." + m.key, name: m.name });
    } else b[fields[m.role]] = "sensor." + m.key;
    if (m.role === "battery_charge") {
      b.charge_device = { name: m.name, entity: "sensor." + m.key };
      b.behind_meter = true;
    }
  }
  flow.batteries = [...groups.values()];
  const rooms = new Map();
  for (const m of config.mappings.filter((x) => x.role === "consumer")) {
    const room = m.group || "Weitere Verbraucher";
    if (!rooms.has(room)) rooms.set(room, { name: room, devices: [] });
    const energy = config.mappings.find(
      (x) =>
        x.role === "consumer_energy" &&
        x.group === m.group &&
        x.name === m.name,
    );
    rooms.get(room).devices.push({
      name: m.name,
      power: "sensor." + m.key,
      energy: energy ? "sensor." + energy.key : undefined,
      lock: true,
    });
  }
  flow.consumer_groups = [...rooms.values()].map((r) => ({
    name: r.name,
    items: r.devices.map((d) => ({ name: d.name, entity: d.power })),
  }));
  // External chargers remain visible in Devices, but their flow belongs to the battery branch.
  for (const m of config.mappings.filter((x) => x.role === "battery_charge")) {
    const room = m.group || "Batterie";
    if (!rooms.has(room)) rooms.set(room, { name: room, devices: [] });
    const energy = config.mappings.find(
      (x) =>
        x.role === "consumer_energy" &&
        x.group === m.group &&
        x.name === m.name,
    );
    rooms
      .get(room)
      .devices.push({
        name: m.name,
        power: "sensor." + m.key,
        energy: energy ? "sensor." + energy.key : undefined,
        lock: true,
      });
  }
  const stats = {
    ...common,
    pv_total: has("pv_total") ? a("pv_total") : undefined,
    grid_import_total: has("grid_import_total")
      ? a("grid_import_total")
      : undefined,
    grid_export_total: has("grid_export_total")
      ? a("grid_export_total")
      : undefined,
    home_power: has("house") ? a("house") : undefined,
  };
  const devices = {
    ...common,
    home: has("house") ? a("house") : undefined,
    rooms: [...rooms.values()],
  };
  const room = {
    theme,
    title: "Raum-Abrechnung",
    price: config.importPrice ?? undefined,
    devices: config.mappings
      .filter((x) => x.role === "consumer_energy")
      .map((x) => ({ energy: "sensor." + x.key, name: x.name })),
  };
  const out = { flow, devices, stats, room };
  for (const key of Object.keys(out))
    out[key] = { ...out[key], ...config.cards[key], theme, strict_data: true };
  return out;
}
function render() {
  const page = location.hash.slice(1) || "flow";
  document
    .querySelectorAll("nav a")
    .forEach((a) =>
      a.setAttribute("aria-current", a.hash === "#" + page ? "page" : "false"),
    );
  card = null;
  $("#main").replaceChildren();
  if (!settings) return;
  if (page === "setup") {
    draft ??= structuredClone(settings);
    renderSetup();
    return;
  }
  if (page === "diagnostics") {
    renderDiagnostics();
    return;
  }
  const configs = generatedCards(settings);
  if (!configs[page]) {
    location.hash = "flow";
    return;
  }
  if (page === "stats") mountHistory($("#main"), settings, snapshot, api, demo);
  if ((page === "stats" || page === "room") && settings.importPrice === null) {
    const note = document.createElement("div");
    note.className = "panel";
    note.textContent =
      "Noch kein Strompreis hinterlegt. Finanzberechnungen stehen nach der Einrichtung zur Verfügung.";
    $("#main").append(note);
    return;
  }
  const quality = document.createElement("div");
  quality.className = "quality-summary";
  quality.innerHTML = (snapshot?.readings || [])
    .filter((x) => x.quality !== "ok")
    .map(
      (x) => `<span class="badge bad">${esc(x.name)}: ${esc(x.quality)}</span>`,
    )
    .join("");
  $("#main").append(quality);
  card = document.createElement("energy-cockpit-" + page + "-card");
  card.setConfig(configs[page]);
  $("#main").append(card);
  card.hass = facade();
  if (page === "flow" && !settings.mappings.some((m) => m.role === "house")) {
    const warning = document.createElement("div");
    warning.className = "banner";
    warning.textContent = settings.mappings.some(
      (m) => m.role === "battery_charge",
    )
      ? "Hausverbrauch inkl. Ladegerät = Solar + Netzbezug − Einspeisung + Batterieabgabe. Weitere Hausverbraucher = Hausverbrauch abzüglich Ladegerät und einzeln gemessener Geräte. Fehlende Messwerte bleiben unbekannt."
      : "Hausverbrauch ist eine Bilanzberechnung. Ohne vollständige Erzeugungs-, Netz- und Batteriemessung ist er nicht verfügbar.";
    $("#main").prepend(warning);
  }
}
function renderDiagnostics() {
  const rows = snapshot?.readings || [];
  $("#main").innerHTML =
    `<section class="panel"><h1>Datenqualität & Diagnose</h1><p>${demo ? "DEMO · simulierte Werte" : "ioBroker · echte Zustände"} · Version ${esc(snapshot?.version || "")} · Europe/Berlin</p><div class="scroll"><table><thead><tr><th>Name / Datenpunkt</th><th>Wert</th><th>Stand</th><th>Qualität</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.name)}<br><small>${esc(r.id)}</small></td><td>${r.value === null ? "—" : esc(r.value)} ${esc(r.unit)}</td><td>${r.timestamp ? new Date(r.timestamp).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "—"}</td><td class="${r.quality === "ok" ? "ok" : "bad"}">${esc(r.quality)}</td></tr>`).join("")}</tbody></table></div><p>Vorzeichen: Netz positiv = Bezug, Batterie positiv = Laden. Nicht erfasste Verbraucher bleiben als Rest sichtbar. Steuerbefehle und BMS-Schreibzugriffe sind deaktiviert.</p></section>`;
}
function mappingForm() {
  return `<h2>Datenpunkt zuordnen</h2><label>Datenpunkte suchen<input id="search" placeholder="Name, Rolle oder ioBroker-ID" autocomplete="off"></label><div id="browse-results"></div><form id="mapping"><div class="grid"><label>Datenpunkt-ID<input name="id" required></label><label>Anzeigename<input name="name" required></label><label>Schlüssel<input name="key" pattern="[a-z][a-z0-9_]{0,63}" required></label><label>Energierolle<select name="role">${(stepRoles[step].length ? stepRoles[step] : Object.keys(roleOptions)).map((k) => `<option value="${k}">${roleOptions[k]}</option>`).join("")}</select></label><label>Messart<select name="dimension">${["power", "energy", "soc", "voltage", "current", "temperature", "status"].map((x, i) => `<option value="${x}">${["Leistung", "Energie", "Ladestand", "Spannung", "Strom", "Temperatur", "Status"][i]}</option>`).join("")}</select></label><label>Quelleinheit<select name="unit">${["W", "kW", "MW", "Wh", "kWh", "MWh", "%", "V", "mV", "A", "mA", "°C", ""].map((x) => `<option>${x}</option>`).join("")}</select></label><label>Raum / eigenständige Batterie<input name="group"></label><label>Nach Sekunden veraltet<input name="staleSeconds" type="number" min="5" max="604800" value="180" required></label><label>Umrechnungsfaktor<input name="scale" type="number" min="0.000001" step="any" value="1"></label><label>JSON-Feld (optional)<input name="jsonPath" placeholder="voltage_v"></label><label>JSON-Zeitstempel (optional)<input name="timestampPath" placeholder="timestamp"></label></div><label><span><input name="invert" type="checkbox"> Vorzeichen umkehren</span></label><label><span><input name="history" type="checkbox"> Vorhandene Historie lesen</span></label><button>Zuordnung übernehmen</button></form>`;
}
function renderSetup() {
  $("#main").innerHTML =
    `<section class="panel"><h1>Einrichtungsassistent</h1><div class="steps">${steps.map((s, i) => `<button data-step="${i}" class="${i === step ? "active" : ""}">${i + 1}. ${s}</button>`).join("")}</div><h2>${steps[step]}</h2><div id="step-content"></div><p id="setup-error" role="alert"></p><div class="row"><button id="back" ${step === 0 ? "disabled" : ""}>Zurück</button><button id="next" ${step === 9 ? "disabled" : ""}>Weiter</button><button id="save">Prüfen & speichern</button></div></section><section id="preview"></section>`;
  const target = $("#step-content");
  if (step < 5 || step === 8) {
    target.innerHTML =
      (step === 8
        ? "<p>Optional: vorhandene, verifizierte MQTT-Telemetrie verwenden. JSON-Feld und Quellzeitstempel angeben. Keine Protokollannahmen, keine BMS-Befehle. Leistung nur bei verifizierter Vorzeichenrichtung zuordnen.</p>"
        : "") +
      mappingForm() +
      `<h2>Zuordnungen</h2><div id="mapping-list"></div>`;
    renderMappingList();
    wireMapping();
  } else if (step === 5) {
    target.innerHTML = `<label>Historieninstanz<input id="history-instance" value="${esc(draft.historyInstance)}"></label><p>Lesender Zugriff über ioBroker getHistory. Vorhandenes Logging bleibt unverändert. Zählerlücken, Rücksetzungen und unvollständige Zeiträume werden nicht als vollständige Energie ausgegeben. Berichtszeitzone: Europe/Berlin.</p>`;
    $("#history-instance").onchange = (e) =>
      (draft.historyInstance = e.target.value);
  } else if (step === 6) {
    target.innerHTML = `<div class="grid"><label>Bezugspreis EUR/kWh<input id="import-price" type="number" min="0" max="10" step=".0001" value="${draft.importPrice ?? ""}"></label><label>Einspeisevergütung EUR/kWh<input id="export-price" type="number" min="0" max="10" step=".0001" value="${draft.exportPrice ?? ""}"></label></div><p>Leer bedeutet unbekannt. Feste Preise sind Szenariowerte; historische Tarifwechsel müssen getrennt berücksichtigt werden.</p>`;
    for (const [id, key] of [
      ["import-price", "importPrice"],
      ["export-price", "exportPrice"],
    ])
      $("#" + id).onchange = (e) =>
        (draft[key] = e.target.value === "" ? null : Number(e.target.value));
  } else if (step === 7) {
    target.innerHTML = `<label>Darstellung<select id="appearance"><option value="3d">Original 3D-Haus</option><option value="classic">Klassischer Energiefluss</option></select></label><label><span><input id="compact" type="checkbox" ${draft.cards.flow?.compact ? "checked" : ""}> Kompakte Mobilansicht</span></label><details><summary>Erweiterte Original-Kartenoptionen (JSON)</summary><p>Sensoren heißen sensor.&lt;Zuordnungsschlüssel&gt;. Alle Originaloptionen sind verfügbar, soweit sie keine Home-Assistant-Dienste benötigen.</p><textarea id="advanced">${esc(JSON.stringify(draft.cards, null, 2))}</textarea><button id="apply-advanced">Übernehmen</button></details>`;
    $("#appearance").value =
      draft.cards.flow?.style === "3d" ? "3d" : "classic";
    $("#appearance").onchange = (e) => {
      draft.cards.flow.style = e.target.value;
      preview();
    };
    $("#compact").onchange = (e) => {
      draft.cards.flow.compact = e.target.checked;
      preview();
    };
    $("#apply-advanced").onclick = () => {
      try {
        draft.cards = JSON.parse($("#advanced").value);
        preview();
      } catch (e) {
        $("#setup-error").textContent = e.message;
      }
    };
  } else {
    target.innerHTML = `<p>${draft.mappings.length} Zuordnungen. Vorschläge und Vorzeichen vor dem Speichern prüfen.</p><pre>${esc(JSON.stringify(draft, null, 2))}</pre>`;
  }
  document.querySelectorAll("[data-step]").forEach(
    (b) =>
      (b.onclick = () => {
        step = Number(b.dataset.step);
        renderSetup();
      }),
  );
  $("#back").onclick = () => {
    step--;
    renderSetup();
  };
  $("#next").onclick = () => {
    step++;
    renderSetup();
  };
  $("#save").onclick = save;
  preview();
}
function renderMappingList() {
  const target = $("#mapping-list");
  if (!target) return;
  target.innerHTML = draft.mappings
    .filter((m) => stepRoles[step].includes(m.role))
    .map(
      (m) =>
        `<p><b>${esc(m.name)}</b> · ${esc(roleOptions[m.role])} · ${esc(m.id)} <button data-edit="${m.key}">Bearbeiten</button> <button data-remove="${m.key}">Entfernen</button></p>`,
    )
    .join("");
  target.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        draft.mappings = draft.mappings.filter(
          (m) => m.key !== b.dataset.remove,
        );
        renderMappingList();
        preview();
      }),
  );
  target.querySelectorAll("[data-edit]").forEach(
    (b) =>
      (b.onclick = () => {
        const m = draft.mappings.find((x) => x.key === b.dataset.edit);
        for (const [k, v] of Object.entries(m)) {
          const el = $("#mapping").elements[k];
          if (el) {
            if (el.type === "checkbox") el.checked = v;
            else el.value = v ?? "";
          }
        }
      }),
  );
}
function wireMapping() {
  let timer;
  $("#search").oninput = (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const results = demo
          ? []
          : await api("datapoints?q=" + encodeURIComponent(e.target.value));
        $("#browse-results").innerHTML =
          "<table>" +
          results
            .map(
              (r, i) =>
                `<tr><td>${esc(r.name)}<br><small>${esc(r.id)}</small></td><td>${esc(r.value)} ${esc(r.unit)}<br><small>${r.ts ? new Date(r.ts).toLocaleString("de-DE") : "kein Zustand"} · q=${esc(r.q)}</small></td><td><button type="button" data-pick="${i}">Wählen</button></td></tr>`,
            )
            .join("") +
          "</table>";
        document.querySelectorAll("[data-pick]").forEach(
          (b) =>
            (b.onclick = () => {
              const r = results[Number(b.dataset.pick)],
                f = $("#mapping").elements;
              f.id.value = r.id;
              f.name.value = r.name || r.id;
              f.key.value = "m_" + Date.now().toString(36);
              if (r.unit) f.unit.value = r.unit;
              if (r.suggestion) f.dimension.value = r.suggestion;
              f.history.checked = r.history;
            }),
        );
      } catch (e) {
        $("#setup-error").textContent = e.message;
      }
    }, 300);
  };
  $("#mapping").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      m = Object.fromEntries(f);
    for (const k of ["scale", "staleSeconds"]) m[k] = Number(m[k]);
    m.invert = f.has("invert");
    m.history = f.has("history");
    m.batteryEnvelope = step === 8;
    if (!m.jsonPath) delete m.jsonPath;
    if (!m.timestampPath) delete m.timestampPath;
    draft.mappings = draft.mappings.filter((x) => x.key !== m.key);
    draft.mappings.push(m);
    renderMappingList();
    preview();
  };
}
function preview() {
  const p = $("#preview");
  if (!p) return;
  p.replaceChildren();
  const title = document.createElement("h2");
  title.textContent = "Live-Vorschau · gespeicherte Datenquellen";
  p.append(title);
  const c = document.createElement("energy-cockpit-flow-card");
  c.setConfig(generatedCards(draft).flow);
  p.append(c);
  c.hass = facade();
}
async function save() {
  if (demo) {
    settings = structuredClone(draft);
    notice("DEMO · Änderungen gelten nur in dieser Vorschau.");
    return;
  }
  try {
    await api("config", "PUT", draft);
    settings = structuredClone(draft);
    notice("Gespeichert. Die Adapterinstanz übernimmt die Konfiguration.");
  } catch (e) {
    $("#setup-error").textContent = e.message;
  }
}
async function refresh() {
  if (stopped) return;
  if (!demo && authenticated) {
    try {
      snapshot = await api("snapshot");
      if (card) card.hass = facade();
      if (location.hash === "#diagnostics") renderDiagnostics();
      const bad = snapshot.readings.filter((x) => x.quality !== "ok");
      if (bad.length)
        notice(
          `${bad.length} Messwerte fehlen oder sind veraltet. Details unter Diagnose.`,
        );
      else if (!snapshot.readings.length)
        notice("Noch keine Messwerte zugeordnet. Bitte Einrichtung öffnen.");
    } catch (e) {
      notice("Verbindung unterbrochen: " + e.message);
      if (e.status === 401) {
        authenticated = false;
        $("#login-error").textContent =
          "Bitte nach dem Neustart erneut anmelden.";
        $("#login").showModal();
      }
      if (snapshot) {
        for (const s of Object.values(snapshot.states)) s.state = "unavailable";
        if (card) card.hass = facade();
      }
    }
  }
  setTimeout(refresh, 3000);
}
async function start() {
  try {
    csrf = (await api("session")).csrf;
    authenticated = true;
    settings = await api("config");
    snapshot = await api("snapshot");
    $("#login").close();
    render();
  } catch {
    $("#login").showModal();
  }
}
$("#login-form").onsubmit = async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    csrf = (await api("login", "POST", Object.fromEntries(form))).csrf;
    e.target.elements.password.value = "";
    demo = false;
    await start();
  } catch (e) {
    $("#login-error").textContent = e.message;
  }
};
function enterDemo() {
  demo = true;
  $("#login").close();
  const defs = [
    ["pv", 2100, "power", "W", "pv"],
    ["grid", 380, "power", "W", "grid"],
    ["battery", 640, "power", "W", "battery_power"],
    ["soc", 64, "soc", "%", "battery_soc"],
    ["home", 1840, "power", "W", "house"],
    ["consumer", 420, "power", "W", "consumer"],
  ];
  settings = {
    mappings: defs.map(([key, _v, dimension, unit, role]) => ({
      key,
      id: "demo." + key,
      name: roleOptions[role],
      dimension,
      unit,
      role,
      staleSeconds: 180,
      group: role.startsWith("battery") ? "Demo-Speicher" : "Küche",
    })),
    cards: {
      flow: { style: "3d", why: true },
      devices: {},
      stats: {},
      room: {},
    },
    historyInstance: "influxdb.0",
    importPrice: null,
    exportPrice: null,
  };
  snapshot = {
    version: "Demo",
    states: Object.fromEntries(
      defs.map(([key, value, _d, unit]) => [
        "sensor." + key,
        {
          state: String(value),
          attributes: { unit_of_measurement: unit },
          last_updated: new Date().toISOString(),
        },
      ]),
    ),
    readings: settings.mappings.map((m, i) => ({
      ...m,
      value: defs[i][1],
      quality: "ok",
      timestamp: Date.now(),
    })),
  };
  draft = null;
  notice("DEMO · Alle Messwerte sind simuliert. Keine Verbindung zu Geräten.");
  render();
}
$("#demo").onclick = () => {
  if (demo) {
    demo = false;
    draft = null;
    notice("");
    start();
  } else enterDemo();
};
$("#login-demo").onclick = enterDemo;
$("#theme").onclick = () => {
  theme = theme === "hell" ? "dunkel" : "hell";
  localStorage.setItem("ec-theme", theme);
  document.body.classList.toggle("light", theme === "hell");
  render();
};
document.body.classList.toggle("light", theme === "hell");
$("#fullscreen").onclick = () =>
  document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen();
$("#logout").onclick = async () => {
  if (authenticated) await api("logout", "POST");
  authenticated = false;
  demo = false;
  settings = null;
  snapshot = null;
  draft = null;
  $("#main").replaceChildren();
  $("#login").showModal();
};
$("#detail-close").onclick = () => $("#detail").close();
document.addEventListener("hass-more-info", async (e) => {
  const id = e.detail.entityId;
  const m = settings.mappings.find((x) => "sensor." + x.key === id);
  if (!m) return;
  const r = snapshot.readings.find((x) => x.key === m.key);
  $("#detail-content").innerHTML =
    `<h2>${esc(m.name)}</h2><p>${esc(r?.value ?? "—")} ${esc(r?.unit)} · ${esc(r?.quality)}</p><p>${esc(m.id)}</p><div id="history-detail"></div>`;
  $("#detail").showModal();
  if (m.history && !demo) {
    try {
      const result = await facade().callWS({
        type: "recorder/statistics_during_period",
        start_time: new Date(Date.now() - 86400000).toISOString(),
        period: "hour",
        statistic_ids: [id],
        types: ["mean", "change"],
      });
      const rows = result[id] || [];
      $("#history-detail").innerHTML =
        "<h3>Letzte 24 Stunden</h3><table>" +
        rows
          .map(
            (x) =>
              `<tr><td>${new Date(x.start).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</td><td>${x.missing ? "Lücke" : esc(x.change ?? x.mean ?? "—")}</td></tr>`,
          )
          .join("") +
        "</table>";
    } catch (e) {
      $("#history-detail").textContent = e.message;
    }
  }
});
window.addEventListener("hashchange", render);
window.addEventListener("beforeunload", () => {
  stopped = true;
});
start();
refresh();
