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
    fetch,
    responses,
    goOffline: () => {
      offline = true;
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
