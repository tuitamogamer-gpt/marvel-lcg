import { thorStats } from "./thor.js";
import { blackWidowStats } from "./black-widow.js";
import {
  doctorStrangeHandSize,
  doctorStrangeStats,
  doctorStrangeTraits,
} from "./doctor-strange.js";
import { expansionErrata } from "./expansion-errata.js";
import { msMarvelStats } from "./ms-marvel.js";
import { identityMatch } from "./unique.js";
import { rulesCode } from "./rules-code.js";
import { captainStats } from "./captain-america.js";
import { hulkStats } from "./hulk.js";
import { captainPackModifiers, captainPackStats } from "./captain-pack.js";
import { scriptedModifier } from "./script-registry.js";
import playerData from "../data/core-player.json" with { type: "json" };
import encounterData from "../data/core-encounter.json" with { type: "json" };
import errata from "../data/core-errata.json" with { type: "json" };
import catalogData from "../data/catalog-cards.json" with { type: "json" };
import catalogImages from "../data/catalog-images.json" with { type: "json" };
import type { Aspect, Card, GameState, Piece, Resource } from "./types.js";
// Keep the downloaded snapshots intact; official corrections survive data syncs.
export const CARDS = ([...playerData, ...encounterData] as Card[]).map((c) => {
  const correction = errata.find((e) => e.code === c.code);
  if (correction)
    return {
      ...c,
      text: correction.text,
      errata: { reference: correction.reference, url: correction.url },
    };
  const text = c.text?.replace(
    /(Surge\.? )<i>\([^<]*additional encounter card[^<]*\)<\/i>/,
    "$1<i>(When revealed, deal yourself 1 facedown encounter card.)</i>",
  );
  return text !== c.text
    ? {
        ...c,
        text,
        errata: {
          reference: "FFG Rules Reference 1.8, p. 42",
          url: errata[0].url.replace("#page=65", "#page=42"),
        },
      }
    : c;
});
/** Read-only collection: imported cards do not gain rules handlers by being in the database. */
export const CATALOG_CARDS = [
  ...CARDS,
  ...(catalogData as Card[])
    .map(expansionErrata)
    .filter((c) => !CARDS.some((core) => core.code === c.code)),
];
export const DB = Object.fromEntries(
  CATALOG_CARDS.map((c) => [c.code, c]),
) as Record<string, Card>;
DB.drone = {
  code: "drone",
  name: "Ultron Drone",
  type_code: "minion",
  faction_code: "encounter",
  quantity: 1,
  position: 0,
  attack: 1,
  scheme: 1,
  health: 1,
  traits: "Drone.",
  text: "Facedown card from your deck. When defeated, return it to your discard pile.",
};
export const card = (piece: Piece | string) =>
  DB[typeof piece === "string" ? piece : piece.code];
export const plain = (text = "") =>
  text
    .replace(/<[^>]*>/g, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\[per_hero\]/g, "per player");
const missingArtwork = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="419" viewBox="0 0 300 419"><rect width="300" height="419" rx="8" fill="#e8ece9"/><rect x="12" y="12" width="276" height="395" rx="6" fill="none" stroke="#a9b8be"/><text x="150" y="201" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#173657">Artwork unavailable</text><text x="150" y="225" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#45596b">Open card details to read the card</text></svg>')}`;
const coreImageCodes = new Set(CARDS.map((c) => c.code));
export const imageFor = (code: string) =>
  code === "drone"
    ? "/art/player-back.svg"
    : coreImageCodes.has(code)
      ? `/cards/${code}.png`
      : (catalogImages as Record<string, string>)[code] || missingArtwork;
export const CORE_HEROES = [
  {
    id: "spider_man",
    code: "01001a",
    alter: "01001b",
    name: "Spider-Man",
    identity: "Peter Parker",
    aspect: "justice" as Aspect,
    color: "#e94146",
    tag: "Your friendly neighborhood hero.",
    description:
      "Outwit your enemies with Spider-Sense. Dodge their attacks, then swing in for a spectacular finish.",
    style: "Agile · Defensive",
    complexity: 1,
  },
  {
    id: "captain_marvel",
    code: "01010a",
    alter: "01010b",
    name: "Captain Marvel",
    identity: "Carol Danvers",
    aspect: "leadership" as Aspect,
    color: "#eab959",
    tag: "Higher. Further. Faster.",
    description:
      "Channel cosmic energy into devastating blasts. Keep your hand full and take the fight to the villain.",
    style: "Energy · Explosive",
    complexity: 1,
  },
  {
    id: "iron_man",
    code: "01029a",
    alter: "01029b",
    name: "Iron Man",
    identity: "Tony Stark",
    aspect: "aggression" as Aspect,
    color: "#ea6753",
    tag: "Genius. Inventor. Avenger.",
    description:
      "Build your suit one upgrade at a time, then take to the skies with an arsenal of powerful technology.",
    style: "Engine · Technical",
    complexity: 3,
  },
  {
    id: "black_panther",
    code: "01040a",
    alter: "01040b",
    name: "Black Panther",
    identity: "T’Challa",
    aspect: "protection" as Aspect,
    color: "#af9ce5",
    tag: "Wakanda forever.",
    description:
      "Assemble your vibranium upgrades and unleash a carefully sequenced flurry of attacks.",
    style: "Combos · Versatile",
    complexity: 2,
  },
  {
    id: "she_hulk",
    code: "01019a",
    alter: "01019b",
    name: "She-Hulk",
    identity: "Jennifer Walters",
    aspect: "aggression" as Aspect,
    color: "#8fb979",
    tag: "You wouldn’t like her angry.",
    description:
      "Balance courtroom control with incredible strength. Turn damage into a game-ending Gamma Slam.",
    style: "Strength · Resilient",
    complexity: 2,
  },
];
export const HEROES = [
  ...CORE_HEROES,
  {
    id: "captain_america",
    code: "03001a",
    alter: "03001b",
    name: "Captain America",
    identity: "Steve Rogers",
    aspect: "leadership" as Aspect,
    color: "#588dcc",
    tag: "I can do this all day.",
    description:
      "Lead your allies, block damage with your shield, and ready Captain America for another action.",
    style: "Leadership · Resilient",
    complexity: 2,
  },
  {
    id: "hulk",
    code: "10001a",
    alter: "10001b",
    name: "Hulk",
    identity: "Bruce Banner",
    aspect: "aggression" as Aspect,
    color: "#6baa65",
    tag: "Hulk smash!",
    description:
      "Build physical resources and turn a basic attack into a devastating Hulk Smash. Spend your hand before Hulk's turn ends.",
    style: "Strength · Explosive",
    complexity: 2,
  },
  {
    id: "ms_marvel",
    code: "05001a",
    alter: "05001b",
    name: "Ms. Marvel",
    identity: "Kamala Khan",
    aspect: "protection" as Aspect,
    color: "#dbb649",
    tag: "Embiggen!",
    description:
      "Stretch your event cards with Embiggen and Shrink, then return them with Morphogenetics.",
    style: "Events · Flexible",
    complexity: 3,
  },
  {
    id: "thor",
    code: "06001a",
    alter: "06001b",
    name: "Thor",
    identity: "Odinson",
    aspect: "aggression" as Aspect,
    color: "#cf5b50",
    tag: "Have at thee!",
    description:
      "Bring Mjolnir to the battle, engage minions, and turn energy into Lightning Strike.",
    style: "Minions · Thunder",
    complexity: 2,
  },
  {
    id: "black_widow",
    code: "08001a",
    alter: "08001b",
    name: "Black Widow",
    identity: "Natasha Romanoff",
    aspect: "justice" as Aspect,
    color: "#bd4b48",
    tag: "Always prepared.",
    description:
      "Prepare for enemy actions, cancel their plans, and answer each resolved Preparation with Widowmaker.",
    style: "Preparations · Control",
    complexity: 3,
  },
  {
    id: "doctor_strange",
    code: "09001a",
    alter: "09001b",
    name: "Doctor Strange",
    identity: "Stephen Strange",
    aspect: "protection" as Aspect,
    color: "#647dbe",
    tag: "Master of the Mystic Arts.",
    description:
      "Resolve spells from your separate Invocation deck, protect your allies, and ready with the Cloak of Levitation.",
    style: "Invocations · Protection",
    complexity: 3,
  },
];
export const VILLAINS = [
  {
    id: "rhino",
    name: "Rhino",
    codes: ["01094", "01095", "01096"],
    schemes: ["01097b"],
    module: "bomb_scare",
    difficulty: 1,
    title: "The Break-In!",
    location: "New York City",
    description:
      "A rampage. A stolen weapon. One very bad day for anyone in his way.",
    color: "#bc9b7c",
  },
  {
    id: "klaw",
    name: "Klaw",
    codes: ["01113", "01114", "01115"],
    schemes: ["01116b", "01117b"],
    module: "masters_of_evil",
    difficulty: 2,
    title: "Underground Distribution",
    location: "Covert weapons facility",
    description:
      "Uncover a shadowy arms operation before Klaw unleashes his sonic arsenal.",
    color: "#b1699c",
  },
  {
    id: "ultron",
    name: "Ultron",
    codes: ["01134", "01135", "01136"],
    schemes: ["01137b", "01138b", "01139b"],
    module: "under_attack",
    difficulty: 3,
    title: "The Crimson Cowl",
    location: "NORAD command center",
    description:
      "An army that never stops growing. A plan to end humanity. No second chances.",
    color: "#89a1aa",
  },
  {
    id: "mutagen_formula",
    name: "Mutagen Formula",
    codes: ["02014", "02015", "02016"],
    schemes: ["02017b", "02018b"],
    module: "goblin_gimmicks",
    difficulty: 3,
    title: "Mutagen Formula",
    location: "New York City",
    color: "#93bb74",
    description:
      "Face Green Goblin and his growing mutagen army. Goblin minions reinforce each other and the main scheme.",
  },
  {
    id: "risky_business",
    name: "Risky Business",
    codes: ["02001a", "02002a", "02003a"],
    schemes: ["02004b", "02005b"],
    module: "goblin_gimmicks",
    difficulty: 2,
    title: "Hostile Takeover",
    location: "Oscorp",
    color: "#93bb74",
    description:
      "Expose Norman Osborn's criminal enterprise and face Green Goblin as his influence and madness change the battlefield.",
  },
];
export const MODULES = [
  { id: "a_mess_of_things", name: "A Mess of Things", difficulty: 2 },
  { id: "power_drain", name: "Power Drain", difficulty: 3 },
  { id: "running_interference", name: "Running Interference", difficulty: 3 },
  { id: "goblin_gimmicks", name: "Goblin Gimmicks", difficulty: 2 },
  { id: "bomb_scare", name: "Bomb Scare", difficulty: 1 },
  { id: "masters_of_evil", name: "Masters of Evil", difficulty: 2 },
  { id: "under_attack", name: "Under Attack", difficulty: 3 },
  { id: "legions_of_hydra", name: "Legions of Hydra", difficulty: 4 },
  { id: "the_doomsday_chair", name: "The Doomsday Chair", difficulty: 5 },
];
export const ASPECTS: {
  id: Aspect;
  name: string;
  color: string;
  description: string;
}[] = [
  {
    id: "justice",
    name: "Justice",
    color: "#e4b84e",
    description: "Control threat. Outsmart the villain.",
  },
  {
    id: "aggression",
    name: "Aggression",
    color: "#ea5755",
    description: "Hit hard. Take down enemies.",
  },
  {
    id: "leadership",
    name: "Leadership",
    color: "#659be5",
    description: "Assemble allies. Fight together.",
  },
  {
    id: "protection",
    name: "Protection",
    color: "#72b27d",
    description: "Stay standing. Protect your hero.",
  },
];
const basics: Record<string, number> = {
  "01083": 1,
  "01084": 1,
  "01085": 1,
  "01086": 1,
  "01087": 1,
  "01088": 1,
  "01089": 1,
  "01090": 1,
  "01091": 1,
  "01092": 1,
  "01093": 1,
};
const aspects: Record<Aspect, Record<string, number>> = {
  aggression: {
    "01050": 1,
    "01051": 1,
    "01052": 2,
    "01053": 2,
    "01054": 2,
    "01055": 2,
    "01056": 2,
    "01057": 2,
  },
  justice: {
    "01058": 1,
    "01059": 1,
    "01060": 2,
    "01061": 2,
    "01062": 2,
    "01063": 2,
    "01064": 2,
    "01065": 2,
  },
  leadership: {
    "01066": 1,
    "01067": 1,
    "01068": 1,
    "01069": 2,
    "01070": 2,
    "01071": 2,
    "01072": 2,
    "01073": 1,
    "01074": 2,
  },
  protection: {
    "01075": 1,
    "01076": 1,
    "01077": 2,
    "01078": 2,
    "01079": 2,
    "01080": 2,
    "01081": 2,
    "01082": 2,
  },
};
export function deckCodes(hero: string, aspect: Aspect) {
  const source = CORE_HEROES.some((h) => h.id === hero) ? CARDS : CATALOG_CARDS;
  const a = source
    .filter(
      (c) =>
        c.set_code === hero &&
        c.faction_code === "hero" &&
        !["hero", "alter_ego"].includes(c.type_code) &&
        !c.permanent,
    )
    .flatMap((c) => Array(c.quantity).fill(c.code)) as string[];
  const starter = a.concat(
    Object.entries({ ...basics, ...aspects[aspect] }).flatMap(([c, n]) =>
      Array(n).fill(c),
    ),
  );
  // An identity cannot include its matching unique ally. Uppercut preserves
  // the existing Aggression starter; Emergency is legal in every other aspect
  // and its second copy remains below the printed three-copy limit.
  return starter.map((code) =>
    identityMatch(hero, card(code))
      ? aspect === "aggression"
        ? "01054"
        : "01085"
      : code,
  );
}
export function resources(c: Card, target?: Card): Resource[] {
  let r: Resource[] = [];
  for (const k of ["energy", "mental", "physical", "wild"] as Resource[])
    r.push(...Array(c[`resource_${k}`] || 0).fill(k));
  if (
    c.name.startsWith("The Power of ") &&
    target?.faction_code === c.faction_code
  )
    r = r.concat(r);
  return r;
}
export function heroCard(s: GameState) {
  const h = HEROES.find((h) => h.id === s.heroId)!;
  return card(s.player.form === "hero" ? h.code : h.alter);
}
export function has(s: GameState, code: string) {
  return s.player.inPlay.some((p) => rulesCode(p) === rulesCode(code));
}
export function maxHP(s: GameState) {
  return (
    card(HEROES.find((h) => h.id === s.heroId)!.code).health! +
    s.player.inPlay.reduce(
      (n, p) =>
        n + (rulesCode(p) === "01036" ? 6 : rulesCode(p) === "01039" ? 1 : 0),
      0,
    ) +
    scriptedModifier(s, "health") +
    hulkStats(s).health +
    msMarvelStats(s).health +
    captainPackModifiers(s, "hero").hp
  );
}
export function aerial(s: GameState) {
  return (
    (s.player.form === "hero" &&
      (has(s, "01017") || !!s.flags.aerial || thorStats(s).aerial)) ||
    doctorStrangeTraits(s).includes("Aerial")
  );
}
export function heroStats(s: GameState) {
  const h = card(HEROES.find((h) => h.id === s.heroId)!.code);
  return {
    attack:
      h.attack! +
      (has(s, "01057") ? 1 : 0) +
      s.player.inPlay.filter((p) => rulesCode(p) === "01028").length * 2 +
      Number(s.flags.lead || 0) +
      scriptedModifier(s, "attack") +
      hulkStats(s).atk +
      msMarvelStats(s).atk +
      thorStats(s).atk +
      doctorStrangeStats(s).attack +
      captainPackStats(s).attack,
    thwart:
      h.thwart! +
      (has(s, "01065") ? 1 : 0) +
      Number(s.flags.lead || 0) +
      captainStats(s).thw +
      msMarvelStats(s).thw +
      doctorStrangeStats(s).thwart +
      scriptedModifier(s, "thwart") +
      captainPackStats(s).thwart,
    defense:
      h.defense! +
      (has(s, "01081") ? 1 : 0) +
      (has(s, "01016") ? (aerial(s) ? 2 : 1) : 0) +
      captainStats(s).def +
      msMarvelStats(s).def +
      blackWidowStats(s).defense +
      doctorStrangeStats(s).defense +
      scriptedModifier(s, "defense"),
    recover:
      card(HEROES.find((h) => h.id === s.heroId)!.alter).recover! +
      scriptedModifier(s, "recover") +
      hulkStats(s).recover +
      msMarvelStats(s).recover,
  };
}
export function handSize(s: GameState) {
  return s.player.form === "hero" && s.heroId === "iron_man"
    ? heroCard(s).hand_size! +
        Math.min(
          6,
          s.player.inPlay.filter(
            (p) =>
              card(p).type_code === "upgrade" &&
              card(p).traits?.includes("Tech."),
          ).length,
        ) +
        scriptedModifier(s, "hand_size") +
        doctorStrangeHandSize(s)
    : heroCard(s).hand_size! +
        scriptedModifier(s, "hand_size") +
        doctorStrangeHandSize(s);
}
export function pieceHP(s: GameState, p: Piece) {
  return (
    (p.code === "drone"
      ? 1 + s.attachments.filter((p) => rulesCode(p) === "01142").length
      : (card(p).health || 0) * (card(p).health_per_hero ? s.playerCount : 1)) +
    (rulesCode(s.villain) === "01136" && card(p).traits?.includes("Drone.")
      ? 1
      : 0) +
    s.attachments.filter(
      (a) => a.attachedTo === p.id && rulesCode(a) === "01163",
    ).length *
      3 +
    scriptedModifier(s, "health", p) +
    captainPackModifiers(s, p.id).hp
  );
}
