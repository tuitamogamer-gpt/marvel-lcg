# Kree Fanatic: the free Ronan the Accuser modular set

This import makes the free Kree Fanatic modular set playable. It can be chosen as the modular set of every scenario that uses modular sets; no scenario recommends it.

## Original source and scope

`src/game/kree-fanatic.ts` registers the set's 5 original faces on 7 physical cards: Ronan the Accuser, Judge, Jury, Executioner, The Accused, Bring the Hammer Down (2) and You Dare Oppose Me? (2). The set's cards come from their own small pack in the imported catalog, which remains unchanged along with the original source decks and artwork.

## Native rules

- **Ronan the Accuser:** an elite minion with toughness that cannot be stunned. When the villain phase begins, he engages the hero with the fewest remaining hit points; if heroes are tied, the players choose. As a boost he enters play engaged with you.
- **Judge, Jury, Executioner:** a side scheme with 3 threat per player. After a friendly character is defeated by an enemy attack, it places 2 threat on the main scheme. As a boost it enters play.
- **The Accused:** attaches to your identity; an enemy attack initiated against that identity gets +1 ATK. It is discarded after Ronan the Accuser is defeated, and as a boost it attaches to your identity.
- **Bring the Hammer Down:** Ronan the Accuser activates against the player he is engaged with; if he is not in play, the card gains surge. As a boost, if the activation defeats a character, the first player is dealt a facedown encounter card.
- **You Dare Oppose Me?:** discards the top 5 cards of the encounter deck and deals you each Kree Fanatic card among them facedown. As a boost, the attack gains overkill.

## Interface

- Kree Fanatic appears in the modular encounter list of every scenario with modular sets.
- The Accused appears with your identity's attachments, Ronan the Accuser in the minion row and Judge, Jury, Executioner with the side schemes.

## Coverage boundaries

- "Defeated by an enemy attack" covers allies and identities defeated by the damage of an enemy's attack.
- The executable registry contains 2,921 faces, including 2,483 dedicated faces, with 1,630 imported faces still unsupported. There are 57 playable identities, thirty-three scenarios and sixty-two modular sets. The inventory pins 154 source files.

The configured source matrix contains 202,384 cases in sixteen disjoint shards of 12,649; CI runs the sixteen shards in parallel. This import adds 3,224 cases for Kree Fanatic in the 31 scenarios with modular sets. Manifest hashes retain all 199,160 previous mission names and seeds, checked against the complete grid of `ea801d9`.

Rules references: the original card texts and [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Boost, Engage, Overkill, Stunned, Surge, Toughness).
