import type { Card } from "./types.js";

const url =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf#page=66";
/** Keep imported printing text intact. Apply published rules corrections in the
 * playable database and card inspector, independently of module registration. */
export function expansionErrata(c: Card): Card {
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
