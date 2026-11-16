# Sanitized environment discovery

Observed 2026-11-16 through authorized SSH. Private addresses, host identities, user names, device serials, database names, tokens and measurements are excluded from this public report.

| Component | Observed |
|---|---|
| Host | Debian GNU/Linux 12, kernel 6.1.0-53-amd64, x86_64 |
| RAM | Approximately 7.6 GiB total, 4.6 GiB initially available |
| Disk | Approximately 190 GiB available on the main filesystem |
| Docker | 20.10.24 Debian package |
| Compose | Neither plugin nor standalone command available |
| Host Node/npm | Not installed; no host upgrade required |
| ioBroker container Node/npm | 24.21.0 / 11.19.0 |
| js-controller | 7.2.5 |
| Admin | 8.2.0, authentication enabled |
| InfluxDB | 2.7.6, ioBroker influxdb adapter 5.1.6, v2 mode |
| ioBroker persistence | Named volume mounted at `/opt/iobroker` |
| ioBroker restart policy | unless-stopped |
| Existing history retention setting | 31,536,000 seconds |
| Backups | Daily controller archives exist under `/opt/iobroker/backups` |
| Web adapter | Not installed |
| Dashboard candidate port | Existing published port 8082, free inside container at inspection |

Running services include ioBroker, InfluxDB, Grafana, Pi-hole, OpenTopoData and Portainer. Existing unrelated stopped containers were not touched. InfluxDB has separate persistent data/config volumes. Grafana reported no Docker volume mounts; its persistence risk predates this project and no changes were made.

Confirmed ioBroker instances: admin (administration), backitup (backup), deyeidc (Deye logger collector), discovery (device discovery), influxdb (history), javascript (automation), moma (machine monitoring), mqtt (broker/client), opendtu (OpenDTU), pi-hole (Pi-hole management), sonoff (Sonoff/Tasmota MQTT). The screenshot spelling `matt` was not a real adapter: `mqtt` is installed. The listed processes were alive at discovery; that does not establish device connectivity.

Deye's connection state was false at discovery and true during later deployment verification, without any Deye changes. InfluxDB's connection state was true. MQTT and Sonoff reported connected clients. OpenDTU does not expose the assumed `info.connection` state in this installation; some power states were old. No unrelated Deye repair was attempted.

Grafana was inspected read-only via a private database copy. Existing query units provide evidence for house power and existing daily/weekly/monthly/yearly energy states. Some panel titles are misleading: battery inverter AC power must not automatically be counted as PV. A voltage-derived SOC formula is present and is not treated as measured SOC.

SSH host keys use existing known-host entries or a dedicated local first-use key store; changed host keys are rejected. Credentials are excluded from repository files and release packages.

Firewall rules have not yet been exhaustively audited. No rules or published port mappings were changed. The new test container is isolated from production data and binds its published test ports to host loopback.
