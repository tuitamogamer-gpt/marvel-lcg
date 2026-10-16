import type { Card } from "./types.js";

const url =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf#page=66";
/** Keep imported printing text intact. Apply published rules corrections in the
 * playable database and card inspector, independently of module registration. */
export function expansionErrata(c: Card): Card {
  if (["32141b", "32142b", "32143b"].includes(c.code))
    return {
      ...c,
      text:
        "<b>Forced Response</b>: After you place a magnet counter on this scheme, if there are at least 3 magnet counters here, remove 3 of them and discard cards from the encounter deck until a [[Magnetic]] card is discarded. Reveal that card." +
        (c.code === "32143b"
          ? "\n<b>If this stage is completed, the players lose the game.</b>"
          : ""),
      errata: {
        reference: "FFG Rules Reference 1.8, p. 68",
        url: url.replace("#page=66", "#page=68"),
      },
    };
  if (c.code === "32088a")
    return {
      ...c,
      text: c.text?.replace(
        "any other version of Jubilee",
        "any other ally version of Jubilee",
      ),
      errata: {
        reference: "FFG Rules Reference 1.8, p. 68",
        url: url.replace("#page=66", "#page=68"),
      },
    };
  if (c.code === "32008")
    return {
      ...c,
      text: "<b>Hero Action</b> <i>(attack)</i>: Deal 5 damage to an enemy. You may discard a tough status card from your hero to stun and confuse that enemy.",
      errata: {
        reference: "FFG Rules Reference 1.8, p. 67",
        url: url.replace("#page=66", "#page=67"),
      },
    };
  if (c.code === "31027")
    return {
      ...c,
      text: "<b>Forced Response</b>: After the engaged player generates any number of resources, deal an equal amount of damage to that player's hero.\n<i>(SP//dr's nemesis minion.)</i>",
      errata: {
        reference: "FFG Rules Reference 1.8, p. 68",
        url: url.replace("#page=66", "#page=68"),
      },
    };
  if (c.code === "31001b")
    return {
      ...c,
      errata: {
        reference: "FFG Rules Reference 1.8, p. 68",
        url: url.replace("#page=66", "#page=68"),
      },
    };
  if (c.code === "22011")
    return {
      ...c,
      text: "<b>Response:</b> After you play Eros from your hand, for each [mental] resource you used to pay for him, choose a minion and confuse it.",
      errata: {
        reference: "FFG Rules Reference 1.8, p. 67",
        url: url.replace("#page=66", "#page=67"),
      },
    };
  if (c.code === "13028")
    return {
      ...c,
      text: c.text?.replace(
        "When Beetle is defeated, choose to either",
        "When Beetle is defeated, the defeating player chooses to either",
      ),
      errata: { reference: "FFG Rules Reference 1.8, p. 66", url },
    };
  if (!["08001a", "08009"].includes(c.code)) return c;
  return {
    ...c,
    text: c.text?.replace(
      "After you trigger the ability",
      "After you resolve the ability",
    ),
    errata: { reference: "FFG Rules Reference 1.8, p. 66", url },
  };
}
