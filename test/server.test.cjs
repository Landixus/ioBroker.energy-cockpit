const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  DashboardServer,
  passwordHash,
  passwordMatches,
} = require("../build/lib/server");
test("password hashes are salted and fail closed", () => {
  const a = passwordHash("test-password");
  assert.notEqual(a, passwordHash("test-password"));
  assert.equal(passwordMatches("test-password", a), true);
  assert.equal(passwordMatches("wrong", a), false);
  assert.equal(passwordMatches("x", "invalid"), false);
});
test("HTTP API authenticates reads and rejects CSRF and arbitrary control", async () => {
  let saved = false;
  const s = new DashboardServer(
    {
      authenticate: async (u, p) => u === "test" && p === "synthetic-password",
      snapshot: () => ({ demo: true }),
      save: () => {
        saved = true;
        return { ok: true };
      },
    },
    "www",
  );
  await s.start({ port: 18085, bind: "127.0.0.1" });
  try {
    const base = "http://127.0.0.1:18085";
    assert.equal((await fetch(base + "/api/snapshot")).status, 401);
    let r = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "test",
        password: "synthetic-password",
      }),
    });
    assert.equal(r.status, 200);
    const cookie = r.headers.get("set-cookie").split(";")[0],
      { csrf } = await r.json();
    assert.match(r.headers.get("set-cookie"), /HttpOnly/);
    assert.equal(
      (
        await fetch(base + "/api/config", {
          method: "PUT",
          headers: { cookie },
          body: "{}",
        })
      ).status,
      403,
    );
    r = await fetch(base + "/api/config", {
      method: "PUT",
      headers: { cookie, "x-csrf-token": csrf },
      body: "{}",
    });
    assert.equal(r.status, 200);
    assert.equal(saved, true);
    assert.equal(
      (
        await fetch(base + "/api/control", {
          method: "POST",
          headers: { cookie, "x-csrf-token": csrf },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/snapshot", {
          headers: { cookie, Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    await fetch(base + "/api/logout", {
      method: "POST",
      headers: { cookie, "x-csrf-token": csrf },
      body: "{}",
    });
    assert.equal(
      (await fetch(base + "/api/snapshot", { headers: { cookie } })).status,
      401,
    );
  } finally {
    await s.stop();
  }
});
