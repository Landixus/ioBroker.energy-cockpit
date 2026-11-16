# Installation

Requires ioBroker js-controller >=6.0.11, Admin >=7.0.23, Node.js >=22 and existing ioBroker TLS certificates. The tested target uses Node 24 and js-controller 7.2.x.

Build from the repository:

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run test:browser
npm pack
```

Install the generated package through the supported controller CLI, from the ioBroker container:

```sh
iobroker url /tmp/iobroker.energy-cockpit-0.1.0-alpha.2.tgz energy-cockpit
iobroker add energy-cockpit --enabled
```

The default bind address is loopback. In Admin, open the adapter settings and select a reachable bind address only on a trusted local network. Port 8082 is the default; check for conflicts first. HTTPS uses `defaultPublic` and `defaultPrivate` from ioBroker's certificate store. Keep HTTPS enabled when exposing the dashboard beyond loopback. A private certificate may require installation of the local issuing certificate on client devices.

Open the dashboard link in Admin. Sign in as `admin` using the ioBroker administrator password, then configure mappings in the wizard. SSH credentials are not automatically dashboard credentials.

The adapter stores configuration in its own instance object. Installing it does not enable logging on any other datapoint, alter existing automations, or write to energy devices.

Troubleshooting: inspect only `energy-cockpit.0` logs; check TLS certificates, port availability, source timestamps and source units. An orange or disconnected indicator can correctly mean that no fresh mapped measurement exists.
