# Batter4802

Read-only discovery found a powered BlueZ controller and existing, active `battcheck-gateway` and `battcheck-influx` systemd services. The gateway uses an ESP32 over USB and publishes MQTT telemetry; the second service records it in InfluxDB. A short host scan did not discover a currently available Batter4802 advertisement. No pairing, firmware update, BMS settings change or competing GATT connection was performed.

The existing parser identifies its protocol as `Daly D2 Modbus function 03`, checks CRC and cites the [aiobmsble Daly implementation](https://github.com/patman15/aiobmsble/blob/main/aiobmsble/bms/daly_bms.py). The retained JSON envelope reports schema version 1, CRC validity, cell voltage consistency and no plausibility concerns. It includes voltage, current, BMS-reported SOC, cell voltages and temperatures. This supports consuming this particular verified envelope; the advertised name alone is not sufficient protocol identification.

At discovery, availability was `unavailable` and retained telemetry was older than the live-data threshold. Therefore no fresh battery telemetry was verified. SOC is BMS-reported and explicitly not independently measured. The current/power sign is preserved as protocol sign until physical charging/discharging direction can be confirmed. It must not drive directional energy accounting on assumption.

The existing LiFePO4 installation also has a Grafana SOC curve derived linearly from inverter DC voltage. That is an estimate, not a measured SOC, and is not promoted to measured SOC by this adapter. Batter4802 is kept separate from that storage system; identity and capacity have not been assumed.

The optional integration consumes existing ioBroker MQTT states through mapped JSON fields and embedded source timestamps. It does not copy or replace the existing gateway. Missing and malformed payloads are tested, stale retained data remains unavailable and fresh source timestamps recover automatically. No raw BLE decoder is shipped, because the existing verified gateway already owns that transport.

Unverified or unavailable: current GATT discovery, live battery reconnect, physical current sign, nominal/usable pack capacity, documented alarm bit meanings, and identity relative to the other storage system. No commands for balancing, limits or BMS control are exposed.
