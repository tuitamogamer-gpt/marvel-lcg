import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import {
  consumeStatus,
  consumeTough,
  printedKeyword,
} from "../src/game/keywords.js";
import { rulesCode } from "../src/game/rules-code.js";
import { allInPlay, seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  WAR_MACHINE_PACK_CORE_ALIASES,
  WAR_MACHINE_PACK_SCRIPT_CODES,
  resolveWarMachinePackEffect,
  warMachinePackAbility,
  warMachinePackAbilityOptions,
  warMachinePackAllyEnter,
  warMachinePackAllyModifiers,
  warMachinePackAttachmentTargets,
  warMachinePackBeforeEvent,
  warMachinePackCardEntered,
  warMachinePackCardLeftPlay,
  warMachinePackDamageOptions,
  warMachinePackEvent,
  warMachinePackPhaseEnded,
  warMachinePackPaymentAllowed,
  warMachinePackPlayRestriction,
  warMachinePackResourceSources,
  warMachinePackResourceSpent,
  warMachinePackSneakAllies,
  warMachinePackResourcesSpent,
  warMachinePackStoredPlayable,
  warMachinePackTakeStoredForPlay,
  type WarMachinePackCharacter,
  type WarMachinePackPorts,
} from "../src/game/war-machine-pack.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: "war-machine-pack:" + type,
  ...args,
});
function reload(s: GameState): GameState {
  const copy: GameState = JSON.parse(JSON.stringify(s));
  const current = copy.players.find((p) => p.id === copy.activePlayerId)!;
  current.player = copy.player;
  current.flags = copy.flags;
  return copy;
}
function fixture(team = false) {
  const state = newGame({
    heroId: "rocket",
    aspect: "leadership",
    villainId: "rhino",
    seed: 23012,
    ...(team
      ? {
          heroes: [
            { heroId: "rocket", aspect: "leadership" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  state.heroId = state.players[0].heroId = "warm";
  state.phase = "player";
  state.round = 1;
  state.prompt = null;
  state.queue = [];
  state.resolving = [];
  state.minions = [];
  state.sideSchemes = [];
  state.attachments = [];
  state.encounter.deck = [];
  state.encounter.discard = [];
  state.scheme.threat = 10;
  state.villain.hp = 50;
  for (const seat of state.players) {
    const s = seatView(state, seat);
    s.player.form = "hero";
    s.player.exhausted = false;
    s.player.inPlay = [];
    s.player.hand = [];
    s.player.deck = [];
    s.player.discard = [];
    s.player.stunned = s.player.confused = false;
    s.flags["heroTraits"] = seat.id === "p1" ? "Avenger,Soldier" : "Guardian";
    s.flags["heroName"] = seat.id === "p1" ? "War Machine" : "Gamora";
  }
  const f = {
    s: state,
    ports: {} as WarMachinePackPorts,
    packets: [] as Effect[],
    receipts: [] as Effect[],
    history: [] as string[],
    discardedBatches: [] as string[][],
    payRequests: [] as Effect[],
    piece(code: string, seat = "p1") {
      return { ...makePiece(f.s, code), ownerId: seat };
    },
  };
  const character = (s: GameState, id: string) => {
    if (id === "hero") id = "hero:" + s.activePlayerId;
    if (id.startsWith("hero:")) return seatView(s, id.slice(5)).player;
    return allInPlay(s).find((p) => p.id === id);
  };
  f.ports = {
    queue: (s, ...effects) => s.queue.unshift(...effects),
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (s, p) => !!s.flags["blank:" + p.id],
    characters: (s) =>
      s.players.flatMap((seat) => {
        const v = seatView(s, seat);
        return [
          {
            id: "hero:" + seat.id,
            name: String(v.flags.heroName),
            label: String(v.flags.heroName),
            playerId: seat.id,
            type: v.player.form === "hero" ? "hero" : "alter_ego",
            exhausted: v.player.exhausted,
          },
          ...v.player.inPlay
            .filter((p) => cards.get(p.code)?.type_code === "ally")
            .map((p) => ({
              id: p.id,
              code: p.code,
              name: cards.get(p.code)!.name,
              label: cards.get(p.code)!.name,
              playerId: seat.id,
              type: "ally",
              exhausted: p.exhausted,
            })),
        ] as WarMachinePackCharacter[];
      }),
    hasTrait: (s, id, trait) =>
      id.startsWith("hero:")
        ? String(seatView(s, id.slice(5)).flags.heroTraits)
            .split(",")
            .includes(trait)
        : (
            cards.get(allInPlay(s).find((p) => p.id === id)?.code || "")
              ?.traits || ""
          )
            .split(/\.\s+|\.$/)
            .includes(trait),
    characterAttack: (s, id) => {
      if (id.startsWith("hero:"))
        return seatView(s, id.slice(5)).player.form === "hero" ? 2 : 0;
      const p = character(s, id) as Piece;
      return (
        Number(cards.get(p.code)?.attack || 0) +
        Number(p.bonusAtk || 0) +
        warMachinePackAllyModifiers(s, p, f.ports).attack
      );
    },
    exhaustCharacter: (s, id) => {
      const p = character(s, id);
      if (!p || p.exhausted) return false;
      p.exhausted = true;
      return true;
    },
    canReady: (s, id) => !s.flags["cannotReady:" + id],
    canDiscardAlly: (s, p) => !s.flags["cannotDiscard:" + p.id],
    canPutAlly: (s, p) => !s.flags["cannotPut:" + p.id],
    canPutUpgrade: (s, p) => !s.flags["cannotPut:" + p.id],
    cardCost: (s, p) =>
      Math.max(
        0,
        Number(cards.get(p.code)?.cost || 0) - Number(s.flags.discount || 0),
      ),
    canPayKeepingHandAlly: (s, event, ally) => {
      const resources = s.player.hand
        .filter((p) => p.id !== event.id && p.id !== ally.id)
        .reduce((n, p) => {
          const c = cards.get(p.code)!;
          return (
            n +
            Number(c.resource_energy || 0) +
            Number(c.resource_mental || 0) +
            Number(c.resource_physical || 0) +
            Number(c.resource_wild || 0)
          );
        }, 0);
      return resources >= f.ports.cardCost(s, event);
    },
    canPay: (s) => !s.flags.cannotPay,
    enemyTargets: (s, attack) => [
      ...(!attack ||
      !s.minions.some((p) => printedKeyword(cards.get(p.code)!, "Guard"))
        ? [{ id: s.villain.id, label: "Rhino", code: s.villain.code }]
        : []),
      ...s.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (s, thwart) => [
      ...(!s.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis) &&
      s.scheme.threat > 0 &&
      (!thwart ||
        !s.minions.some((p) => printedKeyword(cards.get(p.code)!, "Patrol")))
        ? [{ id: "main", label: "Main scheme" }]
        : []),
      ...s.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    discardPiece: (s, id) => {
      for (const seat of s.players) {
        const v = seatView(s, seat),
          i = v.player.inPlay.findIndex((p) => p.id === id);
        if (i < 0) continue;
        const [p] = v.player.inPlay.splice(i, 1);
        warMachinePackCardLeftPlay(s, p);
        const owner = seatView(s, p.ownerId || seat.id).player;
        owner.discard.push(p, ...(p.storedCards || []));
        p.storedCards = [];
        f.history.push("discard:" + p.code);
        return;
      }
      throw Error("Missing actual in-play card " + id);
    },
    putAllyFromHand: (s, id, after) => {
      const i = s.player.hand.findIndex((p) => p.id === id);
      expect(i).toBeGreaterThanOrEqual(0);
      const [p] = s.player.hand.splice(i, 1);
      s.player.inPlay.push(p);
      warMachinePackCardEntered(s, p);
      f.history.push("ally-entry:" + p.code);
      f.ports.queue(s, ...(warMachinePackAllyEnter(s, p) || []), ...after);
    },
    putUpgradeFromDeck: (s, id, after) => {
      const i = s.player.deck.findIndex((p) => p.id === id);
      const [p] = s.player.deck.splice(i, 1);
      expect(p).toBeTruthy();
      s.player.inPlay.push(p);
      warMachinePackCardEntered(s, p);
      f.history.push("put-upgrade:" + p.code);
      f.ports.queue(s, ...after);
    },
    discardPlayerCards: (s, count, continuation) => {
      const discarded = s.player.deck.splice(0, count);
      f.discardedBatches.push(discarded.map((p) => p.id));
      s.player.discard.push(...discarded);
      const emptied = !s.player.deck.length;
      if (emptied) {
        s.player.deck.push(...s.player.discard.splice(0));
        f.history.push("deck-reset");
      }
      f.ports.queue(s, { ...continuation, discarded });
    },
    shufflePlayerDeck: (s, after) => {
      f.history.push("shuffle");
      f.ports.queue(s, ...after);
    },
    revealHidden: () => f.history.push("preview"),
    attackProgram: (s, effects, after) => {
      f.history.push("attack-program");
      f.ports.queue(
        s,
        ...(!consumeStatus(s.player, "stunned") ? effects : []),
        ...after,
      );
    },
    preventAttackDamage: (_s, packet, amount) => {
      f.history.push("prevent:" + amount);
      packet.prevented = amount;
    },
  };
  const execute = (e: Effect) => {
    if (resolveWarMachinePackEffect(f.s, e, f.ports)) return;
    switch (e.type) {
      case "optional":
        f.ports.choose(f.s, e.title, e.text, [
          { id: "yes", label: "Yes", effects: e.effects },
          { id: "no", label: "No", effects: [] },
        ]);
        break;
      case "fixture:event":
        f.receipts.push(e);
        if (e.piece.code === "23032" && consumeStatus(f.s.player, "stunned"))
          break;
        f.ports.queue(
          f.s,
          ...(warMachinePackEvent(f.s, e.piece, e.warMachinePackReceipt) || []),
        );
        break;
      case "payRequest":
        f.payRequests.push(e);
        f.ports.queue(f.s, ...e.after);
        break;
      case "resolveHandEvent": {
        const i = f.s.player.hand.findIndex((p) => p.id === e.id);
        expect(i).toBeGreaterThanOrEqual(0);
        const [p] = f.s.player.hand.splice(i, 1);
        f.s.resolving.push(p);
        f.history.push("play:" + p.code);
        f.ports.queue(
          f.s,
          ...(e.after || []),
          { type: "fixture:finish", id: p.id },
          ...(e.continuation || []),
        );
        break;
      }
      case "fixture:finish": {
        const i = f.s.resolving.findIndex((p) => p.id === e.id);
        f.s.player.discard.push(...f.s.resolving.splice(i, 1));
        f.history.push("finish");
        break;
      }
      case "damage": {
        f.packets.push(e);
        const p =
          e.target === f.s.villain.id
            ? f.s.villain
            : f.s.minions.find((p) => p.id === e.target);
        if (p && !consumeTough(p)) {
          if (p === f.s.villain) f.s.villain.hp -= e.amount;
          else {
            p.damage += e.amount;
            if (p.damage >= Number(cards.get(p.code)?.health || 0))
              f.s.minions = f.s.minions.filter((m) => m.id !== p.id);
          }
        }
        break;
      }
      case "thwart":
        f.packets.push(e);
        if (e.target === "main")
          f.s.scheme.threat = Math.max(0, f.s.scheme.threat - e.amount);
        else {
          const p = f.s.sideSchemes.find((p) => p.id === e.target);
          if (p) p.counters = Math.max(0, p.counters - e.amount);
        }
        break;
      case "status": {
        const p =
          e.target === f.s.villain.id
            ? f.s.villain
            : f.s.minions.find((p) => p.id === e.target);
        if (p) p[e.status as "stunned"] = true;
        break;
      }
      case "ready": {
        const p = character(f.s, e.target);
        if (p) p.exhausted = false;
        f.history.push("ready:" + e.target);
        break;
      }
      case "heal": {
        const p = character(f.s, e.target) as Piece;
        if (p) p.damage = Math.max(0, p.damage - e.amount);
        break;
      }
      case "fixture:resume":
        f.history.push("resume");
        break;
      default:
        throw Error("Unknown fixture effect " + e.type);
    }
  };
  const pump = () => {
    for (let i = 0; !f.s.prompt && f.s.queue.length && i < 200; i++)
      execute(f.s.queue.shift()!);
  };
  const run = (...effects: Effect[]) => {
    f.ports.queue(f.s, ...effects);
    pump();
  };
  const choose = (id: string) => {
    f.s = reload(f.s);
    const option = f.s.prompt!.options.find((o) => o.id === id);
    expect(option, JSON.stringify(f.s.prompt)).toBeTruthy();
    f.s.prompt = null;
    run(...option!.effects);
  };
  const event = (p: Piece) =>
    run(
      ...(warMachinePackBeforeEvent(f.s, p, [
        { type: "fixture:event", piece: p },
      ]) || [{ type: "fixture:event", piece: p }]),
    );
  return Object.assign(f, { run, choose, event, pump });
}

describe("War Machine supplementary catalog and reprints", () => {
  it("accounts for exactly 20 original physical faces: 15 native and five Core aliases", () => {
    const codes = [
      ...WAR_MACHINE_PACK_SCRIPT_CODES,
      ...WAR_MACHINE_PACK_CORE_ALIASES,
    ];
    expect(new Set(codes).size).toBe(20);
    expect(codes.every((code) => cards.get(code)?.pack_code === "warm")).toBe(
      true,
    );
    expect(
      WAR_MACHINE_PACK_CORE_ALIASES.map((code) => rulesCode(code)),
    ).toEqual(["01071", "01083", "01088", "01089", "01090"]);
    expect(
      WAR_MACHINE_PACK_SCRIPT_CODES.every((code) => rulesCode(code) === code),
    ).toBe(true);
  });
  it("keeps the four other-pack reprints executable under their actual source codes", () => {
    expect(WAR_MACHINE_PACK_SCRIPT_CODES).toEqual(
      expect.arrayContaining(["23014", "23015", "23021", "23023"]),
    );
    expect(
      ["23014", "23015", "23021", "23023"].map((code) => cards.get(code)?.name),
    ).toEqual(["Falcon", "Goliath", "Innovation", "Quincarrier"]);
  });
  it("preserves printed Uses, costs, Alliance and nonattack/nonthwart labels", () => {
    expect(cards.get("23016")?.text).toContain("3 command counters");
    expect(cards.get("23033")?.text).toContain("2 training counters");
    expect(cards.get("23034")?.cost).toBe(4);
    expect(cards.get("23032")?.text).toContain("Alliance");
    expect(cards.get("23018")?.text).not.toContain("(thwart)");
    expect(cards.get("23019")?.text).not.toContain("(attack)");
    expect(cards.get("23034")?.text).not.toContain("(defense)");
  });
});

describe("physical Black Panther and Sneak Attack", () => {
  it("attaches only an actual discarded Leadership event and exposes it for play only", () => {
    const f = fixture(),
      bp = f.piece("23012"),
      event = f.piece("23017"),
      other = f.piece("23032");
    f.s.player.inPlay.push(bp);
    f.s.player.discard.push(event, other);
    f.run(...warMachinePackAllyEnter(f.s, bp)!);
    f.choose("yes");
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([event.id]);
    f.choose(event.id);
    expect(warMachinePackStoredPlayable(f.s).map((p) => p.id)).toEqual([
      event.id,
    ]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([other.id]);
    expect(f.s.player.hand).toHaveLength(0);
    expect(warMachinePackTakeStoredForPlay(f.s, event.id)?.id).toBe(event.id);
    expect(warMachinePackStoredPlayable(f.s)).toEqual([]);
  });
  it("does not expose or remove stored events while Panther is blank", () => {
    const f = fixture(),
      bp = f.piece("23012"),
      event = f.piece("23017");
    bp.storedCards = [event];
    f.s.player.inPlay.push(bp);
    f.s.flags["blank:" + bp.id] = true;
    expect(warMachinePackStoredPlayable(f.s, f.ports)).toEqual([]);
    expect(
      warMachinePackTakeStoredForPlay(f.s, event.id, f.ports),
    ).toBeUndefined();
    expect(bp.storedCards[0].id).toBe(event.id);
  });
  it("does not offer Panther without a discarded Leadership event", () => {
    const f = fixture(),
      bp = f.piece("23012");
    f.s.player.discard.push(f.piece("23032"));
    expect(warMachinePackAllyEnter(f.s, bp)).toEqual([]);
  });
  it("uses the current identity traits in either form and commits an actual hand ally choice", () => {
    const f = fixture(),
      sneak = f.piece("23017"),
      avenger = f.piece("23012"),
      shield = f.piece("23022");
    f.s.player.hand.push(sneak, avenger, shield);
    f.s.player.form = "alter";
    f.s.flags.heroTraits = "S.H.I.E.L.D,Soldier";
    f.event(sneak);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([shield.id]);
    f.choose(shield.id);
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual([shield.id]);
    expect(f.receipts[0].warMachinePackReceipt).toEqual({ allyId: shield.id });
  });
  it("rejects hand allies that share no identity trait or cannot enter", () => {
    const f = fixture(),
      sneak = f.piece("23017"),
      shield = f.piece("23022");
    f.s.player.hand.push(sneak, shield);
    expect(warMachinePackPlayRestriction(f.s, sneak, f.ports)).toContain(
      "sharing",
    );
    f.s.flags.heroTraits = "S.H.I.E.L.D";
    f.s.flags["cannotPut:" + shield.id] = true;
    expect(warMachinePackPlayRestriction(f.s, sneak, f.ports)).toContain(
      "sharing",
    );
  });
  it("cannot pay Sneak Attack with its sole eligible hand ally", () => {
    const f = fixture(),
      sneak = f.piece("23017"),
      ally = f.piece("23012");
    f.s.player.hand.push(sneak, ally);
    expect(
      warMachinePackSneakAllies(f.s, f.ports).map((p) => [p.id, p.code]),
    ).toEqual([[ally.id, "23012"]]);
    expect(warMachinePackPlayRestriction(f.s, sneak, f.ports)).toContain(
      "retain",
    );
    expect(warMachinePackPaymentAllowed(f.s, sneak, [ally.id], f.ports)).toBe(
      false,
    );
    expect(f.s.player.hand.map((p) => p.id)).toEqual([sneak.id, ally.id]);
  });
  it("a zero-cost discounted Sneak Attack can retain that same sole ally", () => {
    const f = fixture(),
      sneak = f.piece("23017"),
      ally = f.piece("23012");
    f.s.player.hand.push(sneak, ally);
    f.s.flags.discount = 1;
    expect(warMachinePackPlayRestriction(f.s, sneak, f.ports)).toBeNull();
    expect(warMachinePackPaymentAllowed(f.s, sneak, [], f.ports)).toBe(true);
  });
  it("may spend one eligible ally when a different actual eligible ally remains", () => {
    const f = fixture(),
      sneak = f.piece("23017"),
      first = f.piece("23012"),
      second = f.piece("23013");
    f.s.player.hand.push(sneak, first, second);
    expect(warMachinePackPlayRestriction(f.s, sneak, f.ports)).toBeNull();
    expect(warMachinePackPaymentAllowed(f.s, sneak, [first.id], f.ports)).toBe(
      true,
    );
    expect(
      warMachinePackPaymentAllowed(f.s, sneak, [first.id, second.id], f.ports),
    ).toBe(false);
    f.s.flags["cannotPut:" + second.id] = true;
    expect(warMachinePackPaymentAllowed(f.s, sneak, [first.id], f.ports)).toBe(
      false,
    );
  });
  it("resolves Panther entry before Sneak Attack's second clause and event discard", () => {
    const f = fixture(),
      sneak = f.piece("23017"),
      bp = f.piece("23012"),
      previous = f.piece("23019");
    f.s.player.hand.push(bp);
    f.s.player.discard.push(previous);
    f.s.resolving.push(sneak);
    f.run(...warMachinePackEvent(f.s, sneak, { allyId: bp.id })!);
    f.choose("yes");
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([previous.id]);
    expect(f.s.resolving[0].id).toBe(sneak.id);
    expect(f.s.flags["warMachinePackSneak:" + bp.id]).toBeUndefined();
    f.choose(previous.id);
    expect(f.s.flags["warMachinePackSneak:" + bp.id]).toBe("1:player");
    expect(f.s.player.inPlay[0].storedCards![0].id).toBe(previous.id);
  });
  it("discards the same ally at phase end including control transfer to a teammate", () => {
    const f = fixture(true),
      bp = f.piece("23012");
    f.s.player.inPlay.push(bp);
    f.run(P("sneak-delay", { id: bp.id }));
    f.s.player.inPlay.splice(0, 1);
    seatView(f.s, "p2").player.inPlay.push(bp);
    warMachinePackPhaseEnded(f.s, f.ports);
    expect(seatView(f.s, "p2").player.inPlay).toEqual([]);
    expect(f.s.player.discard[0].id).toBe(bp.id);
    expect(f.s.flags["warMachinePackSneak:" + bp.id]).toBeUndefined();
  });
  it("does not discard a new entry of the same physical ally after it left play", () => {
    const f = fixture(),
      bp = f.piece("23012");
    f.s.player.inPlay.push(bp);
    f.run(P("sneak-delay", { id: bp.id }));
    f.ports.discardPiece(f.s, bp.id);
    const actual = f.s.player.discard.pop()!;
    f.s.player.inPlay.push(actual);
    warMachinePackPhaseEnded(f.s, f.ports);
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual([bp.id]);
  });
  it("returns the actual stored event to its owner when Panther leaves", () => {
    const f = fixture(),
      bp = f.piece("23012"),
      event = f.piece("23017");
    bp.storedCards = [event];
    f.s.player.inPlay.push(bp);
    f.ports.discardPiece(f.s, bp.id);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([bp.id, event.id]);
    expect(bp.storedCards).toEqual([]);
  });
});

describe("Captain Marvel and Falcon original physical deck windows", () => {
  it("does not offer empty-deck or blank source responses", () => {
    const f = fixture(),
      cm = f.piece("23013"),
      falcon = f.piece("23014");
    expect(warMachinePackAllyEnter(f.s, cm, f.ports)).toEqual([]);
    expect(warMachinePackAllyEnter(f.s, falcon, f.ports)).toEqual([]);
    f.s.player.deck.push(f.piece("23025"));
    f.s.flags["blank:" + cm.id] = true;
    expect(warMachinePackAllyEnter(f.s, cm, f.ports)).toEqual([]);
  });
  it("counts printed energy icons, so one double-Energy card enables damage and stun", () => {
    const f = fixture(),
      cm = f.piece("23013");
    f.s.player.inPlay.push(cm);
    f.s.player.deck.push(
      f.piece("23025"),
      f.piece("23026"),
      f.piece("23027"),
      f.piece("23019"),
      f.piece("23035"),
    );
    const original = f.s.player.deck.slice(0, 4).map((p) => p.id);
    f.run(...warMachinePackAllyEnter(f.s, cm)!);
    f.choose("yes");
    f.choose(f.s.villain.id);
    expect(f.discardedBatches).toEqual([original]);
    expect(f.s.villain.hp).toBe(47);
    expect(f.s.villain.stunned).toBe(true);
    expect(f.packets[0]).toMatchObject({ amount: 3, attack: false });
    expect(f.packets[0].source).toBe(cm.id);
  });
  it("one energy icon deals damage without stun", () => {
    const f = fixture(),
      cm = f.piece("23013");
    f.s.player.inPlay.push(cm);
    f.s.player.deck.push(f.piece("01060"));
    expect(cards.get("01060")?.resource_energy).toBe(1);
    f.run(...warMachinePackAllyEnter(f.s, cm)!);
    f.choose("yes");
    f.choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(47);
    expect(f.s.villain.stunned).toBe(false);
  });
  it("counts wild as no printed energy and finishes without a target window", () => {
    const f = fixture();
    f.s.player.deck.push(f.piece("23021"), f.piece("23026"));
    f.run(P("captain-marvel"));
    expect(f.s.prompt).toBeNull();
    expect(f.packets).toEqual([]);
  });
  it("stops at actual deck exhaustion and resumes from the captured pre-reset batch", () => {
    const f = fixture(),
      original = f.piece("23025"),
      recycled = f.piece("23025");
    f.s.player.deck.push(original);
    f.s.player.discard.push(recycled);
    f.run(P("captain-marvel", { after: [{ type: "fixture:resume" }] }));
    expect(f.discardedBatches).toEqual([[original.id]]);
    expect(f.history).toContain("deck-reset");
    f.choose(f.s.villain.id);
    expect(f.s.player.deck.map((p) => p.id)).toEqual([
      recycled.id,
      original.id,
    ]);
    expect(f.history.at(-1)).toBe("resume");
  });
  it("does not stun a defeated enemy or a replacement stage with a different face", () => {
    const f = fixture(),
      minion = f.piece("01101");
    minion.damage = 1;
    f.s.minions.push(minion);
    f.run(
      P("captain-marvel-damage", {
        target: minion.id,
        targetCode: minion.code,
        stun: true,
      }),
    );
    expect(f.s.minions).toHaveLength(0);
    expect(f.s.queue).toHaveLength(0);
    f.run(
      P("captain-marvel-stun", {
        target: f.s.villain.id,
        targetCode: "wrong-stage",
      }),
    );
    expect(f.s.villain.stunned).toBe(false);
  });
  it("deals nonattack damage through Guard without consuming hero Stun", () => {
    const f = fixture();
    f.s.player.stunned = true;
    f.s.minions.push(f.piece("01101"));
    f.s.player.deck.push(f.piece("23025"));
    f.run(P("captain-marvel"));
    f.choose(f.s.villain.id);
    expect(f.s.player.stunned).toBe(true);
    expect(f.s.villain.hp).toBe(47);
  });
  it("Falcon preserves encounter order and removes one threat per treachery from chosen schemes", () => {
    const f = fixture(),
      side = f.piece("01109");
    side.counters = 4;
    f.s.sideSchemes.push(side);
    const top = [
      f.piece("01104"),
      f.piece("01101"),
      f.piece("01104"),
      f.piece("01101"),
    ];
    f.s.encounter.deck.push(...top);
    f.run(P("falcon"));
    f.choose("continue");
    f.choose("main");
    f.choose(side.id);
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual(top.map((p) => p.id));
    expect(
      f.packets
        .filter((e) => e.type === "thwart")
        .map((e) => [e.target, e.amount, e.action]),
    ).toEqual([
      ["main", 1, false],
      [side.id, 1, false],
    ]);
    expect(f.s.scheme.threat).toBe(9);
    expect(f.s.sideSchemes[0].counters).toBe(3);
  });
  it("Falcon's nonthwart removals preserve Confuse while obeying Crisis", () => {
    const f = fixture(),
      crisis = f.piece("01108");
    crisis.counters = 5;
    f.s.sideSchemes.push(crisis);
    f.s.player.confused = true;
    f.s.encounter.deck.push(f.piece("01104"));
    f.run(P("falcon"));
    f.choose("continue");
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([crisis.id]);
    f.choose(crisis.id);
    expect(f.s.player.confused).toBe(true);
    expect(f.s.scheme.threat).toBe(10);
  });
});

describe("supplementary physical supports, resources and attachments", () => {
  it("does not play Sidearm with no ally or when every physical ally already has one", () => {
    const f = fixture(),
      card = f.piece("23035"),
      ally = f.piece("23012"),
      attached = f.piece("23035");
    expect(warMachinePackPlayRestriction(f.s, card, f.ports)).toContain(
      "without a Sidearm",
    );
    attached.attachedTo = ally.id;
    f.s.player.inPlay.push(ally, attached);
    expect(warMachinePackPlayRestriction(f.s, card, f.ports)).toContain(
      "without a Sidearm",
    );
    f.s.flags["blank:" + attached.id] = true;
    expect(warMachinePackPlayRestriction(f.s, card, f.ports)).toContain(
      "without a Sidearm",
    );
  });
  it("Command Team initializes three Uses and can ready a teammate's ally", () => {
    const f = fixture(true),
      command = f.piece("23016"),
      ally = f.piece("23012", "p2");
    ally.exhausted = true;
    f.s.player.inPlay.push(command);
    seatView(f.s, "p2").player.inPlay.push(ally);
    warMachinePackCardEntered(f.s, command);
    expect(command.counters).toBe(3);
    expect(warMachinePackAbility(f.s, command.id, f.ports)).toBe(true);
    f.pump();
    f.choose(ally.id);
    expect(f.s.player.inPlay[0].counters).toBe(2);
    expect(f.s.player.inPlay[0].exhausted).toBe(true);
    expect(seatView(f.s, "p2").player.inPlay[0].exhausted).toBe(false);
  });
  it("Command Team's last counter discards the physical support before the ready", () => {
    const f = fixture(),
      command = f.piece("23016"),
      ally = f.piece("23012");
    command.counters = 1;
    ally.exhausted = true;
    f.s.player.inPlay.push(command, ally);
    f.run(P("command-ready", { id: command.id, target: ally.id }));
    expect(f.history).toEqual(["discard:23016", "ready:" + ally.id]);
    expect(f.s.player.discard[0].id).toBe(command.id);
  });
  it("does not spend Command Team on ready or cannot-ready allies, or while blank", () => {
    const f = fixture(),
      command = f.piece("23016"),
      ally = f.piece("23012");
    command.counters = 3;
    f.s.player.inPlay.push(command, ally);
    expect(warMachinePackAbilityOptions(f.s, command.id, f.ports)).toEqual([]);
    ally.exhausted = true;
    f.s.flags["cannotReady:" + ally.id] = true;
    expect(warMachinePackAbilityOptions(f.s, command.id, f.ports)).toEqual([]);
    delete f.s.flags["cannotReady:" + ally.id];
    f.s.flags["blank:" + command.id] = true;
    expect(warMachinePackAbilityOptions(f.s, command.id, f.ports)).toEqual([]);
  });
  it("Vigilante Training returns a chosen actual Justice event and spends its last counter first", () => {
    const f = fixture(),
      training = f.piece("23033"),
      event = f.piece("01060"),
      other = f.piece("23017");
    warMachinePackCardEntered(f.s, training);
    expect(training.counters).toBe(2);
    training.counters = 1;
    f.s.player.form = "alter";
    f.s.player.inPlay.push(training);
    f.s.player.discard.push(event, other);
    warMachinePackAbility(f.s, training.id, f.ports);
    f.pump();
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([event.id]);
    f.choose(event.id);
    expect(f.s.player.deck[0].id).toBe(event.id);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([
      other.id,
      training.id,
    ]);
    expect(f.history).toEqual(["discard:23033", "shuffle"]);
  });
  it("Vigilante Training cannot activate in hero form or without a Justice event", () => {
    const f = fixture(),
      training = f.piece("23033");
    training.counters = 2;
    f.s.player.inPlay.push(training);
    f.s.player.discard.push(f.piece("01060"));
    expect(warMachinePackAbilityOptions(f.s, training.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    f.s.player.discard = [];
    expect(warMachinePackAbilityOptions(f.s, training.id, f.ports)).toEqual([]);
  });
  it("Goliath shares the once-per-phase maximum across copies and owners", () => {
    const f = fixture(true),
      a = f.piece("23015"),
      b = f.piece("23015", "p2");
    f.s.player.inPlay.push(a);
    seatView(f.s, "p2").player.inPlay.push(b);
    f.run(P("goliath", { id: a.id }));
    expect(a.bonusAtk).toBe(4);
    expect(
      warMachinePackAbilityOptions(seatView(f.s, "p2"), b.id, f.ports),
    ).toEqual([]);
    warMachinePackPhaseEnded(f.s, f.ports);
    expect(f.s.player.inPlay).toEqual([]);
    expect(seatView(f.s, "p2").player.inPlay[0].id).toBe(b.id);
  });
  it("honors an earlier Goliath activation from the Hawkeye printing", () => {
    const f = fixture(true),
      p = f.piece("23015");
    f.s.player.inPlay.push(p);
    seatView(f.s, "p2").flags.hawkeyeGoliathPhase = "1:player";
    expect(warMachinePackAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
  });
  it("Goliath can activate exhausted, and a later phase releases the global maximum", () => {
    const f = fixture(),
      p = f.piece("23015");
    p.exhausted = true;
    f.s.player.inPlay.push(p);
    expect(warMachinePackAbilityOptions(f.s, p.id, f.ports)).toHaveLength(1);
    f.s.flags.hawkeyeGoliathPhase = "1:player";
    f.s.phase = "villain";
    expect(warMachinePackAbilityOptions(f.s, p.id, f.ports)).toHaveLength(1);
  });
  it("Innovation responds to actual spending in hero form and heals only a controlled ally", () => {
    const f = fixture(true),
      mine = f.piece("23012"),
      other = f.piece("23013", "p2");
    mine.damage = other.damage = 2;
    f.s.player.inPlay.push(mine);
    seatView(f.s, "p2").player.inPlay.push(other);
    f.run(...warMachinePackResourcesSpent(f.s, [f.piece("23021")]));
    f.choose("yes");
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([mine.id]);
    f.choose(mine.id);
    expect(f.s.player.inPlay[0].damage).toBe(1);
    expect(seatView(f.s, "p2").player.inPlay[0].damage).toBe(2);
  });
  it("Innovation has no reaction in alter ego or without any damaged controlled ally", () => {
    const f = fixture(),
      p = f.piece("23021");
    expect(warMachinePackResourcesSpent(f.s, [p])).toEqual([]);
    const ally = f.piece("23012");
    ally.damage = 1;
    f.s.player.inPlay.push(ally);
    f.s.player.form = "alter";
    expect(warMachinePackResourcesSpent(f.s, [p])).toEqual([]);
  });
  it("Quincarrier requires the actual current Avenger trait to play, then works in both forms", () => {
    const f = fixture(),
      p = f.piece("23023");
    expect(warMachinePackPlayRestriction(f.s, p, f.ports)).toBeNull();
    f.s.player.form = "alter";
    f.s.flags.heroTraits = "S.H.I.E.L.D";
    expect(warMachinePackPlayRestriction(f.s, p, f.ports)).toContain("Avenger");
    f.s.player.inPlay.push(p);
    expect(warMachinePackResourceSources(f.s, f.ports)[0].resources).toEqual([
      "wild",
    ]);
    expect(warMachinePackResourceSpent(f.s, p.id, f.ports)).toBe(true);
    expect(warMachinePackResourceSources(f.s, f.ports)).toEqual([]);
  });
  it("blank Quincarrier neither supplies nor spends its resource", () => {
    const f = fixture(),
      p = f.piece("23023");
    f.s.player.inPlay.push(p);
    f.s.flags["blank:" + p.id] = true;
    expect(warMachinePackResourceSources(f.s, f.ports)).toEqual([]);
    expect(() => warMachinePackResourceSpent(f.s, p.id, f.ports)).toThrow(
      "unavailable",
    );
    expect(p.exhausted).toBe(false);
  });
  it("Sidearm can attach to any player's ally, grants ATK and Ranged, and enforces max one", () => {
    const f = fixture(true),
      mine = f.piece("23012"),
      other = f.piece("23013", "p2"),
      sidearm = f.piece("23035");
    f.s.player.inPlay.push(mine);
    seatView(f.s, "p2").player.inPlay.push(other);
    expect(
      warMachinePackAttachmentTargets(f.s, sidearm)!.map((t) => t.id),
    ).toEqual([mine.id, other.id]);
    sidearm.attachedTo = other.id;
    f.s.player.inPlay.push(sidearm);
    expect(warMachinePackAllyModifiers(f.s, other, f.ports)).toEqual({
      attack: 1,
      ranged: true,
    });
    f.s.flags["blank:" + sidearm.id] = true;
    expect(warMachinePackAllyModifiers(f.s, other, f.ports)).toEqual({
      attack: 0,
      ranged: false,
    });
    expect(
      warMachinePackAttachmentTargets(f.s, f.piece("23035"))!.map((t) => t.id),
    ).toEqual([mine.id]);
  });
});

describe("actual ally costs, Alliance and Team-Up", () => {
  it.each(["23018", "23019"])(
    "pays %s by discarding a controlled actual ally and records printed cost",
    (code) => {
      const f = fixture(),
        ally = f.piece("23013");
      ally.bonusAtk = 20;
      f.s.player.inPlay.push(ally);
      f.event(f.piece(code));
      f.choose(ally.id);
      expect(f.s.player.discard[0].id).toBe(ally.id);
      expect(f.receipts[0].warMachinePackReceipt.amount).toBe(5);
      f.choose(code === "23018" ? "main" : f.s.villain.id);
      expect(f.packets[0].amount).toBe(5);
    },
  );
  it("Save the Day is a nonthwart effect and preserves Confuse", () => {
    const f = fixture(),
      ally = f.piece("23012");
    f.s.player.inPlay.push(ally);
    f.s.player.confused = true;
    f.event(f.piece("23018"));
    f.choose(ally.id);
    f.choose("main");
    expect(f.s.player.confused).toBe(true);
    expect(f.s.scheme.threat).toBe(6);
    expect(f.packets[0].action).toBe(false);
  });
  it("Go Down Swinging is nonattack damage through Guard and preserves Stun", () => {
    const f = fixture(),
      ally = f.piece("23012");
    f.s.player.inPlay.push(ally);
    f.s.player.stunned = true;
    f.s.minions.push(f.piece("01101"));
    f.event(f.piece("23019"));
    f.choose(ally.id);
    f.choose(f.s.villain.id);
    expect(f.s.player.stunned).toBe(true);
    expect(f.s.villain.hp).toBe(46);
    expect(f.packets[0].attack).toBe(false);
  });
  it("does not select other players' allies or protected discard costs", () => {
    const f = fixture(true),
      ally = f.piece("23012", "p2");
    seatView(f.s, "p2").player.inPlay.push(ally);
    expect(
      warMachinePackPlayRestriction(f.s, f.piece("23018"), f.ports),
    ).toContain("discardable");
    f.s.player.inPlay.push(f.piece("23013"));
    f.s.flags["cannotDiscard:" + f.s.player.inPlay[0].id] = true;
    expect(
      warMachinePackPlayRestriction(f.s, f.piece("23019"), f.ports),
    ).toContain("discardable");
  });
  it("As One exhausts contributors from different owners and makes one actual Overkill attack", () => {
    const f = fixture(true),
      avenger = f.piece("23012"),
      guardian = f.piece("19020", "p2");
    f.s.player.inPlay.push(avenger);
    seatView(f.s, "p2").player.inPlay.push(guardian);
    avenger.bonusAtk = 3;
    const sidearm = f.piece("23035");
    sidearm.attachedTo = avenger.id;
    f.s.player.inPlay.push(sidearm);
    expect(cards.get(guardian.code)?.traits).toContain("Guardian");
    f.event(f.piece("23032"));
    f.choose(avenger.id + "|" + guardian.id);
    f.choose(f.s.villain.id);
    expect(f.s.player.inPlay.find((p) => p.id === avenger.id)!.exhausted).toBe(
      true,
    );
    expect(seatView(f.s, "p2").player.inPlay[0].exhausted).toBe(true);
    expect(f.packets).toHaveLength(1);
    expect(f.packets[0]).toMatchObject({
      amount: 8,
      attack: true,
      overkill: true,
    });
  });
  it("As One costs remain paid when hero Stun replaces the attack", () => {
    const f = fixture(true);
    f.s.player.stunned = true;
    f.event(f.piece("23032"));
    f.choose("hero:p1|hero:p2");
    expect(f.s.player.exhausted).toBe(true);
    expect(seatView(f.s, "p2").player.exhausted).toBe(true);
    expect(f.s.player.stunned).toBe(false);
    expect(f.packets).toEqual([]);
  });
  it("Alliance may exhaust a qualifying alter ego character; its unprinted ATK is zero", () => {
    const f = fixture(true);
    seatView(f.s, "p2").player.form = "alter";
    f.event(f.piece("23032"));
    f.choose("hero:p1|hero:p2");
    f.choose(f.s.villain.id);
    expect(f.packets[0].amount).toBe(2);
    expect(seatView(f.s, "p2").player.exhausted).toBe(true);
  });
  it("one dual-trait physical character cannot pay both exhaustion costs", () => {
    const f = fixture();
    f.s.flags.heroTraits = "Avenger,Guardian";
    expect(
      warMachinePackPlayRestriction(f.s, f.piece("23032"), f.ports),
    ).toContain("two distinct");
  });
  it("As One obeys Guard while nonattack effects do not", () => {
    const f = fixture(true),
      guard = f.piece("01101");
    f.s.minions.push(guard);
    f.event(f.piece("23032"));
    f.choose("hero:p1|hero:p2");
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([guard.id]);
  });
  it("Two Against the World requires current names, not alter ego names", () => {
    const f = fixture(),
      event = f.piece("23024"),
      iron = f.piece("23002");
    f.s.player.inPlay.push(iron);
    expect(warMachinePackPlayRestriction(f.s, event, f.ports)).toBeNull();
    f.s.flags.heroName = "James Rhodes";
    expect(warMachinePackPlayRestriction(f.s, event, f.ports)).toContain(
      "requires Iron Man",
    );
  });
  it("puts an actual searched Tech upgrade into play, shuffles, then readies both named characters", () => {
    const f = fixture(),
      iron = f.piece("23002"),
      tech = f.piece("23005"),
      nontech = f.piece("23016");
    iron.exhausted = true;
    f.s.player.exhausted = true;
    f.s.player.inPlay.push(iron);
    f.s.player.deck.push(tech, nontech);
    f.run(...warMachinePackEvent(f.s, f.piece("23024"))!);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([tech.id]);
    f.choose(tech.id);
    expect(f.s.player.inPlay.some((p) => p.id === tech.id)).toBe(true);
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.inPlay.find((p) => p.id === iron.id)!.exhausted).toBe(
      false,
    );
    expect(f.history.indexOf("shuffle")).toBeLessThan(
      f.history.indexOf("ready:hero:p1"),
    );
    expect(f.history).not.toContain("play:23005");
  });
  it("still shuffles and readies when no Tech upgrade is available", () => {
    const f = fixture(),
      iron = f.piece("23002");
    iron.exhausted = true;
    f.s.player.exhausted = true;
    f.s.player.inPlay.push(iron);
    f.run(...warMachinePackEvent(f.s, f.piece("23024"))!);
    expect(f.history).toEqual([
      "preview",
      "shuffle",
      "ready:hero:p1",
      "ready:" + iron.id,
    ]);
  });
});

describe("Stand Together actual paid interrupt", () => {
  function packet(f: ReturnType<typeof fixture>) {
    return {
      type: "damage",
      target: "hero",
      attack: true,
      kind: "attack",
      amount: 7,
      attacker: f.s.villain.id,
    } as Effect;
  }
  it("uses the actual hand event lifecycle and Alliance resources before physical character costs", () => {
    const f = fixture(true),
      event = f.piece("23034");
    f.s.player.hand.push(event);
    const options = warMachinePackDamageOptions(
      f.s,
      packet(f),
      [{ type: "fixture:resume" }],
      f.ports,
    );
    f.run(...options[0].effects);
    expect(f.payRequests[0]).toMatchObject({
      cost: 4,
      piece: { id: event.id },
      alliance: true,
    });
    expect(f.s.player.hand).toEqual([]);
    expect(f.s.resolving[0].id).toBe(event.id);
    f.choose("hero:p1|hero:p2");
    expect(f.s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    expect(f.s.resolving).toEqual([]);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.history).toEqual(["play:23034", "prevent:7", "finish", "resume"]);
    expect(f.packets[0]).toMatchObject({
      amount: 7,
      target: f.s.villain.id,
      attack: false,
    });
  });
  it("pays its current native card cost, including an actual general discount", () => {
    const f = fixture(true),
      event = f.piece("23034");
    f.s.flags.discount = 1;
    f.s.player.hand.push(event);
    f.run(
      ...warMachinePackDamageOptions(f.s, packet(f), [], f.ports)[0].effects,
    );
    expect(f.payRequests[0].cost).toBe(3);
    f.choose("hero:p1|hero:p2");
    expect(f.s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
  });
  it("recognizes attack packets even when they have no incoming-attack kind marker", () => {
    const f = fixture(true);
    f.s.player.hand.push(f.piece("23034"));
    expect(
      warMachinePackDamageOptions(
        f.s,
        { ...packet(f), kind: undefined },
        [],
        f.ports,
      ),
    ).toHaveLength(1);
  });
  it("can protect a teammate's alter ego and does not claim a defense", () => {
    const f = fixture(true),
      event = f.piece("23034");
    f.s.player.hand.push(event);
    seatView(f.s, "p2").player.form = "alter";
    const options = warMachinePackDamageOptions(
      f.s,
      { ...packet(f), target: "hero:p2" },
      [],
      f.ports,
    );
    expect(options).toHaveLength(1);
    f.run(...options[0].effects);
    f.choose("hero:p1|hero:p2");
    expect(f.history).toContain("prevent:7");
    expect(f.s.attack?.defender).toBeUndefined();
  });
  it("reflects damage without an attack, preserving Stun and ignoring Guard", () => {
    const f = fixture(true);
    f.s.player.stunned = true;
    f.s.minions.push(f.piece("01101"));
    f.s.player.hand.push(f.piece("23034"));
    f.run(
      ...warMachinePackDamageOptions(f.s, packet(f), [], f.ports)[0].effects,
    );
    f.choose("hero:p1|hero:p2");
    expect(f.s.player.stunned).toBe(true);
    expect(f.s.villain.hp).toBe(43);
    expect(f.history).not.toContain("attack-program");
  });
  it("rejects nonattack damage, zero damage, enemy targets and insufficient actual costs", () => {
    const f = fixture(true);
    f.s.player.hand.push(f.piece("23034"));
    expect(
      warMachinePackDamageOptions(
        f.s,
        { ...packet(f), kind: "effect", attack: false },
        [],
        f.ports,
      ),
    ).toEqual([]);
    expect(
      warMachinePackDamageOptions(
        f.s,
        { ...packet(f), amount: 0 },
        [],
        f.ports,
      ),
    ).toEqual([]);
    expect(
      warMachinePackDamageOptions(
        f.s,
        { ...packet(f), target: f.s.villain.id },
        [],
        f.ports,
      ),
    ).toEqual([]);
    f.s.flags.cannotPay = true;
    expect(warMachinePackDamageOptions(f.s, packet(f), [], f.ports)).toEqual(
      [],
    );
  });
  it("rejects the interrupt in alter ego and with no distinct ready pair", () => {
    const f = fixture(true);
    f.s.player.hand.push(f.piece("23034"));
    f.s.player.form = "alter";
    expect(warMachinePackDamageOptions(f.s, packet(f), [], f.ports)).toEqual(
      [],
    );
    f.s.player.form = "hero";
    seatView(f.s, "p2").player.exhausted = true;
    expect(warMachinePackDamageOptions(f.s, packet(f), [], f.ports)).toEqual(
      [],
    );
  });
});
