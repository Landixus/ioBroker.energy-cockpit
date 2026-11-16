# Configuration

## External AC charger and battery inverter

Use `battery_charge` for the charger's positive AC input power and `battery_discharge` for the inverter's positive AC output power. Give both mappings and the corresponding BMS telemetry the same battery `group`. This creates one battery tile with SOC, temperature and extra voltage/current readings, plus a dedicated charger tile. It does not create two independent batteries. Map the charger only once; do not also assign its input as an ordinary consumer. A matching `consumer_energy` mapping (same group/name) may supply its existing energy counter in Devices.

For this layout, gross household power **includes the charger**: solar + signed grid + inverter output. Source shares describe that gross demand. The consumer remainder subtracts charger input and individually measured consumers exactly once. Charger input and inverter output are separate even if both are nonzero. AC input is not DC energy stored; conversion losses are not independently measured.

The charger branch animates from house to charger to battery; the battery-to-house branch uses inverter output. Missing or negative split-channel readings remain unknown; a fresh measured zero is valid. Both power channels are required for a complete source mix. No switch or battery control command is issued.

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

`cards.flow.rest.reverse_flow: true` reverses only the remainder connection animation and direction arrow toward the house. This is a visual override; it does not reclassify the remainder as measured grid power or change calculations. Default: false.

## Grid power and household load

A utility meter reporting positive import and negative export belongs to the `grid` role. It is not a `house` measurement. Do not map the same source as both.

When no house meter is configured, the standard AC layout derives household power as solar + signed grid - battery charging power (negative battery power denotes discharging), but only when all configured source measurements are available. DC-coupled special layouts require a measured household value. A configured house meter that fails is never silently replaced with a calculation.

With unknown storage power, the card shows a clearly labeled grid-plus-solar partial sum, while household power, the consumer remainder and source percentages remain unavailable. Source shares follow the original source-priority allocation and are also withheld if the balance differs by more than 20 W or 5% of household power, whichever is larger. The remainder is household load minus individually measured consumers; it is not grid import.
