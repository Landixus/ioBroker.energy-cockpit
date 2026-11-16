# Changelog

## 0.1.0-alpha.8

- Keep charger labels and AC input descriptions readable down to 320 px.
- Give the charger's incoming and outgoing paths separate connection points so opposite directions cannot overlap at the device.
- Add eight responsive charger-only layout checks with consumer remainder verification.

## 0.1.0-alpha.7

- Correct the short external 3D grid cable: red import enters the meter, green export leaves it. The long grid-to-house connection retains its direction.
- Group BMS telemetry, external AC charger and inverter output in a single battery profile.
- Add a dedicated charger-to-battery animation and independent battery-to-house discharge route.
- Include charger demand in gross household load, subtract it once from the consumer remainder and calculate source shares from complete measurements, including measured zero inverter output.
- Test charging, discharging, simultaneous AC flows, missing/invalid channels and measured household values in classic and 3D layouts.

## 0.1.0-alpha.6

- Separate grid power from household consumption. Derive household consumption only when all configured sources are available; failed house meters remain unavailable.
- Withhold source shares, source-colored rings and inferred cross-device routing for incomplete or contradictory balances.
- Label grid-plus-solar as a partial sum when household consumption is unknown.
- Treat the unassigned consumer remainder as unknown if household or consumer measurements are missing.
- Add classic and 3D regressions for import, export, charging, discharging, missing sensors and inconsistent measurements.

## 0.1.0-alpha.5

- Add `rest.reverse_flow` to reverse only the remainder connection animation and its arrow. Values and all other flow directions are unchanged.
- Add a browser regression for the visual override.

## 0.1.0-alpha.4

- Reverse the 3D grid meter cable on import: energy leaves the meter toward the house. Export returns into the meter.
- Add persistent direction arrows and reduce maximum dotted-flow speed to make direction easier to read.
- Apply explicit accessible light/dark colors to the Admin configuration iframe, including legacy Admin theme overrides.
- Add browser checks for seven Admin themes and import/export/zero/missing grid power at desktop and mobile widths.

## 0.1.0-alpha.3

- Withhold causal energy explanations when mapped grid, home, generation or battery power is incomplete.
- Extend the missing-grid browser regression to cover explanatory text as well as percentages.

## 0.1.0-alpha.2

- Keep power units inside narrow 3D tiles on Linux system fonts.
- Reserve consistent space for statistics explanations across reporting periods.
- Preserve all existing layout assertions; add a targeted Linux regression workflow.

## 0.1.0-alpha.1

- Port original Energy-Cockpit 0.32.5 presentation to a native ioBroker adapter.
- Add authenticated standalone dashboard, source mappings, diagnostics and ten-step setup wizard.
- Add unit/sign/freshness validation and bounded read-only history translation.
- Preserve original MIT attribution, 3D rendering, animations, themes and responsive components.
- Add calculation, security and browser tests. Treat this release as an integration candidate; see the test report for limits.
