# Configuration

The Admin page configures bind address, port and HTTPS, opens the graphical wizard and exposes the same settings as JSON. The wizard has solar, grid, batteries, home, consumers/rooms, history, prices, appearance, optional Batter4802 and diagnostics steps.

Each mapping has a stable lowercase `key`, actual ioBroker `id`, display name, dimension, explicit source unit, positive scale factor, optional sign inversion and `staleSeconds`. The presentation receives only aliases such as `sensor.solar`. Metadata suggestions are editable and are not evidence that a device is a PV inverter or grid meter.

Power normalizes to W, energy to kWh, current to A and voltage to V. Grid positive means import. Battery positive means charging. Negative battery power means discharge only after the source convention has been verified. Assign a distinct `group` for each independent battery; use room names as groups for consumers. Do not map an aggregate and its children as independent generation sources.

Unknown battery capacity must stay unset. A weighted aggregate SOC is invalid when a contributing capacity or SOC is missing. The adapter does not derive LiFePO4 SOC from voltage. JSON sources support a field path and an embedded ISO timestamp path; retained MQTT messages must use the embedded measurement timestamp.

An optional `availabilityId` names a boolean connection state. If configured, only a good-quality `true` permits the cached measurement to be shown as live. This is useful for collectors that retain recently received values while disconnected. It does not change historical queries.

History is opt-in per mapping and points to an existing `influxdb`, `history` or `sql` instance. It does not create or modify logging. Raw queries are capped at 10,001 points, two simultaneous requests, 15 seconds, three years and 30 selected aliases; responses at the sample limit are rejected. Cache lifetime is one minute. This protects small machines but can prevent long reports from high-rate data. A configured gap limit bounds interpolation. Zähler reset intervals are unavailable; an explicitly configured rollover value permits rollover correction. Energy is linearly allocated across period boundaries, an estimate between samples rather than independently measured interval energy.

Reporting buckets and frontend calendar arithmetic use Europe/Berlin, including 23/25-hour days, independently of the browser timezone. The build binds original calendar constructors to a tested timezone-aware Date implementation.

InfluxDB 2 scalar power/energy series use server-side Flux aggregation through the installed InfluxDB adapter, capped at 3,000 result windows. This permits long reports without downloading every raw point. Samples are assigned to the window containing their ending timestamp, so period boundaries are estimates; the interface labels this explicitly. Gaps beyond the configured limit and counter resets invalidate affected windows. Neither this path nor the raw fallback modifies historical data. A period total is withheld when its intervals are incomplete.

Prices are EUR/kWh. Blank means unknown. Fixed tariffs are assumptions for calculation, not historical tariff records. Room/financial views require a configured import price. The initial version does not model tariff changes, taxes or settlement-grade billing.

Advanced JSON preserves original card options under `cards.flow`, `cards.devices`, `cards.stats` and `cards.room`. Local icon names are supported. Remote images, embedded HTML and external navigation URLs are rejected. Home Assistant weather and calendar services have no backend and remain unavailable.

The Cockpit login has permission to view mappings and save this adapter's configuration. There are no unauthenticated mutation routes. Device control is disabled in this version.
