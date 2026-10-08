import { beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createAccountHandler, validateGame } from "../server/account";
import { sqliteStore } from "../server/storage";
import type { Store } from "../server/storage";
import { deckCodes, HEROES, ASPECTS } from "../src/game/cards";
import {
  countsFor,
  deckErrors,
  deckSizeFor,
  deckOptions,
  copyLimit,
} from "../src/game/decks";
import { heroRequiredCards } from "../src/game/hero-runtime";
import { newGame, dispatch } from "../src/game/engine";
import { paymentSources } from "../src/game/payment";

let store: Store;
beforeEach(async () => {
  store = await sqliteStore(":memory:");
});
const password = "a long testing passphrase";
const baseDeck = () => ({
  name: "Neighbourhood patrol",
  heroId: "spider_man",
  aspect: "justice",
  cards: deckCodes("spider_man", "justice"),
});
const game = () =>
  newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    seed: 12345,
    guided: true,
  });
function basicSpiderWomanDeck() {
  const codes = Object.entries(heroRequiredCards("spider_woman")).flatMap(
    ([code, count]) => Array(count).fill(code) as string[],
  );
  const names = new Set<string>();
  for (const c of deckOptions("spider_woman", "leadership", [
    "leadership",
    "protection",
  ])) {
    if (c.faction_code !== "basic" || names.has(c.name)) continue;
    names.add(c.name);
    codes.push(
      ...Array(Math.min(copyLimit(c), 40 - codes.length)).fill(c.code),
    );
    if (codes.length === 40) break;
  }
  return codes;
}
async function call(
  body?: Record<string, unknown>,
  token = "",
  headers: Record<string, string> = {},
) {
  const request = Readable.from(
    body ? [JSON.stringify(body)] : [],
  ) as IncomingMessage;
  request.method = body ? "POST" : "GET";
  request.headers = {
    host: "localhost:5186",
    origin: "http://localhost:5186",
    "content-type": "application/json",
    "x-champions-client": "1",
    cookie: token,
    ...headers,
  };
  Object.defineProperty(request, "socket", {
    value: { remoteAddress: "127.0.0.1" },
  });
  let payload = "";
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
    },
    end(text: string) {
      payload = text;
    },
  };
  await createAccountHandler(store)(
    request,
    response as unknown as ServerResponse,
  );
  return {
    status: response.statusCode,
    data: JSON.parse(payload),
    headers: response.headers,
    cookie: response.headers["set-cookie"]?.split(";")[0] || token,
  };
}
const register = (username = "champion_one") =>
  call({ action: "register", username, displayName: "Champion", password });

describe("private player accounts", () => {
  it("registers with hashed secrets, private cookies, and a persistent session", async () => {
    const r = await register();
    expect(r.status).toBe(200);
    expect(r.headers["set-cookie"]).toContain("HttpOnly; SameSite=Strict");
    expect(r.headers["cache-control"]).toContain("no-store");
    expect(r.data.recoveryCode).toHaveLength(48);
    const stored = JSON.parse((await store.get("user:champion_one"))!);
    expect(stored.passwordHash).not.toContain(password);
    expect(stored.recoveryHash).not.toBe(r.data.recoveryCode);
    expect(r.data.user).not.toHaveProperty("passwordHash");
    expect((await call(undefined, r.cookie)).data.user.username).toBe(
      "champion_one",
    );
    expect((await register("CHAMPION_ONE")).status).toBe(409);
  });
  it("rejects invalid registrations and wrong passwords; logout revokes the session", async () => {
    expect(
      (
        await call({
          action: "register",
          username: "test",
          displayName: "T",
          password: "short",
        })
      ).status,
    ).toBe(400);
    const r = await register();
    expect(
      (
        await call({
          action: "login",
          username: "champion_one",
          password: "wrong",
        })
      ).status,
    ).toBe(401);
    const login = await call({
      action: "login",
      username: "CHAMPION_ONE",
      password,
    });
    expect(login.status).toBe(200);
    await call({ action: "logout" }, login.cookie);
    expect((await call(undefined, login.cookie)).data.user).toBeNull();
    expect(
      (await call({ action: "deck.save", ...baseDeck() }, "")).status,
    ).toBe(401);
    expect((await call(undefined, r.cookie)).data.user.username).toBe(
      "champion_one",
    );
  });
  it("blocks cross-origin writes and stale account identities", async () => {
    const r = await register();
    expect(
      (
        await call(
          { action: "deck.save", ...baseDeck(), accountId: r.data.user.id },
          r.cookie,
          { origin: "https://evil.example" },
        )
      ).status,
    ).toBe(403);
    expect(
      (await call({ action: "logout" }, r.cookie, { "x-champions-client": "" }))
        .status,
    ).toBe(403);
    expect(
      (
        await call(
          { action: "deck.save", ...baseDeck(), accountId: "other-account" },
          r.cookie,
        )
      ).status,
    ).toBe(409);
  });
  it("keeps decks private, validates cards and protects concurrent edits", async () => {
    const a = await register();
    const b = await register("champion_two");
    const save = await call(
      { action: "deck.save", ...baseDeck(), accountId: a.data.user.id },
      a.cookie,
    );
    expect(save.status).toBe(200);
    const deck = save.data.library.decks[0];
    expect((await call(undefined, b.cookie)).data.library.decks).toHaveLength(
      0,
    );
    expect(
      (
        await call(
          {
            action: "deck.delete",
            id: deck.id,
            revision: deck.revision,
            accountId: b.data.user.id,
          },
          b.cookie,
        )
      ).status,
    ).toBe(409);
    const changed = await call(
      {
        action: "deck.save",
        ...deck,
        name: "New name",
        accountId: a.data.user.id,
      },
      a.cookie,
    );
    expect(changed.data.library.decks[0].revision).toBe(2);
    expect(
      (
        await call(
          { action: "deck.save", ...deck, accountId: a.data.user.id },
          a.cookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          {
            action: "deck.save",
            ...baseDeck(),
            cards: ["01097"],
            accountId: a.data.user.id,
          },
          a.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          {
            action: "deck.delete",
            id: deck.id,
            revision: 2,
            accountId: a.data.user.id,
          },
          a.cookie,
        )
      ).data.library.decks,
    ).toHaveLength(0);
  });
  it("preserves the chosen Spider-Woman pair when no customizable aspect card reveals it", async () => {
    const a = await register();
    const cards = basicSpiderWomanDeck();
    expect(
      deckErrors("spider_woman", "leadership", cards, [
        "leadership",
        "protection",
      ]),
    ).toEqual([]);
    const save = await call(
      {
        action: "deck.save",
        accountId: a.data.user.id,
        name: "Jessica's basic deck",
        heroId: "spider_woman",
        aspect: "leadership",
        aspects: ["leadership", "protection"],
        cards,
      },
      a.cookie,
    );
    expect(save.status).toBe(200);
    const deck = (await call(undefined, a.cookie)).data.library.decks[0];
    expect(deck.aspects).toEqual(["leadership", "protection"]);
    expect(deck.cards).toEqual(cards);
    const s = newGame({
      heroId: deck.heroId,
      aspect: deck.aspect,
      villainId: "rhino",
      heroes: [
        {
          heroId: deck.heroId,
          aspect: deck.aspect,
          deckCards: deck.cards,
          deckAspects: deck.aspects,
        },
      ],
    });
    const hydrated = dispatch(JSON.parse(JSON.stringify(s)), {
      type: "MULLIGAN",
      ids: [],
    });
    expect(hydrated.error).toBeUndefined();
    expect(hydrated.players[0].deckAspects).toEqual(deck.aspects);
    expect(
      countsFor(
        [...hydrated.player.hand, ...hydrated.player.deck].map((p) => p.code),
      ),
    ).toEqual(countsFor(cards));
  });
  it("infers legacy Spider-Woman pairs and rejects malformed or conflicting saved metadata", async () => {
    const a = await register();
    const draft = {
      action: "deck.save",
      accountId: a.data.user.id,
      name: "Legacy Jessica",
      heroId: "spider_woman",
      aspect: "leadership",
      cards: deckCodes("spider_woman", "leadership", [
        "leadership",
        "protection",
      ]),
    };
    const save = await call(draft, a.cookie);
    expect(save.status).toBe(200);
    expect(save.data.library.decks[0].aspects.sort()).toEqual([
      "leadership",
      "protection",
    ]);
    for (const aspects of [
      "leadership",
      ["leadership", "leadership"],
      ["aggression", "justice"],
      ["leadership", "unknown"],
    ]) {
      expect((await call({ ...draft, aspects }, a.cookie)).status).toBe(400);
    }
    expect(
      (await call({ ...draft, aspects: ["leadership", "justice"] }, a.cookie))
        .status,
    ).toBe(400);
    expect((await call(undefined, a.cookie)).data.library.decks).toHaveLength(
      1,
    );
  });
  it("round-trips pending gameplay and records a result only once", async () => {
    const a = await register();
    const s = dispatch(game(), { type: "MULLIGAN", ids: [] });
    const payload = {
      action: "mission.save",
      id: "mission-one",
      startedAt: new Date().toISOString(),
      revision: 0,
      state: s,
      accountId: a.data.user.id,
    };
    const saved = await call(payload, a.cookie);
    expect(saved.status).toBe(200);
    expect(saved.data.library.missions[0].state).toEqual(
      JSON.parse(JSON.stringify(s)),
    );
    expect((await call(payload, a.cookie)).status).toBe(409);
    const won = { ...s, phase: "won", result: "Rhino defeated." };
    const completed = await call(
      { ...payload, revision: 1, state: won },
      a.cookie,
    );
    expect(completed.status).toBe(200);
    expect(completed.data.library.missions[0].outcome).toBe("won");
    expect(completed.data.library.missions[0]).not.toHaveProperty("state");
    expect(
      (await call({ ...payload, revision: 2, state: won }, a.cookie)).status,
    ).toBe(409);
    expect(
      (await call(undefined, a.cookie)).data.library.missions,
    ).toHaveLength(1);
  });
  it("preserves the actual mission start across delayed first saves and updates", async () => {
    const a = await register();
    const payload = {
      action: "mission.save",
      id: "delayed-mission",
      startedAt: "2026-09-23T14:30:00+02:00",
      revision: 0,
      state: game(),
      accountId: a.data.user.id,
    };
    const saved = await call(payload, a.cookie);
    expect(saved.status).toBe(200);
    expect(saved.data.library.missions[0].startedAt).toBe(
      "2026-09-23T12:30:00.000Z",
    );
    const updated = await call(
      { ...payload, revision: 1, startedAt: new Date().toISOString() },
      a.cookie,
    );
    expect(updated.data.library.missions[0].startedAt).toBe(
      saved.data.library.missions[0].startedAt,
    );
  });
  it("rejects card and presentation shapes that would crash a resumed table", async () => {
    const a = await register();
    const s = dispatch(game(), { type: "MULLIGAN", ids: [] });
    const payload = {
      action: "mission.save",
      id: "validated-mission",
      startedAt: new Date().toISOString(),
      state: s,
      accountId: a.data.user.id,
    };
    const corruptions = [
      {
        ...s,
        player: {
          ...s.player,
          hand: [{ ...s.player.hand[0], code: "__proto__" }],
        },
      },
      { ...s, review: { ...s.review, actor: undefined } },
      { ...s, review: { ...s.review, source: "not-a-card" } },
      { ...s, review: { ...s.review, messages: [{ unexpected: true }] } },
      { ...s, timeline: [null] },
      { ...s, stats: { ...s.stats, damageDealt: "ten" } },
      { ...s, heroic: 999 },
    ];
    for (const state of corruptions)
      expect((await call({ ...payload, state }, a.cookie)).status).toBe(400);
    expect((await call(undefined, a.cookie)).data.library.missions).toEqual([]);
    const valid = await call(payload, a.cookie);
    expect(valid.status).toBe(200);
    expect(valid.data.library.missions[0].state.review).toEqual(s.review);
  });
  it("rejects malformed snapshots and caps unfinished missions without deleting progress", async () => {
    const a = await register();
    const payload = {
      action: "mission.save",
      startedAt: new Date().toISOString(),
      state: game(),
      accountId: a.data.user.id,
    };
    expect(
      (await call({ ...payload, state: { ...game(), players: [] } }, a.cookie))
        .status,
    ).toBe(400);
    for (let i = 0; i < 5; i++)
      expect(
        (await call({ ...payload, id: `mission-${i}` }, a.cookie)).status,
      ).toBe(200);
    expect(
      (await call({ ...payload, id: "mission-six" }, a.cookie)).status,
    ).toBe(400);
    expect(
      (await call(undefined, a.cookie)).data.library.missions,
    ).toHaveLength(5);
  });
  it("accepts real hot-seat decisions and reviews at every supported tempo", () => {
    for (const pacing of ["guided", "brisk", "expert"] as const) {
      let s = newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "klaw",
        difficulty: "expert",
        pacing,
        heroic: 3,
        seed: 12345,
        guided: true,
        heroes: [
          { heroId: "spider_man", aspect: "justice" },
          { heroId: "captain_marvel", aspect: "aggression" },
          { heroId: "iron_man", aspect: "leadership" },
        ],
      });
      for (let step = 0; step < 60; step++) {
        expect(() => validateGame(JSON.parse(JSON.stringify(s)))).not.toThrow();
        if (s.review) s = dispatch(s, { type: "PROCEED" });
        else if (s.prompt?.kind === "choice")
          s = dispatch(s, { type: "CHOOSE", id: s.prompt.options[0].id });
        else if (s.prompt?.kind === "select")
          s = dispatch(s, {
            type: "SELECT",
            ids: s.prompt.options.slice(0, s.prompt.min || 0).map((o) => o.id),
          });
        else if (s.prompt?.kind === "payment")
          s = dispatch(s, {
            type: "PAY",
            ids: paymentSources(
              s,
              s.prompt.card?.id,
              s.prompt.paymentTarget,
            ).map((p) => p.id),
          });
        else if (s.phase === "mulligan")
          s = dispatch(s, { type: "MULLIGAN", ids: [] });
        else if (s.phase === "player") s = dispatch(s, { type: "END_TURN" });
        else break;
      }
    }
  }, 15_000);
  it("rotates recovery codes and revokes every old session after reset", async () => {
    const a = await register();
    const other = await call({
      action: "login",
      username: "champion_one",
      password,
    });
    const changed = await call({
      action: "recover",
      username: "champion_one",
      recoveryCode: a.data.recoveryCode,
      password: "a different long passphrase",
    });
    expect(changed.status).toBe(200);
    expect(changed.data.recoveryCode).not.toBe(a.data.recoveryCode);
    expect((await call(undefined, a.cookie)).data.user).toBeNull();
    expect((await call(undefined, other.cookie)).data.user).toBeNull();
    expect((await call(undefined, changed.cookie)).data.user.username).toBe(
      "champion_one",
    );
    expect(
      (
        await call(
          {
            action: "recover",
            username: "champion_one",
            recoveryCode: a.data.recoveryCode,
            password,
          },
          changed.cookie,
        )
      ).status,
    ).toBe(401);
  });
  it("rate-limits repeated login attempts", async () => {
    const a = await register();
    for (let i = 0; i < 11; i++)
      await call(
        { action: "login", username: "champion_one", password: "wrong" },
        a.cookie,
      );
    const limited = await call({
      action: "login",
      username: "champion_one",
      password,
    });
    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBe("900");
  }, 20_000);
});

describe("playable saved decks", () => {
  it.each(
    HEROES.flatMap((hero) =>
      ASPECTS.map((aspect) => ({
        heroId: hero.id,
        aspect: aspect.id,
      })),
    ),
  )("accepts the $heroId $aspect starter list", ({ heroId, aspect }) => {
    const codes = deckCodes(heroId, aspect);
    expect(deckSizeFor(codes)).toBe(40);
    expect(deckErrors(heroId, aspect, codes)).toEqual([]);
  });
  it("rejects an off-aspect card in a starter list", () => {
    const codes = deckCodes("spider_man", "justice");
    codes[codes.length - 1] = "01050";
    expect(deckErrors("spider_man", "justice", codes)).not.toEqual([]);
  });
  it("enforces hero cards, copy limits, and the 40–50 range", () => {
    const codes = deckCodes("spider_man", "justice");
    expect(deckErrors("spider_man", "justice", codes.slice(1))).not.toEqual([]);
    expect(
      deckErrors("spider_man", "justice", [...codes, "01083"]),
    ).not.toEqual([]);
    expect(
      deckErrors("spider_man", "justice", Array(51).fill("01083")),
    ).not.toEqual([]);
    expect(
      deckErrors("spider_man", "justice", [...codes, "__proto__"]),
    ).not.toEqual([]);
  });
  it("deals the actual custom list and preserves it through hydration", () => {
    const cards = [...deckCodes("spider_man", "justice"), "01060"];
    const s = newGame({
      heroId: "spider_man",
      aspect: "justice",
      villainId: "rhino",
      seed: 321,
      heroes: [{ heroId: "spider_man", aspect: "justice", deckCards: cards }],
    });
    expect(
      countsFor([...s.player.hand, ...s.player.deck].map((p) => p.code)),
    ).toEqual(countsFor(cards));
    expect(
      dispatch(JSON.parse(JSON.stringify(s)), { type: "MULLIGAN", ids: [] })
        .players[0].deckCards,
    ).toEqual(cards);
    expect(() =>
      newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "rhino",
        heroes: [
          { heroId: "spider_man", aspect: "justice", deckCards: ["01083"] },
        ],
      }),
    ).toThrow();
  });
});
