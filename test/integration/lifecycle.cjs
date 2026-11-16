// Run only inside an isolated ioBroker test container. All measurements are synthetic.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { scryptSync } = require("node:crypto");
const cli = (...args) => execFileSync("iobroker", args, { encoding: "utf8" });
const fixture = "energy-cockpit.0.testFixture.power";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settings = {
  mappings: [
    {
      key: "test_power",
      id: fixture,
      name: "Synthetic power",
      dimension: "power",
      unit: "W",
      staleSeconds: 120,
      role: "grid",
    },
  ],
  cards: { flow: { style: "3d" }, devices: {}, stats: {}, room: {} },
  historyInstance: "influxdb.0",
  importPrice: null,
  exportPrice: null,
};
async function login() {
  for (let n = 0; n < 120; n++) {
    try {
      const r = await fetch("http://127.0.0.1:8082/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "cockpit",
          password: "synthetic-test-password",
        }),
      });
      if (r.ok)
        return {
          cookie: r.headers.get("set-cookie").split(";")[0],
          ...(await r.json()),
        };
    } catch {
      /* controller is restarting this test instance */
    }
    await sleep(1500);
  }
  throw Error("Test adapter did not become ready");
}
async function main() {
  if (process.argv[2] === "provision") {
    cli(
      "object",
      "extend",
      fixture,
      JSON.stringify({
        type: "state",
        common: {
          name: "Synthetic test only",
          type: "number",
          role: "value.power",
          unit: "W",
          read: true,
          write: true,
        },
        native: {},
      }),
    );
    cli("state", "set", fixture, "123", "true");
    const salt = "synthetic-test-salt";
    const hash =
      salt +
      ":" +
      scryptSync("synthetic-test-password", salt, 32).toString("hex");
    cli(
      "object",
      "extend",
      "system.adapter.energy-cockpit.0",
      JSON.stringify({
        native: {
          bind: "127.0.0.1",
          secure: false,
          dashboardPasswordHash: hash,
          settings,
        },
      }),
    );
    console.log("Synthetic integration fixture provisioned");
    return;
  }
  const session = await login();
  const api = async (route, method = "GET", data) => {
    const r = await fetch("http://127.0.0.1:8082/api/" + route, {
      method,
      headers: {
        cookie: session.cookie,
        "x-csrf-token": session.csrf,
        "content-type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    assert.equal(r.status, 200);
    return r.json();
  };
  assert.equal((await fetch("http://127.0.0.1:8082/api/snapshot")).status, 401);
  if (process.argv[2] === "verify") {
    assert.equal(
      (await api("config")).cards.flow.title,
      "Persisted synthetic integration test",
    );
    cli("state", "set", fixture, "789", "true");
    await sleep(1500);
    assert.equal(
      (await api("snapshot")).states["sensor.test_power"].state,
      "789",
    );
    console.log(
      "Container restart: configuration persisted and subscriptions recovered",
    );
    return;
  }
  assert.equal(
    (await api("snapshot")).states["sensor.test_power"].state,
    "123",
  );
  cli("state", "set", fixture, "456", "true");
  await sleep(1500);
  assert.equal(
    (await api("snapshot")).states["sensor.test_power"].state,
    "456",
  );
  const config = await api("config");
  config.cards.flow.title = "Persisted synthetic integration test";
  await api("config", "PUT", config);
  console.log(
    "Startup, authenticated API, subscriptions, state changes and configuration save passed",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
