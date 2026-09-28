// Renders the PWA icons from public/favicon.svg. Run: node scripts/make-icons.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const svg = readFileSync(
  new URL("../public/favicon.svg", import.meta.url),
  "utf8",
);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(size, file, maskable) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable ? Math.round(size * 0.68) : size;
  const pad = Math.round((size - inner) / 2);
  await page.setContent(`<!doctype html><html><body style="margin:0;background:${maskable ? "#cf2330" : "transparent"};width:${size}px;height:${size}px;overflow:hidden">
    <div style="position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px;${maskable ? "border-radius:18%;overflow:hidden" : ""}">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({
    path: file,
    omitBackground: !maskable,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}
await render(
  192,
  new URL("../public/icons/icon-192.png", import.meta.url).pathname,
  false,
);
await render(
  512,
  new URL("../public/icons/icon-512.png", import.meta.url).pathname,
  false,
);
await render(
  512,
  new URL("../public/icons/icon-maskable-512.png", import.meta.url).pathname,
  true,
);
await browser.close();
console.log("icons written");
