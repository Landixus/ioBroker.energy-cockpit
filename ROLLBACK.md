# Rollback

The deployment introduces only a new adapter instance and package. The preferred rollback is to stop this instance:

```sh
docker exec <iobroker-container> iobroker stop energy-cockpit.0
```

Confirm the dashboard port closes and the existing adapter baseline remains healthy. If removal is required, remove only this adapter:

```sh
docker exec <iobroker-container> iobroker del energy-cockpit
```

Do not delete the `/opt/iobroker` volume or restore the entire installation for a routine adapter failure. A full backup restore changes unrelated state and is reserved for demonstrated broader corruption with separately reviewed recovery steps.

Keep the verified pre-install backup and manifest copies in their private recorded location. To roll back an update, stop only this instance, install the retained previous package through `iobroker url`, restore only its previous native configuration if needed and start the instance. Never overwrite another adapter's configuration.

The isolated container is named `energy-cockpit-test`. Its volume is independent of production. It may be stopped to release resources; retaining it permits reproduction of integration failures. Never use global Docker prune commands.
