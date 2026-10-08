import { describe, expect, it } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card, deckCodes } from "../src/game/cards";
import { activateSeat, seatView } from "../src/game/team";
import {
  effectivePrintedHandResources,
  resolveZzzaxEffect,
  zzzaxActions,
  zzzaxBoost,
  zzzaxControlledEnergy,
  zzzaxEnemyStats,
  zzzaxHandEnergy,
  zzzaxHandResources,
  zzzaxReveal,
  zzzaxTotalEnergy,
  zzzaxVillainPhaseInterrupts,
  type ZzzaxIndirectRequest,
  type ZzzaxPorts,
} from "../src/game/zzzax";
import type { Effect, GameState, Piece } from "../src/game/types";

function base(players = 1) {
  // A valid custom forty-card deck retains all fifteen physical signatures
  // and adds Core's three two-icon resources for focused replacement cases.
  const deck = deckCodes("ironheart", "leadership")
    .filter((code) => code !== "29027")
    .concat("01088", "01089", "01090");
  const s = newGame({
    heroId: "ironheart",
    aspect: "leadership",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 29037,
    heroes: [
      { heroId: "ironheart", aspect: "leadership", deckCards: deck },
      ...(players === 2
        ? [{ heroId: "captain_marvel", aspect: "aggression" as const }]
        : []),
    ],
  });
  s.phase = "player";
  s.prompt = null;
  s.queue = [];
  s.review = null;
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  return s;
}
function playerCard(s: GameState, code: string, zone: "hand" | "inPlay") {
  for (const source of [s.player.deck, s.player.hand, s.player.discard]) {
    const i = source.findIndex(
      (p) => p.code === code || card(p).name === card(code).name,
    );
    if (i < 0) continue;
    const p = source.splice(i, 1)[0];
    s.player[zone].push(p);
    return p;
  }
  throw Error(`Missing actual original source card ${code}`);
}
function haywire(s: GameState, playerId = s.activePlayerId) {
  const p = makePiece(s, "29038");
  p.attachedTo = `hero:${playerId}`;
  s.attachments.push(p);
  return p;
}
function fixturePorts() {
  const indirect: ZzzaxIndirectRequest[] = [];
  const moved: { piece: Piece; playerId: string }[] = [];
  const ports: ZzzaxPorts = {
    queue(s, ...effects) {
      s.queue.push(...effects);
    },
    choose(s, title, text, options) {
      s.prompt = { kind: "choice", title, text, options };
    },
    putMinion(s, piece, playerId) {
      moved.push({ piece, playerId });
      piece.engagedWith = playerId;
      s.minions.push(piece);
    },
    attach(s, p, id) {
      p.attachedTo = id;
      if (!s.attachments.some((x) => x.id === p.id)) s.attachments.push(p);
    },
    discardPiece(s, id) {
      for (const zone of [
        s.player.inPlay,
        s.attachments,
        s.environments || [],
      ]) {
        const index = zone.findIndex((p) => p.id === id);
        if (index >= 0) {
          const [p] = zone.splice(index, 1);
          (p.ownerId ? s.player.discard : s.encounter.discard).push(p);
          return;
        }
      }
    },
    indirect(_s, request) {
      indirect.push(request);
    },
    canTakeIndirectCost: () => true,
    canDiscardControlled: (_s, p) => !card(p).permanent,
    discardControlledCost(s, id, after) {
      ports.discardPiece(s, id);
      ports.queue(s, after);
    },
  };
  return { ports, indirect, moved };
}
const resolve = (s: GameState, e: Effect, ports: ZzzaxPorts) => {
  if (e.actorId) activateSeat(s, e.actorId);
  expect(resolveZzzaxEffect(s, e, ports)).toBe(true);
};

describe("Zzzax standalone printed-resource and native-port contracts", () => {
  it("preserves all printed resource icons and never counts Wild as Energy", () => {
    const s = base();
    playerCard(s, "01088", "hand");
    playerCard(s, "01089", "hand");
    playerCard(s, "01090", "hand");
    const power = playerCard(s, "29021", "hand");
    expect(zzzaxHandEnergy(s)).toBe(2);
    expect(effectivePrintedHandResources(s, power)).toEqual(["wild"]);
    haywire(s);
    expect(zzzaxHandEnergy(s)).toBe(7);
    expect(effectivePrintedHandResources(s, power)).toEqual(["energy"]);
  });
  it("does not invent icons or double them through stacked Haywires", () => {
    const s = base();
    const p = playerCard(s, "29021", "hand");
    haywire(s);
    haywire(s);
    expect(zzzaxHandResources(s, p, [])).toEqual([]);
    expect(effectivePrintedHandResources(s, p)).toEqual(["energy"]);
    expect(zzzaxHandResources(s, p, ["wild", "physical", "mental"])).toEqual([
      "energy",
      "energy",
      "energy",
    ]);
  });
  it("limits replacement to the attached identity's actual hand", () => {
    const s = base(2);
    const p1 = playerCard(s, "29021", "hand");
    haywire(s, "p1");
    activateSeat(s, "p2");
    const p2 = playerCard(s, "01090", "hand");
    expect(zzzaxHandResources(s, p2, ["physical", "physical"])).toEqual([
      "physical",
      "physical",
    ]);
    expect(zzzaxHandResources(s, p1, ["wild"])).toEqual(["wild"]);
    activateSeat(s, "p1");
    expect(effectivePrintedHandResources(s, p1)).toEqual(["energy"]);
  });
  it("restores the printed hand icons when the last active Haywire is blanked", () => {
    const s = base();
    const p = playerCard(s, "01089", "hand");
    const h = haywire(s);
    expect(effectivePrintedHandResources(s, p)).toEqual(["energy", "energy"]);
    s.flags[`novaIronheartPackBlank:${h.id}`] = s.round;
    expect(effectivePrintedHandResources(s, p)).toEqual(["mental", "mental"]);
    haywire(s);
    expect(effectivePrintedHandResources(s, p)).toEqual(["energy", "energy"]);
  });
  it("counts controlled printed ENERGY through text blanking, excluding the hand", () => {
    const s = base();
    const ally = playerCard(s, "29023", "inPlay");
    playerCard(s, "29026", "inPlay");
    playerCard(s, "01088", "hand");
    haywire(s);
    s.flags[`novaIronheartPackBlank:${ally.id}`] = s.round;
    expect(zzzaxControlledEnergy(s)).toBe(1);
    expect(zzzaxTotalEnergy(s)).toBe(3);
  });
  it("derives both dynamic modifiers from the current engaged player's cards", () => {
    const s = base(2);
    playerCard(s, "29023", "inPlay");
    const p = makePiece(s, "29037");
    p.engagedWith = "p1";
    p.damage = 4;
    s.minions.push(p);
    activateSeat(s, "p2");
    expect(zzzaxEnemyStats(s, p)).toEqual({ attack: 1, health: 1 });
    p.engagedWith = "p2";
    expect(zzzaxEnemyStats(s, p)).toEqual({ attack: 0, health: 0 });
    expect(p.damage).toBe(4);
  });
  it("turns off Zzzax's stat text without changing its existing damage tokens", () => {
    const s = base();
    playerCard(s, "29023", "inPlay");
    const p = makePiece(s, "29037");
    p.damage = 3;
    expect(zzzaxEnemyStats(s, p)).toEqual({ attack: 1, health: 1 });
    s.flags[`novaIronheartPackBlank:${p.id}`] = s.round;
    expect(zzzaxEnemyStats(s, p)).toEqual({ attack: 0, health: 0 });
    expect(p.damage).toBe(3);
  });
  it("queues Feedback Loop's separate per-player native threat placements", () => {
    const s = base(2);
    playerCard(s, "01088", "hand");
    playerCard(s, "29023", "inPlay");
    const piece = makePiece(s, "29036");
    piece.counters = 2;
    s.sideSchemes.push(piece);
    const { ports } = fixturePorts();
    const effects = zzzaxReveal(s, piece)!;
    expect(effects.map((e) => e.actorId)).toEqual(["p1", "p2"]);
    resolve(s, effects[0], ports);
    expect(s.queue[0]).toMatchObject({
      type: "threat",
      target: piece.id,
      amount: 3,
      actorId: "p1",
    });
    expect(piece.counters).toBe(2);
  });
  it("keeps the same physical boost when the target seat has two effective icons", () => {
    const s = base();
    playerCard(s, "01089", "hand");
    const piece = makePiece(s, "29037");
    expect(zzzaxBoost(s, piece, "p1")).toEqual({
      effects: [],
      retainsCard: false,
    });
    haywire(s);
    const boost = zzzaxBoost(s, piece, "p1")!;
    const { ports, moved } = fixturePorts();
    expect(boost.retainsCard).toBe(true);
    resolve(s, boost.effects[0], ports);
    expect(moved[0].piece).toBe(piece);
    expect(moved[0].playerId).toBe("p1");
  });
  it("checks the attacked seat rather than the currently viewed seat for boosts", () => {
    const s = base(2);
    playerCard(s, "01088", "hand");
    const p = makePiece(s, "29037");
    activateSeat(s, "p2");
    expect(zzzaxBoost(s, p, "p1")?.retainsCard).toBe(true);
    expect(zzzaxBoost(s, p, "p2")?.retainsCard).toBe(false);
  });
  it("disables a blanked boost ability and ignores unrelated cards", () => {
    const s = base();
    playerCard(s, "01088", "hand");
    const p = makePiece(s, "29037");
    s.flags[`novaIronheartPackBlank:${p.id}`] = s.round;
    expect(zzzaxBoost(s, p, "p1")?.retainsCard).toBe(false);
    expect(zzzaxBoost(s, makePiece(s, "01100"), "p1")).toBeNull();
  });
  it("resolves Air Static's resource eligibility when that seat's effect executes", () => {
    const s = base();
    const p = makePiece(s, "29039");
    s.environments = [p];
    const { ports, indirect } = fixturePorts();
    const [source] = zzzaxVillainPhaseInterrupts(s);
    expect(source.type).toBe("zzzax:static-source");
    resolve(s, source, ports);
    const effect = s.queue.shift()!;
    playerCard(s, "01088", "hand");
    resolve(s, JSON.parse(JSON.stringify(effect)), ports);
    expect(indirect[0]).toMatchObject({
      playerId: "p1",
      amount: 2,
      sourceId: p.id,
    });
  });
  it("does not deal Air Static damage after its source is blanked or discarded", () => {
    const s = base();
    const p = makePiece(s, "29039");
    s.environments = [p];
    playerCard(s, "01088", "hand");
    const { ports, indirect } = fixturePorts();
    const [source] = zzzaxVillainPhaseInterrupts(s);
    resolve(s, source, ports);
    s.environments = [];
    resolve(s, s.queue.shift()!, ports);
    expect(indirect).toEqual([]);
    s.environments = [p];
    s.flags[`novaIronheartPackBlank:${p.id}`] = s.round;
    expect(zzzaxVillainPhaseInterrupts(s)).toEqual([]);
  });
  it("lets the first player order multiple simultaneous Air Static sources", () => {
    const s = base(2);
    s.firstPlayerId = "p2";
    s.environments = [makePiece(s, "29039"), makePiece(s, "29039")];
    const { ports } = fixturePorts();
    const [effect] = zzzaxVillainPhaseInterrupts(s);
    resolve(s, JSON.parse(JSON.stringify(effect)), ports);
    expect(s.activePlayerId).toBe("p2");
    expect(s.prompt?.title).toBe("Forced interrupts");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(
      s.environments.map((p) => p.id),
    );
  });
  it("requires completed native damage-dealt receipts and survives a saved callback", () => {
    const s = base();
    const { ports } = fixturePorts();
    expect(() =>
      resolveZzzaxEffect(s, { type: "zzzax:zzzap-after" }, ports),
    ).toThrow(/native damage-dealt receipt/);
    resolve(
      s,
      JSON.parse(
        JSON.stringify({
          type: "zzzax:zzzap-after",
          actorId: "p1",
          identityDamageDealt: 1,
          damageTaken: 0,
        }),
      ),
      ports,
    );
    expect(s.queue).toEqual([{ type: "surge", actorId: "p1" }]);
  });
  it.each([0, 1, 2, 5])(
    "Zzzap uses dealt damage %i independently of prevented damage taken",
    (identityDamageDealt) => {
      const s = base();
      const { ports } = fixturePorts();
      resolve(
        s,
        { type: "zzzax:zzzap-after", identityDamageDealt, damageTaken: 0 },
        ports,
      );
      expect(s.queue.some((e) => e.type === "surge")).toBe(
        identityDamageDealt <= 1,
      );
    },
  );
  it("asks the native adapter to resolve zero-damage Zzzap and report its receipt", () => {
    const s = base();
    const p = makePiece(s, "29040");
    const { ports, indirect } = fixturePorts();
    resolve(s, zzzaxReveal(s, p)![0], ports);
    expect(indirect[0]).toMatchObject({
      amount: 0,
      after: { type: "zzzax:zzzap-after", actorId: "p1" },
    });
  });
  it("restricts discard costs to own controlled printed Energy, even with Haywire", () => {
    const s = base();
    const own = playerCard(s, "29023", "inPlay");
    const physical = playerCard(s, "29026", "inPlay");
    const hand = playerCard(s, "01088", "hand");
    const h = haywire(s);
    const { ports } = fixturePorts();
    resolve(s, zzzaxActions(s, h, ports)[0].effects[0], ports);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      own.id,
      "indirect",
      "cancel",
    ]);
    expect(
      s.prompt?.options.some((o) => [physical.id, hand.id].includes(o.id)),
    ).toBe(false);
  });
  it("allows a Hero to pay their own cost to remove another seat's Haywire", () => {
    const s = base(2);
    const h = haywire(s, "p1");
    activateSeat(s, "p2");
    const { ports } = fixturePorts();
    expect(zzzaxActions(s, h, ports)[0].effects[0].actorId).toBe("p2");
    s.player.form = "alter";
    expect(zzzaxActions(s, h, ports)).toEqual([]);
  });
  it("offers no action if neither full cost can be paid", () => {
    const s = base();
    const h = haywire(s);
    const { ports } = fixturePorts();
    ports.canTakeIndirectCost = () => false;
    expect(zzzaxActions(s, h, ports)).toEqual([]);
  });
  it.each([0, 1, 2])(
    "TAKE cost requires all 2 actual damage taken, receipt %i",
    (damageTaken) => {
      const s = base();
      const h = haywire(s);
      const { ports } = fixturePorts();
      resolve(
        s,
        { type: "zzzax:remove-damage-after", id: h.id, damageTaken },
        ports,
      );
      expect(s.queue.some((e) => e.type === "zzzax:remove-paid")).toBe(
        damageTaken === 2,
      );
    },
  );
  it("does not recheck form or text after the full cost has already been paid", () => {
    const s = base();
    const h = haywire(s);
    const { ports } = fixturePorts();
    s.player.form = "alter";
    s.flags[`novaIronheartPackBlank:${h.id}`] = s.round;
    resolve(s, { type: "zzzax:remove-paid", id: h.id }, ports);
    expect(s.attachments).toEqual([]);
    expect(s.encounter.discard.some((p) => p.id === h.id)).toBe(true);
  });
  it("does not leak a Surge to a surviving teammate after actor elimination", () => {
    const s = base(2);
    s.players[0].eliminated = true;
    const { ports } = fixturePorts();
    resolve(
      s,
      { type: "zzzax:zzzap-after", actorId: "p1", identityDamageDealt: 1 },
      ports,
    );
    expect(s.queue).toEqual([]);
  });
});
