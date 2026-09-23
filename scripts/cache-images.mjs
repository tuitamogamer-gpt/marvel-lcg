import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, stat } from "node:fs/promises";
const run = promisify(execFile);
const cards = [
  ...JSON.parse(await readFile("src/data/core-player.json")),
  ...JSON.parse(await readFile("src/data/core-encounter.json")),
];
const q = [...cards];
let ok = 0,
  failed = [];
await Promise.all(
  Array.from({ length: 1 }, async () => {
    while (q.length) {
      const c = q.shift();
      const dest = `public/cards/${c.code}.png`;
      try {
        if ((await stat(dest)).size > 500) {
          ok++;
          continue;
        }
      } catch {}
      try {
        await run("curl", [
          "-L",
          "--fail",
          "--max-time",
          "12",
          "--retry",
          "1",
          "-s",
          `https://marvelcdb.com/bundles/cards/${c.code}.png`,
          "-o",
          dest,
        ]);
        if ((await stat(dest)).size < 500) throw Error();
        ok++;
      } catch {
        failed.push(c.code);
      }
    }
  }),
);
await writeFile(
  "src/data/provenance.json",
  JSON.stringify(
    {
      source: "https://marvelcdb.com/api/public/cards/core.json",
      fallback: "https://github.com/zzorba/marvelsdb-json-data",
      syncedAt: new Date().toISOString(),
      cardFaces: cards.length,
      cachedImages: ok,
      failedImages: failed,
    },
    null,
    2,
  ),
);
console.log({ ok, failed });
