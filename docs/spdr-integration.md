# SP//dr original Hero Pack contract

This continuation covers all **39 imported SP//dr Hero Pack faces**: nineteen identity/signature/obligation/nemesis faces, twelve player-pool faces and the eight Iron Spider's Sinister Six faces. The original Energy Barrier printing (31018) uses the established 05017 adapter; other native registrations retain their actual 310xx codes. The retail pack and its modular set are one implementation scope, while registration, rules, regression, browser checks, remote CI and production deployment have separate acceptance evidence.

## Original source and physical cards

The imported `starter-31001a` is an original **forty-card Protection deck** with fifteen signatures, seventeen Protection cards and eight Basic cards. The source retains the pinned [DragnCards fixture](https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747); its SP//dr bundle separately identifies Peni Parker at [lines 841–862](https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L841). Downloaded source-deck and catalog JSON remain the provenance boundary.

| Source group | Original physical quantities                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Signature    | 31003×1, 31004×3, 31005×2, 31006×2, 31007×1, 31008×1, 31009×1, 31010×1, 31011×1, 31012×1, 31013×1 |
| Protection   | 31014×1, 31015×1, 31016×3, 31017×3, 31018×3, 31019×3, 31020×3                                     |
| Basic        | 31021×1, 31022×1, 31023×3, 31024×3                                                                |

Clarity of Purpose (31029) is a supplementary Leadership printing outside that original forty-card source. Four identity faces represent **two reversible physical cards**, rather than four separately owned cards: SP//dr Suit (31001a/31001b) and Peni Parker/SP//dr (31002a/31002b). Their original set-up starts Peni Parker as the alter ego and the Suit as an Inactive support, outside the forty-card deck. Obligation 31025 and five physical nemesis cards (31026×1, 31027×1, 31028×3) are separate encounter dependencies. Iron Spider's Sinister Six uses eight physical cards, one each of 31030–31037.

SP//dr Suit's hero has THW 2, ATK 2, DEF 2, fourteen hit points and hand size three. Peni Parker has REC 4, fourteen hit points and hand size four. The [official separated-identity insert](https://images-cdn.fantasyflightgames.com/filer_public/91/03/9103516c-4e22-43bc-94b7-b9d78178ee6b/mc31_spdr_rulesheet.pdf) establishes one shared hit-point dial: damage persists between forms and defeating either form defeats both simultaneously. Each physical card retains its own exhaustion through its ordinary flip; the other identity card becoming active does not automatically ready it.

## Current official rules boundary

The authoritative baseline is [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf). Its Appendix V, page 68, corrects **both** SP//dr Suit and M.O.R.B.I.U.S. The Inactive Suit's Return to Base moves all counters and attached cards from the Suit **to Peni Parker**. Earlier rulings that left attached cards on the Inactive Suit predate this correction. Status belongs to the current identity and remains through both form changes. The native reversible-card state must preserve actual ownership, physical IDs, attached cards, counters, exhaustion, shared HP and pending choices through save/reload.

The same appendix corrects M.O.R.B.I.U.S. to trigger after the engaged **player** generates any number of resources and to deal that amount to that player's **hero**. The [April 2025 FFG clarification](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/) explicitly includes discarded hand cards, resource cards, support abilities and resources generated beyond the card's cost. This is an actual generation receipt, distinct from resources allocated to the paid cost. Alter-ego Peni is not a valid hero damage target. Resource-generation responses must finish before the paid card's ability starts; lethal damage in that intervening window cannot be undone by the pending card's later healing.

Actual generation modifiers also apply. Both original Nova event images, Lightspeed Flight (28004) and Pot Shot (28005), explicitly say “Double the number of [Wild] resources generated while paying for this card.” They modify generation, rather than merely providing additional spending credit. Clarity of Purpose's one generated Wild therefore becomes two generated resources for either payment, and M.O.R.B.I.U.S. deals two damage in addition to Clarity's separate one-damage cost. Rules Reference page 37 defines resource generation and resource abilities; its Nova errata does not change either event's printed modifier.

Rules Reference Appendix IV, page 58, also states, in its Pepper Potts FAQ, that **resources are generated simultaneously**. Together with the simultaneous-cost rule and M.O.R.B.I.U.S.'s “any number” trigger, this supports one generation occurrence per contributing player for a committed payment, with one corresponding damage packet per actual M.O.R.B.I.U.S. source. Splitting that native payment into a separate damage packet for each selected hand card would change Tough and prevention behavior. The April 2025 example establishes the total generated amount (Genius + First Aid + Pepper Potts = 3 + X); the packet grouping follows the current simultaneous-generation rule. This distinction is a rules interpretation, rather than a claim that FFG published a separate M.O.R.B.I.U.S./Tough FAQ.

Sync Ratio uses the actual resource icons of an exhausted controlled Interface upgrade and may be triggered repeatedly in the same payment window, as the [original FFG SP//dr ruling](https://hallofheroeslcg.com/official-ffg-rulings/#spdr) confirms. Its generated resources and actual allocation remain distinguishable from hand payment and other abilities. VEN#m, Rapid Deployment and Web-Trap use their own actual Sync Ratio payment receipts. All Systems Go! may ready the very Interface exhausted to pay its cost. The Pilot is an Interface upgrade with one Wild icon; ordinary discard effects must preserve the two physical identity pieces and the rules protecting Permanent cards.

Rules Reference pages 13–14 distinguish **dealing damage** from **taking damage** as a cost. Thwip Thwip!, Spider-Tingle and Clarity of Purpose deal damage: their cost remains paid through Tough and prevention, including Forcefield Generator. Taking damage requires all of the specified damage actually to be taken. Costs for a single ability are simultaneous; a toon counter gained in response to Thwip Thwip!'s damage cannot finance that same event's resource cost. Clarity of Purpose has its own resource ability and cost/response window before its generated Wild resource joins a payment.

Spider-Tingle cancels only the pending physical card's printed When Revealed effects. Its blind reveal interrupt cannot disclose the pending card's type before the player commits the damage cost. Surge, Incite and other uncanceled effects retain their native windows. Rules Reference Appendix IV, page 63, explicitly allows Spider-Man Noir to capture a treachery if such a keyword resolved even when its When Revealed ability was canceled. If all effects were canceled, including by I Don't Think So!, Noir cannot capture that card. Merely revealing or discarding a treachery is not a resolved-treachery receipt. Captured facedown cards remain associated with that actual ally and do not resolve their player or encounter text.

Warrior of the Great Web cannot attach to the SP//dr hero or ally: the same official FAQ requires the actual title to contain the word “Spider” spelled exactly that way. Limitless Stamina and Unshakable check printed fourteen-or-more hit points, rather than current or modified HP. Repurpose uses the actually discarded legal Tech upgrade's printed cost and lasts through the end of the round. The Pilot's printed traits are Interface and Pilot, not Tech.

## Native encounter timing boundary

Giant Monster Attack adds its Energy resource cost to an actual thwart targeting that side scheme, while Crisis retains the ordinary main-scheme restriction. Inherited Burden routes to Peni's actual player, preserves the optional form change and physical remove/discard outcomes, and uses actual exhaustion or a legal Interface discard. Energy Drain uses the printed hero/alter-ego choices and a real two-Energy payment.

Grand Larceny blocks every threat-removal effect while a Criminal minion is in play, including minions engaged with another player and unlabelled removal. Criminal is a trait, so blanking the minion's text does not remove that trait. Surge in Crime grants one instance of Surge to each Criminal minion; multiple equivalent grants do not stack. Its discard action requires there to be no Criminal minions anywhere in play and a real two-resource payment.

Bombshell splits the final attack damage as evenly as possible among **all characters controlled by the final attacked player**. A teammate's defense changes that attacked player under Rules Reference pages 8–9. This is attack damage, not indirect damage: the allocation has no indirect-damage remaining-HP ceiling. Basic DEF modifies the attack's damage before the split; each recipient then has its own Tough/prevention window. Preventing one recipient's share does not redistribute it. Nondefending recipients taking damage are not thereby considered attacked. Bombshell's boost is a separate actual indirect-damage occurrence for each player and exhausts only characters that actually took damage.

Electro attaches an actual hand card with printed Energy icons after engagement or activation and gains one HP per attached Energy icon, including both icons on Energy. The [FFG attachment ruling](https://hallofheroeslcg.com/official-ffg-rulings/) distinguishes these stored cards from upgrades actually played or put into play: cards attached through Electro's forced response have inactive text. Ownership and physical IDs persist until cleanup.

Hobgoblin's Forced Interrupt replaces its attack with encounter-deck discards equal to its current ATK and the printed indirect damage from boost icons. The replacement occurs before defense, and the replaced attack does not produce attack damage, Retaliate or defense responses. Stun has priority over that forced attack-replacement interrupt. Iron Spider retains Guard, Patrol, Retaliate 1, Toughness and attack Overkill through the established native attack/defense windows.

Spot shuffles into the encounter deck only if the actual defeating damage had no excess. Exactly lethal damage has no excess; merely possessing Overkill is insufficient. Damage prevention and the actual remaining HP determine the final packet's excess, while native retaliation and physical cleanup retain their own windows.

Sandman's forced response discards seven encounter cards after **surviving actual damage from an attack**. It does not trigger for fully prevented damage, nonattack damage or a lethal attack. The [June 2023 FFG ruling, question 17](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/), states explicitly: “If Sandman (SP//dr #35) takes lethal damage and is defeated, his Forced Response will not resolve.” Rules Reference page 14 places defeat/discard before after-damage responses, and page 23 requires this minion's response source still to be in play. Its boost remains an independent discard-seven effect.

## Verification status

The native boundary comprises `src/game/spdr.ts`, `src/game/spdr-pack.ts` and `src/game/ironspider-sinister.ts`, connected through the engine's actual payment, damage, defense, reveal, defeat and physical-card hooks. Independent source review inspected all 39 original imported card images and confirmed the forty-card source, two physical identity cards and preserved printed metadata. Imported catalog and starter JSON remain unchanged.

The final eight focused suites completed on **11 October 2026 at 20:12 UTC: 308 tests passed**. Evidence is recorded in `output/spdr/focus-r4-final.log` and `output/spdr/metadata-r4-final.log`:

| Boundary                                     | Passing tests |
| -------------------------------------------- | ------------: |
| Identity rules                               |            40 |
| Original metadata and decks                  |            22 |
| Payment and physical attachment presentation |             6 |
| Native identity and signature integration    |            61 |
| Player-pool rules and native integration     |            73 |
| Sinister Six rules and native integration    |           106 |

Native cases preserve original physical IDs through JSON hydration and cover independent identity exhaustion, counter/attachment transfer, simultaneous elimination, signatures, allocated Sync Ratio payments, nemesis costs and resource-generation responses. An actual Psychic Link basic thwart and Core Iron Man's Aerial Helmet pay Giant Monster Attack's additional cost before removal; the temporary permission clears afterward.

Two original-source Thwip regressions prove all costs finish before generation responses: its damage cost first consumes Tough, then M.O.R.B.I.U.S. deals the two generated resources as two damage. With the actual Forcefield Generator in play, those two damage instead consume exactly two generator counters. Saved cost windows retain the original source cards and resume each payment and effect once. Optional damage responses wait until mandatory resource-generation responses complete.

Electro's stored original VEN#m adds one HP from its Energy icon, while its printed ally ATK remains inactive. Actual native Electro attacks therefore deal two damage. A retained Gobbler Glider control preserves its real encounter attachment's +1 ATK. Native enemy statistics, the table and scheme reviews share the encounter-attachment modifier.

Sandman’s damage response retains its actual source ID and rechecks that the same unblanked minion survived before it initiates. Original Wasp forty-card BASIC and paid Wasp Sting distributions prove that deferred batch defeat suppresses the lethal response while surviving attacks discard exactly seven cards. Sandman’s independent boost still discards seven without an in-play source. Saved response packets also respect a defeated or newly blanked source.

Surge in Crime displays its native removal action on the table when the active hero can pay two resources and no Criminal minion is in play. The action opens the actual payment window and discards that physical environment once. It has no Infamy or Madness counter; the table preserves those labels only for the relevant Risky Business environments.

TypeScript/build, formatting, generated inventory and production-entry startup pass. Native Node 24.19.0 resolves 74 runtime modules and six JSON imports; API startup returns HTTP 200. The generated inventory covers 35 native heroes, 1,408 executable faces, 935 dedicated faces and 87 source hashes.

The final frozen production artifact is `index-z_-sN5ly.js`, SHA256 `ef27c2a76083a38ddbc16b1d8cf7f067cb9ff00933de3f27db8fc43fd9f054ad` (1,501,200 bytes). CSS is `index-CCow7VPF.css`, SHA256 `bd92f463c83d279e62c502af2733ec622431fa53916439fc83664c6bfaa27720`. Independent HTTP 200 body comparisons match the immutable copy; evidence is `output/spdr/frozen-artifact-r4.json`.

**Full regression, final production-browser acceptance, remote CI and production deployment are separate pending gates.** The target browser coverage is 216 SP//dr flows across 1920/1440/1280/390, plus retained Spider-Ham, Inheritors, Zzzax and engine-continuation flows. Earlier acceptance artifacts with another JS hash are historical evidence only. The PR records the completed final counts and deployment once these gates finish.
