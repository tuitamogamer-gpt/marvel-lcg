/** Refresh the public data snapshots; cache artwork without a runtime API dependency. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
const run = promisify(execFile);
const get = async (url) =>
  (
    await run(
      "curl",
      ["-L", "--fail", "--max-time", "30", "--retry", "1", "-sS", url],
      { maxBuffer: 10 * 1024 * 1024 },
    )
  ).stdout;
const api = "https://marvelcdb.com/api/public/cards/core.json";
const github =
  "https://raw.githubusercontent.com/zzorba/marvelsdb-json-data/master/pack/";
let apiCount = null;
try {
  apiCount = JSON.parse(await get(api)).length;
} catch {
  console.log("Public API unavailable; using maintained JSON source.");
}
const player = JSON.parse(await get(github + "core.json"));
const encounter = JSON.parse(await get(github + "core_encounter.json"));
if (
  !player.some((c) => c.code === "01001a") ||
  !encounter.some((c) => c.code === "01190")
)
  throw Error("Unexpected core-set schema. Snapshots were not replaced.");
await writeFile(
  "src/data/core-player.json",
  JSON.stringify(player, null, 2) + "\n",
);
await writeFile(
  "src/data/core-encounter.json",
  JSON.stringify(encounter, null, 2) + "\n",
);
await mkdir("public/cards", { recursive: true });
const schemeNames = {
  "01097": "rhino4",
  "01116": "klaw4",
  "01117": "klaw5",
  "01137": "ultron4",
  "01138": "ultron5",
  "01139": "ultron6",
};
const fallbackUrls = Object.fromEntries(
  Object.entries(schemeNames).flatMap(([code, name]) =>
    ["a", "b"].map((side) => [
      code + side,
      `https://hallofheroeslcg.com/wp-content/uploads/2019/12/${name}${side}.jpg`,
    ]),
  ),
);
const missing = [];
for (const c of [...player, ...encounter]) {
  const dest = `public/cards/${c.code}.png`;
  try {
    if ((await stat(dest)).size > 500) continue;
  } catch {}
  const url =
    fallbackUrls[c.code] || `https://marvelcdb.com/bundles/cards/${c.code}.png`;
  try {
    await run("curl", [
      "-L",
      "--fail",
      "--max-time",
      "15",
      "--retry",
      "1",
      "-sS",
      url,
      "-o",
      dest,
    ]);
  } catch {
    missing.push(c.code);
  }
}
let existing = {};
try {
  existing = JSON.parse(await readFile("src/data/provenance.json"));
} catch {}
const provenance = {
  ...existing,
  source: api,
  apiCardRecords: apiCount,
  dataSource: github,
  syncedAt: new Date().toISOString(),
  cardFaces: player.length + encounter.length,
  cachedImages: player.length + encounter.length - missing.length,
  failedImages: missing,
};
await writeFile(
  "src/data/provenance.json",
  JSON.stringify(provenance, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      apiRecords: apiCount,
      localFaces: provenance.cardFaces,
      cachedImages: provenance.cachedImages,
      missing,
    },
    null,
    2,
  ),
);
if (missing.length) process.exitCode = 1;
