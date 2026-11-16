# Verification report - 0.1.0-alpha.8

## Alpha.8 charger layout

- 70 UI regression scenarios passed, including eight new classic/3D charger-only layouts at 1440, 768, 390 and 320 px. They verify separate input/output ports, non-overlapping labels and the consumer remainder.
- 18 unit/API tests, six standalone browser groups, ESLint, TypeScript and the upstream 3D/behind-meter assertion pages passed on the final local build.
- Alpha.8 is installed after a fresh validated backup. Authenticated production browser checks passed for the single BMS-equipped battery, measured zero inverter contribution, complete source shares, household/remainder calculations, grid import/export sign handling and charger/inverter routes. Tablet/mobile checks also verified charger path endpoints and non-overlapping text; no page errors occurred.
- Installed and uploaded assets match the build; native settings are unchanged from the confirmed alpha.7 merge. Existing container IDs/start times are unchanged. MQTT, JavaScript and InfluxDB status checks passed; Grafana and InfluxDB HTTP health endpoints returned 200. Current adapter startup contains no subsequent warning/error entries.
- [Release packaging](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43848296395) passed, including Linux browser tests. The published checksum was verified and all 77 package files match the tested build after line-ending normalization. The first release attempt had an npm download connection reset before build/test execution; the retry passed.
- [Full CI](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43848291157) and [isolated installation](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43848291180) are still running at this documentation checkpoint; they are not counted as passed for alpha.8.

## Alpha.7 external battery channels and grid cable

- 18 unit/API tests, six standalone browser groups and 62 UI regression scenarios passed locally.
- New classic/3D scenarios cover external charging, inverter discharge, simultaneous charge/discharge, unavailable inverter readings, negative charger readings and measured household demand. They assert source shares, household/remainder values and independent route directions.
- Short 3D meter cable direction is checked separately from the main connection for import/export at desktop and mobile widths.
- ESLint, TypeScript and existing upstream 3D, animation and behind-meter assertion pages passed.
- A fresh production controller backup was validated and its archive readability checked. Alpha.7 production verification passed: exactly one BMS-equipped battery tile, correct household/remainder calculations, complete source shares with measured zero battery output, correct grid cable and charger/inverter directions, desktop/tablet/mobile without overflow or page errors. Native configuration and installed/uploaded assets match expectations; existing containers and adapter health checks are unchanged.
- Pattern and exact private-value scans passed for tracked source and the packaged adapter. No private telemetry or screenshots are published.

## Previous alpha.6 verification

## Alpha.6 grid and household correction

- 18 unit/API tests and six dashboard browser groups passed locally.
- 50 UI scenarios passed, including 22 new classic/3D cases covering source shares, import/export, battery charging/discharging, missing battery/grid/PV/consumer readings, a failed house meter and inconsistent measurements.
- ESLint and TypeScript passed.
- Existing upstream 3D, explanation and animation assertion suites passed locally.
- Production alpha.6 was installed after a fresh controller-validated backup. The owner-confirmed utility-meter power source is now assigned to grid, its old house alias is explicitly cleared, and the previous consumer-remainder direction override is disabled.
- Authenticated live browser verification passed: incoming grid flow, unavailable household/remainder and shares with missing battery power, correctly labeled grid-plus-solar subtotal, no inferred cross-device routes, neutral source ring, desktop/tablet/mobile layout, no page errors.
- Installed and uploaded assets match the build. Native configuration matches the requested mapping correction; existing container IDs/start times and MQTT/JavaScript/InfluxDB health flags are unchanged. Startup logs show the authenticated listener with no subsequent adapter errors.
- [Release workflow](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43844510719) passed; all 77 published files match the tested build after line-ending normalization. [Full CI](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43844504040) and [isolated installation](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43844504048) were still running at the time of this deployment verification.
- This change verifies the live power mapping. Historical meter-counter meanings and missing storage-power measurements are not newly certified by this update.

## Previous alpha.5 verification

## Alpha.5 visual direction override

The change is limited to `rest.reverse_flow`. No sensor-role or calculation change is included. Local validation: 18 unit/API tests and 28 UI regression scenarios passed, including reversal of the selected connection without changing its value or other consumer directions. Production alpha.5 is installed. Browser inspection verified that the selected animated path and arrow point toward the house, with no page errors. Sensor mappings are unchanged; only the visual override was enabled. Installed assets and unchanged existing container IDs/start times were checked. Full CI for this commit was still running when this deployment check completed.

## Previous alpha.4 verification

## Alpha.4 UI regression checks

- 18 unit/API tests, ESLint and TypeScript passed locally.
- Six existing dashboard browser groups passed without page errors.
- 27 additional browser cases passed: seven Admin themes (text contrast at least 4.5:1 and checkbox interaction), plus 20 desktop/mobile 3D/classic cases for grid import, export, high power, zero and unavailable readings. Local Admin rendering also used the installed Admin 8.2.0 stylesheets; copies remain private.
- Existing upstream `flow-3d.html` and `flow-anim.html` assertion suites passed.
- [Full Node 22/24 CI](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43833142623) passed, including all 42 original HTML pages (33 assertion pages, 9 smoke pages) on both Node versions.
- [Isolated installation and restart](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43833904888) passed. Earlier attempts exposed a test-harness startup race: temporary setup DB ports are not readiness evidence. The workflow now waits for the actual Admin HTTP listener before invoking the CLI.
- [Release workflow](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43833148453) passed. The published package checksum was verified and all 77 packaged files matched the local build after line-ending normalization.
- Production updated to alpha.4 after a fresh controller-validated readable backup. Installed frontend and uploaded Admin files match the tested assets. Native configuration is byte-for-byte equivalent as parsed JSON; existing container IDs/start times are unchanged. Energy-Cockpit, MQTT, JavaScript and InfluxDB status checks passed.
- Production browser verification passed: authenticated real snapshot, original 3D, incomplete-grid explanation, historical comparison, tablet/mobile layout and persisted touch theme; no page errors. Grid direction cases use synthetic inputs because this installation still has no verified grid-power mapping.

## Previous alpha.3 baseline

Executed on 2026-11-16. This is a functioning installed integration candidate, not completion of every production acceptance requirement.

| Check | Evidence / result |
| --- | --- |
| TypeScript and ESLint | Passed locally |
| Unit/API tests | 18 passed: units, signs, duplicate sources, invalid/missing/stale states, source availability recovery, battery capacity/telemetry, power balance, DST, history reset/gap/rollover/cache limits, Flux bounds, authentication and CSRF |
| Standalone Playwright | 6 groups passed: original 3D, missing-grid percentages, wizard/additional battery, classic view, mobile 390 px, light theme; no page errors |
| Upstream browser suite | 42 HTML pages executed: 33 assertion pages passed, 9 smoke pages loaded, zero failures. Smoke pages are not counted as assertion tests |
| Admin in isolated ioBroker | Loaded with no page errors; native settings populated; actual message-based datapoint search returned the synthetic fixture |
| Isolated Docker integration | Package installed using controller CLI; authenticated startup, state subscriptions, changes and configuration save passed. Dedicated container restart retained configuration and restored subscriptions |
| Production installation | New adapter installed in existing persistent ioBroker volume after controller-validated backup and SHA-256 verification |
| Production dashboard | Version 0.1.0-alpha.3: HTTPS login, real snapshot with 16 mappings, original 3D, guarded incomplete-balance explanations and historical comparison verified. Tablet 768 px/mobile 390 px, touch and persisted theme checked without page errors. Private screenshots are excluded from Git |
| Existing InfluxDB | Read-only requests through installed adapter succeeded for 1, 30 and 365 days. At inspection: 25/25 hourly, 24/31 daily and 0/13 monthly windows complete. Incomplete totals remain unavailable |
| Existing services | Six existing container IDs/start times unchanged and running; seven script objects and 56 Grafana panel query configurations identical; MQTT, JavaScript and InfluxDB status checked; Grafana and InfluxDB health endpoints HTTP 200 |
| Dependency/security checks | npm audit: zero known vulnerabilities at inspection; tracked-source pattern scan and exact local private-value comparison passed for source and package |
| GitHub Actions | Final functional commit `d1256ea`: [Node 22/24 full build/browser matrix](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43825957617) and [isolated Docker integration](https://github.com/Landixus/ioBroker.energy-cockpit/actions/runs/43825957716) completed successfully. All 33 upstream assertion pages and 9 smoke pages passed on both Node versions |

## Acceptance limitations

- No verified grid source or battery power sign was available. Grid balance, live autarky and self-consumption cannot be accepted as measured facts. Missing grid must not imply 100% autarky.
- Deye was disconnected and its configured TCP endpoint unreachable during initial discovery. It later reported connected without intervention; production mappings also depend on its connection flag. This is not proof that the underlying intermittent connectivity issue is repaired.
- Batter4802 retained telemetry was stale and availability unavailable. Existing gateway identity/protocol was inspected read-only. Fresh BLE telemetry, GATT discovery and physical reconnect were not verified. No replacement gateway or guessed decoder was deployed.
- The other storage profile has verified voltage only. Capacity, SOC and directional power remain unverified. Multiple independent profiles render, but correct aggregate battery energy is not established for this household.
- Tariffs are unknown. No financial result is asserted for this installation. Original financial/room cards are available for configured inputs; partial history cannot silently become a complete total.
- History boundaries are sampled estimates. Resets and long gaps invalidate intervals. Annual history is incomplete; a returned query is not proof of complete annual accounting.
- Device switching and Home Assistant weather/calendar services are explicitly unavailable. A reviewed per-device command allowlist has not been implemented.
- Full production-container restart was deliberately not performed because it would interrupt unrelated adapters. Persistence was exercised in the dedicated container, and production package/configuration paths are on the existing persistent volume.
- No long-duration soak, independent power-meter calibration or recovery from a real Bluetooth outage has been completed. Public distribution remains an alpha prerelease.

Synthetic fixtures and explicit demo screenshots are separate from private real telemetry. Nothing in this report treats an unexecuted test as passed.
