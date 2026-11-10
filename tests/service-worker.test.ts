import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);
const origin = "https://champions.example";
type RequestValue =
  | string
  | { url: string; method: string; mode: string; headers?: { origin: string } };
type WorkerEvent = {
  request?: RequestValue;
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith?: (promise: Promise<Response>) => void;
};
function worker() {
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const stores = new Map<
    string,
    Map<string, { response: Response; origin?: string }>
  >();
  const path = (request: RequestValue) =>
    new URL(typeof request === "string" ? request : request.url, origin).href;
  const responses = new Map<string, string>([
    [
      "/",
      '<script src="/assets/table-123.js"></script><link href="/assets/table-123.css" rel="stylesheet"><link rel="modulepreload" href="/assets/cards-123.js">',
    ],
    ["/assets/table-123.js", "table code"],
    [
      "/assets/table-123.css",
      "@font-face { src:url(/assets/table-font.woff2),url(/assets/table-font.woff); }",
    ],
    ["/assets/cards-123.js", "card data"],
    ["/assets/table-font.woff2", "table font"],
  ]);
  for (const path of [
    "/art/core-banner.jpg",
    "/cards/01001a.png",
    "/cards/01010a.png",
    "/cards/01019a.png",
    "/cards/01029a.png",
    "/cards/01040a.png",
  ])
    responses.set(path, "landing art");
  let offline = false;
  let failWrites = false;
  const fetch = vi.fn(async (request: RequestValue) => {
    if (offline) throw Error("Offline");
    const value = responses.get(new URL(path(request)).pathname);
    return new Response(value || "missing", {
      status: value ? 200 : 404,
      headers: { Vary: "Origin" },
    });
  });
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const cache = stores.get(name)!;
      return {
        async match(request: RequestValue, options?: { ignoreVary?: boolean }) {
          const hit = cache.get(path(request));
          const requestOrigin =
            typeof request === "string" ? undefined : request.headers?.origin;
          if (
            hit?.response.headers.get("Vary") === "Origin" &&
            !options?.ignoreVary &&
            hit.origin !== requestOrigin
          )
            return undefined;
          return hit?.response.clone();
        },
        async put(request: RequestValue, response: Response) {
          if (failWrites) throw Error("Quota exceeded");
          cache.set(path(request), {
            response: response.clone(),
            origin:
              typeof request === "string" ? undefined : request.headers?.origin,
          });
        },
        async keys() {
          return [...cache.keys()].map((url) => ({ url }));
        },
        async delete(request: RequestValue) {
          return cache.delete(path(request));
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };
  runInNewContext(source, {
    self: {
      addEventListener: (name: string, fn: (event: WorkerEvent) => void) =>
        handlers.set(name, fn),
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    },
    location: { origin },
    caches,
    fetch,
    URL,
    Response,
  });
  async function lifecycle(type: string) {
    const pending: Promise<unknown>[] = [];
    handlers.get(type)!({ waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
  }
  async function request(url: string, mode = "cors", method = "GET") {
    const pending: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    handlers.get("fetch")!({
      request: {
        url: new URL(url, origin).href,
        mode,
        method,
        ...(mode === "cors" ? { headers: { origin } } : {}),
      },
      waitUntil: (p) => pending.push(p),
      respondWith: (p) => {
        response = p;
      },
    });
    const result = await response;
    await Promise.all(pending);
    return result;
  }
  return {
    lifecycle,
    request,
    caches,
    stores,
    fetch,
    responses,
    goOffline: () => {
      offline = true;
    },
    goOnline: () => {
      offline = false;
    },
    blockWrites: () => {
      failWrites = true;
    },
  };
}

describe("offline tabletop", () => {
  it("opens the table and its build chunks on the first offline reload, including Vary: Origin assets", async () => {
    const sw = worker();
    await sw.lifecycle("install");
    await sw.lifecycle("activate");
    sw.goOffline();
    expect(await (await sw.request("/", "navigate"))!.text()).toContain(
      "table-123.js",
    );
    expect(await (await sw.request("/assets/table-123.js"))!.text()).toBe(
      "table code",
    );
    expect(await (await sw.request("/assets/cards-123.js"))!.text()).toBe(
      "card data",
    );
    expect(await (await sw.request("/assets/table-123.css"))!.text()).toContain(
      "@font-face",
    );
    expect(await (await sw.request("/assets/table-font.woff2"))!.text()).toBe(
      "table font",
    );
    expect(
      await (await sw.request("/art/core-banner.jpg", "no-cors"))!.text(),
    ).toBe("landing art");
  });
  it("keeps on-demand chunks and milestone effects for offline play without requiring them", async () => {
    const sw = worker();
    sw.responses.set(
      "/assets/table-123.js",
      'table code import("./ribbon-123.js") deps(["assets/ribbon-123.js","assets/ribbon-123.css","assets/removed-123.js"])',
    );
    sw.responses.set("/assets/ribbon-123.js", "ribbon code");
    sw.responses.set("/assets/ribbon-123.css", ".ribbon{}");
    sw.responses.set("/audio/milestones/victory.mp3", "fanfare");
    sw.responses.set("/motion/milestone-ink.png", "ink");
    // removed-123.js and the other three sounds answer 404: extras never
    // stop the table itself from being installed.
    await sw.lifecycle("install");
    await sw.lifecycle("activate");
    sw.goOffline();
    expect(await (await sw.request("/", "navigate"))!.text()).toContain(
      "table-123.js",
    );
    expect(await (await sw.request("/assets/ribbon-123.js"))!.text()).toBe(
      "ribbon code",
    );
    expect(await (await sw.request("/assets/ribbon-123.css"))!.text()).toBe(
      ".ribbon{}",
    );
    expect(
      await (await sw.request("/audio/milestones/victory.mp3"))!.text(),
    ).toBe("fanfare");
    expect(
      await (await sw.request("/motion/milestone-ink.png", "no-cors"))!.text(),
    ).toBe("ink");
  });
  it("still refuses to install when a file the table needs is missing", async () => {
    const sw = worker();
    sw.responses.delete("/assets/cards-123.js");
    await expect(sw.lifecycle("install")).rejects.toThrow(
      "An offline table asset is unavailable.",
    );
  });
  it("switches the offline table to a new deploy only once its build files are stored", async () => {
    const sw = worker();
    await sw.lifecycle("install");
    await sw.lifecycle("activate");
    const deploy = (build: string) =>
      sw.responses.set(
        "/",
        `<script src="/assets/table-${build}.js"></script><link href="/assets/table-123.css" rel="stylesheet">`,
      );
    // A deploy whose chunk cannot be downloaded yet keeps the previous table.
    deploy("456");
    expect(await (await sw.request("/", "navigate"))!.text()).toContain(
      "table-456.js",
    );
    sw.goOffline();
    expect(await (await sw.request("/", "navigate"))!.text()).toContain(
      "table-123.js",
    );
    sw.goOnline();
    // Once the chunk is reachable, visiting the page is enough: the worker
    // stores it even though this page never requested it.
    sw.responses.set("/assets/table-456.js", "new table code");
    const calls = sw.fetch.mock.calls.length;
    await sw.request("/", "navigate");
    // Only the page and its one new file are downloaded; cached files stay.
    expect(
      sw.fetch.mock.calls
        .slice(calls)
        .map(([request]) => (typeof request === "string" ? request : "/"))
        .filter((url) => !/^\/(audio|motion)\//.test(url)),
    ).toEqual(["/", "/assets/table-456.js"]);
    sw.goOffline();
    expect(await (await sw.request("/", "navigate"))!.text()).toContain(
      "table-456.js",
    );
    expect(await (await sw.request("/assets/table-456.js"))!.text()).toBe(
      "new table code",
    );
  });
  it("deletes build files of older deploys but keeps the previous page's", async () => {
    const sw = worker();
    await sw.lifecycle("install");
    await sw.lifecycle("activate");
    const deploy = (build: string) => {
      sw.responses.set(
        "/",
        `<script src="/assets/table-${build}.js"></script><link href="/assets/table-123.css" rel="stylesheet">`,
      );
      sw.responses.set(
        `/assets/table-${build}.js`,
        `code ${build} import("./ribbon-${build}.js") ["assets/ribbon-${build}.js"]`,
      );
      sw.responses.set(`/assets/ribbon-${build}.js`, `ribbon ${build}`);
    };
    const stored = () =>
      [...sw.stores.get("champions-cache-v2")!.keys()]
        .map((url) => new URL(url).pathname)
        .filter((path) => path.startsWith("/assets/"))
        .sort();
    deploy("456");
    await sw.request("/?utm_source=newsletter", "navigate");
    deploy("789");
    await sw.request("/", "navigate");
    // The first build is gone; the previous one stays for tabs still open.
    // The unchanged stylesheet keeps its font, though only the first visit
    // downloaded them.
    expect(stored()).toEqual([
      "/assets/ribbon-456.js",
      "/assets/ribbon-789.js",
      "/assets/table-123.css",
      "/assets/table-456.js",
      "/assets/table-789.js",
      "/assets/table-font.woff2",
    ]);
    deploy("999");
    await sw.request("/", "navigate");
    expect(stored()).toEqual([
      "/assets/ribbon-789.js",
      "/assets/ribbon-999.js",
      "/assets/table-123.css",
      "/assets/table-789.js",
      "/assets/table-999.js",
      "/assets/table-font.woff2",
    ]);
    // One offline copy of the page, whatever query string it was opened with.
    expect(
      [...sw.stores.get("champions-cache-v2")!.keys()].filter(
        (url) => !new URL(url).pathname.startsWith("/assets/"),
      ),
    ).not.toContain(`${origin}/?utm_source=newsletter`);
    sw.goOffline();
    expect(
      await (await sw.request("/?utm_source=newsletter", "navigate"))!.text(),
    ).toContain("table-999.js");
  });
  it("refreshes art at the same URL and retains it when offline", async () => {
    const sw = worker();
    sw.responses.set("/art/table.webp", "old art");
    expect(await (await sw.request("/art/table.webp"))!.text()).toBe("old art");
    sw.responses.set("/art/table.webp", "new art");
    expect(await (await sw.request("/art/table.webp"))!.text()).toBe("old art");
    sw.goOffline();
    expect(await (await sw.request("/art/table.webp"))!.text()).toBe("new art");
  });
  it("keeps account APIs out of the cache and preserves unrelated app caches", async () => {
    const sw = worker();
    await sw.caches.open("champions-cache-v1");
    await sw.caches.open("another-app");
    await sw.lifecycle("install");
    await sw.lifecycle("activate");
    expect(await sw.caches.keys()).toEqual([
      "another-app",
      "champions-cache-v2",
    ]);
    expect(await sw.request("/api/account")).toBeUndefined();
    expect(await sw.request("/api/account", "cors", "POST")).toBeUndefined();
    expect(await sw.request("https://other.example/image.png")).toBeUndefined();
    sw.goOffline();
    const manifest = await sw.request("/manifest.webmanifest");
    expect(manifest!.type).toBe("error");
  });
  it("returns successful network responses when a runtime cache is full", async () => {
    const sw = worker();
    sw.blockWrites();
    sw.responses.set("/cards/01001a.png", "card image");
    expect(await (await sw.request("/cards/01001a.png"))!.text()).toBe(
      "card image",
    );
    expect(await (await sw.request("/", "navigate"))!.text()).toContain(
      "table-123.js",
    );
  });
});
