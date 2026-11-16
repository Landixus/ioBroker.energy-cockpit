import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// All power readings here are synthetic and never sent to an ioBroker instance.
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  try {
    if (path.includes("..")) throw Error();
    let body;
    if (path === "/")
      body =
        '<html><body style="margin:0"><script src="/energy-cockpit.js"></script></body></html>';
    else if (path.startsWith("/adapter/energy-cockpit/"))
      body = await readFile("admin/" + path.split("/").pop());
    else if (
      path === "/css/adapter.css" ||
      path === "/lib/css/materialize.css"
    ) {
      // Optional production stylesheet copies remain private; CI checks the adapter's own CSS.
      body = await readFile(".private/" + path.split("/").pop()).catch(
        () => "",
      );
    } else if (/^\/(js|lib\/js|socket.io)\//.test(path)) body = "";
    else body = await readFile("www" + path);
    res.setHeader(
      "Content-Type",
      (path.endsWith(".js")
        ? "text/javascript"
        : path.endsWith(".css")
          ? "text/css"
          : "text/html") + "; charset=utf-8",
    );
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(18089, "127.0.0.1", r));
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("test-results", { recursive: true });
try {
  for (const theme of [
    "dark",
    "modernDark",
    "blue",
    "NW",
    "HA",
    "light",
    "colored",
  ]) {
    await page.goto(
      "http://127.0.0.1:18089/adapter/energy-cockpit/index_m.html?0&react=" +
        theme,
    );
    await page.evaluate((theme) => {
      document.body.classList.add(
        "react-" +
          (["dark", "modernDark", "blue", "NW", "HA"].includes(theme)
            ? "dark"
            : "light"),
      );
      window.load(
        {
          port: 8082,
          bind: "0.0.0.0",
          secure: true,
          settings: { mappings: [] },
        },
        () => {},
      );
      document.querySelector("#error").textContent = "Test: Ungültiger Port";
    }, theme);
    await page.locator("#secure").uncheck();
    assert.equal(await page.locator("#secure").isChecked(), false);
    await page.locator("#secure").check();
    const contrast = await page.evaluate(() => {
      const lum = (rgb) => {
        const c = rgb
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((x) => {
            x /= 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          });
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      };
      return [
        "h1",
        "h2",
        "p",
        "label",
        "a",
        "input",
        "textarea",
        "button",
        "#error",
      ].map((selector) => {
        const el = document.querySelector(selector),
          style = getComputedStyle(el);
        let bg = style.backgroundColor,
          parent = el;
        while (bg === "rgba(0, 0, 0, 0)" && parent.parentElement) {
          parent = parent.parentElement;
          bg = getComputedStyle(parent).backgroundColor;
        }
        const a = lum(style.color),
          b = lum(bg);
        return {
          selector,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
    });
    for (const { selector, ratio } of contrast)
      assert.ok(ratio >= 4.5, `${theme} ${selector}: ${ratio}`);
    if (theme === "dark" || theme === "light")
      await page.screenshot({
        path: `test-results/admin-${theme}.png`,
        fullPage: true,
      });
    results.push(`Admin ${theme}: text contrast >= 4.5:1`);
  }
  await page.goto("http://127.0.0.1:18089/");
  assert.deepEqual(errors, []);
  for (const width of [1440, 390])
    for (const style of ["3d", "classic"])
      for (const power of [800, -800, 8000, 0, null]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(
          ({ style, power }) => {
            document.querySelector("energy-cockpit-flow-card")?.remove();
            const card = document.createElement("energy-cockpit-flow-card");
            card.setConfig({
              grid: { entity: "sensor.grid" },
              home: { entity: "sensor.home" },
              style,
              animations: "always",
            });
            document.body.append(card);
            const s = (value) => ({
              state: value === null ? "unavailable" : String(value),
              attributes: { unit_of_measurement: "W" },
            });
            card.hass = {
              states: { "sensor.grid": s(power), "sensor.home": s(800) },
              language: "de",
              locale: { language: "de" },
              themes: { darkMode: true },
            };
          },
          { style, power },
        );
        await page.waitForFunction(() =>
          document
            .querySelector("energy-cockpit-flow-card")
            ?.shadowRoot.querySelector('[data-l="grid"] .flow')
            ?.getAttribute("d"),
        );
        const result = await page.evaluate(async () => {
          const root = document.querySelector(
            "energy-cockpit-flow-card",
          ).shadowRoot;
          const g = root.querySelector('[data-l="grid"]'),
            path = g.querySelector(".flow"),
            arrow = g.querySelector(".direction");
          const n = path.getTotalLength(),
            a = path.getPointAtLength(n * 0.56 - 1),
            b = path.getPointAtLength(n * 0.56 + 1);
          const matrix = arrow.transform.baseVal.consolidate().matrix;
          const animation = path.getAnimations()[0];
          let delta = null;
          if (animation) {
            animation.pause();
            const duration = animation.effect.getTiming().duration;
            animation.currentTime = duration * 0.25;
            const first = parseFloat(getComputedStyle(path).strokeDashoffset);
            animation.currentTime = duration * 0.5;
            delta = parseFloat(getComputedStyle(path).strokeDashoffset) - first;
          }
          const cable = root.querySelector('[data-o="grid"] .d3-fl');
          return {
            active: g.classList.contains("on"),
            arrowVisible: getComputedStyle(arrow).opacity === "1",
            arrowDot: (b.x - a.x) * matrix.a + (b.y - a.y) * matrix.b,
            delta,
            cableDy: cable
              ? Number(cable.getAttribute("y2")) -
                Number(cable.getAttribute("y1"))
              : null,
            label: root.querySelector(".grid .tag").textContent,
          };
        });
        if (power) {
          assert.ok(result.active && result.arrowVisible);
          assert.ok(
            result.arrowDot * power > 0,
            "Arrow follows energy direction",
          );
          assert.ok(
            result.delta * power < 0,
            "Animated dots follow energy direction",
          );
          if (style === "3d")
            assert.ok(
              result.cableDy * power > 0,
              "3D meter cable: import leaves meter, export enters meter",
            );
          assert.match(result.label, power > 0 ? /Bezug/ : /Einspeisung/);
        } else
          assert.ok(
            !result.active && !result.arrowVisible && result.cableDy === null,
          );
        results.push(
          `${width}px ${style} grid=${power}: direction and availability correct`,
        );
      }
  assert.deepEqual(errors, []);
  // A visual direction override must not change any measured or calculated value.
  for (const reverse of [false, true]) {
    await page.evaluate((reverse) => {
      document.querySelector("energy-cockpit-flow-card")?.remove();
      const card = document.createElement("energy-cockpit-flow-card");
      card.setConfig({
        pv: { entity: "sensor.pv" },
        home: { entity: "sensor.home" },
        style: "3d",
        consumer_groups: [
          {
            name: "Testgruppe",
            items: [{ entity: "sensor.device", name: "Testgerät" }],
          },
        ],
        rest: { reverse_flow: reverse },
      });
      document.body.append(card);
      const s = (value) => ({
        state: String(value),
        attributes: { unit_of_measurement: "W" },
      });
      card.hass = {
        language: "de",
        locale: { language: "de" },
        themes: { darkMode: true },
        states: {
          "sensor.pv": s(100),
          "sensor.home": s(500),
          "sensor.device": s(50),
        },
      };
    }, reverse);
    await page.waitForFunction(() =>
      document
        .querySelector("energy-cockpit-flow-card")
        .shadowRoot.querySelector('[data-l="grest"] .flow')
        ?.getAttribute("d"),
    );
    assert.equal(
      await page.locator('[data-k="grest"] .num').textContent(),
      "450",
    );
    assert.equal(
      await page.locator('[data-l="grest"].on.rev').count(),
      reverse ? 0 : 1,
    );
    assert.equal(await page.locator('[data-l="g0"].on.rev').count(), 1);
  }
  results.push(
    "Selected remainder animation reverses without changing values or other consumer directions",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/ui-regression.json",
    JSON.stringify({ passed: results, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: results, errors }, null, 2));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
