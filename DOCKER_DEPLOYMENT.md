# Docker deployment

Use the existing ioBroker container and supported controller package installer. The new adapter belongs under `/opt/iobroker/node_modules/iobroker.energy-cockpit`; its native config belongs to the controller's persistent instance object. Both survive normal container restart when `/opt/iobroker` is persisted.

Before production installation:

1. Verify the exact container, data mounts, free space and currently running services.
2. Run `iobroker backup` inside that container. Validate the resulting archive with `iobroker validate`, list its members and store its SHA-256. Record the new archive path privately.
3. Preserve the package manifest and lockfile and document the adapter-only rollback.
4. Install and test the exact package in a separate container using a separate volume. Verify its subscriptions, configuration persistence, shutdown and restart.
5. Copy the tested package to production and run `iobroker url /tmp/package.tgz energy-cockpit`, then add only the new instance.
6. Configure only the new instance. Do not recreate production containers, change unrelated mounts or restart the whole stack.
7. Check the new instance, dashboard authentication and actual readings. Compare the previous service baseline.

A restart of the isolated test container verifies the packaging/persistence mechanism without interrupting household automation. It is not evidence that a production container restart has occurred. Production restart testing must be recorded separately if performed.

The discovered installation publishes port 8082 and has no process using it. Other installations must choose an available already-routed port or explicitly provision a new local route. Do not open a router port, disable a firewall or use privileged mode for this dashboard.
