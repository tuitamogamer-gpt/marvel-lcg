# Sinister Motives: Venom Goblin and Goblin Gear

This import adds the fifth and last scenario of the Sinister Motives campaign expansion: Venom Goblin, with the Symbiotic Strength set that the scenario always uses and its recommended modular set, Goblin Gear. Goblin Gear can also be chosen as the modular set of every other scenario that uses modular sets.

## Original source and scope

`src/game/venom-goblin.ts` registers 24 original faces on 25 physical cards. The Venom Goblin set has 18 faces: Venom Goblin (I), (II) and (III), both sides of Skies Over New York and of Lower, Midtown and Upper Manhattan, We Are One, Symbiotic Berserker (2), Symbiotic Monstrosity, Symbiotic Thrall (4), Festering Mass, Joy Ride and Spreading Panic (2), twelve encounter cards in all. Goblin Gear has Advanced Glider, Concussive Bombs, Incendiary Bombs, Smoke Bombs, Limitless Supply and Remote Navigation, six cards. Symbiotic Strength was imported with Venom. The imported catalog, original source decks and artwork remain unchanged.

Standard uses Venom Goblin (I) and (II), Expert Venom Goblin (II) and (III). The encounter deck holds the Venom Goblin, Symbiotic Strength and Standard sets and one modular set, Goblin Gear unless another is chosen.

## Native rules

- **Setup (Skies Over New York):** Lower Manhattan (1 threat per player), Midtown Manhattan (2 per player) and Upper Manhattan (no threat) are all in play, with the glider counter on Midtown Manhattan. Their thresholds are 11, 12 and 10 per player.
- **Three main schemes:** in the villain phase each main scheme gains 1 threat per player plus its own acceleration tokens; acceleration icons and every other encounter effect on "the main scheme" apply to the scheme with the glider counter. Player cards can remove threat from any main scheme.
- **Specials:** Lower Manhattan places 1 threat on each scheme and 1 more on itself with a Symbiote environment in play; Midtown Manhattan deals you 2 indirect damage, 3 with a Symbiote environment; Upper Manhattan has you discard 1 card from your hand, and the top 4 cards of your deck as well with a Symbiote environment. A Special always resolves for the main scheme the glider counter has just moved to.
- **Completed main schemes:** a main scheme that reaches its threshold flips to its Symbiote environment side. Its acceleration tokens, and the glider counter if it was there, move to the main scheme with the least threat; with at least two Symbiote environments in play the players lose.
- **The villain:** after Venom Goblin activates against you, the glider counter moves to the main scheme with the least threat. Venom Goblin (I) then places 2 threat there or resolves its Special, your choice; Venom Goblin (II) resolves the Special; Venom Goblin (III) places 1 threat and resolves the Special. Venom Goblin (II) and (III) deal 2 and 3 facedown encounter cards to each player when revealed, also at Expert setup.
- **Venom Goblin encounter cards:** We Are One attaches to Venom Goblin with +3 ATK and +3 SCH; its Hero Action spends an energy, a mental and a physical resource to discard it. With a Symbiote environment in play, Symbiotic Berserker gains quickstrike, Symbiotic Thrall gains patrol and Symbiotic Monstrosity gets +3 hit points. As boosts, Symbiotic Berserker moves the glider counter to the main scheme with the most threat and places 1 threat there, Symbiotic Monstrosity makes the attack deal indirect damage, and Symbiotic Thrall places 1 threat on each main scheme without the glider counter. Festering Mass is a Symbiote environment while there is no other one and is revealed as a boost. Joy Ride (Hinder 2 per player) moves the glider counter to the main scheme with the most threat and resolves that Special; Spreading Panic (surge) resolves the Special of the main scheme with the glider counter, also as a boost.
- **Goblin Gear:** Advanced Glider attaches to the villain, which activates against you again after it activates against you, once per round for each player; its Hero Action discards attack cards with a combined cost of 3 or more to discard it. Concussive, Incendiary and Smoke Bombs attach to the villain with 2 bomb counters; after the villain attacks you, one counter is removed to exhaust an upgrade and a support you control, deal you 2 indirect damage or discard the lowest-cost event in your hand, and the card is discarded with its last counter. Limitless Supply gives each Tech attachment surge. Remote Navigation has the villain activate against you if Advanced Glider is in play, or finds Advanced Glider in the encounter deck or discard pile and reveals it; as a boost during the villain's activation it gives 2 more boost cards. Ties for the least or most threat are the players' choice.

## Interface

- Mission setup notes that Symbiotic Strength is always included and preselects Goblin Gear as Venom Goblin's modular set.
- The scheme row shows the Manhattan main schemes still in play side by side, each with its threat, threshold and the threat it gains each villain phase; the one with the glider counter carries a GLIDER marker. A completed main scheme appears with the environments as a Symbiote environment, and the threat objective counts the infested districts out of two.
- We Are One's and Advanced Glider's Hero Actions appear in Venom Goblin's attachment row, and each bomb card shows its remaining bomb counters.
- On narrow screens the threat token of main schemes shown side by side, here and in Tower Defense, sits higher so that it no longer covers the caption under the card.

## Coverage boundaries

- "Each scheme" includes only the main scheme with the glider counter among the main schemes, as Skies Over New York says for encounter cards that affect the main scheme.
- Advanced Glider's Hero Action discards the fewest, most expensive attack cards that reach a combined cost of 3; it offers no choice among other combinations.
- We Are One's cost accepts generated resources as well as printed ones.
- "After Venom Goblin activates against you" follows each completed attack or scheme; an attack that ends early because its target left play does not count.
- The executable registry contains 2,904 faces, including 2,466 dedicated faces, with 1,647 imported faces still unsupported. There are 57 playable identities, thirty-three scenarios and fifty-nine modular sets. The inventory pins 152 source files.

The configured source matrix contains 192,712 cases in sixteen disjoint shards of 12,044 or 12,045; CI runs the sixteen shards in parallel. This import adds 9,256 cases: 6,032 for Venom Goblin (52 expansion starter identities × two difficulties × his 58 selectable modular sets), 104 for Venom Goblin with Standard II and Expert II, and 3,120 for Goblin Gear in the 30 other scenarios with modular sets. Manifest hashes retain all 183,456 previous mission names and seeds, checked against the complete grid of `5c10dbb`.

The first mission sweep found Remote Navigation's boost giving the villain boost cards during another enemy's activation; it now does so only during the villain's own activation.

Rules references: Skies Over New York, the Manhattan main schemes and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Acceleration Tokens, Boost, Environment, Hinder, Indirect Damage, Patrol, Quickstrike, Surge, Uses).
