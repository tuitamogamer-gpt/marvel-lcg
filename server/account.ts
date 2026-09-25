import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ASPECTS, HEROES, MODULES, VILLAINS, card } from "../src/game/cards.js";
import { deckErrors } from "../src/game/decks.js";
import type { GameState } from "../src/game/types";
import type {
  AccountSession,
  Library,
  MissionRecord,
  SavedDeck,
} from "../src/account/types";
import { getStore } from "./storage.js";
import type { Store } from "./storage";

const COOKIE = "champions_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const MAX_BODY = 750_000;
const empty = (): Library => ({ decks: [], missions: [] });
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  passwordHash: string;
  recoveryHash: string;
  authVersion: string;
  library: Library;
}
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function requireValue(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new ApiError(status, message);
}
function passwordKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}
async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await passwordKey(password, salt)).toString("hex")}`;
}
async function verifyPassword(password: string, encoded?: string) {
  const [salt, value] = (
    encoded || `${"0".repeat(32)}:${"0".repeat(128)}`
  ).split(":");
  return timingSafeEqual(
    await passwordKey(password, salt),
    Buffer.from(value, "hex"),
  );
}
function validatePassword(password: unknown): asserts password is string {
  requireValue(
    typeof password === "string" &&
      password.length >= 15 &&
      password.length <= 128,
    "Use a password or passphrase with 15–128 characters.",
  );
}
function sessionPayload(
  user: UserRecord | null,
  storage: Store["kind"],
): AccountSession {
  return {
    user: user
      ? {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          createdAt: user.createdAt,
        }
      : null,
    library: user?.library || empty(),
    storage,
  };
}
function sessionToken(req: IncomingMessage) {
  return (
    req.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1) || ""
  );
}
function cookie(res: ServerResponse, token: string, secure: boolean) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? SESSION_SECONDS : 0}${secure ? "; Secure" : ""}`,
  );
}
async function readSession(store: Store, req: IncomingMessage) {
  const token = sessionToken(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const raw = await store.get(`session:${hash(token)}`);
  if (!raw) return null;
  const session = JSON.parse(raw);
  const userRaw = await store.get(`user:${session.username}`);
  if (!userRaw) return null;
  const user = JSON.parse(userRaw) as UserRecord;
  return user.authVersion === session.authVersion ? user : null;
}
async function createSession(
  store: Store,
  req: IncomingMessage,
  res: ServerResponse,
  user: UserRecord,
  secure: boolean,
) {
  const previous = sessionToken(req);
  if (previous) await store.remove(`session:${hash(previous)}`);
  const token = randomBytes(32).toString("hex");
  await store.create(
    `session:${hash(token)}`,
    JSON.stringify({ username: user.username, authVersion: user.authVersion }),
    SESSION_SECONDS,
  );
  cookie(res, token, secure);
}
async function limited(
  store: Store,
  key: string,
  max: number,
  seconds: number,
) {
  requireValue(
    (await store.hit(`rate:${key}`, seconds)) <= max,
    "Too many attempts. Please try again later.",
    429,
  );
}
async function readBody(req: IncomingMessage & { body?: unknown }) {
  if (req.body !== undefined) {
    const text =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    requireValue(
      Buffer.byteLength(text) <= MAX_BODY,
      "This save is too large.",
      413,
    );
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError(400, "Invalid request.");
    }
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    requireValue(size <= MAX_BODY, "This save is too large.", 413);
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new ApiError(400, "Invalid request.");
  }
}
export function validateGame(value: unknown): asserts value is GameState {
  const s = value as GameState;
  requireValue(
    s &&
      s.version === 1 &&
      HEROES.some((h) => h.id === s.heroId) &&
      ASPECTS.some((a) => a.id === s.aspect),
    "This mission save is incompatible.",
  );
  requireValue(
    VILLAINS.some((v) => v.id === s.villainId) &&
      MODULES.some((m) => m.id === s.module) &&
      ["standard", "expert"].includes(s.difficulty),
    "Invalid mission setup.",
  );
  requireValue(
    ["mulligan", "player", "villain", "won", "lost"].includes(s.phase) &&
      Number.isInteger(s.round) &&
      s.round >= 1 &&
      s.round <= 10000,
    "Invalid mission progress.",
  );
  requireValue(
    Number.isInteger(s.seed) &&
      Number.isInteger(s.nextId) &&
      s.nextId > 0 &&
      s.flags &&
      typeof s.flags === "object" &&
      typeof s.guided === "boolean",
    "Invalid mission state.",
  );
  requireValue(
    s.villain &&
      card(s.villain.code)?.type_code === "villain" &&
      Number.isFinite(s.villain.hp) &&
      s.scheme &&
      card(s.scheme.code)?.type_code === "main_scheme" &&
      Number.isFinite(s.scheme.threat),
    "Invalid opposition.",
  );
  const pieces = (items: unknown) =>
    Array.isArray(items) &&
    items.length <= 1000 &&
    items.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        !!card(p.code) &&
        Number.isFinite(p.damage) &&
        Number.isFinite(p.counters),
    );
  const player = (p: GameState["player"]) =>
    p &&
    ["hero", "alter"].includes(p.form) &&
    Number.isFinite(p.hp) &&
    [p.hand, p.deck, p.discard, p.inPlay].every(pieces);
  requireValue(
    player(s.player) &&
      s.encounter &&
      [
        s.minions,
        s.sideSchemes,
        s.attachments,
        s.removed,
        s.resolving,
        s.encounter.deck,
        s.encounter.discard,
        s.encounter.dealt,
      ].every(pieces),
    "Invalid card zones.",
  );
  requireValue(
    Array.isArray(s.players) &&
      s.players.length >= 1 &&
      s.players.length <= 3 &&
      s.playerCount === s.players.length &&
      s.players.every(
        (p) =>
          p &&
          player(p.player) &&
          HEROES.some((h) => h.id === p.heroId) &&
          ASPECTS.some((a) => a.id === p.aspect) &&
          p.flags &&
          typeof p.id === "string",
      ),
    "Invalid hero team.",
  );
  requireValue(
    new Set(s.players.map((p) => p.id)).size === s.players.length &&
      [s.activePlayerId, s.firstPlayerId, s.turnPlayerId].every((id) =>
        s.players.some((p) => p.id === id),
      ),
    "Invalid player order.",
  );
  requireValue(
    Array.isArray(s.queue) &&
      s.queue.length <= 1000 &&
      s.queue.every((e) => e && typeof e.type === "string") &&
      Array.isArray(s.log) &&
      s.log.every(
        (l) => l && typeof l.text === "string" && Number.isFinite(l.round),
      ),
    "Invalid mission log.",
  );
  requireValue(
    !s.prompt ||
      (["choice", "payment", "select"].includes(s.prompt.kind) &&
        typeof s.prompt.title === "string" &&
        Array.isArray(s.prompt.options) &&
        s.prompt.options.every(
          (o) =>
            o &&
            typeof o.id === "string" &&
            typeof o.label === "string" &&
            Array.isArray(o.effects),
        )),
    "Invalid pending decision.",
  );
  requireValue(
    !s.review ||
      (typeof s.review.title === "string" &&
        Array.isArray(s.review.cards || []) &&
        Array.isArray(s.review.messages) &&
        Array.isArray(s.review.changes)),
    "Invalid pending review.",
  );
}
const validId = (id: unknown) =>
  typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(id);

export function createAccountHandler(providedStore?: Store) {
  return async function handler(req: IncomingMessage, res: ServerResponse) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Vary", "Cookie");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const reply = (status: number, data: unknown) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };
    try {
      requireValue(
        req.method === "GET" || req.method === "POST",
        "Method not allowed.",
        405,
      );
      const secure =
        !!process.env.VERCEL || req.headers["x-forwarded-proto"] === "https";
      if (req.method === "POST") {
        const expected =
          process.env.ACCOUNTS_ORIGIN ||
          `${secure ? "https" : "http"}://${req.headers.host}`;
        requireValue(
          req.headers.origin === expected &&
            req.headers["x-champions-client"] === "1" &&
            req.headers["content-type"]?.startsWith("application/json"),
          "Request origin is not allowed.",
          403,
        );
      }
      let store: Store;
      try {
        store = providedStore || (await getStore());
      } catch {
        if (req.method === "GET")
          return reply(200, {
            user: null,
            library: empty(),
            storage: "unavailable",
          });
        throw new ApiError(
          503,
          "Accounts are not available yet. Please try again later; you can still play as a guest.",
        );
      }
      let user = await readSession(store, req);
      if (req.method === "GET")
        return reply(200, sessionPayload(user, store.kind));
      const body = await readBody(req);
      requireValue(body && typeof body.action === "string", "Invalid request.");
      const ip = process.env.VERCEL
        ? String(
            req.headers["x-vercel-forwarded-for"] || req.socket.remoteAddress,
          )
        : String(req.socket.remoteAddress);
      if (["register", "login", "recover"].includes(body.action)) {
        await limited(store, `auth-ip:${hash(ip)}`, 50, 900);
        const username =
          typeof body.username === "string"
            ? body.username.trim().toLowerCase()
            : "";
        requireValue(
          /^[a-z0-9_]{3,24}$/.test(username),
          "Use 3–24 letters, numbers, or underscores for your username.",
        );
        await limited(store, `auth-user:${username}`, 12, 900);
        const key = `user:${username}`;
        const previous = await store.get(key);
        let recoveryCode: string | undefined;
        if (body.action === "register") {
          await limited(store, `register:${hash(ip)}`, 10, 3600);
          validatePassword(body.password);
          const displayName =
            typeof body.displayName === "string" ? body.displayName.trim() : "";
          requireValue(
            displayName.length >= 1 && displayName.length <= 40,
            "Enter a player name with 1–40 characters.",
          );
          requireValue(!previous, "That username is already taken.", 409);
          recoveryCode = randomBytes(24).toString("hex");
          user = {
            id: randomUUID(),
            username,
            displayName,
            passwordHash: await passwordHash(body.password),
            recoveryHash: hash(recoveryCode),
            authVersion: randomUUID(),
            createdAt: new Date().toISOString(),
            library: empty(),
          };
          requireValue(
            await store.create(key, JSON.stringify(user)),
            "That username is already taken.",
            409,
          );
        } else if (body.action === "login") {
          requireValue(
            typeof body.password === "string" && body.password.length <= 128,
            "Username or password is incorrect.",
            401,
          );
          user = previous ? JSON.parse(previous) : null;
          requireValue(
            (await verifyPassword(body.password, user?.passwordHash)) && user,
            "Username or password is incorrect.",
            401,
          );
        } else {
          validatePassword(body.password);
          user = previous ? JSON.parse(previous) : null;
          const recoveryHash = hash(
            typeof body.recoveryCode === "string"
              ? body.recoveryCode.trim().toLowerCase()
              : "",
          );
          requireValue(
            user &&
              timingSafeEqual(
                Buffer.from(user.recoveryHash, "hex"),
                Buffer.from(recoveryHash, "hex"),
              ),
            "Username or recovery code is incorrect.",
            401,
          );
          recoveryCode = randomBytes(24).toString("hex");
          user = {
            ...user,
            passwordHash: await passwordHash(body.password),
            recoveryHash: hash(recoveryCode),
            authVersion: randomUUID(),
          };
          requireValue(
            await store.swap(key, previous!, JSON.stringify(user)),
            "Your account changed. Please try again.",
            409,
          );
        }
        await createSession(store, req, res, user!, secure);
        return reply(200, {
          ...sessionPayload(user, store.kind),
          ...(recoveryCode ? { recoveryCode } : {}),
        });
      }
      if (body.action === "logout") {
        const token = sessionToken(req);
        if (token) await store.remove(`session:${hash(token)}`);
        cookie(res, "", secure);
        return reply(200, sessionPayload(null, store.kind));
      }
      requireValue(user, "Please sign in again to save your changes.", 401);
      requireValue(
        body.accountId === user.id,
        "Your signed-in account changed. Refresh before saving.",
        409,
      );
      await limited(store, `write:${user.id}`, 240, 60);
      const key = `user:${user.username}`;
      const id = body.id || randomUUID();
      requireValue(validId(id), "Invalid item ID.");
      for (let attempt = 0; attempt < 5; attempt++) {
        const previous = await store.get(key);
        const latest: UserRecord | null = previous
          ? JSON.parse(previous)
          : null;
        requireValue(
          latest && latest.authVersion === user.authVersion,
          "Please sign in again.",
          401,
        );
        const library = latest.library;
        const now = new Date().toISOString();
        if (body.action === "deck.save") {
          const name = typeof body.name === "string" ? body.name.trim() : "";
          requireValue(
            name.length > 0 && name.length <= 60,
            "Name your deck using 1–60 characters.",
          );
          const errors = deckErrors(body.heroId, body.aspect, body.cards);
          requireValue(!errors.length, errors[0]);
          const old = library.decks.find((d) => d.id === id);
          requireValue(
            (old?.revision || 0) === (body.revision || 0),
            "This deck changed in another tab. Refresh your profile before editing again.",
            409,
          );
          requireValue(
            old || library.decks.length < 30,
            "Your library can hold 30 decks. Remove one before saving another.",
          );
          const deck: SavedDeck = {
            id,
            name,
            heroId: body.heroId,
            aspect: body.aspect,
            cards: body.cards,
            revision: (old?.revision || 0) + 1,
            updatedAt: now,
          };
          library.decks = [deck, ...library.decks.filter((d) => d.id !== id)];
        } else if (
          body.action === "deck.delete" ||
          body.action === "mission.delete"
        ) {
          const items =
            body.action === "deck.delete" ? library.decks : library.missions;
          const old = items.find((i) => i.id === id);
          requireValue(
            old && old.revision === body.revision,
            "This item changed. Refresh your profile and try again.",
            409,
          );
          if (body.action === "deck.delete")
            library.decks = library.decks.filter((d) => d.id !== id);
          else library.missions = library.missions.filter((m) => m.id !== id);
        } else if (body.action === "mission.save") {
          validateGame(body.state);
          const s: GameState = body.state;
          const old = library.missions.find((m) => m.id === id);
          requireValue(
            (old?.revision || 0) === (body.revision || 0),
            "This mission changed in another tab or device. Open your profile and resume its latest save.",
            409,
          );
          requireValue(
            !old || old.outcome === "active",
            "This mission is already complete.",
            409,
          );
          const outcome =
            s.phase === "won" || s.phase === "lost" ? s.phase : "active";
          requireValue(
            outcome !== "active" ||
              old ||
              library.missions.filter((m) => m.outcome === "active").length < 5,
            "You have 5 unfinished missions. Finish or remove one to save another.",
          );
          requireValue(
            typeof body.startedAt === "string" &&
              Number.isFinite(Date.parse(body.startedAt)),
            "Invalid mission date.",
          );
          const mission: MissionRecord = {
            id,
            revision: (old?.revision || 0) + 1,
            startedAt: old?.startedAt || now,
            updatedAt: now,
            heroes: s.players.map((p) => ({
              heroId: p.heroId,
              aspect: p.aspect,
            })),
            villainId: s.villainId,
            difficulty: s.difficulty,
            module: s.module,
            round: s.round,
            outcome,
            ...(typeof s.result === "string"
              ? { result: s.result.slice(0, 1000) }
              : {}),
            ...(outcome === "active" ? { state: s } : {}),
          };
          library.missions = [
            mission,
            ...library.missions.filter((m) => m.id !== id),
          ];
          let completed = 0;
          library.missions = library.missions.filter(
            (m) => m.outcome === "active" || ++completed <= 100,
          );
        } else throw new ApiError(400, "Unknown account action.");
        if (await store.swap(key, previous!, JSON.stringify(latest)))
          return reply(200, sessionPayload(latest, store.kind));
      }
      throw new ApiError(
        409,
        "Your account is busy in another tab. Please try again.",
      );
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) res.setHeader("Retry-After", "900");
        reply(error.status, { error: error.message });
      } else
        reply(503, {
          error:
            "Account storage is temporarily unavailable. Your current mission is still open; please retry saving.",
        });
    }
  };
}
