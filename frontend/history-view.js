const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const number = (v) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString("de-DE", { maximumFractionDigits: 3 });
export function reportingRange(period, now = Date.now(), previous = false) {
  const D = globalThis.EnergyCockpitClock.BerlinDate;
  const end = new D(now),
    start = new D(now);
  start.setHours(0, 0, 0, 0);
  if (period === "week")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === "month") start.setDate(1);
  if (period === "year") {
    start.setMonth(0, 1);
  }
  if (previous) {
    if (period === "year") {
      start.setFullYear(start.getFullYear() - 1);
      end.setFullYear(end.getFullYear() - 1);
    } else if (period === "month") {
      start.setMonth(start.getMonth() - 1);
      end.setMonth(end.getMonth() - 1);
    } else {
      const days = period === "week" ? 7 : 1;
      start.setDate(start.getDate() - days);
      end.setDate(end.getDate() - days);
    }
  }
  return { start_time: start.toISOString(), end_time: end.toISOString() };
}
export function mountHistory(target, settings, snapshot, api, demo) {
  const measurements = settings.mappings.filter(
    (m) => m.history && ["power", "energy"].includes(m.dimension),
  );
  const energy = snapshot.readings.filter((r) => r.unit === "kWh");
  const root = document.createElement("section");
  root.className = "panel";
  target.append(root);
  root.innerHTML = `<h1>Energie & Verlauf</h1><div class="grid">${energy.map((r) => `<div><span class="muted">${esc(r.name)}</span><h2>${r.quality === "ok" ? number(r.value) : "—"} kWh</h2><small>${esc(r.quality)} · vorhandener Zählerstand</small></div>`).join("")}</div><div class="grid"><label>Messreihe<select id="history-series">${measurements.map((m) => `<option value="${m.key}">${esc(m.name)}</option>`).join("")}</select></label><label>Berichtszeitraum<select id="history-period"><option value="day">Heute</option><option value="week">Diese Woche</option><option value="month">Dieser Monat</option><option value="year">Dieses Jahr</option></select></label></div><button id="history-load" ${!measurements.length || demo ? "disabled" : ""}>Verlauf laden & vergleichen</button><p id="history-status" role="status">${demo ? "Demo enthält keine erfundene Historie." : !measurements.length ? "Noch keine vorhandene Historie zugeordnet." : "Lesender Zugriff. Vergleich mit dem gleichen Abschnitt des vorherigen Zeitraums."}</p><div id="history-chart"></div><div id="history-rows"></div>`;
  root.querySelector("#history-load").onclick = async () => {
    const status = root.querySelector("#history-status");
    status.textContent = "Historie wird gelesen …";
    const button = root.querySelector("#history-load");
    button.disabled = true;
    try {
      const m = measurements.find(
          (x) => x.key === root.querySelector("#history-series").value,
        ),
        period = root.querySelector("#history-period").value,
        alias = "sensor." + m.key;
      const query = (previous) =>
        api("history", "POST", {
          type: "recorder/statistics_during_period",
          ...reportingRange(period, Date.now(), previous),
          period:
            period === "year" ? "month" : period === "day" ? "hour" : "day",
          statistic_ids: [alias],
          types: [m.dimension === "energy" ? "change" : "mean"],
        });
      const current = await query(false),
        prior = await query(true),
        rows = current[alias] || [],
        old = prior[alias] || [];
      const complete = rows.length && rows.every((r) => !r.missing),
        priorComplete = old.length && old.every((r) => !r.missing);
      const value = (r) => (m.dimension === "energy" ? r.change : r.mean);
      const sum = (list) => list.reduce((s, r) => s + (value(r) ?? 0), 0);
      const total = m.dimension === "energy" && complete ? sum(rows) : null,
        previous = m.dimension === "energy" && priorComplete ? sum(old) : null;
      const price = [
        "grid_import_total",
        "home_total",
        "consumer_energy",
      ].includes(m.role)
        ? settings.importPrice
        : null;
      status.textContent = `${rows.filter((r) => !r.missing).length}/${rows.length} Intervalle verfügbar. ${m.dimension === "energy" ? `Summe: ${number(total)} kWh · Vergleich: ${number(previous)} kWh${total !== null && price !== null ? ` · Kostenannahme: ${number(total * price)} EUR` : ""}` : "Leistung als zeitgewichteter Mittelwert."} ${rows.some((r) => r.estimatedBoundaries) ? "Periodengrenzen sind auf den Messrhythmus angenähert." : ""} ${complete ? "" : "Bei Datenlücken wird keine vollständige Summe angegeben."}`;
      const vals = rows.map(value).filter(Number.isFinite),
        max = Math.max(1, ...vals.map(Math.abs));
      let segments = [],
        segment = [];
      rows.forEach((r, i) => {
        const v = value(r);
        if (v === null || r.missing) {
          if (segment.length) segments.push(segment);
          segment = [];
        } else
          segment.push(
            `${10 + (i / Math.max(1, rows.length - 1)) * 980},${90 - (v / max) * 75}`,
          );
      });
      if (segment.length) segments.push(segment);
      root.querySelector("#history-chart").innerHTML =
        `<svg class="chart" role="img" aria-label="Zeitverlauf, Lücken bleiben leer" viewBox="0 0 1000 180">${segments.map((s) => `<polyline points="${s.join(" ")}"/>`).join("")}</svg>`;
      root.querySelector("#history-rows").innerHTML =
        `<details><summary>Intervalle und Datenqualität</summary><div class="scroll"><table><thead><tr><th>Beginn (Berlin)</th><th>Wert</th><th>Qualität</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${new Date(r.start).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</td><td>${number(value(r))} ${m.dimension === "energy" ? "kWh" : "W"}</td><td>${r.missing ? "Lücke / Reset" : "verfügbar"}</td></tr>`).join("")}</tbody></table></div></details>`;
    } catch (e) {
      status.textContent = e.message;
    } finally {
      button.disabled = false;
    }
  };
}
