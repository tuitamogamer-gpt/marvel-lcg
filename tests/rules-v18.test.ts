import { it, expect } from "vitest";
import {
  newGame,
  dispatch,
  makePiece,
  abilityOptions,
  playable,
  paymentSources,
} from "../src/game/engine";
import { card, pieceHP, maxHP, handSize } from "../src/game/cards";
import { boardSnapshot, recordReview } from "../src/game/review";
import { activateSeat, seatView } from "../src/game/team";
import type { GameState, Command, Effect, Piece } from "../src/game/types";

// Reproductions from the core audit, checked against FFG Rules Reference 1.8.
function test(
  id: string,
  title: string,
  expected: unknown,
  fixture: () => unknown,
  pages: string,
) {
  it(`${id}: ${title}`, () => {
    expect(fixture(), `Rules Reference 1.8, p. ${pages}`).toEqual(expected);
  });
}
function send(s: GameState, c: Command) {
  const next = dispatch(s, c);
  if (next.error) throw Error(`${c.type}: ${next.error}`);
  return next;
}
function settle(s: GameState): GameState {
  for (let n = 0; n < 100 && (s.review || s.prompt); n++) {
    if (s.review) {
      s = send(s, { type: "PROCEED" });
      continue;
    }
    const p = s.prompt!;
    if (p.kind === "select")
      s = send(s, {
        type: "SELECT",
        ids: p.options.slice(0, p.min || 0).map((x) => x.id),
      });
    else if (p.kind === "payment") {
      const sources = paymentSources(s, p.card?.id, p.paymentTarget);
      let total = 0;
      const ids = [];
      for (const x of sources) {
        if (total >= (p.cost || 0)) break;
        ids.push(x.id);
        total += x.resources.length;
      }
      s = send(s, {
        type: "PAY",
        ids,
        wildAs: p.requirements?.[0] || "energy",
      });
    } else {
      const o =
        p.options.find((x) =>
          ["allow", "resolve", "take", "pass", "skip", "threat"].includes(x.id),
        ) || p.options[0];
      s = send(s, { type: "CHOOSE", id: o.id });
    }
  }
  if (s.prompt || s.review) throw Error("Fixture did not settle");
  return s;
}
function base(heroId = "spider_man", villainId = "rhino", team = false) {
  let s = newGame({
    heroId,
    villainId,
    aspect: "leadership",
    seed: 77889,
    ...(team
      ? {
          heroes: [
            { heroId, aspect: "leadership" as const },
            { heroId: "captain_marvel", aspect: "protection" as const },
          ],
        }
      : {}),
  });
  while (s.phase === "mulligan") s = send(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const p of s.players) {
    p.player.hand = [];
    p.player.inPlay = [];
    p.player.form = "hero";
  }
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.form = "hero";
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.scheme.threat = 0;
  s.queue = [];
  s.prompt = null;
  return s;
}
function effects(s: GameState, ...queue: Effect[]) {
  s.queue = queue;
  s.prompt = {
    kind: "choice",
    title: "Audit fixture",
    text: "",
    options: [{ id: "go", label: "Go", effects: [] }],
  };
  return send(s, { type: "CHOOSE", id: "go" });
}
function inPlay(s: GameState, code: string) {
  const p = makePiece(s, code);
  s.player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code: string) {
  const p = makePiece(s, code);
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  return p;
}
function attachment(s: GameState, code: string, target = s.villain.id) {
  const p = makePiece(s, code);
  p.attachedTo = target;
  s.attachments.push(p);
  return p;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((c) => makePiece(s, c));
  return s.player.hand;
}
function deck(s: GameState, ...codes: string[]) {
  s.encounter.deck = codes.map((c) => makePiece(s, c));
  s.encounter.discard = [];
}
function reveal(s: GameState, code: string) {
  s.encounter.deck.unshift(makePiece(s, code));
  return effects(s, { type: "revealNext" });
}

test(
  "K01",
  "Armored Guard receives Toughness on entry",
  true,
  () => {
    let s = base();
    s = settle(reveal(s, "01120"));
    return s.minions[0].tough;
  },
  "45",
);
test(
  "K02",
  "Quickstrike also triggers when Vulture is put into play",
  "Vulture attacks",
  () => {
    let s = base();
    deck(s, "01167", "01101");
    s = effects(s, { type: "findMinion" });
    return s.prompt?.title || null;
  },
  "18, 36",
);
test(
  "K03",
  "Minion re-entry clears old state and engages the revealing player",
  {
    damage: 0,
    stunned: false,
    confused: false,
    engagedWith: "p2",
    tough: true,
  },
  () => {
    let s = base("spider_man", "rhino", true);
    const p = minion(s, "01120");
    p.tough = false;
    p.stunned = true;
    p.confused = true;
    s = settle(effects(s, { type: "damage", target: p.id, amount: 5 }));
    const returned = s.encounter.discard.find((x) => x.id === p.id)!;
    s.encounter.discard = [];
    s.encounter.deck = [returned, makePiece(s, "01101")];
    activateSeat(s, "p2");
    s = settle(effects(s, { type: "revealNext" }));
    const x = s.minions.find((x) => x.id === p.id)!;
    return {
      damage: x.damage,
      stunned: x.stunned,
      confused: x.confused,
      engagedWith: x.engagedWith,
      tough: x.tough,
    };
  },
  "18, 27, 45",
);
test(
  "K04",
  "Tough has priority over Backflip",
  false,
  () => {
    let s = base();
    s.player.tough = true;
    hand(s, "01003");
    deck(s, "01154", "01101");
    // A zero-icon boost without an ability, so no incidental damage removes Tough.
    s.encounter.deck[0] = makePiece(s, "01193");
    s = effects(s, { type: "enemyAttack", id: "villain" });
    s = send(s, { type: "CHOOSE", id: "take" });
    return !!s.prompt?.options.some((x) => x.id === "backflip");
  },
  "41, 57",
);
test(
  "K05",
  "Retaliate still resolves when Armored Rhino Suit absorbs an attack",
  { heroHp: 9, armorDamage: 2 },
  () => {
    let s = base();
    attachment(s, "01098");
    attachment(s, "01153");
    s = settle(send(s, { type: "BASIC", action: "attack" }));
    return {
      heroHp: s.player.hp,
      armorDamage: s.attachments.find((p) => p.code === "01098")!.damage,
    };
  },
  "38",
);
test(
  "K06",
  "Guard prevents Counter-Punch targeting the villain",
  false,
  () => {
    let s = base();
    minion(s, "01101");
    hand(s, "01077");
    s = effects(s, {
      type: "defenseResponses",
      defended: true,
      attacker: "villain",
    });
    return !!s.prompt?.options.some((x) => x.id === "counter");
  },
  "10, 21",
);
test(
  "K07",
  "Confused can be cleared by a basic thwart without a target",
  { confused: false, exhausted: true, error: null },
  () => {
    let s = base();
    s.player.confused = true;
    s = dispatch(s, { type: "BASIC", action: "thwart" });
    return {
      confused: s.player.confused,
      exhausted: s.player.exhausted,
      error: s.error || null,
    };
  },
  "13",
);
test(
  "K08",
  "Tough on a minion prevents overkill from reaching the villain",
  { hp: 14, damage: 0, tough: false },
  () => {
    let s = base();
    const p = minion(s, "01101");
    p.tough = true;
    s = settle(
      effects(s, {
        type: "damage",
        target: p.id,
        amount: 5,
        attack: true,
        overkill: true,
      }),
    );
    return {
      hp: s.villain.hp,
      damage: s.minions[0].damage,
      tough: s.minions[0].tough,
    };
  },
  "31, 57",
);
test(
  "K09",
  "Normal overkill transfers only excess damage",
  12,
  () => {
    let s = base();
    const p = minion(s, "01101");
    s = settle(
      effects(s, {
        type: "damage",
        target: p.id,
        amount: 5,
        attack: true,
        overkill: true,
      }),
    );
    return s.villain.hp;
  },
  "31",
);
test(
  "K10",
  "Tough prevents consequential damage to Luke Cage",
  { damage: 0, tough: false },
  () => {
    let s = base();
    const p = inPlay(s, "01076");
    s = settle(send(s, { type: "ABILITY", id: p.id, action: "attack" }));
    const x = s.player.inPlay.find((x) => x.id === p.id)!;
    return { damage: x.damage, tough: x.tough };
  },
  "13, 44",
);
test(
  "C01",
  "A defeated ally defender redirects the remaining attack to its controller",
  7,
  () => {
    let s = base();
    const p = inPlay(s, "01002");
    p.damage = pieceHP(s, p) - 1;
    deck(s, "01154", "01101");
    s = effects(s, { type: "enemyAttack", id: "villain" });
    s = settle(send(s, { type: "CHOOSE", id: p.id }));
    return s.player.hp;
  },
  "9",
);
test(
  "C02",
  "Titania's Fury adds a boost when the villain schemes",
  4,
  () => {
    let s = base();
    s.player.form = "alter";
    deck(s, "01164", "01167", "01101");
    s = settle(effects(s, { type: "enemyScheme", id: "villain" }));
    // Rhino SCH 1 + Fury 1 + Vulture 2 = 4.
    return s.scheme.threat;
  },
  "11, 39",
);
test(
  "C03",
  "Hawkeye sees the Ultron II drone before defenders are declared",
  "Hawkeye",
  () => {
    let s = base("spider_man", "ultron");
    s.villain.code = "01135";
    s.villain.stage = 2;
    const p = inPlay(s, "01066");
    p.counters = 4;
    deck(s, "01193", "01101");
    s = effects(s, { type: "enemyAttack", id: "villain" });
    return s.prompt?.title;
  },
  "9, 25, 58",
);
test(
  "C04",
  "Focused Rage cannot pay its damage cost through Tough",
  { rejected: true, tough: true, hand: 0, exhausted: false },
  () => {
    let s = base("she_hulk");
    s.player.tough = true;
    const p = inPlay(s, "01027");
    s = dispatch(s, { type: "ABILITY", id: p.id });
    return {
      rejected: !!s.error,
      tough: s.player.tough,
      hand: s.player.hand.length,
      exhausted: s.player.inPlay[0].exhausted,
    };
  },
  "14, 57",
);
test(
  "C05",
  "An exhausted Vision can use Density Control",
  null,
  () => {
    const s = base();
    const p = inPlay(s, "01068");
    p.exhausted = true;
    return (
      abilityOptions(s, p).find((x) => x.id === "special")?.disabled || null
    );
  },
  "19; Core #68",
);
test(
  "C06",
  "Superhuman Strength stays when its target is already stunned",
  true,
  () => {
    let s = base("she_hulk");
    const p = inPlay(s, "01028");
    s.villain.stunned = true;
    s = settle(send(s, { type: "BASIC", action: "attack" }));
    return s.player.inPlay.some((x) => x.id === p.id);
  },
  "57",
);
test(
  "C07",
  "Ancestral Knowledge cannot select the event currently resolving",
  false,
  () => {
    let s = base("black_panther");
    s.player.form = "alter";
    const [p] = hand(s, "01042", "01088");
    s.player.discard = [makePiece(s, "01044")];
    s = send(s, { type: "PLAY", id: p.id });
    s = send(s, {
      type: "PAY",
      ids: [s.player.hand.find((x) => x.code === "01088")!.id],
    });
    return !!s.prompt?.options.some((x) => x.id === p.id);
  },
  "18",
);
test(
  "C08",
  "An unresolved Assault is not yet in the encounter discard pile",
  false,
  () => {
    let s = base();
    deck(s, "01101");
    s = reveal(s, "01187");
    return s.encounter.discard.some((x) => x.code === "01187");
  },
  "38, 58",
);
test(
  "C09",
  "Player deck discard stops at exhaustion",
  { deck: 11, discard: 0, encounter: 1 },
  () => {
    let s = base();
    s.player.deck = [makePiece(s, "01088")];
    s.player.discard = Array.from({ length: 10 }, () => makePiece(s, "01090"));
    s = settle(effects(s, { type: "mill", amount: 5 }));
    return {
      deck: s.player.deck.length,
      discard: s.player.discard.length,
      encounter: s.encounter.dealt.length,
    };
  },
  "33",
);
test(
  "C10",
  "Encounter discard-until stops at exhaustion",
  0,
  () => {
    let s = base();
    deck(s, "01191");
    s.encounter.discard = [makePiece(s, "01101")];
    s = settle(effects(s, { type: "findMinion" }));
    return s.minions.length;
  },
  "17",
);
test(
  "C11",
  "Futurist only looks at the available cards and does not mill into a new deck",
  1,
  () => {
    let s = base("iron_man");
    s.player.form = "alter";
    s.player.deck = [makePiece(s, "01088")];
    s.player.discard = [
      makePiece(s, "01089"),
      makePiece(s, "01090"),
      makePiece(s, "01044"),
    ];
    s = send(s, { type: "ABILITY", id: "identity" });
    return s.prompt?.options.length;
  },
  "27, 33; Core #29B",
);
test(
  "C12",
  "Losing Triskelion rechecks the ally limit",
  "Ally limit",
  () => {
    let s = base();
    const p = inPlay(s, "01073");
    for (const c of ["01002", "01051", "01058", "01068"]) inPlay(s, c);
    s = effects(s, { type: "discardPiece", id: p.id });
    return s.prompt?.title || null;
  },
  "7",
);
test(
  "C13",
  "Spider-Tracer has no one-per-minion restriction",
  2,
  () => {
    let s = base();
    const m = minion(s, "01101");
    const a = inPlay(s, "01007"),
      b = inPlay(s, "01007");
    a.attachedTo = m.id;
    s = settle(effects(s, { type: "attachPlayer", id: b.id, target: m.id }));
    return s.player.inPlay.filter(
      (p) => p.code === "01007" && p.attachedTo === m.id,
    ).length;
  },
  "14; Core #7",
);
test(
  "C14",
  "Legal Practice requires its additional discard cost even when confused",
  "Legal Practice",
  () => {
    let s = base("she_hulk");
    s.player.form = "alter";
    s.player.confused = true;
    s.scheme.threat = 2;
    const [p] = hand(s, "01023", "01088");
    s = send(s, { type: "PLAY", id: p.id });
    return s.prompt?.title || null;
  },
  "13, 14",
);
test(
  "C15",
  "Sweeping Swoop cannot stun an alter-ego with 'your hero'",
  false,
  () => {
    let s = base();
    s.player.form = "alter";
    s = settle(reveal(s, "01168"));
    return s.player.stunned;
  },
  "21; Core #168",
);
test(
  "C16",
  "Under Attack cannot offer hero-only damage to an alter-ego",
  false,
  () => {
    let s = base();
    s.player.form = "alter";
    s = reveal(s, "01151");
    return !!s.prompt?.options.some((x) => x.id === "damage");
  },
  "12, 21; Core #151",
);
test(
  "C17",
  "A stunned Titania triggers Fury's fallback heal and Surge",
  0,
  () => {
    let s = base();
    const p = minion(s, "01162");
    p.damage = 3;
    p.stunned = true;
    deck(s, "01105", "01101");
    s = settle(reveal(s, "01164"));
    return s.minions.find((x) => x.id === p.id)!.damage;
  },
  "41; Core #164",
);
test(
  "C18",
  "A stunned drone causes Swarm Attack's no-attack fallback",
  2,
  () => {
    let s = base("spider_man", "ultron");
    const p = minion(s, "drone");
    p.stunned = true;
    s = settle(reveal(s, "01147"));
    return s.minions.length;
  },
  "41; Core #147",
);
test(
  "C19",
  "Enhanced Spider-Sense can cancel a teammate's treachery",
  true,
  () => {
    let s = base("spider_man", "rhino", true);
    hand(s, "01004", "01088");
    activateSeat(s, "p2");
    s = reveal(s, "01105");
    return !!s.prompt?.options.some((x) => x.id === "01004:p1");
  },
  "25; Core #4",
);
test(
  "C20",
  "I Object can interrupt additional When Revealed side-scheme threat",
  "Threat incoming",
  () => {
    let s = base("she_hulk");
    s.player.form = "alter";
    s = reveal(s, "01107");
    return s.prompt?.title || null;
  },
  "57; Core #107",
);
test(
  "S01",
  "Surge in the player phase deals rather than immediately reveals a card",
  { dealt: 1, tough: false },
  () => {
    let s = base();
    deck(s, "01105", "01101");
    s = settle(reveal(s, "01191"));
    return { dealt: s.encounter.dealt.length, tough: s.villain.tough };
  },
  "42; FFG Mission Updates",
);
test(
  "S02",
  "Enhanced Spider-Sense cancels Surge's When Revealed ability in 1.8",
  false,
  () => {
    let s = base();
    hand(s, "01004", "01088");
    deck(s, "01105", "01101");
    s = reveal(s, "01191");
    s = send(s, { type: "CHOOSE", id: "01004" });
    s = settle(
      send(s, {
        type: "PAY",
        ids: [s.player.hand.find((p) => p.code === "01088")!.id],
      }),
    );
    return s.villain.tough || s.encounter.dealt.length > 0;
  },
  "42",
);
test(
  "S03",
  "Surge waits behind encounter cards already dealt",
  ["01191", "01112", "01105"],
  () => {
    let s = base();
    s.phase = "villain";
    deck(s, "01105", "01101");
    s.encounter.dealt = [makePiece(s, "01191"), makePiece(s, "01112")];
    s.encounter.dealt.forEach((p) => (p.dealtTo = "p1"));
    s.log = [];
    s = settle(effects(s, { type: "revealDealt" }));
    const titles = s.log
      .filter((x) => x.text.startsWith("Encounter:"))
      .map((x) => x.text);
    return titles.map((t) =>
      ["01191", "01112", "01105"].find(
        (c) => t === `Encounter: ${card(c).name}.`,
      ),
    );
  },
  "38, 42; FFG Mission Updates",
);
test(
  "P01",
  "Superhuman Law Division errata does not remove Confused",
  { threat: 1, confused: true },
  () => {
    let s = base("she_hulk");
    s.player.form = "alter";
    s.player.confused = true;
    s.scheme.threat = 3;
    const p = inPlay(s, "01026");
    hand(s, "01089");
    s = send(s, { type: "ABILITY", id: p.id });
    s = settle(send(s, { type: "PAY", ids: [s.player.hand[0].id] }));
    return { threat: s.scheme.threat, confused: s.player.confused };
  },
  "65",
);
test(
  "P02",
  "Pepper Potts does not double Power-of resources",
  1,
  () => {
    const s = base("iron_man");
    const p = inPlay(s, "01033");
    s.player.discard = [makePiece(s, "01055")];
    return paymentSources(s, undefined, "01054").find((x) => x.id === p.id)!
      .resources.length;
  },
  "58",
);
test(
  "P03",
  "Pepper Potts copies two printed resources",
  2,
  () => {
    const s = base("iron_man");
    const p = inPlay(s, "01033");
    s.player.discard = [makePiece(s, "01088")];
    return paymentSources(s).find((x) => x.id === p.id)!.resources.length;
  },
  "57",
);
test(
  "P04",
  "Guard permits non-attack damage to the villain",
  13,
  () => {
    let s = base();
    minion(s, "01101");
    s = settle(effects(s, { type: "damage", target: "villain", amount: 1 }));
    return s.villain.hp;
  },
  "21",
);
test(
  "P05",
  "Stunned takes priority over Webbed Up",
  { stunned: false, webbed: true },
  () => {
    let s = base();
    const p = inPlay(s, "01009");
    p.attachedTo = "villain";
    s.villain.stunned = true;
    s = settle(effects(s, { type: "enemyAttack", id: "villain" }));
    return {
      stunned: s.villain.stunned,
      webbed: s.player.inPlay.some((x) => x.id === p.id),
    };
  },
  "41, 57",
);
test(
  "P06",
  "Core-only Iron Man reaches seven cards from six Tech upgrades",
  7,
  () => {
    const s = base("iron_man");
    for (const c of ["01035", "01036", "01037", "01038", "01038", "01039"])
      inPlay(s, c);
    return handSize(s);
  },
  "65",
);

test(
  "K11",
  "Luke Cage regains Toughness when played after leaving play",
  true,
  () => {
    let s = base();
    const p = inPlay(s, "01076");
    p.tough = false;
    s = settle(effects(s, { type: "discardPiece", id: p.id }));
    const returned = s.player.discard.find((x) => x.id === p.id)!;
    s.player.discard = s.player.discard.filter((x) => x.id !== p.id);
    s.player.hand = [returned, makePiece(s, "01088"), makePiece(s, "01089")];
    s = settle(send(s, { type: "PLAY", id: returned.id }));
    return s.player.inPlay.find((x) => x.id === p.id)!.tough;
  },
  "27, 45",
);
test(
  "K12",
  "Retaliate survives Biomechanical Upgrades preventing defeat",
  8,
  () => {
    let s = base();
    const p = minion(s, "01184");
    p.damage = pieceHP(s, p) - 1;
    attachment(s, "01185", p.id);
    s = settle(
      effects(s, { type: "damage", target: p.id, amount: 2, attack: true }),
    );
    return s.player.hp;
  },
  "38; Core #184-185",
);
test(
  "C21",
  "Removing Upgraded Drones immediately defeats a drone with lethal damage",
  0,
  () => {
    let s = base("spider_man", "ultron");
    const a = attachment(s, "01142");
    const p = minion(s, "drone");
    p.damage = 1;
    s = settle(effects(s, { type: "discardPiece", id: a.id }));
    return s.minions.length;
  },
  "15, 22; Core #142",
);
test(
  "C22",
  "A defeated Black Panther does not retaliate while teammates continue",
  28,
  () => {
    let s = base("black_panther", "rhino", true);
    s.player.hp = 1;
    deck(s, "01105", "01101");
    s = effects(s, { type: "enemyAttack", id: "villain" });
    s = settle(send(s, { type: "CHOOSE", id: "take" }));
    return s.villain.hp;
  },
  "34, 38",
);
test(
  "C23",
  "Ultron II attack tracks a drone added by a boost",
  6,
  () => {
    let s = base("spider_man", "ultron");
    s.villain.code = "01135";
    s.villain.stage = 2;
    deck(s, "01144a", "01101");
    s = effects(s, { type: "enemyAttack", id: "villain" });
    s = send(s, { type: "CHOOSE", id: "take" });
    s = send(s, { type: "CHOOSE", id: "drone" });
    s = settle(s);
    return s.player.hp;
  },
  "9, 58",
);
test(
  "C24",
  "Cosmic Flight can interrupt non-attack damage",
  true,
  () => {
    let s = base("captain_marvel");
    inPlay(s, "01017");
    s = effects(s, { type: "damage", target: "hero", amount: 2 });
    return !!s.prompt?.options.some(
      (x) => x.id === "flight" || x.image === "01017",
    );
  },
  "16; Core #17",
);
test(
  "C25",
  "Crisis Interdiction does not resolve 'then' after only removing one of two threat",
  3,
  () => {
    let s = base("captain_marvel");
    inPlay(s, "01017");
    s.scheme.threat = 1;
    const p = makePiece(s, "01107");
    p.counters = 3;
    s.sideSchemes.push(p);
    s = settle(effects(s, { type: "crisisInterdiction", target: "main" }));
    return s.sideSchemes[0].counters;
  },
  "44; Core #12",
);
test(
  "C26",
  "First Aid can target a damaged enemy",
  true,
  () => {
    let s = base();
    s.villain.hp = 10;
    const ally = inPlay(s, "01002");
    ally.damage = 1;
    const [p, pay] = hand(s, "01086", "01088");
    s = send(s, { type: "PLAY", id: p.id });
    s = send(s, { type: "PAY", ids: [pay.id] });
    return !!s.prompt?.options.some((x) => x.id === "villain");
  },
  "12; Core #86",
);
test(
  "P07",
  "A final Uses counter discards Tac Team but still resolves its damage",
  { inPlay: false, villain: 12 },
  () => {
    let s = base();
    const p = inPlay(s, "01056");
    p.counters = 1;
    s = settle(send(s, { type: "ABILITY", id: p.id }));
    return {
      inPlay: s.player.inPlay.some((x) => x.id === p.id),
      villain: s.villain.hp,
    };
  },
  "46; Core #56",
);
test(
  "P08",
  "Tigra heals before consequential damage",
  1,
  () => {
    let s = base();
    const p = inPlay(s, "01051");
    p.damage = 1;
    const m = minion(s, "01101");
    m.damage = 2;
    s = settle(send(s, { type: "ABILITY", id: p.id, action: "attack" }));
    return s.player.inPlay.find((x) => x.id === p.id)!.damage;
  },
  "58",
);
test(
  "P09",
  "Energy Daggers deals non-attack damage without clearing Stunned",
  { villain: 12, stunned: true },
  () => {
    let s = base("black_panther");
    const p = inPlay(s, "01046");
    s.player.stunned = true;
    s = settle(effects(s, { type: "pantherSpecial", id: p.id, final: true }));
    return { villain: s.villain.hp, stunned: s.player.stunned };
  },
  "26; Core #46",
);
test(
  "P10",
  "Make the Call can use doubled Power of Leadership to pay for Maria Hill",
  true,
  () => {
    let s = base();
    s.player.discard = [makePiece(s, "01067")];
    const [p] = hand(s, "01071", "01072");
    s = settle(send(s, { type: "PLAY", id: p.id }));
    return s.player.inPlay.some((x) => x.code === "01067");
  },
  "58",
);

it("Legal Practice pays at least one additional card before Confused cancels the thwart", () => {
  let s = base("she_hulk");
  s.player.form = "alter";
  s.player.confused = true;
  s.scheme.threat = 3;
  const [event, resource] = hand(s, "01023", "01088");
  s = send(s, { type: "PLAY", id: event.id });
  expect(s.prompt?.min).toBe(1);
  expect(dispatch(s, { type: "SELECT", ids: [] }).error).toBeTruthy();
  s = send(s, { type: "SELECT", ids: [resource.id] });
  expect(s.player.confused).toBe(false);
  expect(s.scheme.threat).toBe(3);
  expect(s.player.hand).toHaveLength(0);
  expect(s.player.discard.map((p) => p.id)).toEqual([resource.id, event.id]);
  expect(s.resolving).toHaveLength(0);
});
it("Legal Practice cannot be initiated without its additional discard cost", () => {
  const s = base("she_hulk");
  s.player.form = "alter";
  s.player.confused = true;
  const [p] = hand(s, "01023");
  expect(dispatch(s, { type: "PLAY", id: p.id }).error).toMatch(/at least one/);
});
it("a resolving event stays out of the discard across a saved choice and finishes once", () => {
  let s = base("black_panther");
  s.player.form = "alter";
  const [event, resource] = hand(s, "01042", "01088");
  const chosen = makePiece(s, "01044");
  s.player.discard = [chosen];
  s = send(s, { type: "PLAY", id: event.id });
  s = send(s, { type: "PAY", ids: [resource.id] });
  expect(s.resolving.map((p) => p.id)).toEqual([event.id]);
  s = send(JSON.parse(JSON.stringify(s)), { type: "SELECT", ids: [chosen.id] });
  expect(s.player.deck.filter((p) => p.id === chosen.id)).toHaveLength(1);
  expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
  expect(s.resolving).toHaveLength(0);
});
it("Assault is discarded only after its nested attack, even when the encounter deck empties", () => {
  let s = base();
  deck(s, "01105");
  s.encounter.discard = [makePiece(s, "01112")];
  s = reveal(s, "01187");
  const assault = s.resolving.find((p) => p.code === "01187")!;
  expect(assault).toBeTruthy();
  expect(s.encounter.deck.some((p) => p.id === assault.id)).toBe(false);
  s = settle(
    send(JSON.parse(JSON.stringify(s)), { type: "CHOOSE", id: "take" }),
  );
  expect(s.encounter.discard.filter((p) => p.id === assault.id)).toHaveLength(
    1,
  );
  expect(s.resolving).toHaveLength(0);
});
it("Futurist keeps the looked-at cards in the deck until the choice, then conserves every card", () => {
  let s = base("iron_man");
  s.player.form = "alter";
  const chosen = makePiece(s, "01088"),
    old = makePiece(s, "01090");
  s.player.deck = [chosen];
  s.player.discard = [old];
  s = send(s, { type: "ABILITY", id: "identity" });
  expect(s.player.deck.map((p) => p.id)).toEqual([chosen.id]);
  expect(s.encounter.dealt).toHaveLength(0);
  s = send(JSON.parse(JSON.stringify(s)), { type: "CHOOSE", id: chosen.id });
  expect(s.player.hand.map((p) => p.id)).toEqual([chosen.id]);
  expect(s.player.deck.map((p) => p.id)).toEqual([old.id]);
  expect(s.player.discard).toHaveLength(0);
  expect(s.encounter.dealt).toHaveLength(1);
});
it("Black Cat cannot duplicate a discarded mental card already shuffled into a new deck", () => {
  let s = base();
  const cat = inPlay(s, "01002");
  const mental = makePiece(s, "01089");
  s.player.deck = [mental];
  s.player.discard = [];
  s = settle(effects(s, { type: "allyEnter", id: cat.id }));
  const copies = [
    ...s.player.deck,
    ...s.player.hand,
    ...s.player.discard,
  ].filter((p) => p.id === mental.id);
  expect(copies).toHaveLength(1);
});
it("discarding a player's last card stops and reshuffles, while drawing continues", () => {
  let s = base();
  s.player.deck = [makePiece(s, "01088")];
  s.player.discard = [makePiece(s, "01090"), makePiece(s, "01089")];
  s = settle(effects(s, { type: "draw", amount: 2 }));
  expect(s.player.hand).toHaveLength(2);
  expect(s.player.deck).toHaveLength(1);
  expect(s.encounter.dealt).toHaveLength(1);
});
it("losing Triskelion lets the player select an ally and then resumes without a limit loop", () => {
  let s = base();
  const support = inPlay(s, "01073");
  const allies = ["01002", "01051", "01058", "01068"].map((c) => inPlay(s, c));
  s = effects(s, { type: "discardPiece", id: support.id });
  s = send(JSON.parse(JSON.stringify(s)), { type: "CHOOSE", id: allies[2].id });
  expect(s.player.inPlay).toHaveLength(3);
  expect(s.player.discard.some((p) => p.id === allies[2].id)).toBe(true);
  expect(s.prompt).toBeNull();
  expect(s.queue).toHaveLength(0);
});
it("two Spider-Tracers each remove threat when their minion is defeated", () => {
  let s = base();
  s.scheme.threat = 6;
  const m = minion(s, "01101");
  for (let n = 0; n < 2; n++) inPlay(s, "01007").attachedTo = m.id;
  s = settle(effects(s, { type: "damage", target: m.id, amount: 3 }));
  expect(s.scheme.threat).toBe(0);
  expect(s.player.discard.filter((p) => p.code === "01007")).toHaveLength(2);
});
it("Quickstrike occurs before the optional Hawkeye response and does not trigger in alter-ego", () => {
  let s = base();
  inPlay(s, "01066").counters = 4;
  deck(s, "01167", "01105");
  s = effects(s, { type: "findMinion" });
  expect(s.prompt?.title).toBe("Vulture attacks");
  s = send(s, { type: "CHOOSE", id: "take" });
  expect(s.player.hp).toBe(7);
  expect(s.prompt?.title).toBe("Hawkeye");
  let alter = base();
  alter.player.form = "alter";
  deck(alter, "01167", "01105");
  alter = settle(effects(alter, { type: "findMinion" }));
  expect(alter.player.hp).toBe(10);
});
it("Hawkeye waits until a revealed Hydra Bomber's When Revealed choice finishes", () => {
  let s = base();
  inPlay(s, "01066").counters = 4;
  s = reveal(s, "01110");
  expect(s.prompt?.title).toBe("Hydra Bomber");
  s = send(s, { type: "CHOOSE", id: "damage" });
  expect(s.player.hp).toBe(8);
  expect(s.prompt?.title).toBe("Hawkeye");
});
it("Cosmic Flight prevents non-attack damage and remains optional", () => {
  let s = base("captain_marvel");
  const flight = inPlay(s, "01017");
  const hp = s.player.hp;
  s = effects(s, { type: "damage", target: "hero", amount: 4 });
  s = send(s, { type: "CHOOSE", id: "flight" });
  expect(s.player.hp).toBe(hp - 1);
  expect(s.player.discard.some((p) => p.id === flight.id)).toBe(true);
});
it("Tough prevents non-attack damage before Cosmic Flight can be spent", () => {
  let s = base("captain_marvel");
  const flight = inPlay(s, "01017");
  s.player.tough = true;
  s = effects(s, { type: "damage", target: "hero", amount: 4 });
  expect(s.prompt).toBeNull();
  expect(s.player.hp).toBe(maxHP(s));
  expect(s.player.tough).toBe(false);
  expect(s.player.inPlay.some((p) => p.id === flight.id)).toBe(true);
});
it("retaliate resolves before consequential damage to an attacking Tough ally", () => {
  let s = base();
  const luke = inPlay(s, "01076");
  const enemy = minion(s, "01184");
  s = send(s, { type: "ABILITY", id: luke.id, action: "attack" });
  s = settle(send(s, { type: "CHOOSE", id: enemy.id }));
  // Retaliate 2 removes Tough; only the subsequent consequential damage is taken.
  expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(2);
  expect(s.player.inPlay.find((p) => p.id === luke.id)).toMatchObject({
    damage: 1,
    tough: false,
  });
});
it("a minion saved by Biomechanical Upgrades takes no overkill and still retaliates", () => {
  let s = base();
  const enemy = minion(s, "01184");
  enemy.damage = pieceHP(s, enemy) - 1;
  attachment(s, "01185", enemy.id);
  s = settle(
    effects(s, {
      type: "damage",
      target: enemy.id,
      amount: 5,
      attack: true,
      overkill: true,
    }),
  );
  expect(s.villain.hp).toBe(14);
  expect(s.player.hp).toBe(8);
  expect(s.minions[0].damage).toBe(0);
});
it("a stunned minion-only attack can be paid even without any minions", () => {
  let s = base();
  s.player.stunned = true;
  const [event] = hand(s, "01053", "01088");
  s = settle(send(s, { type: "PLAY", id: event.id }));
  expect(s.player.stunned).toBe(false);
  expect(s.villain.hp).toBe(14);
});
it("a stunned Counter-Punch can clear Stunned even when Guard prevents hitting the attacker", () => {
  let s = base();
  minion(s, "01101");
  const [counter] = hand(s, "01077");
  s.player.stunned = true;
  s = effects(s, {
    type: "defenseResponses",
    defended: true,
    attacker: "villain",
  });
  s = settle(send(s, { type: "CHOOSE", id: "counter" }));
  expect(s.player.stunned).toBe(false);
  expect(s.villain.hp).toBe(14);
  expect(s.player.discard.some((p) => p.id === counter.id)).toBe(true);
});
it("Enhanced Spider-Sense is paid by its controller and cancels another hero's treachery", () => {
  let s = base("spider_man", "rhino", true);
  const [interrupt, resource] = hand(s, "01004", "01088");
  activateSeat(s, "p2");
  s = reveal(s, "01105");
  s = send(s, { type: "CHOOSE", id: "01004:p1" });
  s = send(s, { type: "PAY", ids: [resource.id] });
  expect(s.villain.tough).toBe(false);
  expect(seatView(s, "p1").player.discard.map((p) => p.id)).toEqual([
    resource.id,
    interrupt.id,
  ]);
  expect(s.encounter.discard.filter((p) => p.code === "01105")).toHaveLength(1);
});
it("a stunned Titania heals and deals exactly one Surge encounter without revealing it", () => {
  let s = base();
  const m = minion(s, "01162");
  m.damage = 3;
  m.stunned = true;
  deck(s, "01105", "01101");
  s = settle(reveal(s, "01164"));
  expect(s.minions[0]).toMatchObject({ damage: 0, stunned: false });
  expect(s.encounter.dealt.map((p) => p.code)).toEqual(["01105"]);
  expect(s.villain.tough).toBe(false);
});
it("Masters of Mayhem uses its fallback when every attempted attack is stunned", () => {
  let s = base();
  const m = minion(s, "01129");
  m.stunned = true;
  deck(s, "01130", "01105");
  s = settle(reveal(s, "01133"));
  expect(s.minions.map((p) => p.code)).toEqual(["01129", "01130"]);
  expect(s.minions[0].stunned).toBe(false);
});
it("I Object changes only additional side-scheme threat, not the initial threat", () => {
  let s = base("she_hulk");
  s.player.form = "alter";
  s = reveal(s, "01107");
  const initial = card("01107").base_threat!;
  expect(s.sideSchemes[0].counters).toBe(initial);
  const objection = s.prompt!.options.find((p) => p.id.startsWith("object"))!;
  s = settle(send(s, { type: "CHOOSE", id: objection.id }));
  expect(s.sideSchemes[0].counters).toBe(initial);
});
it("First Aid actually heals an enemy selected by the player", () => {
  let s = base();
  s.villain.hp = 10;
  const [event, resource] = hand(s, "01086", "01088");
  s = send(s, { type: "PLAY", id: event.id });
  s = send(s, { type: "PAY", ids: [resource.id] });
  s = send(s, { type: "CHOOSE", id: "villain" });
  expect(s.villain.hp).toBe(12);
  expect(s.resolving).toHaveLength(0);
});
it("Crisis Interdiction applies its Aerial bonus after a full two-threat removal", () => {
  let s = base("captain_marvel");
  inPlay(s, "01017");
  s.scheme.threat = 2;
  const side = makePiece(s, "01107");
  side.counters = 3;
  s.sideSchemes.push(side);
  s = settle(effects(s, { type: "crisisInterdiction", target: "main" }));
  expect(s.scheme.threat).toBe(0);
  expect(s.sideSchemes[0].counters).toBe(1);
});
it("Under Fire reveals its explicit encounter immediately and deals Surge separately", () => {
  let s = base();
  deck(s, "01105", "01112", "01101");
  s = reveal(s, "01193");
  expect(s.prompt?.options.map((p) => p.id)).toEqual([
    "text-first",
    "surge-first",
  ]);
  s = settle(send(s, { type: "CHOOSE", id: "text-first" }));
  expect(s.villain.tough).toBe(true);
  expect(s.player.confused).toBe(false);
  expect(s.encounter.dealt.map((p) => p.code)).toEqual(["01112"]);
});
it("the player may resolve Under Fire's Surge before its other When Revealed ability", () => {
  let s = base();
  deck(s, "01105", "01112", "01101");
  s = reveal(s, "01193");
  s = settle(send(s, { type: "CHOOSE", id: "surge-first" }));
  expect(s.villain.tough).toBe(false);
  expect(s.player.confused).toBe(true);
  expect(s.encounter.dealt.map((p) => p.code)).toEqual(["01105"]);
});
it("Ultron II counts the original player's drones when a teammate defends", () => {
  let s = base("spider_man", "ultron", true);
  s.villain.code = "01135";
  s.villain.stage = 2;
  deck(s, "01144a", "01101");
  s = effects(s, { type: "enemyAttack", id: "villain" });
  s = send(s, { type: "CHOOSE", id: "hero:p2" });
  s = settle(send(s, { type: "CHOOSE", id: "drone" }));
  expect(s.minions.filter((p) => p.engagedWith === "p1")).toHaveLength(1);
  expect(s.minions.filter((p) => p.engagedWith === "p2")).toHaveLength(1);
  expect(seatView(s, "p2").player.hp).toBe(10); // 3 ATK - Captain Marvel's 1 DEF
});
it("a teammate's defeated ally redirects the attack to that ally's controller", () => {
  let s = base("spider_man", "rhino", true);
  activateSeat(s, "p2");
  const cat = inPlay(s, "01002");
  cat.damage = pieceHP(s, cat) - 1;
  activateSeat(s, "p1");
  deck(s, "01154", "01101");
  s = effects(s, { type: "enemyAttack", id: "villain" });
  s = settle(send(s, { type: "CHOOSE", id: cat.id }));
  expect(seatView(s, "p1").player.hp).toBe(10);
  expect(seatView(s, "p2").player.hp).toBe(9);
});
it("Titania's extra scheme boost waits for its first boost ability before discarding either card", () => {
  let s = base();
  s.player.form = "alter";
  s.guided = true;
  deck(s, "01164", "01167", "01101");
  s = effects(s, { type: "enemyScheme", id: "villain" });
  for (let n = 0; n < 10 && s.review?.title !== "Reveal scheme boost"; n++)
    s = send(s, { type: "PROCEED" });
  expect(s.review?.cards).toContainEqual(
    expect.objectContaining({ code: "01164", kind: "boost" }),
  );
  expect(s.encounter.discard.some((p) => p.code === "01164")).toBe(false);
  s = settle(JSON.parse(JSON.stringify(s)));
  expect(s.scheme.threat).toBe(4);
  expect(s.encounter.discard.map((p) => p.code)).toEqual(["01164", "01167"]);
  expect(s.scheming).toBeUndefined();
  expect(s.resolving).toHaveLength(0);
});
it("boost cards are dealt face down before defense and remain hidden in the review", () => {
  let s = base();
  deck(s, "01103", "01105");
  s = effects(s, { type: "enemyAttack", id: "villain" });
  expect(s.attack?.pendingBoosts?.map((p) => p.code)).toEqual(["01103"]);
  expect(s.encounter.deck[0].code).toBe("01105");
  const before = boardSnapshot(s);
  s.guided = true;
  recordReview(s, before, { type: "prepareAttackBoosts" });
  expect(s.review).toBeNull();
  expect(before.locations[s.attack!.pendingBoosts![0].id].visible).toBe(false);
});
it("a settled obligation is removed once and never also discarded", () => {
  let s = base();
  s = reveal(s, "01165");
  s = settle(send(s, { type: "CHOOSE", id: "resolve" }));
  expect(s.removed.filter((p) => p.code === "01165")).toHaveLength(1);
  expect(s.encounter.discard.some((p) => p.code === "01165")).toBe(false);
  expect(s.resolving).toHaveLength(0);
});
it("Iron Man's current text caps the bonus at six and original Surge reminders are updated", () => {
  expect(card("01029a").text).toContain("maximum of +6 hand size");
  expect(card("01029a").errata?.reference).toContain("1.8");
  expect(card("01121").text).toContain(
    "deal yourself 1 facedown encounter card",
  );
  expect(card("01121").text).not.toContain("reveal 1 additional");
});

it("the final dynamic attack calculation pauses before applying damage", () => {
  let s = base("spider_man", "ultron");
  s.villain.code = "01135";
  s.villain.stage = 2;
  deck(s, "01144a", "01101");
  s = effects(s, { type: "enemyAttack", id: "villain" });
  s = send(s, { type: "CHOOSE", id: "take" });
  s.guided = true;
  s = send(s, { type: "CHOOSE", id: "drone" });
  for (
    let n = 0;
    n < 20 && s.review?.title !== "Prevent damage or resolve the attack";
    n++
  )
    s = send(s, { type: "PROCEED" });
  expect(s.review?.calculation?.total).toBe(4);
  expect(s.player.hp).toBe(10);
  s = send(JSON.parse(JSON.stringify(s)), { type: "PROCEED" });
  expect(s.player.hp).toBe(6);
});
it("scheme math uses threat units and waits for Proceed before placing any threat", () => {
  let s = base();
  s.player.form = "alter";
  s.guided = true;
  deck(s, "01164", "01167", "01101");
  s = effects(s, { type: "enemyScheme", id: "villain" });
  for (let n = 0; n < 20 && s.review?.title !== "Calculate scheme threat"; n++)
    s = send(s, { type: "PROCEED" });
  expect(s.review?.calculation).toMatchObject({ unit: "threat", total: 4 });
  expect(s.scheme.threat).toBe(0);
  s = send(JSON.parse(JSON.stringify(s)), { type: "PROCEED" });
  expect(s.scheme.threat).toBe(4);
});
it("legacy saved attacks still consume their queued boost and apply damage exactly once", () => {
  let s = base();
  deck(s, "01167", "01101");
  s.attack = {
    attacker: "villain",
    base: 3,
    boostCodes: ["01164"],
    boostEffects: [],
    defender: "none",
    defense: 0,
    prevented: 0,
    damage: 0,
    overkill: false,
    isVillain: true,
  };
  s = settle(
    effects(
      JSON.parse(JSON.stringify(s)),
      { type: "revealBoost" },
      { type: "damageWindow" },
    ),
  );
  expect(s.player.hp).toBe(5);
  expect(s.resolving).toHaveLength(0);
  expect(s.encounter.discard.map((p) => p.code)).toEqual(["01167"]);
});

it("Get Behind Me remains resolving throughout its villain attack and is discarded once afterward", () => {
  let s = base();
  const [event, resource] = hand(s, "01078", "01088");
  deck(s, "01105", "01101");
  s = reveal(s, "01112");
  s = send(s, { type: "CHOOSE", id: "01078" });
  s = send(s, { type: "PAY", ids: [resource.id] });
  expect(s.prompt?.title).toBe("Rhino attacks");
  expect(s.player.discard.some((p) => p.id === event.id)).toBe(false);
  expect(s.resolving.some((p) => p.id === event.id)).toBe(true);
  s = settle(
    send(JSON.parse(JSON.stringify(s)), { type: "CHOOSE", id: "take" }),
  );
  expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
  expect(s.resolving).toHaveLength(0);
});
it("an empty player deck resets as soon as a resolving event reaches its discard pile", () => {
  let s = base();
  s.player.deck = [];
  s.player.discard = [];
  const p = makePiece(s, "01042");
  s.resolving = [p];
  s = settle(effects(s, { type: "finishResolution", id: p.id }));
  expect(s.player.deck.map((p) => p.code)).toEqual(["01042"]);
  expect(s.player.discard).toHaveLength(0);
  expect(s.encounter.dealt).toHaveLength(1);
});
