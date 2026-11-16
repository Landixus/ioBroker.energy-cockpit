import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  readdir,
  unlink,
} from "node:fs/promises";
import { build } from "esbuild";
const order = [
  "common.js",
  "i18n.js",
  "wizard.js",
  "editor-kit.js",
  "flow-3d.js",
  "flow-card.js",
  "flow-editor.js",
  "devices-i18n.js",
  "devices-card.js",
  "devices-editor.js",
  "room-card.js",
  "room-editor.js",
  "stats-i18n.js",
  "stats-card.js",
  "stats-editor.js",
];
await mkdir("www/icons", { recursive: true });
const parts = await Promise.all(
  order.map((f) => readFile("frontend/upstream/" + f, "utf8")),
);
const clock = await build({
  entryPoints: ["frontend/timezone.mjs"],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "EnergyCockpitClock",
  platform: "browser",
  target: "es2022",
});
await writeFile(
  "www/energy-cockpit.js",
  "/*! Original Energy-Cockpit 0.32.5; Copyright 2026 Musicmaker3112; MIT */\n" +
    clock.outputFiles[0].text +
    "\nconst ECDate=EnergyCockpitClock.BerlinDate;\n" +
    parts.join("\n").replace(/new Date\(/g, "new ECDate("),
);
for (const f of [
  "index.html",
  "app.js",
  "style.css",
  "icons.js",
  "history-view.js",
])
  await copyFile("frontend/" + f, "www/" + f);
// MDI SVG artwork is distributed with its Apache-2.0 license; no CDN dependency.
const icons = new Set(
  Array.from(parts.join("\n").matchAll(/mdi:([a-z0-9-]+)/g), (m) => m[1]),
);
for (const f of [
  "help-circle-outline",
  "battery",
  "battery-outline",
  "battery-unknown",
  "battery-alert",
  "battery-charging",
  ...Array.from({ length: 10 }, (_, i) => "battery-" + (i + 1) * 10),
])
  icons.add(f);
for (const f of await readdir("www/icons"))
  if (f.endsWith(".svg")) await unlink("www/icons/" + f);
for (const icon of icons) {
  try {
    await copyFile(
      "node_modules/@mdi/svg/svg/" + icon + ".svg",
      "www/icons/" + icon + ".svg",
    );
  } catch {
    /* Dynamic icon prefixes use the fallback. */
  }
}
await copyFile("node_modules/@mdi/svg/LICENSE", "www/icons/LICENSE");
await copyFile("node_modules/@date-fns/tz/LICENSE.md", "www/TIMEZONE-LICENSE");
await mkdir("test/dist", { recursive: true });
await copyFile("www/energy-cockpit.js", "test/dist/energy-cockpit.js");
console.log(
  "Built original cards, standalone frontend and local licensed icons",
);
