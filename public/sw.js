// Prime the shell on installation so the first offline reload can open the
// table. Hashed build assets are immutable; art is refreshed in the background.
// Account requests always use the network and never enter a cache.
const PREFIX = "champions-cache-";
const VERSION = `${PREFIX}v2`;
const ASSET = /^\/assets\//;
const ART = /^\/(cards|art|icons|audio|motion)\//;
// These landing images normally load before the first worker takes control.
// Like all art they are optional: a renamed image must not stop installation.
const LANDING_ART = [
  "/art/core-banner.jpg",
  "/cards/01001a.png",
  "/cards/01010a.png",
  "/cards/01019a.png",
  "/cards/01029a.png",
  "/cards/01040a.png",
];
// Card backs, tokens and playmats appear in every mission, so a first mission
// started offline still has its table.
const TABLE_ART = [
  "/art/player-back.svg",
  "/art/tabletop/hero-back.webp",
  "/art/tabletop/encounter-back.webp",
  "/art/tabletop/premium-tokens.webp",
  "/art/tabletop/damage-counter.png",
  "/art/tabletop/midnight-city.webp",
  "/art/tabletop/helicarrier.webp",
  "/art/tabletop/cosmic-rift.webp",
  "/art/tabletop/wakanda.webp",
  "/art/tabletop/photon-orbit.webp",
  "/art/tabletop/queens-rooftops.webp",
  "/art/tabletop/stark-workshop.webp",
  "/art/tabletop/gamma-lab.webp",
];
// Art is checked for a newer version once per worker lifetime, not on every
// card shown: a mission displays the same faces many times.
const refreshed = new Set();
// Build files kept by the previous offline page, for tabs still open on it.
const MANIFEST = "/__offline-build-files.json";
// Milestone effects are only requested when a milestone happens. They are
// tiny, so keep them ready for a mission that is finished offline.
const MILESTONE_MEDIA = [
  "/motion/milestone-ink.png",
  "/audio/milestones/victory.mp3",
  "/audio/milestones/defeat.mp3",
  "/audio/milestones/stage.mp3",
  "/audio/milestones/upgrade.mp3",
];

async function remember(cache, request, response) {
  if (!response.ok) return;
  try {
    await cache.put(request, response.clone());
  } catch {
    // A full or blocked cache must not stop an otherwise successful request.
  }
}

// Stores a shell page only after every build file it needs is in the cache,
// so the cached page never points at chunks that are missing offline.
// `fresh` downloads everything (installation); otherwise files that are
// already cached are kept, because hashed build files never change.
async function prime(cache, key, shell, fresh) {
  const html = await shell.clone().text();
  const visited = new Set();
  async function store(path, required) {
    if (visited.has(path)) return;
    visited.add(path);
    try {
      // A stored file is still read for the files it links to, so cleanup
      // knows they belong to this page too.
      const hit = !fresh && (await cache.match(path, { ignoreVary: true }));
      // Hashed build files never change, so the browser's copy is current.
      const response =
        hit ||
        (await fetch(
          path,
          fresh && !ASSET.test(path) ? { cache: "reload" } : {},
        ));
      if (!response.ok) throw Error("An offline table asset is unavailable.");
      let linked = [];
      if (path.endsWith(".css")) {
        const css = await response.clone().text();
        linked = [...css.matchAll(/url\(["']?(\/assets\/[^)"']+)["']?\)/g)]
          .map((match) => match[1])
          // Service-worker browsers support WOFF2; avoid caching the
          // redundant WOFF fallback for every bundled font weight.
          .filter((asset) => !asset.endsWith(".woff"));
      } else if (path.endsWith(".js")) {
        // Chunks loaded on demand (import()) are listed by file name inside
        // the code that requests them, not in the page.
        const code = await response.clone().text();
        linked = [
          ...code.matchAll(/["'`](?:\.\/)?(assets\/[\w.-]+\.(?:js|css))["'`]/g),
        ].map((match) => `/${match[1]}`);
      }
      await Promise.all(
        linked.map((asset) => store(asset, required && path.endsWith(".css"))),
      );
      if (!hit) await cache.put(path, response);
    } catch (error) {
      // On-demand chunks and effects are extras: the table opens without them.
      if (required) throw error;
    }
  }
  const assets = new Set(
    [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(
      (match) => match[1],
    ),
  );
  await Promise.all([
    ...[...assets].map((path) => store(path, true)),
    ...(fresh
      ? [...LANDING_ART, ...TABLE_ART].map((path) => store(path, false))
      : []),
    ...MILESTONE_MEDIA.map((path) => store(path, false)),
  ]);
  await cache.put(key, shell);
  await forget(cache, visited);
}

// Each deploy adds new hashed build files. Keep this page's files and the
// previous page's (a tab may still be open on it) and delete the rest.
async function forget(cache, visited) {
  try {
    const current = [...visited].filter((path) => ASSET.test(path));
    const previous = await cache
      .match(MANIFEST)
      .then((response) => (response ? response.json() : []))
      .catch(() => []);
    const keep = new Set([...current, ...previous]);
    await cache.put(
      MANIFEST,
      new Response(JSON.stringify(current), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    for (const request of await cache.keys()) {
      const { pathname } = new URL(request.url);
      if (ASSET.test(pathname) && !keep.has(pathname))
        await cache.delete(request);
    }
  } catch {
    // Cleanup is housekeeping; a failure leaves the offline table usable.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const shell = await fetch("/", { cache: "reload" });
      if (!shell.ok) throw Error("The offline table could not be prepared.");
      await prime(cache, "/", shell, true);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(PREFIX) && k !== VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/"))
    return;
  if (ASSET.test(url.pathname) || ART.test(url.pathname)) {
    event.respondWith(
      caches.open(VERSION).then(
        async (cache) => {
          // Static files have one representation at each URL. CDN or preview
          // Vary: Origin headers must not hide install-time cached files.
          const hit = await cache.match(request, { ignoreVary: true });
          if (hit && (ASSET.test(url.pathname) || refreshed.has(url.pathname)))
            return hit;
          if (hit) refreshed.add(url.pathname);
          const update = fetch(
            request,
            ASSET.test(url.pathname) ? {} : { cache: "no-cache" },
          ).then((response) => {
            // The page receives the file while it is being stored.
            event.waitUntil(remember(cache, request, response));
            return response;
          });
          if (hit) {
            event.waitUntil(update.catch(() => {}));
            return hit;
          }
          return update;
        },
        () => fetch(request),
      ),
    );
    return;
  }
  if (request.mode === "navigate" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          try {
            const cache = await caches.open(VERSION);
            if (request.mode === "navigate" && response.ok)
              // A new deploy replaces the offline copy only once all of its
              // build files are stored; until then the previous one remains.
              // One offline copy per page, whatever its query string.
              event.waitUntil(
                prime(cache, url.pathname, response.clone(), false).catch(
                  () => {},
                ),
              );
            else await remember(cache, request, response);
          } catch {
            // The online table still works when cache access is blocked.
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(VERSION);
          return (
            (await cache.match(request, { ignoreSearch: true })) ||
            (request.mode === "navigate" && (await cache.match("/"))) ||
            Response.error()
          );
        }),
    );
  }
});
