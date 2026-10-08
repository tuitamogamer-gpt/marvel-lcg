/** Native Venom acceptance: original Justice cards, saved costs and set-aside IDs. */
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { card, handSize, heroCard, heroStats } from "../src/game/cards.js";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog.js";
import { deckErrors } from "../src/game/decks.js";
import { dispatch, playable, paymentSources } from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
import {
  allocation,
  attach,
  base,
  choose,
  command,
  conserved,
  encounterConserved,
  finish,
  hand,
  minion,
  native,
  owned,
  paidPlay,
  pay,
  physical,
  play,
  put,
  reload,
  respond,
  side,
  starting,
  target,
  top,
  until,
} from "./dv-test-helpers.js";

describe("Venom's original Justice source and setup", () => {
  it("creates forty original player IDs and five separate physical nemesis IDs", () => {
    const codes = heroStarterCodes("vnm"),
      source = STARTER_DECKS.find((d) => d.id === "starter-20001a")!;
    expect(codes).toHaveLength(40);
    expect([...codes].sort()).toEqual(catalogDeckCodes(source).sort());
    expect(codes.every((code) => code.startsWith("20"))).toBe(true);
    expect(deckErrors("vnm", "justice", codes)).toEqual([]);
    expect(catalog.filter((c) => c.pack_code === "vnm")).toHaveLength(30);
    const s = starting("vnm");
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual([...codes].sort());
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "20024",
      "20025",
      "20025",
      "20025",
      "20025",
    ]);
    expect(new Set(s.player.setAside?.map((p) => p.id)).size).toBe(5);
    expect(
      s.player.setAside?.every((p) => !physical(s).some((c) => c.id === p.id)),
    ).toBe(true);
    expect(s.player.hp).toBe(12);
    expect(heroCard(s).code).toBe("20001b");
    expect(handSize(s)).toBe(6);
    expect(s.encounter.deck.filter((p) => p.code === "20023")).toHaveLength(1);
  });

  it("Armed and Ready discards real top cards until the first real Weapon after mulligan", () => {
    let s = starting("vnm");
    const source = physical(s);
    const weapon =
      s.player.deck.find((p) => p.code === "20010") ||
      s.player.deck.find((p) => card(p).traits?.includes("Weapon"))!;
    const misses = s.player.deck
      .filter((p) => !card(p).traits?.includes("Weapon"))
      .slice(0, 2);
    s.player.deck = [
      ...misses,
      weapon,
      ...s.player.deck.filter(
        (p) => p.id !== weapon.id && !misses.some((m) => m.id === p.id),
      ),
    ];
    const opening = s.player.hand.length;
    s = finish(command(s, { type: "MULLIGAN", ids: [] }));
    expect(s.player.hand).toHaveLength(opening + 1);
    expect(s.player.hand.some((p) => p.id === weapon.id)).toBe(true);
    expect(s.player.discard.map((p) => p.id)).toEqual(misses.map((p) => p.id));
    expect(physical(s)).toHaveLength(40);
    conserved(s, source);
  });

  it("uses printed basic stats and keeps the identity's restricted allowance in either form", () => {
    let s = base("vnm");
    expect(heroStats(s)).toMatchObject({
      attack: 2,
      thwart: 1,
      defense: 2,
      recover: 4,
    });
    expect(handSize(s)).toBe(5);
    expect(heroCard(s).traits).toContain("Guardian");
    s = command(s, { type: "FLIP" });
    expect(handSize(s)).toBe(6);
    expect(heroCard(s).code).toBe("20001b");
    put(s, "20010");
    put(s, "20010");
    const h = hand(s, "20008", "20017", "20004");
    expect(playable(s, h[0])).toBeNull();
    s = finish(play(s, h[0], h.slice(1)));
    expect(
      s.player.inPlay.filter((p) => card(p).text?.includes("Restricted")),
    ).toHaveLength(3);
  });
});

describe("Venom's actual payment resources", () => {
  it("Behind Enemy Lines paid only Mental removes three and confuses an enemy", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20018");
    s = play(s, h[0], [h[1]], "mental");
    s = target(s, "main");
    s = finish(target(s, "villain"));
    expect(s.scheme.threat).toBe(3);
    expect(s.villain.confused).toBe(true);
    conserved(s, h);
  });

  it("mixed resources pay the event without its only-Mental bonus", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20004", "20003");
    s = finish(target(play(s, h[0], h.slice(1)), "main"));
    expect(s.scheme.threat).toBe(3);
    expect(s.villain.confused).toBe(false);
    conserved(s, h);
  });

  it("chooses the actual paid pips before discarding mixed overpayments", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20018", "20017");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: h.slice(1).map((p) => p.id) });
    expect(s.prompt?.kind).toBe("choice");
    expect(s.player.hand.some((p) => p.id === h[0].id)).toBe(true);
    expect(
      s.player.discard.some((p) => h.slice(1).some((c) => c.id === p.id)),
    ).toBe(false);
    s = allocation(reload(s), "mental");
    s = finish(target(target(s, "main"), "villain"));
    expect(s.villain.confused).toBe(true);
    conserved(s, h);
  });

  it("zero-cost Behind Enemy Lines receives no bonus from hypothetical overpayment", () => {
    let s = base("vnm", "drax");
    const a = put(s, "01092"),
      b = put(s, "01092", "p2");
    s = choose(command(s, { type: "ABILITY", id: a.id }), "p1");
    s = choose(command(s, { type: "ABILITY", id: b.id, playerId: "p2" }), "p1");
    const h = hand(s, "20002");
    s = finish(target(play(s, h[0]), "main"));
    expect(s.scheme.threat).toBe(3);
    expect(s.villain.confused).toBe(false);
    conserved(s, h);
  });

  it("Symbiotic Bond takes one real HP for a Wild allocated as Mental, once per phase", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20004");
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(
      paymentSources(s, h[0].id, s.prompt?.paymentTarget).some(
        (p) => p.id === "symbiotic-bond",
      ),
    ).toBe(true);
    s = pay(s, [h[1]], "mental", ["symbiotic-bond"]);
    s = finish(target(target(s, "main"), "villain"));
    expect(s.player.hp).toBe(11);
    expect(s.villain.confused).toBe(true);
    expect(s.flags.venomBondPhase).toBe(`${s.round}:${s.phase}`);
    conserved(s, h);
    const second = hand(s, "20002", "20004", "20012");
    s = command(s, { type: "PLAY", id: second[0].id });
    expect(
      paymentSources(s, second[0].id, s.prompt?.paymentTarget).some(
        (p) => p.id === "symbiotic-bond",
      ),
    ).not.toBe(true);
  });

  it("Tough makes Bond unavailable and cannot be consumed merely to pay its TAKE cost", () => {
    const s = base("vnm");
    s.player.tough = true;
    const h = hand(s, "20002", "20004", "20012");
    const requested = command(s, { type: "PLAY", id: h[0].id });
    expect(
      paymentSources(requested, h[0].id, requested.prompt?.paymentTarget).some(
        (p) => p.id === "symbiotic-bond",
      ),
    ).not.toBe(true);
    const result = dispatch(reload(requested), {
      type: "PAY",
      ids: [h[1].id, "symbiotic-bond"],
      wildAs: "mental",
    });
    expect(result.error).toBeTruthy();
    expect(result.player.tough).toBe(true);
    expect(result.player.hp).toBe(12);
    expect(result.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    expect(result.flags.venomBondPhase).toBeUndefined();
  });

  it("Bond is unavailable in alter-ego form", () => {
    let s = base("vnm");
    s.player.form = "alter";
    const h = hand(s, "20008", "20017", "20004");
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(
      paymentSources(s, h[0].id, s.prompt?.paymentTarget).some(
        (p) => p.id === "symbiotic-bond",
      ),
    ).not.toBe(true);
  });

  it("Savage Attack receives overkill only from the actual Energy payment", () => {
    let s = base("vnm");
    const enemy = minion(s, "01110"),
      h = hand(s, "20006", "20017");
    s = finish(target(play(s, h[0], [h[1]], "energy"), enemy.id));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.villain.hp).toBe(47);
    conserved(s, h);
  });
});

describe("Venom's Pistols and physical Weapon actions", () => {
  it("two physical Pistols add one each to one basic attack, then exhaust", () => {
    let s = base("vnm");
    const a = put(s, "20010"),
      b = put(s, "20010");
    s = target(command(s, { type: "BASIC", action: "attack" }), "villain");
    s = respond(s, /Venom.*Pistol/i);
    s = respond(s, /Venom.*Pistol/i);
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(46);
    expect(heroStats(s).attack).toBe(2);
    expect(
      s.player.inPlay
        .filter((p) => [a.id, b.id].includes(p.id))
        .every((p) => p.exhausted),
    ).toBe(true);
    conserved(s, [a, b]);
  });

  it("a Pistol adds one to a real basic thwart but Confused consumes first", () => {
    let s = base("vnm");
    const pistol = put(s, "20010");
    s = target(command(s, { type: "BASIC", action: "thwart" }), "main");
    s = finish(target(respond(s, /Venom.*Pistol/i), "main"));
    expect(s.scheme.threat).toBe(4);
    s.player.exhausted = false;
    s.player.inPlay.find((p) => p.id === pistol.id)!.exhausted = false;
    s.player.confused = true;
    s = finish(command(s, { type: "BASIC", action: "thwart" }));
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.inPlay.find((p) => p.id === pistol.id)?.exhausted).toBe(
      false,
    );
  });

  it("Multi-Gun single damage is not an attack and bypasses Stun and Guard", () => {
    let s = base("vnm");
    const gun = put(s, "20008");
    minion(s);
    s.player.stunned = true;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: gun.id, action: "multi-damage" }),
        "villain",
      ),
    );
    expect(s.villain.hp).toBe(48);
    expect(s.player.stunned).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === gun.id)?.exhausted).toBe(true);
  });

  it("Multi-Gun threat removal bypasses Confuse and Patrol but obeys Crisis", () => {
    let s = base("vnm");
    const gun = put(s, "20008");
    minion(s, "20025");
    s.player.confused = true;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: gun.id, action: "multi-threat" }),
        "main",
      ),
    );
    expect(s.scheme.threat).toBe(4);
    expect(s.player.confused).toBe(true);
    s.player.inPlay.find((p) => p.id === gun.id)!.exhausted = false;
    const crisis = side(s, "01108", 4);
    s = command(s, { type: "ABILITY", id: gun.id, action: "multi-threat" });
    expect(s.prompt?.options.some((o) => o.id === "main")).not.toBe(true);
    s = finish(target(s, crisis.id));
    expect(s.scheme.threat).toBe(4);
  });

  it("Multi-Gun's simultaneous minion packet affects only the selected seat", () => {
    let s = base("vnm", "drax");
    const gun = put(s, "20008"),
      own = minion(s, "01110"),
      a = minion(s, "01110", "p2"),
      b = minion(s, "01103", "p2");
    s = command(s, { type: "ABILITY", id: gun.id, action: "multi-minions" });
    s = finish(target(s, "p2"));
    expect(s.minions.find((p) => p.id === own.id)?.damage).toBe(0);
    expect(s.minions.find((p) => p.id === a.id)?.damage).toBe(1);
    expect(s.minions.find((p) => p.id === b.id)?.damage).toBe(1);
  });

  it("Run and Gun readies Venom and every controlled Weapon, not Project Rebirth", () => {
    let s = base("vnm");
    const weapons = [put(s, "20010"), put(s, "20008"), put(s, "20015")],
      rebirth = put(s, "20007");
    for (const p of [...weapons, rebirth]) p.exhausted = true;
    s.player.exhausted = true;
    const h = hand(s, "20005", "20017", "20004");
    s = finish(play(s, h[0], h.slice(1)));
    expect(s.player.exhausted).toBe(false);
    expect(
      s.player.inPlay
        .filter((p) => weapons.some((w) => w.id === p.id))
        .every((p) => !p.exhausted),
    ).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === rebirth.id)?.exhausted).toBe(
      true,
    );
    conserved(s, [...weapons, rebirth, ...h]);
  });

  it("Locked and Loaded searches an actual deck Weapon in either form and shuffles", () => {
    let s = base("vnm");
    s.player.form = "alter";
    const weapon = s.player.deck.find((p) => p.code === "20008")!,
      h = hand(s, "20004");
    s = finish(target(play(s, h[0]), weapon.id));
    expect(s.player.hand.some((p) => p.id === weapon.id)).toBe(true);
    expect(s.player.deck.some((p) => p.id === weapon.id)).toBe(false);
    conserved(s, [...h, weapon]);
  });

  it("Project Rebirth chooses a real draw or heals three, alter-ego only", () => {
    let s = base("vnm");
    const rebirth = put(s, "20007");
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: rebirth.id,
        action: "rebirth-draw",
      }).error,
    ).toBeTruthy();
    s.player.form = "alter";
    s.player.hp = 4;
    s = command(s, { type: "ABILITY", id: rebirth.id, action: "rebirth-heal" });
    expect(s.player.hp).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === rebirth.id)?.exhausted).toBe(
      true,
    );
  });
});

describe("Venom's villain attack interrupts and physical nemesis", () => {
  it("Spider-Sense draws an actual Tendrils before the next optional interrupt", () => {
    let s = base("vnm");
    put(s, "20009");
    const tendrils = top(s, "20003"),
      resources = hand(s, "20019");
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      /Spider-Sense/i,
    );
    expect(s.player.hand.some((p) => p.id === tendrils.id)).toBe(true);
    s = respond(s, /Grasping Tendrils/i);
    s = pay(s, resources, "physical");
    s = finish(s);
    expect(s.attack).toBeNull();
    expect(s.player.hp).toBe(12);
    expect(s.villain.stunned).toBe(true);
    conserved(s, [...resources, tendrils]);
  });

  it("Tendrils counts as a defense for Indomitable while the attack is cancelled", () => {
    let s = base("vnm");
    s.player.exhausted = true;
    const ready = put(s, "19019"),
      h = hand(s, "20003", "20018");
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      /Grasping Tendrils/i,
    );
    s = pay(s, [h[1]], "mental");
    s = finish(respond(s, /Indomitable/i, "19019"));
    expect(s.attack).toBeNull();
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hp).toBe(12);
    expect(s.villain.stunned).toBe(false);
    expect(s.player.discard.some((p) => p.id === ready.id)).toBe(true);
    conserved(s, [ready, ...h]);
  });

  it("obligation moves exactly one saved Symbiote to the first player", () => {
    let s = base("vnm", "drax");
    s.firstPlayerId = "p2";
    const setAside = [...s.player.setAside!],
      obligation = owned(s, "20023");
    s = choose(native(s, { type: "reveal", piece: obligation }), "stay");
    s = finish(choose(s, "symbiote"));
    expect(s.player.setAside).toHaveLength(4);
    expect(s.minions.filter((p) => p.code === "20025")).toHaveLength(1);
    expect(s.minions.find((p) => p.code === "20025")?.engagedWith).toBe("p2");
    expect(
      setAside.some(
        (p) => p.id === s.minions.find((p) => p.code === "20025")?.id,
      ),
    ).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
    encounterConserved(s, [...setAside, obligation]);
  });

  it("obligation TAKE2 and exhaust discards itself without removing it from the game", () => {
    let s = base("vnm");
    const obligation = owned(s, "20023");
    s = choose(native(s, { type: "reveal", piece: obligation }), "alter");
    s = finish(choose(s, "exhaust"));
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.form).toBe("alter");
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
    expect(s.removed.some((p) => p.id === obligation.id)).toBe(false);
    encounterConserved(s, [obligation]);
  });

  it("Tough hides the obligation's actual TAKE2 branch and keeps Tough untouched", () => {
    let s = base("vnm");
    s.player.form = "alter";
    s.player.tough = true;
    s = native(s, { type: "reveal", piece: owned(s, "20023") });
    expect(s.prompt?.options.some((o) => o.id === "exhaust")).toBe(false);
    s = finish(choose(s, "symbiote"));
    expect(s.player.tough).toBe(true);
    expect(s.player.hp).toBe(12);
  });

  it.each([false, true])(
    "lethal obligation TAKE2 eliminates Venom before its benefit (teammate=%s)",
    (team) => {
      let s = base("vnm", team ? "drax" : undefined);
      s.player.form = "alter";
      s.player.hp = 2;
      const obligation = owned(s, "20023"),
        setAside = [...s.player.setAside!];
      const teammate = team
        ? JSON.parse(JSON.stringify(seatView(s, "p2").player))
        : undefined;
      s = native(s, { type: "reveal", piece: obligation });
      s = finish(choose(s, "exhaust"));
      expect(s.players.find((seat) => seat.id === "p1")?.eliminated).toBe(true);
      expect(seatView(s, "p1").player.hp).toBe(0);
      expect(seatView(s, "p1").player.setAside?.map((p) => p.id)).toEqual(
        setAside.map((p) => p.id),
      );
      expect(s.minions.filter((p) => p.code === "20025")).toHaveLength(0);
      expect(s.removed.some((p) => p.id === obligation.id)).toBe(false);
      expect(s.phase).toBe(team ? "player" : "lost");
      if (team) {
        expect(seatView(s, "p2").player.hp).toBe(teammate.hp);
        expect(seatView(s, "p2").player.exhausted).toBe(teammate.exhausted);
        expect(seatView(s, "p2").player.form).toBe(teammate.form);
      }
      encounterConserved(s, [...setAside, obligation]);
    },
  );

  it("Shadows reveals all four original set-aside copies and the hazard scheme", () => {
    let s = base("vnm", "drax");
    const setAside = [...s.player.setAside!];
    s = finish(native(s, { type: "reveal", piece: owned(s, "01190") }));
    expect(s.minions.filter((p) => p.code === "20025")).toHaveLength(4);
    expect(s.sideSchemes.find((p) => p.code === "20024")?.counters).toBe(4);
    expect(s.player.setAside).toEqual([]);
    expect(
      s.minions
        .filter((p) => p.code === "20025")
        .map((p) => p.id)
        .sort(),
    ).toEqual(
      setAside
        .filter((p) => p.code === "20025")
        .map((p) => p.id)
        .sort(),
    );
    encounterConserved(s, setAside);
  });

  it("an obligation before Shadows leaves exactly three saved minions for Shadows", () => {
    let s = base("vnm");
    const setAside = [...s.player.setAside!];
    s = choose(native(s, { type: "reveal", piece: owned(s, "20023") }), "stay");
    s = finish(choose(s, "symbiote"));
    const first = s.minions[0];
    s = finish(native(s, { type: "reveal", piece: owned(s, "01190") }));
    expect(s.minions.filter((p) => p.code === "20025")).toHaveLength(4);
    expect(s.minions.filter((p) => p.id === first.id)).toHaveLength(1);
    encounterConserved(s, setAside);
  });

  it("Klyntar Frenzy stays locked until the final Symbiote enemy leaves play", () => {
    let s = base("vnm");
    const scheme = side(s, "20024", 2),
      other = side(s, "01107", 3),
      a = minion(s, "20025"),
      b = minion(s, "20025");
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt?.options.some((o) => o.id === scheme.id)).not.toBe(true);
    s = finish(target(s, other.id));
    s = finish(
      native(
        s,
        { type: "damage", target: a.id, amount: 2, source: "20008" },
        { type: "damage", target: b.id, amount: 2, source: "20008" },
      ),
    );
    s.player.exhausted = false;
    s = finish(
      target(command(s, { type: "BASIC", action: "thwart" }), scheme.id),
    );
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(1);
  });

  it("a boosted Symbiote becomes the same physical engaged minion and is not discarded at cleanup", () => {
    let s = base("vnm");
    const boost = owned(s, "20025");
    s.encounter.deck.unshift(boost);
    s = finish(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => v.prompt?.options.find((o) => o.id === "take")?.id,
    );
    expect(s.minions.find((p) => p.id === boost.id)?.engagedWith).toBe("p1");
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(false);
    encounterConserved(s, [boost]);
  });
});
