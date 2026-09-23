import playerData from "../data/core-player.json";
import encounterData from "../data/core-encounter.json";
import type { Aspect, Card, GameState, Piece, Resource } from "./types";
export const CARDS = [...playerData, ...encounterData] as Card[];
export const DB = Object.fromEntries(CARDS.map((c) => [c.code, c])) as Record<
  string,
  Card
>;
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
export const imageFor = (code: string) =>
  code === "drone" ? "/art/player-back.svg" : `/cards/${code}.png`;
export const HEROES = [
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
];
export const MODULES = [
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
  const a = CARDS.filter(
    (c) =>
      c.set_code === hero &&
      c.faction_code === "hero" &&
      !["hero", "alter_ego"].includes(c.type_code),
  ).flatMap((c) => Array(c.quantity).fill(c.code)) as string[];
  return a.concat(
    Object.entries({ ...basics, ...aspects[aspect] }).flatMap(([c, n]) =>
      Array(n).fill(c),
    ),
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
  return s.player.inPlay.some((p) => p.code === code);
}
export function maxHP(s: GameState) {
  return (
    card(HEROES.find((h) => h.id === s.heroId)!.code).health! +
    s.player.inPlay.reduce(
      (n, p) => n + (p.code === "01036" ? 6 : p.code === "01039" ? 1 : 0),
      0,
    )
  );
}
export function aerial(s: GameState) {
  return s.player.form === "hero" && (has(s, "01017") || !!s.flags.aerial);
}
export function heroStats(s: GameState) {
  const h = card(HEROES.find((h) => h.id === s.heroId)!.code);
  return {
    attack:
      h.attack! +
      (has(s, "01057") ? 1 : 0) +
      s.player.inPlay.filter((p) => p.code === "01028").length * 2 +
      Number(s.flags.lead || 0),
    thwart: h.thwart! + (has(s, "01065") ? 1 : 0) + Number(s.flags.lead || 0),
    defense:
      h.defense! +
      (has(s, "01081") ? 1 : 0) +
      (has(s, "01016") ? (aerial(s) ? 2 : 1) : 0),
    recover: card(HEROES.find((h) => h.id === s.heroId)!.alter).recover!,
  };
}
export function handSize(s: GameState) {
  return s.player.form === "hero" && s.heroId === "iron_man"
    ? Math.min(
        7,
        1 +
          s.player.inPlay.filter(
            (p) =>
              card(p).type_code === "upgrade" &&
              card(p).traits?.includes("Tech."),
          ).length,
      )
    : heroCard(s).hand_size!;
}
export function pieceHP(s: GameState, p: Piece) {
  return (
    (p.code === "drone"
      ? 1 + s.attachments.filter((p) => p.code === "01142").length
      : card(p).health || 0) +
    (s.villain.code === "01136" && card(p).traits?.includes("Drone.") ? 1 : 0) +
    s.attachments.filter((a) => a.attachedTo === p.id && a.code === "01163")
      .length *
      3
  );
}
