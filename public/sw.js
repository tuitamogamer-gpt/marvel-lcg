// Prime the shell on installation so the first offline reload can open the
// table. Hashed build assets are immutable; art is refreshed in the background.
// Account requests always use the network and never enter a cache.
const PREFIX = "champions-cache-";
const VERSION = `${PREFIX}v2`;
const ASSET = /^\/assets\//;
const ART = /^\/(cards|art|icons)\//;
// These landing images normally load before the first worker takes control.
const LANDING_ART = [
  "/art/core-banner.jpg",
  "/cards/01001a.png",
  "/cards/01010a.png",
  "/cards/01019a.png",
  "/cards/01029a.png",
  "/cards/01040a.png",
];

async function remember(cache, request, response) {
  if (!response.ok) return;
  try {
    await cache.put(request, response.clone());
  } catch {
    // A full or blocked cache must not stop an otherwise successful request.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const shell = await fetch("/", { cache: "reload" });
      if (!shell.ok) throw Error("The offline table could not be prepared.");
      const html = await shell.clone().text();
      await cache.put("/", shell);
      const assets = new Set(
        [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(
          (match) => match[1],
        ),
      );
      const downloaded = new Set();
      async function cacheAsset(path) {
        if (downloaded.has(path)) return;
        downloaded.add(path);
        const response = await fetch(path, { cache: "reload" });
        if (!response.ok) throw Error("An offline table asset is unavailable.");
        if (path.endsWith(".css")) {
          const css = await response.clone().text();
          await Promise.all(
            [...css.matchAll(/url\(["']?(\/assets\/[^)"']+)["']?\)/g)]
              .map((match) => match[1])
              // Service-worker browsers support WOFF2; avoid caching the
              // redundant WOFF fallback for every bundled font weight.
              .filter((asset) => !asset.endsWith(".woff"))
              .map(cacheAsset),
          );
        }
        await cache.put(path, response);
      }
      await Promise.all([...assets, ...LANDING_ART].map(cacheAsset));
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
          // Hashed files have one representation at each URL. CDN or preview
          // Vary: Origin headers must not hide install-time cached chunks.
          const hit = await cache.match(request, {
            ignoreVary: ASSET.test(url.pathname),
          });
          if (hit && ASSET.test(url.pathname)) return hit;
          const update = fetch(request, { cache: "no-cache" }).then(
            async (response) => {
              await remember(cache, request, response);
              return response;
            },
          );
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
            await remember(cache, request, response);
          } catch {
            // The online table still works when cache access is blocked.
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(VERSION);
          return (
            (await cache.match(request)) ||
            (request.mode === "navigate" && (await cache.match("/"))) ||
            Response.error()
          );
        }),
    );
  }
});
