import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const server = createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end('{"error":"Test: authentication required"}');
    return;
  }
  try {
    const name = req.url === "/" ? "index.html" : req.url.slice(1);
    if (name.includes("..")) throw Error();
    const body = await readFile("www/" + name);
    res.setHeader(
      "Content-Type",
      name.endsWith(".js")
        ? "text/javascript"
        : name.endsWith(".css")
          ? "text/css"
          : name.endsWith(".svg")
            ? "image/svg+xml"
            : "text/html",
    );
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(18086, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  timezoneId: "Europe/Berlin",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
try {
  await page.goto("http://127.0.0.1:18086");
  await page.locator("#login-demo").click();
  await page.locator("energy-cockpit-flow-card .o3d").first().waitFor();
  assert.equal(await page.locator("energy-cockpit-flow-card .o3d").count(), 4);
  assert.match(await page.locator("#notice").innerText(), /DEMO/);
  results.push(
    "Original 3D house, grid, PV and battery render in explicit demo mode",
  );
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/demo-desktop.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    const card = document.querySelector("energy-cockpit-flow-card");
    window.testOriginalHass = card._hass;
    const h = card._hass;
    const id = card._c.grid.entity;
    card.hass = {
      ...h,
      states: { ...h.states, [id]: { ...h.states[id], state: "unavailable" } },
    };
  });
  await page.waitForFunction(
    () =>
      document
        .querySelector("energy-cockpit-flow-card")
        .shadowRoot.querySelector('[data-p="aut"]').textContent === "—",
  );
  assert.equal(await page.locator('[data-p="aut"]').innerText(), "—");
  assert.equal(await page.locator('[data-p="self"]').innerText(), "—");
  for (const source of ["pv", "bat", "grid"])
    assert.equal(await page.locator(`[data-m="${source}"]`).innerText(), "—");
  assert.equal(
    await page
      .locator('[data-o="home"] polyline[style*="stroke:rgb("]')
      .count(),
    0,
  );
  assert.match(
    await page.evaluate(() =>
      document.querySelector("energy-cockpit-flow-card")._whyHtml(),
    ),
    /Energiebilanz unvollständig/,
  );
  await page.evaluate(() => {
    document.querySelector("energy-cockpit-flow-card").hass =
      window.testOriginalHass;
    delete window.testOriginalHass;
  });
  results.push(
    "Missing grid cannot imply 100% self-sufficiency or self-consumption",
  );
  await page.getByRole("link", { name: "Einrichtung", exact: true }).click();
  await page.locator("[data-step]").first().waitFor();
  assert.equal(await page.locator("[data-step]").count(), 10);
  await page.locator('[data-step="7"]').click();
  for (const style of ["3d", "classic"]) {
    await page.locator("#appearance").selectOption(style);
    const readBalance = () =>
      page.locator("#preview energy-cockpit-flow-card").evaluate((card) => ({
        house: card._wy.home,
        shares: [...card.shadowRoot.querySelectorAll("[data-m]")].map(
          (e) => e.textContent,
        ),
      }));
    const before = await readBalance();
    assert.ok(before.house > 0);
    await page.locator("#show-home-value").uncheck();
    await page.locator("#show-rest").uncheck();
    assert.equal(await page.locator("#preview .core .val").isVisible(), false);
    assert.equal(await page.locator("#preview .hub-lbl").isVisible(), false);
    assert.equal(await page.locator("#preview .mix").isVisible(), true);
    assert.equal(
      await page
        .locator('#preview [data-k="grest"], #preview [data-k="crest"]')
        .count(),
      0,
    );
    assert.deepEqual(await readBalance(), before);
    if (style === "3d")
      assert.equal(
        await page.locator('#preview [data-o="home"]').isVisible(),
        true,
      );
    await page.locator("#show-home-value").check();
    await page.locator("#show-rest").check();
    assert.equal(await page.locator("#preview .core .val").isVisible(), true);
    assert.equal(
      await page
        .locator('#preview [data-k="grest"], #preview [data-k="crest"]')
        .count(),
      1,
    );
    assert.deepEqual(await readBalance(), before);
  }
  await page.locator("#appearance").selectOption("3d");
  results.push(
    "Appearance switches hide and restore household text and remainder without changing source shares or house rendering",
  );
  await page.locator('[data-step="2"]').click();
  await page
    .locator('#mapping input[name="name"]')
    .fill("Zweiter Demo-Speicher");
  await page.locator('#mapping input[name="id"]').fill("test.battery.power");
  await page.locator('#mapping input[name="key"]').fill("battery_two");
  await page.locator('#mapping input[name="group"]').fill("Speicher 2");
  await page.locator("#mapping button").click();
  assert.match(
    await page.locator("#mapping-list").innerText(),
    /Zweiter Demo-Speicher/,
  );
  results.push("Ten-step wizard and additional battery mapping");
  await page.locator('[data-step="7"]').click();
  await page.locator("#appearance").selectOption("classic");
  assert.equal(await page.locator("#preview .o3d").count(), 0);
  results.push("Classic view switches from original 3D view");
  await page.getByRole("link", { name: "Geräte", exact: true }).click();
  await page.locator("energy-cockpit-devices-card").waitFor();
  await page.getByRole("link", { name: "Diagnose", exact: true }).click();
  await page.locator("#main table").waitFor();
  assert.match(await page.locator("#main").innerText(), /simulierte Werte/);
  await page.getByRole("link", { name: "Energiefluss", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
  );
  await page.screenshot({
    path: "docs/screenshots/demo-mobile.png",
    fullPage: true,
  });
  results.push("Mobile width 390 px without horizontal overflow");
  await page.locator("#theme").click();
  assert.equal(await page.locator("body.light").count(), 1);
  await page.screenshot({
    path: "docs/screenshots/demo-light.png",
    fullPage: true,
  });
  results.push("Light theme");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: results, errors }, null, 2));
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/browser.json",
    JSON.stringify({ passed: results, errors }, null, 2),
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
