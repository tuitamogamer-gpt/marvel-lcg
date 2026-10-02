/** Optimize imported card scans while leaving the supported Core art intact. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readFile,
  writeFile,
  rename,
  unlink,
  stat,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const run = promisify(execFile);
const args = process.argv.slice(2);
const concurrency = args.includes("--concurrency")
  ? Number(args[args.indexOf("--concurrency") + 1])
  : 6;
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12)
  throw Error("--concurrency must be an integer from 1 to 12");
await run("ffmpeg", ["-version"]);
const scratch = await mkdtemp(join(tmpdir(), "marvel-art-optimize-"));
const manifestPath = "src/data/catalog-images.json";
const provenancePath = "src/data/catalog-provenance.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
const maxDimension = 800;
const quality = 80;
const previousOptimization = provenance.images.optimization;
const reencode =
  previousOptimization?.maxDimension !== maxDimension ||
  previousOptimization?.quality !== quality;
const queue = Object.entries(manifest).filter(
  ([, path]) =>
    /^\/cards\/catalog\/[a-zA-Z0-9_]+\.(jpg|png)$/.test(path) ||
    (reencode && /^\/cards\/catalog\/[a-zA-Z0-9_]+\.webp$/.test(path)),
);
const expected = queue.length;
const replaced = [];
const failures = [];
let originalBytes = 0;
let optimizedBytes = 0;
let completed = 0;

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const [code, path] = queue.shift();
      const original = resolve(`public${path}`);
      const optimizedPath = path.replace(/\.(jpg|png)$/, ".webp");
      const optimized = resolve(`public${optimizedPath}`);
      const temporary = join(scratch, `${code}.webp`);
      try {
        await run("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          original,
          "-vf",
          `scale=w='min(${maxDimension},iw)':h='min(${maxDimension},ih)':force_original_aspect_ratio=decrease`,
          "-frames:v",
          "1",
          "-c:v",
          "libwebp",
          "-quality",
          String(quality),
          "-compression_level",
          "6",
          "-threads",
          "1",
          temporary,
        ]);
        const bytes = await readFile(temporary);
        if (
          bytes.length < 500 ||
          bytes.toString("ascii", 0, 4) !== "RIFF" ||
          bytes.toString("ascii", 8, 12) !== "WEBP"
        )
          throw Error("FFmpeg did not produce a valid WebP card image");
        originalBytes += (await stat(original)).size;
        optimizedBytes += bytes.length;
        await rename(temporary, optimized);
        manifest[code] = optimizedPath;
        if (original !== optimized) replaced.push(original);
      } catch (error) {
        failures.push({ code, error: error.message });
        await unlink(temporary).catch(() => {});
      }
      completed++;
      if (completed % 500 === 0 || completed === expected)
        console.log(`Optimized artwork ${completed}/${expected}`);
    }
  }),
);

const save = async (path, value) => {
  await writeFile(
    `${path}.optimize-tmp`,
    JSON.stringify(value, null, 2) + "\n",
  );
  await rename(`${path}.optimize-tmp`, path);
};
// Switch every path before removing scans so an interrupted conversion is recoverable.
await save(manifestPath, manifest);
await Promise.all(replaced.map((path) => unlink(path)));
provenance.images.optimization = {
  ...(provenance.images.optimization || {}),
  checkedAt: new Date().toISOString(),
  format: "WebP",
  maxDimension,
  quality,
  coreArtPreserved: true,
  webpImages: Object.values(manifest).filter((path) => path.endsWith(".webp"))
    .length,
  ...(expected
    ? {
        convertedImages: expected - failures.length,
        originalBytes,
        optimizedBytes,
        runs: [
          ...(previousOptimization?.runs ||
            (previousOptimization
              ? [
                  {
                    checkedAt: previousOptimization.checkedAt,
                    maxDimension: previousOptimization.maxDimension,
                    quality: previousOptimization.quality,
                    originalBytes: previousOptimization.originalBytes,
                    optimizedBytes: previousOptimization.optimizedBytes,
                  },
                ]
              : [])),
          { maxDimension, quality, originalBytes, optimizedBytes },
        ],
      }
    : {}),
  failures,
};
await save(provenancePath, provenance);
await rm(scratch, { recursive: true, force: true });
console.log(JSON.stringify(provenance.images.optimization));
if (failures.length) process.exitCode = 1;
