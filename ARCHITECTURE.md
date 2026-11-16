# Architecture

`main.ts` owns the ioBroker lifecycle, subscriptions, state cache, administrative messages and instance configuration. `lib/model.ts` validates mappings and normalizes measurements. `lib/history.ts` translates the original recorder request format into ioBroker `getHistory` messages and aggregates explicit raw samples. `lib/server.ts` provides HTTPS, authentication, bounded sessions, login rate limiting, CSRF protection and static files. `lib/battery.ts` validates the existing gateway's verified JSON envelope without implementing Bluetooth writes.

`frontend/upstream` contains the original presentation source, with narrowly scoped correctness changes documented in `docs/UPSTREAM.md`. `tools/build.mjs` concatenates it in the original dependency order. `frontend/app.js` hosts the original custom elements and supplies a compatibility object with `states`, locale information and a read-only statistics bridge. The standalone host implements navigation, diagnostics, mapping wizard and more-info history dialogs. It does not impersonate a Home Assistant backend.

The adapter subscribes once to each mapped source ID and reuses the latest state for all mapped JSON fields. Polling is limited to authenticated browser snapshots every three seconds; physical sensors are not polled by this adapter. Each snapshot reevaluates data freshness, so a stopped source expires even without a new state event. Reconnection is delegated to adapter-core/controller connections; browser snapshot reads retry after disconnects.

The backend returns only the public mapping configuration and selected readings. Password hashes, certificates and database tokens are not returned. The optional Cockpit login hash is protected native configuration, salted with scrypt. ioBroker admin passwords are verified through `checkPasswordAsync`.

Standalone serving was selected because the discovered installation has no web adapter and already publishes an unused container port. Installing web or recreating the existing container is unnecessary. The whole ioBroker installation resides on its existing persistent `/opt/iobroker` volume.

Energy accounting is deliberately conservative. A missing measurement is not zero. Where the physical topology is unverified, the adapter must not classify battery inverter output as PV generation. Measured consumer sums can be compared with measured home demand; the difference is unmeasured, not a discovered appliance.

For scalar power/energy measurements in InfluxDB 2, `lib/flux.ts` generates a bounded, read-only aggregation query sent through the existing adapter's `query` message interface. Identifiers are escaped as string literals; browsers cannot supply query fragments. Existing bucket configuration remains backend-only. Other history adapters use bounded raw `getHistory` requests. `frontend/history-view.js` adds an explicit history table, chart and period comparison with visible missing intervals.
