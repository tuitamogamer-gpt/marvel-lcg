import { mkdirSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import sourceDecks from "../src/data/catalog-decks.json";
import { card } from "../src/game/cards.js";
import { catalogDeckCodes, type CatalogDeck } from "../src/game/catalog.js";
import { dispatch, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { Command, GameState, Piece } from "../src/game/types.js";

function physical(s: GameState) {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.captured || []).flatMap(nested),
    ...(p.storedCards || []).flatMap(nested),
    ...(p.inheritorBoosts || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
  ];
  const m = s.mansionAttack!;
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.invocationDeck || []),
        ...(p.invocationDiscard || []),
      ];
    }),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.victoryDisplay || []),
    ...m.villainDeck,
    ...m.mainDeck,
    ...(m.currentMain ? [m.currentMain] : []),
    ...(m.activeVillainRetired ? [] : [s.villain]),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function snapshot(name: string, s: GameState) {
  if (!process.env.MANSION_PAYMENT_REPRO_SAVE) return;
  mkdirSync("output/mansion-attack", { recursive: true });
  writeFileSync(
    `output/mansion-attack/warlock-payment-${name}.json`,
    JSON.stringify(s, null, 2),
  );
}
it("pays Zone of Silence's actual target and discard costs before its spent Determination response", () => {
  const source = (sourceDecks as unknown as CatalogDeck[]).find(
    (d) => d.heroCode === "21031a",
  )!;
  const deckCards = catalogDeckCodes(source);
  expect(deckCards).toHaveLength(40);
  let s = newGame({
    heroId: "warlock",
    aspect: "aggression",
    heroes: [{ heroId: "warlock", aspect: "aggression", deckCards }],
    villainId: "mansion_attack",
    difficulty: "expert",
    module: "under_attack",
    seed: 28816,
    pacing: "expert",
  });
  const ids = physical(s)
    .map((p) => p.id)
    .sort();
  const send = (cmd: Command) => {
    s = dispatch(JSON.parse(JSON.stringify(s)), cmd);
    snapshot(
      cmd.type === "CHOOSE" ? "after-response" : cmd.type.toLowerCase(),
      s,
    );
    expect(s.error, JSON.stringify(cmd)).toBeUndefined();
    expect(
      physical(s)
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids);
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(ids.length);
  };
  send({ type: "MULLIGAN", ids: [] });
  send({ type: "FLIP" });
  expect(s.scheme.threat).toBe(1);
  expect(s.sideSchemes).toEqual([]);
  const spell = s.player.hand.find((p) => p.code === "21050")!;
  const determination = s.player.hand.find((p) => p.code === "21052")!;
  expect(spell, "actual opening source Zone of Silence").toBeTruthy();
  expect(determination, "actual opening source Determination").toBeTruthy();
  expect([spell.id, determination.id]).toEqual(["c25", "c27"]);
  expect(card(spell).name).toBe("Zone of Silence");
  send({ type: "PLAY", id: spell.id });
  expect(s.prompt?.kind).toBe("payment");
  send({ type: "PAY", ids: [determination.id], wildAs: "energy" });
  expect(s.prompt?.title).toBe("Zone of Silence");
  expect(s.prompt?.text).toMatch(/target before discarding/i);
  expect(s.scheme.threat).toBe(1);
  send({ type: "CHOOSE", id: "main" });
  expect(s.prompt?.text).toMatch(/how many cards to discard/i);
  const beforeDeck = s.player.deck.map((p) => p.id),
    milled = s.player.deck.slice(0, 2);
  send({ type: "CHOOSE", id: "2" });
  expect(s.prompt?.title).toBe("Determination");
  expect(s.scheme.threat).toBe(1);
  expect(
    s.player.discard.filter((p) => p.id === determination.id),
  ).toHaveLength(1);
  expect(s.player.deck.map((p) => p.id)).toEqual(beforeDeck.slice(2));
  for (const p of milled)
    expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
  snapshot("all-costs-paid-before-response", s);
  send({ type: "CHOOSE", id: "yes" });
  expect(s.scheme.threat).toBe(0);
  expect(s.prompt).toBeNull();
  expect(s.player.deck.map((p) => p.id)).toEqual(beforeDeck.slice(2));
  for (const p of [spell, determination, ...milled])
    expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
  expect(s.resolving).toEqual([]);
  expect(s.currentEventId).toBeUndefined();
  expect(s.queue).toEqual([]);
  expect(s.phase).toBe("player");
});
