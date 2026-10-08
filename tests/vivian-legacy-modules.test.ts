/** Real Vivian entry, payment, and targets exercise older native modules. */
import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { isTextBlank } from "../src/game/card-text.js";
import { deckErrors } from "../src/game/decks.js";
import { makePiece, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  native,
  passId,
  play,
  target,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & { vivianLegacyOriginalIds?: string[] };

function physical(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
  ];
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.invocationDeck || []),
        ...(p.invocationDiscard || []),
        ...(p.ironheartIdentity ? [p.ironheartIdentity] : []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}

function exact(s: GameState) {
  const all = physical(s);
  for (const id of (s as Fixture).vivianLegacyOriginalIds || [])
    expect(
      all.filter((p) => p.id === id),
      `original physical source ${id}`,
    ).toHaveLength(1);
}

function settle(s: GameState) {
  for (let n = 0; s.prompt && n < 160; n++) {
    const id =
      passId(s) ||
      s.prompt.options.find((o) => o.id === "undefended")?.id ||
      s.prompt.options.find((o) => o.id === "resolve")?.id ||
      (s.prompt.title === "Forced responses"
        ? s.prompt.options[0]?.id
        : undefined) ||
      (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  exact(s);
  return s;
}

/** Arrange source instances, keeping the two reserve identities, current
 * identity, and every separate physical Invocation in their real zones. */
function base(other?: "doctor_strange" | "spider_man") {
  const iron = { heroId: "ironheart", aspect: "leadership" as const };
  let s = newGame({
    ...iron,
    villainId: "rhino",
    seed: 29024,
    pacing: "expert",
    ...(other
      ? {
          heroes: [
            iron,
            {
              heroId: other,
              aspect:
                other === "doctor_strange"
                  ? ("protection" as const)
                  : ("justice" as const),
            },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  const originals = physical(s).filter(
    (p) => p.ownerId && card(p).faction_code !== "encounter",
  );
  expect(originals.filter((p) => p.ownerId === "p1")).toHaveLength(43);
  if (other === "doctor_strange") {
    expect(originals.filter((p) => p.ownerId === "p2")).toHaveLength(45);
    expect(seatView(s, "p2").player.invocationDeck).toHaveLength(5);
  }
  for (const seat of s.players) {
    const view = seatView(s, seat);
    const source = [
      ...view.player.deck,
      ...view.player.hand,
      ...view.player.discard,
      ...view.player.inPlay,
    ];
    expect(source).toHaveLength(40);
    expect(
      deckErrors(
        seat.heroId,
        seat.aspect,
        source.map((p) => p.code),
      ),
    ).toEqual([]);
    view.player.deck = source;
    view.player.hand = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.player.form = "hero";
    view.player.hp = 10;
    view.player.exhausted = view.player.flipped = false;
    view.player.stunned = view.player.confused = view.player.tough = false;
  }
  s.encounter.deck.push(
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
  );
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck.unshift(
    ...Array.from({ length: 30 }, () => makePiece(s, "01104")),
  );
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  s.queue = [];
  s.prompt = s.review = null;
  (s as Fixture).vivianLegacyOriginalIds = originals.map((p) => p.id);
  exact(s);
  return s;
}

function playerCard(s: GameState, code: string) {
  for (const zone of [s.player.deck, s.player.hand, s.player.discard]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original source ${code}`);
}

function minion(s: GameState, code: string) {
  const p = makePiece(s, code);
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  return p;
}

function scheme(s: GameState, code: string, counters: number) {
  const p = makePiece(s, code);
  p.counters = counters;
  s.sideSchemes.push(p);
  return p;
}

function blank(s: GameState, targetId: string) {
  const vivian = playerCard(s, "29024");
  const resources = [playerCard(s, "29009"), playerCard(s, "29009")];
  expect(new Set(resources.map((p) => p.id)).size).toBe(2);
  s.player.hand.push(vivian, ...resources);
  s = play(s, vivian, resources);
  s = until(s, (v) => v.prompt?.title === "Vivian");
  expect(s.player.inPlay.some((p) => p.id === vivian.id)).toBe(true);
  for (const p of resources)
    expect(s.player.discard.some((d) => d.id === p.id)).toBe(true);
  s = choose(s, "yes");
  expect(s.prompt?.options.some((o) => o.id === targetId)).toBe(true);
  s = choose(s, targetId);
  s = settle(s);
  expect(
    isTextBlank(
      s,
      physical(s).find((p) => p.id === targetId)!,
    ),
  ).toBe(true);
  exact(s);
  return s;
}

function expire(s: GameState, targetId: string) {
  const round = s.round;
  s = settle(native(s, { type: "newRound" }));
  expect(s.round).toBe(round + 1);
  expect(
    isTextBlank(
      s,
      physical(s).find((p) => p.id === targetId)!,
    ),
  ).toBe(false);
  return s;
}

describe("Vivian suppresses real printed effects in older native modules", () => {
  it.each(["normal", "blank", "expired"] as const)(
    "Counterspell %s preserves cancellation, suppresses it, or restores it for an original played event",
    (mode) => {
      let s = base();
      const counter = makePiece(s, "09030");
      counter.attachedTo = `hero:${s.activePlayerId}`;
      s.attachments.push(counter);
      if (mode !== "normal") s = blank(s, counter.id);
      if (mode === "expired") s = expire(s, counter.id);
      const event = playerCard(s, "29005"),
        resources = [playerCard(s, "29017"), playerCard(s, "29018")],
        before = s.scheme.threat;
      s.player.hand.push(event, ...resources);
      s = target(play(s, event, resources), "main");
      s = settle(s);
      const cancelled = mode !== "blank";
      expect(s.scheme.threat).toBe(before - (cancelled ? 0 : 3));
      expect(s.attachments.some((p) => p.id === counter.id)).toBe(!cancelled);
      expect(s.encounter.discard.some((p) => p.id === counter.id)).toBe(
        cancelled,
      );
      expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
      for (const p of resources)
        expect(s.player.discard.some((d) => d.id === p.id)).toBe(true);
      exact(s);
    },
  );

  it.each([false, true])(
    "Open the Dark Dimension keeps the captured original Invocation in its own deck or special discard (blank=%s)",
    (textBlank) => {
      let s = base("doctor_strange");
      const strange = seatView(s, "p2"),
        invocation = strange.player.invocationDeck![0],
        dimension = makePiece(s, "09029");
      expect(invocation.ownerId).toBe("p2");
      s = settle(native(s, { type: "reveal", piece: dimension, skip: true }));
      expect(
        s.sideSchemes
          .find((p) => p.id === dimension.id)
          ?.storedCards?.map((p) => p.id),
      ).toEqual([invocation.id]);
      expect(physical(s).filter((p) => p.id === invocation.id)).toHaveLength(1);
      if (textBlank) s = blank(s, dimension.id);
      const actual = s.sideSchemes.find((p) => p.id === dimension.id)!;
      s = settle(
        native(s, {
          type: "thwart",
          target: dimension.id,
          amount: actual.counters,
          source: "hero",
        }),
      );
      const owner = seatView(s, "p2").player;
      expect(s.sideSchemes.some((p) => p.id === dimension.id)).toBe(false);
      expect(s.encounter.discard.some((p) => p.id === dimension.id)).toBe(true);
      expect(owner.invocationDeck?.some((p) => p.id === invocation.id)).toBe(
        !textBlank,
      );
      expect(owner.invocationDiscard?.some((p) => p.id === invocation.id)).toBe(
        textBlank,
      );
      expect(owner.discard.some((p) => p.id === invocation.id)).toBe(false);
      expect(s.removed.some((p) => p.id === invocation.id)).toBe(false);
      expect(physical(s).filter((p) => p.id === invocation.id)).toHaveLength(1);
      exact(s);
    },
  );

  it.each(["normal", "blank", "expired"] as const)(
    "Loki %s heals and mills only when its actual forced interrupt is active",
    (mode) => {
      let s = base();
      const loki = minion(s, "06028"),
        top = makePiece(s, "06030");
      s.encounter.deck.unshift(top);
      if (mode !== "normal") s = blank(s, loki.id);
      if (mode === "expired") s = expire(s, loki.id);
      s = settle(native(s, { type: "damage", target: loki.id, amount: 4 }));
      const active = mode !== "blank";
      expect(s.minions.some((p) => p.id === loki.id)).toBe(active);
      expect(s.encounter.discard.some((p) => p.id === top.id)).toBe(active);
      expect(s.encounter.deck[0].id === top.id).toBe(!active);
      expect(s.encounter.discard.some((p) => p.id === loki.id)).toBe(!active);
      if (active)
        expect(s.minions.find((p) => p.id === loki.id)?.damage).toBe(0);
      exact(s);
    },
  );

  it("Total Destruction allows native thwart only while its own text is blank, with Abomination still in play", () => {
    let s = base();
    const abomination = minion(s, "10026"),
      total = scheme(s, "10027", 4);
    s = settle(native(s, { type: "thwart", target: total.id, amount: 1 }));
    expect(s.sideSchemes.find((p) => p.id === total.id)?.counters).toBe(4);
    s = blank(s, total.id);
    s = settle(native(s, { type: "thwart", target: total.id, amount: 1 }));
    expect(s.sideSchemes.find((p) => p.id === total.id)?.counters).toBe(3);
    expect(s.minions.some((p) => p.id === abomination.id)).toBe(true);
    s = expire(s, total.id);
    s = settle(native(s, { type: "thwart", target: total.id, amount: 1 }));
    expect(s.sideSchemes.find((p) => p.id === total.id)?.counters).toBe(3);
    exact(s);
  });

  it.each(["05027", "05028"])(
    "%s regains its actual damage immunity after Vivian expires, while traits and accumulated damage remain",
    (code) => {
      let s = base();
      const enemy = minion(s, code),
        companion = minion(s, "01101"),
        traits = card(enemy).traits;
      s = settle(native(s, { type: "damage", target: enemy.id, amount: 1 }));
      expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
      s = blank(s, enemy.id);
      s = settle(native(s, { type: "damage", target: enemy.id, amount: 1 }));
      expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
      expect(s.minions.some((p) => p.id === companion.id)).toBe(true);
      expect(card(s.minions.find((p) => p.id === enemy.id)!).traits).toBe(
        traits,
      );
      s = expire(s, enemy.id);
      s = settle(native(s, { type: "damage", target: enemy.id, amount: 1 }));
      expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
      exact(s);
    },
  );

  it.each([false, true])(
    "Deadly Light Show's actual defeat damages both identities only when printed text is active (blank=%s)",
    (textBlank) => {
      let s = base("spider_man");
      seatView(s, "p2").player.form = "alter";
      const light = makePiece(s, "23030");
      s = settle(native(s, { type: "reveal", piece: light, skip: true }));
      expect(s.sideSchemes.find((p) => p.id === light.id)?.counters).toBe(5);
      if (textBlank) s = blank(s, light.id);
      const before = s.players.map((seat) => seatView(s, seat).player.hp);
      s = settle(native(s, { type: "thwart", target: light.id, amount: 5 }));
      expect(s.sideSchemes.some((p) => p.id === light.id)).toBe(false);
      expect(s.encounter.discard.some((p) => p.id === light.id)).toBe(true);
      expect(s.players.map((seat) => seatView(s, seat).player.hp)).toEqual(
        before.map((hp) => hp - (textBlank ? 0 : 1)),
      );
      expect(seatView(s, "p2").player.form).toBe("alter");
      exact(s);
    },
  );

  it.each([false, true])(
    "Highway Robbery returns captured original cards to their owners' hands only when its printed defeat effect is active (blank=%s)",
    (textBlank) => {
      let s = base("spider_man");
      const ironCard = playerCard(s, "29017"),
        spiderCard = seatView(s, "p2").player.deck.shift()!,
        robbery = makePiece(s, "01166");
      s.player.hand.push(ironCard);
      seatView(s, "p2").player.hand.push(spiderCard);
      expect(ironCard.ownerId).toBe("p1");
      expect(spiderCard.ownerId).toBe("p2");
      s = settle(native(s, { type: "reveal", piece: robbery, skip: true }));
      expect(
        s.sideSchemes
          .find((p) => p.id === robbery.id)
          ?.captured?.map((p) => p.id)
          .sort(),
      ).toEqual([ironCard.id, spiderCard.id].sort());
      expect(s.player.hand).toHaveLength(0);
      expect(seatView(s, "p2").player.hand).toHaveLength(0);
      if (textBlank) s = blank(s, robbery.id);
      const actual = s.sideSchemes.find((p) => p.id === robbery.id)!;
      s = settle(
        native(s, {
          type: "thwart",
          target: robbery.id,
          amount: actual.counters,
          source: "hero",
        }),
      );
      expect(s.sideSchemes.some((p) => p.id === robbery.id)).toBe(false);
      expect(
        s.encounter.discard.filter((p) => p.id === robbery.id),
      ).toHaveLength(1);
      for (const captured of [ironCard, spiderCard]) {
        const owner = seatView(s, captured.ownerId!).player,
          other = seatView(s, captured.ownerId === "p1" ? "p2" : "p1").player;
        expect(owner.hand.some((p) => p.id === captured.id)).toBe(!textBlank);
        expect(owner.discard.some((p) => p.id === captured.id)).toBe(textBlank);
        expect(
          [...other.hand, ...other.discard].some((p) => p.id === captured.id),
        ).toBe(false);
        expect(physical(s).filter((p) => p.id === captured.id)).toHaveLength(1);
      }
      expect(
        s.encounter.discard.find((p) => p.id === robbery.id)?.captured,
      ).toBeUndefined();
      exact(s);
    },
  );

  it("Beetle Armor's actual villain hit-point bonus disappears and returns with Vivian while preserving existing damage", () => {
    let s = base();
    const armor = makePiece(s, "13029"),
      baseMax = s.villain.maxHp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 3,
        source: "hero",
      }),
    );
    expect(s.villain.maxHp - s.villain.hp).toBe(3);
    s = settle(native(s, { type: "reveal", piece: armor, skip: true }));
    expect(s.attachments.find((p) => p.id === armor.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.villain.maxHp).toBe(baseMax + 4);
    expect(s.villain.hp).toBe(baseMax + 1);
    s = blank(s, armor.id);
    expect(s.villain.maxHp).toBe(baseMax);
    expect(s.villain.hp).toBe(baseMax - 3);
    expect(s.villain.maxHp - s.villain.hp).toBe(3);
    expect(card(s.attachments.find((p) => p.id === armor.id)!).traits).toBe(
      "Armor. Tech.",
    );
    s = expire(s, armor.id);
    expect(s.villain.maxHp).toBe(baseMax + 4);
    expect(s.villain.hp).toBe(baseMax + 1);
    expect(s.villain.maxHp - s.villain.hp).toBe(3);
    expect(s.attachments.filter((p) => p.id === armor.id)).toHaveLength(1);
    exact(s);
  });

  it("leaving play while Vivian has blanked Beetle Armor cannot subtract the already removed hit-point bonus again", () => {
    let s = base();
    const armor = makePiece(s, "13029"),
      baseMax = s.villain.maxHp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 3,
        source: "hero",
      }),
    );
    s = settle(native(s, { type: "reveal", piece: armor, skip: true }));
    expect(s.villain.maxHp).toBe(baseMax + 4);
    expect(s.villain.hp).toBe(baseMax + 1);
    s = blank(s, armor.id);
    expect(s.villain.maxHp).toBe(baseMax);
    expect(s.villain.hp).toBe(baseMax - 3);
    s = settle(native(s, { type: "discardPiece", id: armor.id }));
    expect(s.attachments.some((p) => p.id === armor.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === armor.id)).toHaveLength(
      1,
    );
    expect(s.villain.maxHp).toBe(baseMax);
    expect(s.villain.hp).toBe(baseMax - 3);
    s = expire(s, armor.id);
    expect(s.villain.maxHp).toBe(baseMax);
    expect(s.villain.hp).toBe(baseMax - 3);
    expect(physical(s).filter((p) => p.id === armor.id)).toHaveLength(1);
    exact(s);
  });
});
