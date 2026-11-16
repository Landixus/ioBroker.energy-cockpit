import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
const files = (await readdir("test/upstream")).filter(
  (f) =>
    f.endsWith(".html") && (!process.argv[2] || f.includes(process.argv[2])),
);
const results = [];
const server = createServer(async (req, res) => {
  try {
    const name = new URL(req.url, "http://localhost").pathname.slice(1);
    if (name.includes("..")) throw Error();
    const b = await readFile("test/" + name);
    res.setHeader(
      "Content-Type",
      name.endsWith(".js") ? "text/javascript" : "text/html",
    );
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
const port = process.argv[2] ? 18088 : 18087;
await new Promise((r) => server.listen(port, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true });
try {
  for (const file of files) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Europe/Berlin",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(
      "https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/*",
      async (route) => {
        try {
          await route.fulfill({
            contentType: "image/svg+xml",
            body: await readFile(
              "www/icons/" + route.request().url().split("/").pop(),
            ),
          });
        } catch {
          await route.abort();
        }
      },
    );
    await page.goto(
      "http://127.0.0.1:" + port + "/upstream/" + file + "?test=1&still=1",
    );
    const source = await readFile("test/upstream/" + file, "utf8");
    let text = "",
      status = "smoke";
    if (
      source.includes("ALLE OK") ||
      source.includes("document.title = 'FERTIG'")
    ) {
      try {
        await page.waitForFunction(
          () =>
            document.title === "FERTIG" ||
            /ALLE OK|FEHLER \d/.test(
              document.querySelector("#res")?.textContent || "",
            ),
          null,
          { timeout: 90000 },
        );
        text = await page.locator("#res, #out").first().innerText();
        status = /FEHLER [1-9]|"ok": false|"error": "[^\"]/.test(text)
          ? "failed"
          : "passed";
      } catch {
        status = "timeout";
      }
    } else {
      await page.waitForTimeout(1500);
      text = (await page.locator("body").innerText()).slice(0, 1000);
    }
    if (errors.length) status = "failed";
    results.push({ file, status, errors, details: text });
    console.log(file + ": " + status);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await mkdir("test-results", { recursive: true });
  await writeFile(
    process.argv[2]
      ? "test-results/upstream-" + process.argv[2] + ".json"
      : "test-results/upstream.json",
    JSON.stringify(results, null, 2),
  );
}
if (results.some((x) => ["failed", "timeout"].includes(x.status)))
  process.exitCode = 1;
