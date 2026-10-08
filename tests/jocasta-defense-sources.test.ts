import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine.js";
import { card } from "../src/game/cards.js";
import { defenseEventSources, isTextBlank } from "../src/game/card-text.js";
import { activateSeat } from "../src/game/team.js";
import {
  captainShieldBlockOptions,
  resolveCaptainEffect,
  type CaptainEnginePorts,
} from "../src/game/captain-america.js";
import {
  captainPackExpertDefenseOptions,
  resolveCaptainPackEffect,
  type CaptainPackPorts,
} from "../src/game/captain-pack.js";
import {
  msMarvelDamageOptions,
  msMarvelBoostOptions,
  resolveMsMarvelEffect,
  type MsMarvelPorts,
} from "../src/game/ms-marvel.js";
import {
  doctorStrangeDefenseOptions,
  resolveDoctorStrangeEffect,
  type DoctorStrangePorts,
} from "../src/game/doctor-strange.js";
import {
  quicksilverPackDefenseOptions,
  quicksilverPackDamageOptions,
  resolveQuicksilverPackEffect,
  type QuicksilverPackPorts,
} from "../src/game/quicksilver-pack.js";
import {
  gmwPlayerPackDefenseOptions,
  resolveGmwPlayerPackEffect,
  type GmwPlayerPackPorts,
} from "../src/game/gmw-player-pack.js";
import {
  gamoraDamageOptions,
  resolveGamoraEffect,
  type GamoraPorts,
} from "../src/game/gamora.js";
import {
  draxDamageOptions,
  resolveDraxEffect,
  type DraxPorts,
} from "../src/game/drax.js";
import {
  venomAttackInitiatedOptions,
  type VenomPorts,
} from "../src/game/venom.js";
import {
  spectrumDefenseOptions,
  resolveSpectrumEffect,
  type SpectrumPorts,
} from "../src/game/spectrum.js";
import {
  mtsPlayerPackDamageOptions,
  resolveMtsPlayerPackEffect,
  type MtsPlayerPackPorts,
} from "../src/game/mts-player-pack.js";
import {
  valkyrieAttackInitiationOptions,
  resolveValkyrieEffect,
  type ValkyriePorts,
} from "../src/game/valkyrie.js";
import {
  valkyriePackDefenseOptions,
  resolveValkyriePackEffect,
  type ValkyriePackPorts,
} from "../src/game/valkyrie-pack.js";
import type {
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "../src/game/types.js";

type Ports = CaptainEnginePorts &
  CaptainPackPorts &
  MsMarvelPorts &
  DoctorStrangePorts &
  QuicksilverPackPorts &
  GmwPlayerPackPorts &
  GamoraPorts &
  DraxPorts &
  VenomPorts &
  SpectrumPorts &
  MtsPlayerPackPorts &
  ValkyriePorts &
  ValkyriePackPorts;
const packet = (s: GameState): Effect => ({
  type: "damage",
  target: "hero",
  amount: 3,
  attack: true,
  source: s.villain.id,
});
const window = (s: GameState) => ({
  target: "hero",
  amount: 3,
  source: s.villain.id,
  packet: packet(s),
});
interface Case {
  code: string;
  hero?: GameState["heroId"];
  options(s: GameState, ports: Ports): Option[];
  resolve?(s: GameState, e: Effect, ports: Ports): boolean;
}
const cases: Case[] = [
  {
    code: "03005",
    hero: "captain_america",
    options: (s) => captainShieldBlockOptions(s, []),
    resolve: resolveCaptainEffect,
  },
  {
    code: "03033",
    options: (s) => captainPackExpertDefenseOptions(s, []),
    resolve: resolveCaptainPackEffect,
  },
  {
    code: "05005",
    options: (s, p) => msMarvelDamageOptions(s, window(s), [], p),
    resolve: resolveMsMarvelEffect,
  },
  {
    code: "05014",
    options: (s, p) =>
      msMarvelBoostOptions(
        s,
        { ...s.villain, id: "actual-numeric-boost", code: "01102" },
        [],
        p,
      ),
    resolve: resolveMsMarvelEffect,
  },
  {
    code: "09015",
    options: (s, p) => doctorStrangeDefenseOptions(s, [], p),
    resolve: resolveDoctorStrangeEffect,
  },
  {
    code: "14014",
    options: (s, p) => quicksilverPackDefenseOptions(s, [], p),
    resolve: resolveQuicksilverPackEffect,
  },
  {
    code: "14015",
    options: (s, p) => quicksilverPackDamageOptions(s, window(s), [], p),
    resolve: resolveQuicksilverPackEffect,
  },
  {
    code: "16013",
    options: (s, p) => gmwPlayerPackDefenseOptions(s, [], p),
    resolve: resolveGmwPlayerPackEffect,
  },
  {
    code: "18004",
    options: (s, p) => gamoraDamageOptions(s, packet(s), 3, [], p),
    resolve: resolveGamoraEffect,
  },
  {
    code: "19006",
    options: (s, p) => draxDamageOptions(s, packet(s), 3, [], p),
    resolve: resolveDraxEffect,
  },
  {
    code: "20003",
    options: (s, p) =>
      venomAttackInitiatedOptions(
        s,
        { attacker: s.villain.id, playerId: s.activePlayerId, isVillain: true },
        [],
        p,
      ),
  },
  {
    code: "21009",
    hero: "spectrum",
    options: (s, p) => spectrumDefenseOptions(s, [], [], p),
    resolve: resolveSpectrumEffect,
  },
  {
    code: "21061",
    options: (s, p) => mtsPlayerPackDamageOptions(s, packet(s), 3, [], p),
    resolve: resolveMtsPlayerPackEffect,
  },
  {
    code: "25011",
    hero: "valk",
    options: (s, p) => valkyrieAttackInitiationOptions(s, s.villain.id, [], p),
    resolve: resolveValkyrieEffect,
  },
  {
    code: "25020",
    options: (s, p) => valkyriePackDefenseOptions(s, [], p),
    resolve: resolveValkyriePackEffect,
  },
];

function fixture(c: Case = cases[0]) {
  let s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "protection",
    seed: 26013,
    heroes: [
      { heroId: "spider_man", aspect: "protection" },
      { heroId: "captain_marvel", aspect: "leadership" },
    ],
  });
  s.heroId = s.players[0].heroId = c.hero || "spider_man";
  s.phase = "player";
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.sideSchemes = [];
  s.minions = [];
  for (const seat of s.players) {
    seat.player.form = "hero";
    seat.player.hand = [];
    seat.player.inPlay = [];
    seat.player.deck = Array.from({ length: 3 }, () => makePiece(s, "01088"));
    seat.player.discard = [];
  }
  const held = makePiece(s, c.code);
  held.ownerId = s.activePlayerId;
  const jocasta = makePiece(s, "26013");
  jocasta.ownerId = s.activePlayerId;
  jocasta.storedCards = [held];
  s.player.inPlay.push(jocasta, makePiece(s, "03009"), {
    ...makePiece(s, "25002"),
    attachedTo: s.villain.id,
  });
  s.player.hand.push(makePiece(s, "01088"));
  s.attack = {
    attacker: s.villain.id,
    base: 4,
    boostCodes: [],
    boostEffects: [],
    defense: 1,
    prevented: 0,
    damage: 0,
    overkill: false,
    isVillain: true,
    defender: "hero",
    targetPlayerId: s.activePlayerId,
    basicDefense: true,
  };
  s = JSON.parse(JSON.stringify(s));
  activateSeat(s, "p1");
  const ports = {
    queue: (state: GameState, ...effects: Effect[]) =>
      state.queue.unshift(...effects),
    canPay: () => true,
    cardCost: (_state: GameState, p: Piece) => card(p).cost || 0,
    isTextBlank,
    canReadyIdentity: () => true,
    canChangeForm: () => true,
    canDeclareIdentityDefender: () => true,
    hasTrait: () => true,
    heroAttack: () => 2,
    preventDamage: vi.fn(),
    pay: (
      state: GameState,
      title: string,
      cost: number,
      requirements: Resource[],
      after: Effect[],
      piece?: Piece,
      targetCode?: string,
    ) =>
      state.queue.unshift({
        type: "payRequest",
        title,
        cost,
        requirements,
        after,
        piece,
        targetCode,
      }),
  } as unknown as Ports;
  return {
    s,
    ports,
    held: s.player.inPlay.find((p) => p.id === jocasta.id)!.storedCards![0],
    jocasta: s.player.inPlay.find((p) => p.id === jocasta.id)!,
  };
}

function effectsDeep(effects: Effect[]): Effect[] {
  return effects.flatMap((e) => [e, ...effectsDeep(e.after || [])]);
}

describe("Jocasta's physical Defense event sources across existing products", () => {
  it("preserves hand and attached physical IDs, excludes resources/non-Defense cards, and uses current control rather than original ownership", () => {
    const { s, jocasta, held } = fixture();
    const hand = makePiece(s, "01003");
    const resource = makePiece(s, "01088");
    const ordinary = makePiece(s, "01002");
    const alliance = makePiece(s, "23034");
    s.player.hand.push(hand);
    jocasta.ownerId = "p2";
    jocasta.storedCards!.push(resource, ordinary, alliance);
    const peer = makePiece(s, "26013");
    peer.storedCards = [makePiece(s, "05005")];
    s.players[1].player.inPlay.push(peer);
    const before = JSON.stringify(s);
    expect(defenseEventSources(s)).toEqual([hand, held]);
    expect(defenseEventSources(s)[1]).toBe(held);
    expect(JSON.stringify(s)).toBe(before);
    jocasta.treatedAsMinion = true;
    expect(defenseEventSources(s)).toEqual([hand]);
    jocasta.treatedAsMinion = false;
    s.player.inPlay.splice(s.player.inPlay.indexOf(jocasta), 1);
    expect(defenseEventSources(s)).toEqual([hand]);
  });

  it.each(cases)(
    "$code offers and pays the same saved attached event without premature extraction",
    (c) => {
      const { s, ports, held, jocasta } = fixture(c);
      const before = JSON.stringify(s);
      const option = c.options(s, ports).find((o) => o.id === held.id);
      expect(option?.image).toBe(c.code);
      expect(s.player.hand.some((p) => p.id === held.id)).toBe(false);
      expect(jocasta.storedCards).toEqual([held]);
      expect(JSON.stringify(s)).toBe(before);
      for (const effect of option!.effects) {
        if (!c.resolve?.(s, effect, ports)) s.queue.push(effect);
      }
      const queued = effectsDeep(s.queue);
      const payment = queued.find((e) => e.type === "payRequest");
      if (payment) expect(payment.piece).toBe(held);
      else
        expect(queued.find((e) => e.type === "resolveHandEvent")?.id).toBe(
          held.id,
        );
      expect(jocasta.storedCards?.[0]).toBe(held);
      expect(s.player.hand.some((p) => p.id === held.id)).toBe(false);
    },
  );

  it.each(cases.filter((c) => c.resolve))(
    "$code revalidates Jocasta after a saved choice before paying",
    (c) => {
      const { s, ports, held, jocasta } = fixture(c);
      const option = c.options(s, ports).find((o) => o.id === held.id)!;
      expect(option).toBeDefined();
      jocasta.treatedAsMinion = true;
      const before = JSON.stringify(s);
      expect(() => c.resolve!(s, option.effects[0], ports)).toThrow();
      expect(JSON.stringify(s)).toBe(before);
    },
  );

  it("Side Step's generated excess Energy does not satisfy its cost bonus, while allocated Energy does", () => {
    const { s, ports } = fixture(cases.find((c) => c.code === "14015"));
    const effect = {
      type: "quicksilver-pack:event-paid",
      id: "physical-side-step",
      paid: ["physical", "energy"],
      paidForCard: ["physical"],
      effects: [{ type: "quicksilver-pack:side", window: window(s) }],
    };
    resolveQuicksilverPackEffect(s, effect, ports);
    const paidEvent = s.queue.shift()!;
    expect(paidEvent.after[0].paidForCard).toEqual(["physical"]);
    resolveQuicksilverPackEffect(s, paidEvent.after[0], ports);
    expect(s.queue).toEqual([]);
    expect(ports.preventDamage).toHaveBeenCalledWith(
      s,
      3,
      expect.objectContaining({ target: "hero" }),
    );
    resolveQuicksilverPackEffect(
      s,
      { ...effect, paidForCard: ["energy"] },
      ports,
    );
    resolveQuicksilverPackEffect(s, s.queue.shift()!.after[0], ports);
    expect(s.queue).toEqual([
      { type: "damage", target: s.villain.id, amount: 1, source: "hero" },
    ]);
  });
});
