# Verification report — 0.1.0-alpha.1

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
| Production dashboard | HTTPS login, real snapshot with 16 mappings, original 3D rendering and historical comparison verified. Private screenshots are excluded from Git |
| Existing InfluxDB | Read-only requests through installed adapter succeeded for 1, 30 and 365 days. At inspection: 25/25 hourly, 24/31 daily and 0/13 monthly windows complete. Incomplete totals remain unavailable |
| Existing services | Six existing container IDs/start times unchanged and running; seven script objects and 56 Grafana panel query configurations identical; MQTT, JavaScript and InfluxDB status checked; Grafana and InfluxDB health endpoints HTTP 200 |
| Dependency/security checks | npm audit: zero known vulnerabilities at inspection; tracked-source pattern scan and exact local private-value comparison passed for source and package |
| GitHub Actions | Build/browser and isolated Docker workflows supplied; remote execution is recorded in GitHub Actions, not presumed from local results |

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
