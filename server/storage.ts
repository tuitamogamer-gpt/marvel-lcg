import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface Store {
  kind: "local" | "cloud";
  get(key: string): Promise<string | null>;
  create(key: string, value: string, ttl?: number): Promise<boolean>;
  swap(key: string, previous: string, value: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  hit(key: string, seconds: number): Promise<number>;
}
const PREFIX = "marvel-champions:accounts:v1:";

export async function sqliteStore(path: string): Promise<Store> {
  const { DatabaseSync } = await import("node:sqlite");
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER)",
  );
  const clear = () =>
    db
      .prepare("DELETE FROM records WHERE expires IS NOT NULL AND expires <= ?")
      .run(Date.now());
  return {
    kind: "local",
    async get(key) {
      clear();
      return (
        (db.prepare("SELECT value FROM records WHERE key = ?").get(PREFIX + key)
          ?.value as string) ?? null
      );
    },
    async create(key, value, ttl) {
      clear();
      return (
        db
          .prepare("INSERT OR IGNORE INTO records VALUES (?, ?, ?)")
          .run(PREFIX + key, value, ttl ? Date.now() + ttl * 1000 : null)
          .changes === 1
      );
    },
    async swap(key, previous, value) {
      return (
        db
          .prepare("UPDATE records SET value = ? WHERE key = ? AND value = ?")
          .run(value, PREFIX + key, previous).changes === 1
      );
    },
    async remove(key) {
      db.prepare("DELETE FROM records WHERE key = ?").run(PREFIX + key);
    },
    async hit(key, seconds) {
      clear();
      const row = db
        .prepare(
          "INSERT INTO records VALUES (?, '1', ?) ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1 RETURNING value",
        )
        .get(PREFIX + key, Date.now() + seconds * 1000);
      return Number(row?.value);
    },
  };
}

export function redisStore(url: string, token: string): Store {
  if (!url.startsWith("https://"))
    throw Error("Account storage requires HTTPS.");
  async function command(...args: (string | number)[]) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw Error("Account storage is unavailable.");
    const body = await response.json();
    if (body.error) throw Error("Account storage rejected the request.");
    return body.result;
  }
  return {
    kind: "cloud",
    get: (key) => command("GET", PREFIX + key),
    async create(key, value, ttl) {
      return (
        (await command(
          "SET",
          PREFIX + key,
          value,
          "NX",
          ...(ttl ? ["EX", ttl] : []),
        )) === "OK"
      );
    },
    async swap(key, previous, value) {
      return (
        (await command(
          "EVAL",
          "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]); return 1 else return 0 end",
          1,
          PREFIX + key,
          previous,
          value,
        )) === 1
      );
    },
    async remove(key) {
      await command("DEL", PREFIX + key);
    },
    hit: (key, seconds) =>
      command(
        "EVAL",
        "local n=redis.call('INCR',KEYS[1]); if n == 1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
        1,
        PREFIX + key,
        seconds,
      ),
  };
}
let configured: Promise<Store> | undefined;
export function getStore(): Promise<Store> {
  if (configured) return configured;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) configured = Promise.resolve(redisStore(url, token));
  else if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
    configured = sqliteStore(
      resolve(process.env.ACCOUNTS_DB_PATH || ".accounts/accounts.sqlite"),
    );
  } else
    return Promise.reject(Error("Account storage has not been configured."));
  return configured;
}
