// Validates the existing gateway's versioned JSON envelope. No BLE writes or guessed binary decoding.
export function validateBatteryTelemetry(value: any, now = Date.now()) {
  const p = typeof value === "string" ? JSON.parse(value) : value;
  if (!p || p.crc_valid !== true || p.protocol !== "Daly D2 Modbus function 03")
    throw Error("Nicht verifizierte Batterie-Telemetrie");
  const ts = Date.parse(p.timestamp);
  if (!Number.isFinite(ts) || ts > now + 60000)
    throw Error("Ungültiger Batteriezeitstempel");
  if (
    !Array.isArray(p.cell_voltages_v) ||
    p.cell_voltages_v.length !== p.cell_count ||
    p.cell_count < 1 ||
    p.cell_count > 32
  )
    throw Error("Ungültige Zellzahl");
  if (
    p.cell_voltages_v.some(
      (v: any) => !Number.isFinite(v) || v < 0.5 || v > 5,
    ) ||
    !Number.isFinite(p.voltage_v) ||
    p.voltage_v <= 0
  )
    throw Error("Ungültige Zellspannung");
  if (
    Math.abs(
      p.cell_voltages_v.reduce((a: number, b: number) => a + b, 0) -
        p.voltage_v,
    ) > Math.max(0.5, p.voltage_v * 0.02)
  )
    throw Error("Zellsumme widerspricht Batteriespannung");
  if (
    !Number.isFinite(p.current_a) ||
    !Number.isFinite(p.soc_bms_percent) ||
    p.soc_bms_percent < 0 ||
    p.soc_bms_percent > 100
  )
    throw Error("Ungültiger Batteriemesswert");
  if (p.plausibility_concerns?.length)
    throw Error("Batterie-Gateway meldet Plausibilitätsfehler");
  return {
    timestamp: ts,
    voltage: p.voltage_v,
    current: p.current_a,
    soc: p.soc_bms_percent,
    cellVoltages: p.cell_voltages_v,
    temperatures: p.temperatures_c || [],
    source: "BMS report; not independently measured",
  };
}
