import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type {
  Card,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types.js";
import {
  NOVA_IRONHEART_PACK_CORE_ALIAS_PAIRS,
  NOVA_IRONHEART_PACK_INHERITED_ALIAS_PAIRS,
  NOVA_IRONHEART_PACK_SCRIPT_CODES,
  novaIronheartPackAbility,
  novaIronheartPackAbilityOptions,
  novaIronheartPackAllyEntered,
  novaIronheartPackAttackDamageReduction,
  novaIronheartPackAttackEventBonus,
  novaIronheartPackBeforeEvent,
  novaIronheartPackBombshellDivisions,
  novaIronheartPackCanShareResource,
  novaIronheartPackCannotTakeDamage,
  novaIronheartPackCardEntered,
  novaIronheartPackCardLeftPlay,
  novaIronheartPackCardPlayed,
  novaIronheartPackCharacterModifiers,
  novaIronheartPackEvent,
  novaIronheartPackLeaveInterrupt,
  novaIronheartPackPhaseEnded,
  novaIronheartPackPlayRestriction,
  novaIronheartPackPowerResponses,
  novaIronheartPackRequirements,
  novaIronheartPackResourceSources,
  novaIronheartPackResourceSpent,
  novaIronheartPackResourcesSpent,
  novaIronheartPackTextBlank,
  novaIronheartPackTurnBegan,
  novaIronheartPackWaspIgnores,
  resolveNovaIronheartPackEffect,
  type NovaIronheartLeaveReceipt,
  type NovaIronheartPackPorts,
  type NovaIronheartPlayedReceipt,
  type NovaIronheartPowerReceipt,
} from "../src/game/nova-ironheart-pack.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `nova-ironheart-pack:${type}`,
  ...args,
});
const printedFields = [
  "name",
  "subname",
  "type_code",
  "faction_code",
  "cost",
  "deck_limit",
  "is_unique",
  "traits",
  "text",
  "resource_energy",
  "resource_mental",
  "resource_physical",
  "resource_wild",
  "attack",
  "thwart",
  "health",
] as const;
function fixture() {
  const s = newGame({
    heroId: "spider_man",
    aspect: "aggression",
    villainId: "rhino",
    seed: 28010,
    pacing: "expert",
    heroes: [
      { heroId: "spider_man", aspect: "aggression" },
      { heroId: "captain_marvel", aspect: "leadership" },
    ],
  });
  s.phase = "player";
  for (const seat of s.players) {
    const v = seatView(s, seat);
    Object.assign(v.player, {
      form: "hero",
      hp: 8,
      hand: [],
      deck: [],
      discard: [],
      inPlay: [],
      exhausted: false,
      tough: false,
      stunned: false,
      confused: false,
    });
    for (const key of Object.keys(v.flags)) delete v.flags[key];
  }
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.villain.hp = 30;
  s.villain.tough = false;
  const blanked = new Set<string>(),
    identityTraits = new Map<string, string[]>(
      s.players.map((seat) => [seat.id, ["Champion", "Genius", "Aerial"]]),
    );
  const f = {
    s,
    ports: {} as NovaIronheartPackPorts,
    blanked,
    identityTraits,
    attacks: [] as { source: string; target: string; amount: number }[],
    spent: [] as Resource[][],
    removed: [] as string[],
    shuffled: [] as string[],
    completed: [] as string[],
    payment: true,
    leave: true,
    millCounts: [] as number[],
    afterDamage: undefined as (() => void) | undefined,
  };
  const find = (s: GameState, id: string) =>
    [
      ...s.players.flatMap((seat) => seatView(s, seat).player.inPlay),
      ...s.minions,
      ...s.attachments,
      ...s.sideSchemes,
    ].find((p) => p.id === id);
  f.ports = {
    queue(s, ...effects) {
      s.queue.unshift(...effects);
    },
    choose(s, title, text, options) {
      s.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (_s, p) => blanked.has(p.id),
    identityHasTrait: (s, trait) =>
      identityTraits.get(s.activePlayerId)!.includes(trait),
    hasTrait(s, target, trait) {
      if (target === "hero" || target.startsWith("hero:"))
        return identityTraits
          .get(target === "hero" ? s.activePlayerId : target.slice(5))!
          .includes(trait);
      const p = find(s, target);
      return (
        !!p &&
        ((cards.get(p.code)?.traits || "").split(/\.\s*/).includes(trait) ||
          (p.code === "29023" &&
            p.counters === 2 &&
            trait === "Aerial" &&
            !blanked.has(p.id)))
      );
    },
    friendlyTargets(s) {
      return [
        ...s.players
          .filter((seat) => !seat.eliminated)
          .map((seat) => ({ id: `hero:${seat.id}`, label: seat.id })),
        ...s.players.flatMap((seat) =>
          seatView(s, seat)
            .player.inPlay.filter(
              (p) => cards.get(p.code)?.type_code === "ally",
            )
            .map((p) => ({
              id: p.id,
              code: p.code,
              label: cards.get(p.code)!.name,
            })),
        ),
      ];
    },
    enemyTargets(s, attack) {
      const ms = s.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)?.name || "Minion",
        code: p.code,
      }));
      return [
        ...(!attack ||
        !s.minions.some((p) =>
          (cards.get(p.code)?.text || "").includes("Guard"),
        )
          ? [{ id: s.villain.id, label: "Rhino", code: s.villain.code }]
          : []),
        ...ms,
      ];
    },
    schemeTargets(s) {
      return [
        ...(s.scheme.threat > 0 &&
        !s.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis)
          ? [{ id: "main", label: "Main scheme" }]
          : []),
        ...s.sideSchemes
          .filter((p) => p.counters > 0)
          .map((p) => ({
            id: p.id,
            code: p.code,
            label: cards.get(p.code)!.name,
          })),
      ];
    },
    allEnemies(s) {
      return [
        { id: s.villain.id, label: "Rhino", code: s.villain.code },
        ...s.minions.map((p) => ({ id: p.id, label: "Minion", code: p.code })),
      ];
    },
    blankableTargets(s) {
      return [
        ...s.attachments,
        ...s.minions.filter(
          (p) => !(cards.get(p.code)?.traits || "").includes("Elite"),
        ),
        ...s.sideSchemes.filter((p) => !cards.get(p.code)?.permanent),
      ].map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      }));
    },
    shieldSupportTargets(s) {
      return s.players.flatMap((seat) =>
        seatView(s, seat)
          .player.inPlay.filter(
            (p) =>
              cards.get(p.code)?.type_code === "support" &&
              (cards.get(p.code)?.traits || "").includes("S.H.I.E.L.D.") &&
              p.exhausted,
          )
          .map((p) => ({
            id: p.id,
            label: cards.get(p.code)!.name,
            code: p.code,
          })),
      );
    },
    canReady(s, target) {
      if (target === "hero" || target.startsWith("hero:"))
        return seatView(
          s,
          target === "hero" ? s.activePlayerId : target.slice(5),
        ).player.exhausted;
      return !!find(s, target)?.exhausted;
    },
    heroStats: () => ({ attack: 2, thwart: 3, defense: 4 }),
    canExhaustIdentity: (s) => s.player.form === "hero" && !s.player.exhausted,
    exhaustIdentity(s) {
      s.player.exhausted = true;
    },
    canPay: () => f.payment,
    handPlayableCards: (s) => s.player.hand,
    cardCost: (_s, p) => cards.get(p.code)!.cost || 0,
    playResponse(s, id, after) {
      const index = s.player.hand.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Missing physical response");
      const p = s.player.hand.splice(index, 1)[0];
      s.resolving.push(p);
      f.ports.queue(s, ...novaIronheartPackEvent(s, p)!, ...after);
    },
    payAbility(s, _cost, requirements, after) {
      if (!f.payment) throw Error("Cannot pay");
      f.spent.push(requirements);
      f.ports.queue(s, ...after);
    },
    attackProgram(s, effects, after) {
      if (s.player.stunned) s.player.stunned = false;
      else f.ports.queue(s, ...effects);
      s.queue.push(...after);
    },
    thwartProgram(s, effects, after) {
      if (s.player.confused) s.player.confused = false;
      else f.ports.queue(s, ...effects);
      s.queue.push(...after);
    },
    attackDamage(s, source, target, amount, after) {
      f.attacks.push({ source, target, amount });
      const p =
        target === s.villain.id
          ? s.villain
          : s.minions.find((p) => p.id === target)!;
      const remaining =
        target === s.villain.id
          ? s.villain.hp
          : cards.get(p.code)!.health! - p.damage;
      const prevented = p.tough;
      p.tough = false;
      if (!prevented) {
        if (target === s.villain.id)
          s.villain.hp -= Math.min(amount, remaining);
        else {
          p.damage += Math.min(amount, remaining);
          if (amount >= remaining) s.minions = s.minions.filter((q) => q !== p);
        }
      }
      f.afterDamage?.();
      const receipt = {
        target,
        damageDealt: prevented ? 0 : amount,
        excessDamage: prevented ? 0 : Math.max(0, amount - remaining),
        defeated: !prevented && amount >= remaining,
      };
      f.ports.queue(s, ...after.map((e) => ({ ...e, damageReceipt: receipt })));
    },
    discardTopPlayer(s, count, after) {
      f.millCounts.push(count);
      const deckExhausted = s.player.deck.length <= count;
      const discarded = s.player.deck.splice(0, count);
      s.player.discard.push(...discarded);
      f.ports.queue(
        s,
        ...after.map((e) => ({
          ...e,
          discardedIds: discarded.map((p) => p.id),
          deckExhausted,
        })),
      );
    },
    discardHand(s, id) {
      const index = s.player.hand.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Not in hand");
      s.player.discard.push(s.player.hand.splice(index, 1)[0]);
    },
    discardPiece(s, id) {
      const p = find(s, id)!;
      for (const seat of s.players) {
        const v = seatView(s, seat);
        v.player.inPlay = v.player.inPlay.filter((p) => p.id !== id);
      }
      seatView(s, p.ownerId || s.activePlayerId).player.discard.push(p);
      novaIronheartPackCardLeftPlay(s, p);
    },
    spendUseCost(s, id, after) {
      const p = find(s, id)!;
      p.counters--;
      f.ports.queue(s, ...after);
    },
    finishUse(s, id, after) {
      const p = find(s, id);
      if (p && !p.counters) f.ports.discardPiece(s, id);
      f.ports.queue(s, ...after);
    },
    removeResolvingFromGame(s, id) {
      const index = s.resolving.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Missing resolving original");
      s.resolving.splice(index, 1);
      f.removed.push(id);
    },
    replaceLeaveWithShuffle(s, receipt, after) {
      const p = find(s, receipt.pieceId)!;
      for (const seat of s.players) {
        const v = seatView(s, seat);
        v.player.inPlay = v.player.inPlay.filter((q) => q.id !== p.id);
      }
      seatView(s, receipt.ownerId).player.deck.push(p);
      novaIronheartPackCardLeftPlay(s, p);
      f.shuffled.push(p.id);
      f.leave = false;
      f.ports.queue(s, ...after);
    },
    leaveAvailable: () => f.leave,
    revealHidden() {},
    maxHP: () => 12,
  };
  const piece = (code: string, ownerId = s.activePlayerId): Piece => ({
    ...makePiece(s, code),
    ownerId,
  });
  const put = (code: string, ownerId = s.activePlayerId) => {
    const p = piece(code, ownerId);
    seatView(s, ownerId).player.inPlay.push(p);
    novaIronheartPackCardEntered(s, p);
    return p;
  };
  function drain() {
    for (let i = 0; i < 150 && !s.prompt && s.queue.length; i++) {
      const e = s.queue.shift()!;
      if (e.actorId) activateSeat(s, e.actorId);
      if (resolveNovaIronheartPackEffect(s, e, f.ports)) continue;
      if (e.type === "draw") {
        s.player.hand.push(...s.player.deck.splice(0, e.amount));
        continue;
      }
      if (e.type === "thwart") {
        if (e.target === "main")
          s.scheme.threat = Math.max(0, s.scheme.threat - e.amount);
        else {
          const p = s.sideSchemes.find((p) => p.id === e.target)!;
          p.counters = Math.max(0, p.counters - e.amount);
        }
        continue;
      }
      if (e.type === "ready") {
        if (e.target === "hero" || e.target.startsWith("hero:"))
          seatView(
            s,
            e.target === "hero" ? s.activePlayerId : e.target.slice(5),
          ).player.exhausted = false;
        else find(s, e.target)!.exhausted = false;
        continue;
      }
      if (e.type === "heal") {
        const seat = e.target.startsWith("hero:")
          ? e.target.slice(5)
          : s.activePlayerId;
        seatView(s, seat).player.hp = Math.min(
          12,
          seatView(s, seat).player.hp + e.amount,
        );
        continue;
      }
      if (e.type === "optional") {
        f.ports.choose(s, e.title, e.text, [
          { id: "yes", label: "Resolve", effects: e.effects },
          { id: "no", label: "Decline", effects: [] },
        ]);
        continue;
      }
      f.completed.push(e.type);
    }
    if (!s.prompt && s.queue.length) throw Error("Unbounded pure program");
  }
  function start(effects: Effect[] | null) {
    f.ports.queue(s, ...(effects || []));
    drain();
  }
  function choose(id: string) {
    const o = s.prompt?.options.find((o) => o.id === id);
    if (!o) throw Error(`Missing option ${id} in ${s.prompt?.title}`);
    s.prompt = null;
    f.ports.queue(s, ...o.effects);
    drain();
  }
  function restore() {
    const parsed = JSON.parse(JSON.stringify(s)) as GameState;
    Object.assign(s, parsed);
    const current = s.players.find((seat) => seat.id === s.activePlayerId)!;
    current.player = s.player;
    current.flags = s.flags;
  }
  const played = (
    p: Piece,
    paid: Resource[] = [],
    extra: Partial<NovaIronheartPlayedReceipt> = {},
  ): NovaIronheartPlayedReceipt => ({
    token: `play:${p.id}`,
    playerId: s.activePlayerId,
    pieceId: p.id,
    code: p.code,
    traits: (cards.get(p.code)?.traits || "").split(/\.\s*/),
    paid,
    fromHand: true,
    ...extra,
  });
  const power = (
    sourceId: string,
    extra: Partial<NovaIronheartPowerReceipt> = {},
  ): NovaIronheartPowerReceipt => ({
    token: `power:${sourceId}`,
    playerId: s.activePlayerId,
    sourceId,
    power: "attack",
    performed: true,
    hero: sourceId === "hero",
    ...extra,
  });
  return Object.assign(f, {
    piece,
    put,
    drain,
    start,
    choose,
    restore,
    played,
    power,
  });
}

describe("original Nova and Ironheart player pool", () => {
  it("registers all 30 retail player faces with no encounter or identity leakage", () => {
    const actual = [...cards.values()]
      .filter(
        (c) =>
          ["nova", "ironheart"].includes(c.pack_code || "") &&
          !["hero", "encounter"].includes(c.faction_code),
      )
      .map((c) => c.code)
      .sort();
    expect(
      [
        ...NOVA_IRONHEART_PACK_SCRIPT_CODES,
        ...NOVA_IRONHEART_PACK_CORE_ALIAS_PAIRS.map(([a]) => a),
      ].sort(),
    ).toEqual(actual);
    expect(actual).toHaveLength(30);
  });
  it.each([
    ...NOVA_IRONHEART_PACK_CORE_ALIAS_PAIRS,
    ...NOVA_IRONHEART_PACK_INHERITED_ALIAS_PAIRS,
  ])("preserves exact source rule fields for %s→%s", (source, original) => {
    const a = cards.get(source)!,
      b = cards.get(original)!;
    for (const field of printedFields)
      expect(a[field], field).toEqual(b[field]);
  });
  it.each([
    ["28013", ["physical"]],
    ["28017", ["mental", "mental"]],
    ["29017", ["energy"]],
    ["29018", ["mental"]],
    ["29020", ["mental", "mental"]],
    ["28014", []],
  ] as const)(
    "retains the explicit SPEND requirement for %s",
    (code, resources) =>
      expect(novaIronheartPackRequirements(fixture().piece(code))).toEqual(
        resources,
      ),
  );
  it("enforces printed Champion/Genius/Aerial gates against the current identity traits", () => {
    const f = fixture();
    f.identityTraits.set(f.s.activePlayerId, ["Civilian"]);
    for (const code of [
      "28010",
      "28012",
      "28018",
      "28026",
      "29025",
      "29027",
      "29033",
      "29034",
      "29035",
    ])
      expect(
        novaIronheartPackPlayRestriction(f.s, f.piece(code), f.ports),
      ).toBeTruthy();
    f.identityTraits.set(f.s.activePlayerId, ["Genius"]);
    expect(
      novaIronheartPackPlayRestriction(f.s, f.piece("28018"), f.ports),
    ).toBeNull();
  });
  it("Honed Technique uses printed cost and allocated FOR mental, and respects blanking", () => {
    const f = fixture(),
      h = f.put("28017"),
      p = f.piece("28013");
    expect(novaIronheartPackAttackEventBonus(f.s, p, ["mental"], f.ports)).toBe(
      2,
    );
    expect(
      novaIronheartPackAttackEventBonus(f.s, p, ["physical"], f.ports),
    ).toBe(0);
    expect(
      novaIronheartPackAttackEventBonus(
        f.s,
        f.piece("29017"),
        ["mental"],
        f.ports,
      ),
    ).toBe(0);
    f.blanked.add(h.id);
    expect(novaIronheartPackAttackEventBonus(f.s, p, ["mental"], f.ports)).toBe(
      0,
    );
    expect(novaIronheartPackEvent(f.s, p, ["mental"])![0].amount).toBe(4);
  });
  it("cannot put a second Honed Technique or Ingenuity under one controller", () => {
    const f = fixture();
    for (const code of ["28017", "29027"]) {
      f.put(code);
      expect(
        novaIronheartPackPlayRestriction(f.s, f.piece(code), f.ports),
      ).toContain("Max 1");
    }
  });
  it("No Quarter retrieves only exact Aggression IDs discarded by its actual excess", () => {
    const f = fixture(),
      event = f.piece("28013"),
      enemy = f.piece("01101");
    enemy.damage = 2;
    f.s.minions.push(enemy);
    f.s.resolving.push(event);
    const old = f.piece("28014"),
      a = f.piece("28016"),
      b = f.piece("29027"),
      c = f.piece("28013");
    f.s.player.discard.push(old);
    f.s.player.deck.push(a, b, c, f.piece("29027"));
    f.start(novaIronheartPackEvent(f.s, event));
    f.choose(enemy.id);
    expect(f.millCounts).toEqual([1, 1, 1]);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([a.id, c.id]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([old.id, b.id]);
  });
  it("No Quarter keeps an earlier red recovery when a later nonred card empties the deck", () => {
    const f = fixture(),
      event = f.piece("28013"),
      enemy = f.piece("01101"),
      red = f.piece("28016"),
      nonred = f.piece("29027");
    enemy.damage = 2;
    f.s.minions.push(enemy);
    f.s.resolving.push(event);
    f.s.player.deck.push(red, nonred);
    f.start(novaIronheartPackEvent(f.s, event));
    f.choose(enemy.id);
    expect(f.millCounts).toEqual([1, 1]);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([red.id]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([nonred.id]);
  });
  it("Tough prevents No Quarter's excess benefit without discarding the deck", () => {
    const f = fixture(),
      p = f.piece("28013"),
      enemy = f.piece("01101");
    enemy.tough = true;
    f.s.minions.push(enemy);
    f.s.resolving.push(p);
    f.start(novaIronheartPackEvent(f.s, p));
    f.choose(enemy.id);
    expect(f.millCounts).toEqual([]);
    expect(enemy.damage).toBe(0);
    expect(enemy.tough).toBe(false);
  });
  it("One by One checks actual defeat before choosing its second target", () => {
    const f = fixture(),
      p = f.piece("28014"),
      enemy = f.piece("01101");
    enemy.damage = 2;
    f.s.minions.push(enemy);
    f.s.resolving.push(p);
    f.start(novaIronheartPackEvent(f.s, p));
    f.choose(enemy.id);
    f.restore();
    f.choose(f.s.villain.id);
    expect(f.attacks.map((a) => a.target)).toEqual([enemy.id, f.s.villain.id]);
    expect(f.s.villain.hp).toBe(28);
  });
  it("One by One cannot add its second packet when the first does not defeat", () => {
    const f = fixture(),
      p = f.piece("28014");
    f.s.resolving.push(p);
    f.start(novaIronheartPackEvent(f.s, p));
    f.choose(f.s.villain.id);
    expect(f.attacks).toHaveLength(1);
    expect(f.s.prompt).toBeNull();
  });
  it("the second One by One choice rechecks an actual new Guard", () => {
    const f = fixture(),
      p = f.piece("28014"),
      enemy = f.piece("01101"),
      guard = f.piece("01182");
    enemy.damage = 2;
    f.s.minions.push(enemy);
    f.s.resolving.push(p);
    f.afterDamage = () => {
      if (!f.s.minions.some((m) => m.id === guard.id)) f.s.minions.push(guard);
    };
    f.start(novaIronheartPackEvent(f.s, p));
    f.choose(enemy.id);
    expect(f.s.prompt?.options.map((o) => o.id)).not.toContain(f.s.villain.id);
  });
  it("Stun replaces the whole One by One attack before any target or damage", () => {
    const f = fixture();
    f.s.player.stunned = true;
    f.start(novaIronheartPackEvent(f.s, f.piece("28014")));
    expect(f.s.player.stunned).toBe(false);
    expect(f.attacks).toEqual([]);
    expect(f.s.prompt).toBeNull();
  });
  it("The Locust recovers the original discarded Aggression event on PUT entry", () => {
    const f = fixture(),
      ally = f.put("28010"),
      red = f.piece("28014"),
      blue = f.piece("29017");
    f.s.player.discard.push(red, blue);
    f.start(novaIronheartPackAllyEntered(f.s, ally, f.ports));
    f.choose("yes");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([red.id]);
    f.choose(red.id);
    expect(f.s.player.hand[0]).toBe(red);
    expect(f.s.player.discard).toEqual([blue]);
  });
  it("The Locust hero entry response and other entry text disappear when blanked", () => {
    const f = fixture(),
      p = f.put("28010");
    f.s.player.discard.push(f.piece("28014"));
    f.s.player.form = "alter";
    expect(novaIronheartPackAllyEntered(f.s, p, f.ports)).toBeNull();
    f.s.player.form = "hero";
    f.blanked.add(p.id);
    expect(novaIronheartPackAllyEntered(f.s, p, f.ports)).toBeNull();
  });
  it("Moon Girl counts actual FOR mental on PLAY from hand and never PUT", () => {
    const f = fixture(),
      p = f.put("28018"),
      draws = [f.piece("28014"), f.piece("28016"), f.piece("28017")];
    f.s.player.deck.push(...draws);
    expect(
      novaIronheartPackCardPlayed(
        f.s,
        f.played(p, ["mental", "mental", "physical"], { fromHand: false }),
        f.ports,
      ),
    ).toBeNull();
    f.start(
      novaIronheartPackCardPlayed(
        f.s,
        f.played(p, ["mental", "mental", "physical"]),
        f.ports,
      ),
    );
    f.choose("yes");
    expect(f.s.player.hand.map((p) => p.id)).toEqual(
      draws.slice(0, 2).map((p) => p.id),
    );
    f.blanked.add(p.id);
    expect(
      novaIronheartPackCardPlayed(f.s, f.played(p, ["mental"]), f.ports),
    ).toBeNull();
  });
  it("Fluid Motion shares Max 1 across copies for one actual PLAY token", () => {
    const f = fixture(),
      a = f.put("28016"),
      b = f.put("28016"),
      event = f.piece("28014"),
      receipt = f.played(event);
    f.start(novaIronheartPackCardPlayed(f.s, receipt, f.ports));
    f.restore();
    f.choose(a.id);
    expect(
      novaIronheartPackCharacterModifiers(f.s, "hero", f.ports).attack,
    ).toBe(1);
    expect(novaIronheartPackCardPlayed(f.s, receipt, f.ports)).toBeNull();
    expect(b.exhausted).toBe(false);
    f.start(
      novaIronheartPackCardPlayed(
        f.s,
        { ...receipt, token: "other-actual-event" },
        f.ports,
      ),
    );
    f.choose(b.id);
    expect(
      novaIronheartPackCharacterModifiers(f.s, "hero", f.ports).attack,
    ).toBe(2);
    novaIronheartPackPhaseEnded(f.s);
    expect(
      novaIronheartPackCharacterModifiers(f.s, "hero", f.ports).attack,
    ).toBe(0);
  });
  it("Pitchback responds only to a performed hero attack with current Aerial", () => {
    const f = fixture(),
      p = f.piece("28012");
    f.s.player.hand.push(p);
    const receipt = f.power("hero");
    expect(
      novaIronheartPackPowerResponses(
        f.s,
        { ...receipt, performed: false },
        f.ports,
      ),
    ).toBeNull();
    expect(
      novaIronheartPackPowerResponses(f.s, f.power("some-ally"), f.ports),
    ).toBeNull();
    f.start(novaIronheartPackPowerResponses(f.s, receipt, f.ports));
    f.choose(p.id);
    f.choose(f.s.villain.id);
    f.choose("pass");
    expect(f.s.villain.hp).toBe(26);
  });
  it("different Pitchback copies may respond to one attack while the same physical copy cannot", () => {
    const f = fixture(),
      a = f.piece("28012"),
      b = f.piece("28012");
    f.s.player.hand.push(a, b);
    const receipt = f.power("hero");
    f.start(novaIronheartPackPowerResponses(f.s, receipt, f.ports));
    f.choose(a.id);
    f.choose(f.s.villain.id);
    expect(f.s.prompt?.options.map((o) => o.id)).toContain(b.id);
    f.choose(b.id);
    f.choose(f.s.villain.id);
    f.choose("pass");
    f.s.player.hand.push(a);
    f.start(novaIronheartPackPowerResponses(f.s, receipt, f.ports));
    expect(f.s.prompt?.options.map((o) => o.id)).not.toContain(a.id);
  });
  it("Yaw and Roll reuses the actual thwart window and legal non-Crisis target", () => {
    const f = fixture(),
      p = f.piece("28026");
    f.s.player.hand.push(p);
    f.s.scheme.threat = 5;
    const receipt = f.power("hero", { power: "thwart" });
    f.start(novaIronheartPackPowerResponses(f.s, receipt, f.ports));
    f.choose(p.id);
    f.choose("main");
    f.choose("pass");
    expect(f.s.scheme.threat).toBe(2);
  });
  it("Everyday Hero can share only while its source identity is Civilian and heals the beneficiary", () => {
    const f = fixture(),
      p = f.piece("28019"),
      allySeat = f.s.players[1].id;
    f.identityTraits.set(f.s.activePlayerId, ["Civilian"]);
    expect(novaIronheartPackCanShareResource(f.s, p, f.ports)).toBe(true);
    f.start(novaIronheartPackResourcesSpent(f.s, [p], allySeat, f.ports));
    f.choose("yes");
    expect(seatView(f.s, allySeat).player.hp).toBe(9);
    expect(f.s.player.hp).toBe(8);
    f.identityTraits.set(f.s.activePlayerId, ["Champion"]);
    expect(novaIronheartPackCanShareResource(f.s, p, f.ports)).toBe(false);
    expect(
      novaIronheartPackResourcesSpent(f.s, [p], allySeat, f.ports),
    ).toEqual([]);
  });
  it("Champions Mobile Bunker offers the chosen player draw then physical hand discards", () => {
    const f = fixture(),
      bunker = f.put("28020"),
      target = f.s.players[1].id;
    const a = f.piece("28014", target),
      b = f.piece("28016", target);
    seatView(f.s, target).player.deck.push(a, b);
    f.start(novaIronheartPackAbility(f.s, bunker.id, "bunker", f.ports));
    f.choose(target);
    f.choose("yes");
    f.restore();
    f.choose(a.id);
    f.choose(b.id);
    expect(seatView(f.s, target).player.hand).toEqual([]);
    expect(seatView(f.s, target).player.discard.map((p) => p.id)).toEqual([
      a.id,
      b.id,
    ]);
  });
  it("Bunker may be declined without drawing or discarding", () => {
    const f = fixture(),
      p = f.put("28020");
    f.s.player.deck.push(f.piece("28014"));
    f.start(novaIronheartPackAbility(f.s, p.id, "bunker", f.ports));
    f.choose(f.s.activePlayerId);
    f.choose("no");
    expect(f.s.player.deck).toHaveLength(1);
    expect(f.s.player.hand).toEqual([]);
  });
  it("Height Advantage stacks printed prevention and discards at its controller's turn", () => {
    const f = fixture(),
      a = f.put("28027"),
      b = f.put("28027");
    expect(novaIronheartPackAttackDamageReduction(f.s, "hero", f.ports)).toBe(
      2,
    );
    f.blanked.add(b.id);
    expect(novaIronheartPackAttackDamageReduction(f.s, "hero", f.ports)).toBe(
      1,
    );
    f.start(novaIronheartPackTurnBegan(f.s, f.s.activePlayerId));
    expect(f.s.player.discard.map((p) => p.id)).toContain(a.id);
    expect(f.s.player.inPlay.map((p) => p.id)).toContain(b.id);
  });
  it("Cloud 9's printed special does not intercept her ordinary ally basic powers", () => {
    const f = fixture(),
      p = f.put("29014");
    expect(
      novaIronheartPackAbilityOptions(f.s, p.id, f.ports).map((o) => o.id),
    ).toEqual(["cloud"]);
    expect(novaIronheartPackAbility(f.s, p.id, "attack", f.ports)).toBeNull();
    expect(novaIronheartPackAbility(f.s, p.id, "thwart", f.ports)).toBeNull();
  });
  it("Cloud 9's lasting set includes a later Aerial ally and excludes other players", () => {
    const f = fixture(),
      p = f.put("29014");
    const mine = f.s.activePlayerId,
      other = f.s.players[1].id;
    f.start(novaIronheartPackAbility(f.s, p.id, "cloud", f.ports));
    f.choose(mine);
    const aerial = f.put("29024"),
      foreign = f.put("29024", other);
    expect(
      novaIronheartPackCharacterModifiers(f.s, aerial.id, f.ports).thwart,
    ).toBe(1);
    expect(
      novaIronheartPackCharacterModifiers(f.s, foreign.id, f.ports).thwart,
    ).toBe(0);
    novaIronheartPackPhaseEnded(f.s);
    expect(
      novaIronheartPackCharacterModifiers(f.s, aerial.id, f.ports).thwart,
    ).toBe(0);
  });
  it("Falcon pays a typed energy ability cost and readies another controlled Champion", () => {
    const f = fixture(),
      falcon = f.put("29015"),
      other = f.put("29016"),
      foreign = f.put("29016", f.s.players[1].id);
    other.exhausted = true;
    foreign.exhausted = true;
    f.start(novaIronheartPackPowerResponses(f.s, f.power(falcon.id), f.ports));
    f.choose("yes");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([other.id]);
    f.choose(other.id);
    expect(f.spent).toEqual([["energy"]]);
    expect(other.exhausted).toBe(false);
    expect(foreign.exhausted).toBe(true);
  });
  it("Patriot boosts an actual Champion's basic powers through the round", () => {
    const f = fixture(),
      p = f.put("29016"),
      target = `hero:${f.s.players[1].id}`;
    f.start(novaIronheartPackAllyEntered(f.s, p, f.ports));
    f.choose("yes");
    f.choose(target);
    const m = novaIronheartPackCharacterModifiers(f.s, target, f.ports);
    expect([m.attack, m.thwart, m.defense]).toEqual([1, 1, 1]);
    novaIronheartPackPhaseEnded(f.s);
    expect(
      novaIronheartPackCharacterModifiers(f.s, target, f.ports).attack,
    ).toBe(1);
    f.s.round++;
    expect(
      novaIronheartPackCharacterModifiers(f.s, target, f.ports).attack,
    ).toBe(0);
  });
  it("Go All Out exhausts first and snapshots current basic stats for damage", () => {
    const f = fixture(),
      p = f.piece("29017");
    f.s.resolving.push(p);
    f.start(
      novaIronheartPackBeforeEvent(f.s, p, novaIronheartPackEvent(f.s, p)!),
    );
    expect(f.s.player.exhausted).toBe(true);
    f.choose(f.s.villain.id);
    expect(f.attacks[0].amount).toBe(9);
    expect(
      novaIronheartPackPlayRestriction(f.s, f.piece("29017"), f.ports),
    ).toBeTruthy();
  });
  it("Push Ahead still pays its exhaust cost before Confuse replaces the thwart", () => {
    const f = fixture(),
      p = f.piece("29018");
    f.s.player.confused = true;
    f.s.scheme.threat = 5;
    f.start(
      novaIronheartPackBeforeEvent(f.s, p, novaIronheartPackEvent(f.s, p)!),
    );
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.player.confused).toBe(false);
    expect(f.s.scheme.threat).toBe(5);
  });
  it("Morale Boost gives only a selected hero a round modifier", () => {
    const f = fixture(),
      ally = f.put("29016");
    f.start(novaIronheartPackEvent(f.s, f.piece("29019")));
    expect(f.s.prompt?.options.map((o) => o.id)).not.toContain(ally.id);
    f.choose(`hero:${f.s.activePlayerId}`);
    expect(
      novaIronheartPackCharacterModifiers(f.s, "hero", f.ports).defense,
    ).toBe(1);
  });
  it("R&D Facility's final Uses counter discards the source after the lasting benefit", () => {
    const f = fixture(),
      p = f.put("29020");
    p.counters = 1;
    f.start(novaIronheartPackAbility(f.s, p.id, "research", f.ports));
    expect(f.s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
    expect(f.s.player.discard).toEqual([]);
    f.restore();
    f.choose(`hero:${f.s.activePlayerId}`);
    expect(f.s.player.discard[0].id).toBe(p.id);
    expect(
      novaIronheartPackCharacterModifiers(f.s, "hero", f.ports),
    ).toMatchObject({ attack: 1, thwart: 1 });
  });
  it.each([
    [
      0,
      {
        attack: 0,
        thwart: 0,
        health: 0,
        aerial: false,
        retaliate: 0,
        overkill: false,
      },
    ],
    [
      1,
      {
        attack: 3,
        thwart: 0,
        health: 0,
        aerial: false,
        retaliate: 0,
        overkill: true,
      },
    ],
    [
      2,
      {
        attack: 0,
        thwart: 3,
        health: 0,
        aerial: true,
        retaliate: 0,
        overkill: false,
      },
    ],
    [
      3,
      {
        attack: 0,
        thwart: 0,
        health: 5,
        aerial: false,
        retaliate: 1,
        overkill: false,
      },
    ],
  ] as const)(
    "Snowguard's %s counters preserve the exact printed mode",
    (amount, expected) => {
      const f = fixture(),
        p = f.put("29023");
      f.start(novaIronheartPackAllyEntered(f.s, p, f.ports));
      f.choose(String(amount));
      expect(
        novaIronheartPackCharacterModifiers(f.s, p.id, f.ports),
      ).toMatchObject(expected);
      f.blanked.add(p.id);
      expect(
        novaIronheartPackCharacterModifiers(f.s, p.id, f.ports).health,
      ).toBe(0);
    },
  );
  it("Vivian blanks only the actual eligible printed textbox until the round expires", () => {
    const f = fixture(),
      p = f.put("29024"),
      ordinary = f.piece("01101"),
      elite = f.piece("01102");
    f.s.minions.push(ordinary, elite);
    f.start(novaIronheartPackAllyEntered(f.s, p, f.ports));
    f.choose("yes");
    expect(f.s.prompt?.options.map((o) => o.id)).not.toContain(elite.id);
    f.choose(ordinary.id);
    f.restore();
    expect(novaIronheartPackTextBlank(f.s, ordinary)).toBe(true);
    expect(cards.get(ordinary.code)?.traits).toBeTruthy();
    f.s.round++;
    expect(novaIronheartPackTextBlank(f.s, ordinary)).toBe(false);
  });
  it("Go for Champions removes the original event as a cost and protects later Champions too", () => {
    const f = fixture(),
      p = f.piece("29025");
    f.s.resolving.push(p);
    f.start(
      novaIronheartPackBeforeEvent(f.s, p, novaIronheartPackEvent(f.s, p)!),
    );
    expect(f.removed).toEqual([p.id]);
    expect(f.s.resolving).toEqual([]);
    const later = f.put("29016");
    expect(novaIronheartPackCannotTakeDamage(f.s, later.id, f.ports)).toBe(
      true,
    );
    f.identityTraits.set(f.s.players[1].id, ["Avenger"]);
    expect(
      novaIronheartPackCannotTakeDamage(
        f.s,
        `hero:${f.s.players[1].id}`,
        f.ports,
      ),
    ).toBe(false);
    f.s.round++;
    expect(novaIronheartPackCannotTakeDamage(f.s, later.id, f.ports)).toBe(
      false,
    );
  });
  it("the original Agent 13 reprint readies another player's actual S.H.I.E.L.D. support", () => {
    const f = fixture(),
      agent = f.put("29022"),
      support = f.put("29026", f.s.players[1].id);
    support.exhausted = true;
    f.s.player.form = "alter";
    f.start(novaIronheartPackPowerResponses(f.s, f.power(agent.id), f.ports));
    f.choose("yes");
    f.restore();
    f.choose(support.id);
    expect(
      f.s.players[1].player.inPlay.find((p) => p.id === support.id)?.exhausted,
    ).toBe(false);
    expect(f.s.player.inPlay.find((p) => p.id === agent.id)?.code).toBe(
      "29022",
    );
  });
  it("Morale Boost cannot choose an identity currently in alter-ego form", () => {
    const f = fixture();
    seatView(f.s, f.s.players[1].id).player.form = "alter";
    f.start(novaIronheartPackEvent(f.s, f.piece("29019")));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
      `hero:${f.s.activePlayerId}`,
    ]);
  });
  it("Ingenuity generates mental in either form, with actual exhaustion and blanking", () => {
    const f = fixture(),
      p = f.put("29027");
    f.s.player.form = "alter";
    expect(novaIronheartPackResourceSources(f.s, f.ports)[0].resources).toEqual(
      ["mental"],
    );
    expect(novaIronheartPackResourceSpent(f.s, p.id, f.ports)).toBe(true);
    expect(novaIronheartPackResourceSources(f.s, f.ports)).toEqual([]);
    p.exhausted = false;
    f.blanked.add(p.id);
    expect(novaIronheartPackResourceSources(f.s, f.ports)).toEqual([]);
  });
  it("Bombshell distributes every point as evenly as possible across all enemies", () => {
    expect(
      novaIronheartPackBombshellDivisions(3, ["v", "a", "b"]).map(
        (p) => p.allocations,
      ),
    ).toEqual([
      [
        { target: "v", amount: 1 },
        { target: "a", amount: 1 },
        { target: "b", amount: 1 },
      ],
    ]);
    const uneven = novaIronheartPackBombshellDivisions(3, ["v", "a"]);
    expect(uneven).toHaveLength(2);
    expect(uneven.map((p) => p.allocations.map((a) => a.amount))).toEqual([
      [2, 1],
      [1, 2],
    ]);
    expect(
      novaIronheartPackBombshellDivisions(0, ["v"])[0].allocations[0].amount,
    ).toBe(0);
  });
  it("Wasp's printed bypass requires the actual unblanked Wasp printing", () => {
    const f = fixture(),
      p = f.put("29034");
    expect(novaIronheartPackWaspIgnores(f.s, p, f.ports)).toBe(true);
    f.blanked.add(p.id);
    expect(novaIronheartPackWaspIgnores(f.s, p, f.ports)).toBe(false);
    expect(novaIronheartPackWaspIgnores(f.s, f.put("29016"), f.ports)).toBe(
      false,
    );
  });
  it("Pinpoint preserves a different player's original card and shuffles into its owner deck", () => {
    const f = fixture(),
      pinpoint = f.put("29035"),
      owner = f.s.players[1].id,
      leaving = f.put("29016", owner);
    const receipt: NovaIronheartLeaveReceipt = {
      token: "leave:1",
      pieceId: leaving.id,
      code: leaving.code,
      ownerId: owner,
      playerCard: true,
      fromPlay: true,
      toDiscard: true,
    };
    f.start(novaIronheartPackLeaveInterrupt(f.s, receipt, f.ports));
    f.restore();
    f.choose(pinpoint.id);
    expect(seatView(f.s, owner).player.deck.map((p) => p.id)).toEqual([
      leaving.id,
    ]);
    expect(f.s.player.deck).toEqual([]);
    expect(f.shuffled).toEqual([leaving.id]);
    expect(novaIronheartPackLeaveInterrupt(f.s, receipt, f.ports)).toBeNull();
  });
  it("Pinpoint may interrupt its own impending discard while still ready in play", () => {
    const f = fixture(),
      p = f.put("29035"),
      receipt: NovaIronheartLeaveReceipt = {
        token: "leave:self",
        pieceId: p.id,
        code: p.code,
        ownerId: f.s.activePlayerId,
        playerCard: true,
        fromPlay: true,
        toDiscard: true,
      };
    f.start(novaIronheartPackLeaveInterrupt(f.s, receipt, f.ports));
    f.choose(p.id);
    expect(f.s.player.deck[0].id).toBe(p.id);
  });
  it("Pinpoint cannot replace a resource discard, encounter discard, return or removed-game cost", () => {
    const f = fixture(),
      p = f.put("29035"),
      base: NovaIronheartLeaveReceipt = {
        token: "leave:invalid",
        pieceId: p.id,
        code: p.code,
        ownerId: f.s.activePlayerId,
        playerCard: true,
        fromPlay: true,
        toDiscard: true,
      };
    for (const change of [
      { fromPlay: false },
      { playerCard: false },
      { toDiscard: false },
    ])
      expect(
        novaIronheartPackLeaveInterrupt(f.s, { ...base, ...change }, f.ports),
      ).toBeNull();
    f.blanked.add(p.id);
    expect(novaIronheartPackLeaveInterrupt(f.s, base, f.ports)).toBeNull();
  });
  it("leaving and reentering the same physical card clears its prior targeted lasting modifiers", () => {
    const f = fixture(),
      ally = f.put("29016");
    f.start([P("patriot-mod", { target: ally.id })]);
    expect(
      novaIronheartPackCharacterModifiers(f.s, ally.id, f.ports).attack,
    ).toBe(1);
    novaIronheartPackCardLeftPlay(f.s, ally);
    expect(
      novaIronheartPackCharacterModifiers(f.s, ally.id, f.ports).attack,
    ).toBe(0);
  });
});
