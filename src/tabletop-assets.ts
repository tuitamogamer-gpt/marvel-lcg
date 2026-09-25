export const PLAYMATS = [
  {
    id: "midnight-city",
    name: "Midnight Manhattan",
    detail: "Rooftops, moonlight & a city to protect.",
    image: "/art/tabletop/midnight-city.webp",
    accent: "#b8cce6",
    heroId: "",
    hero: "Shared table",
  },
  {
    id: "helicarrier",
    name: "Helicarrier",
    detail: "Brushed steel above the clouds.",
    image: "/art/tabletop/helicarrier.webp",
    accent: "#9ddbdc",
    heroId: "",
    hero: "Shared table",
  },
  {
    id: "cosmic-rift",
    name: "Cosmic Rift",
    detail: "A new frontier among the stars.",
    image: "/art/tabletop/cosmic-rift.webp",
    accent: "#d4b4ed",
    heroId: "",
    hero: "Shared table",
  },
  {
    id: "wakanda",
    name: "Wakanda Forever",
    detail: "Vibranium light over a kingdom worth protecting.",
    image: "/art/tabletop/wakanda.webp",
    accent: "#cbb6f4",
    heroId: "black_panther",
    hero: "Black Panther",
  },
  {
    id: "photon-orbit",
    name: "Photon Orbit",
    detail: "Earth below. A golden trail beyond the stars.",
    image: "/art/tabletop/photon-orbit.webp",
    accent: "#f3d493",
    heroId: "captain_marvel",
    hero: "Captain Marvel",
  },
  {
    id: "stark-workshop",
    name: "Stark Workshop",
    detail: "Arc-reactor light. The next suit starts here.",
    image: "/art/tabletop/stark-workshop.webp",
    accent: "#99dfe9",
    heroId: "iron_man",
    hero: "Iron Man",
  },
  {
    id: "gamma-lab",
    name: "Gamma After Hours",
    detail: "Emerald energy with a little purple attitude.",
    image: "/art/tabletop/gamma-lab.webp",
    accent: "#b4dfa7",
    heroId: "she_hulk",
    hero: "She-Hulk",
  },
  {
    id: "queens-rooftops",
    name: "Above Queens",
    detail: "Your friendly neighborhood, after sunset.",
    image: "/art/tabletop/queens-rooftops.webp",
    accent: "#f1adac",
    heroId: "spider_man",
    hero: "Spider-Man",
  },
] as const;

export type PlaymatId = (typeof PLAYMATS)[number]["id"];
export type PlaymatPreference = PlaymatId | "match-hero";
export const TABLE_STYLE_KEY = "champions.playmat.v1";

export function playmatForHero(heroId: string) {
  return PLAYMATS.find((mat) => mat.heroId === heroId) ?? PLAYMATS[0];
}

export function readPlaymat(): PlaymatPreference {
  try {
    const saved = localStorage.getItem(TABLE_STYLE_KEY);
    if (saved === null || saved === "match-hero") return "match-hero";
    return PLAYMATS.find((mat) => mat.id === saved)?.id ?? PLAYMATS[0].id;
  } catch {
    return "match-hero";
  }
}
