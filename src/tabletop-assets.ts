export const PLAYMATS = [
  {
    id: "midnight-city",
    name: "Midnight Manhattan",
    detail: "Rooftops, moonlight & a city to protect.",
    image: "/art/tabletop/midnight-city.webp",
    accent: "#b8cce6",
  },
  {
    id: "helicarrier",
    name: "Helicarrier",
    detail: "Brushed steel above the clouds.",
    image: "/art/tabletop/helicarrier.webp",
    accent: "#9ddbdc",
  },
  {
    id: "cosmic-rift",
    name: "Cosmic Rift",
    detail: "A new frontier among the stars.",
    image: "/art/tabletop/cosmic-rift.webp",
    accent: "#d4b4ed",
  },
] as const;

export type PlaymatId = (typeof PLAYMATS)[number]["id"];
export const TABLE_STYLE_KEY = "champions.playmat.v1";

export function readPlaymat(): PlaymatId {
  try {
    const saved = localStorage.getItem(TABLE_STYLE_KEY);
    return PLAYMATS.find((mat) => mat.id === saved)?.id ?? PLAYMATS[0].id;
  } catch {
    return PLAYMATS[0].id;
  }
}
