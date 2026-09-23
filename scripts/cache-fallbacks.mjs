import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, stat } from "node:fs/promises";
const run = promisify(execFile);
const map = {
  "01033": "tony7.jpg",
  "01042": "tc2.jpg",
  "01062": "j62.jpg",
  "01078": "p78.jpg",
  "01093": "b93-1.jpg",
  "01097a": "rhino4a.jpg",
  "01098": "rhino5.jpg",
  "01109": "bomb1.jpg",
  "01116a": "klaw4a.jpg",
  "01117a": "klaw5a.jpg",
  "01137a": "ultron4a.jpg",
  "01138a": "ultron5a.jpg",
  "01139a": "ultron6a.jpg",
};
const fallbacks = [];
for (const [code, name] of Object.entries(map)) {
  const dest = `public/cards/${code}.png`;
  try {
    if ((await stat(dest)).size > 500) continue;
  } catch {}
  const url = `https://hallofheroeslcg.com/wp-content/uploads/2019/12/${name}`;
  try {
    await run("curl", [
      "-L",
      "--fail",
      "--max-time",
      "20",
      "--retry",
      "1",
      "-sS",
      url,
      "-o",
      dest,
    ]);
    fallbacks.push({ code, url });
  } catch (e) {
    console.log(code, e.message);
  }
}
const cards = [
  ...JSON.parse(await readFile("src/data/core-player.json")),
  ...JSON.parse(await readFile("src/data/core-encounter.json")),
];
const missing = [];
for (const c of cards)
  try {
    if ((await stat(`public/cards/${c.code}.png`)).size < 500)
      missing.push(c.code);
  } catch {
    missing.push(c.code);
  }
const p = JSON.parse(await readFile("src/data/provenance.json"));
p.fallbackArt = [...(p.fallbackArt || []), ...fallbacks];
p.cachedImages = cards.length - missing.length;
p.failedImages = missing;
await writeFile("src/data/provenance.json", JSON.stringify(p, null, 2));
console.log({ cached: p.cachedImages, missing, fallbacks: fallbacks.length });
