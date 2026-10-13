# Sabretooth standalone original-source contract

This continuation installs exactly **27 English retail faces** from Mutant Genesis: the Sabretooth scenario (`32060`–`32072`, including three reverse faces), Brotherhood (`32073`–`32079`) and Mystique (`32080`–`32083`). Those faces represent **30 physical box cards**. The four other scenarios, four other modular sets and campaign/role cards remain outside this release. The earlier [hero source contract](mutant-genesis-heroes-contract.md) covers Colossus, Shadowcat and the player pool separately.

## Immutable evidence

The source is the [original Mutant Genesis card gallery](https://hallofheroeslcg.com/mutant-genesis/), the local original English scans indexed by `src/data/catalog-images.json`, the [original rulebook](https://hallofheroeslcg.com/wp-content/uploads/2022/10/mutant-genesis-rulebook.pdf) and [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf). Numerical metadata, fixed-threat flags, unique flags and boost stars for all 27 faces already agree with the original scans. **No metadata overlay or source JSON edit is needed.** The imported `32083` transcription says “an reveal her”; its original scan says “and reveal her.” Native execution must perform the printed search and reveal without rewriting the imported catalog or inventing an official erratum. No published RRG 1.8 erratum was identified for these faces.

The independent source suite freezes these SHA-256 values:

| Imported file | SHA-256 |
| --- | --- |
| `catalog-cards.json` | `c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb` |
| `catalog-decks.json` | `6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886` |
| `catalog-images.json` | `fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d` |

## Physical scenario and deck construction

| Printing | Physical quantity | Printed numerical contract |
| --- | ---: | --- |
| `32060` Sabretooth I | 1 | SCH 1, ATK 2, HP 13 per player; both power stars; unique |
| `32061` Sabretooth II | 1 | SCH 2, ATK 2, HP 15 per player; Toughness; unique |
| `32062` Sabretooth III | 1 | SCH 2, ATK 3, HP 18 per player; Toughness, Retaliate 1; unique |
| `32063a/b` Stalked by Sabretooth | 1 double card | Initial threat 0; escalation 1 per player; **no threat limit** |
| `32064a/b` The Injured Senator | 1 double card | Initial threat 0; escalation 1 per player; limit 9 per player |
| `32065a/b` Find / Protect the Senator | 1 double card | Find starts at 5 per player and has Crisis; Protect is an environment |
| `32066` Robert Kelly | 1 | Unique; 9 HP; cost 0; ATK/THW dashes; no resources |
| `32067` Adamantium Claws | 1 | Printed +1 ATK; star-only boost (zero numerical icons) |
| `32068` Animal Ferocity | 1 | Star-only boost (zero numerical icons) |
| `32069` Sabretooth Strikes | 2 | Star-only boost (zero numerical icons) |
| `32070` Unrelenting Savage | 3 | One numerical boost icon |
| `32071` Medical Emergency | 2 | **Fixed** base 2, Hinder 2 per player, Acceleration, boost 2, Victory 1 |
| `32072` Feral Rage | 1 | **Fixed** base 4, Crisis, boost 3 |

Sabretooth's three retail stage cards are distinct physical printings, not three copies of one stage. Standard uses I then II; Expert uses II then III, with one active stage at a time. The two main schemes and Find/Protect each represent one reversible physical card. Robert Kelly is an independent singleton scenario ally, initially attached to Find; none of these setup pieces belongs in the shuffled encounter deck.

The scenario contributes **10 shuffled encounter cards**; Brotherhood contributes **8** and Mystique **5**. The recommended box encounter portion is therefore **23 physical cards**. Core Standard adds 7 and Expert adds another 3: the initial shuffled deck is **30 plus one obligation per player** in Standard, or **33 plus one obligation per player** in Expert. Campaign setup, Future Past, role upgrades and Frightened Police are excluded.

Sabretooth requires **two distinct supported modular sets**, recommended Brotherhood and Mystique. The persisted `modules` array records both; legacy `module` records the primary selection. A legacy primary-only setup supplies the recommended distinct second set. Other registered scenarios retain their single modular slot. A catalog encounter set is not selectable merely because its data or artwork exists.

## Kelly, scenario progression and timing

The original rulebook page 7 recommends Kelly starting damage **Standard 1, Expert 2, Skirmish 0, Heroic 3** and permits the group to adjust it. The standalone interface supports an optional integer override from 0 through 8; otherwise difficulty chooses 1/2/3. Save/replay records the exact resolved value, including zero. This does not add a Skirmish mode.

During stage 1, Kelly is attached to Find, has no player's control, and his text is blank. After villain-phase step 1, Stalked deals him 2 damage, or 3 when the main scheme has at least 6 threat per player. Stage 1's printed dash is **no limit**, rather than a zero-threat defeat threshold. Find prevents player-card healing and upgrades. When Find is defeated, the first player detaches and takes control of the same Kelly, advances to stage 2A (dealing each player an encounter card), and flips the same Find physical card into Protect by the main scheme. Protect retains its player healing/upgrade restrictions.

Kelly's text makes the first player his controller after the blanking is removed; the same NPC passes with the first-player token, without leave/enter-play duplication. Kelly does not consume an ally-limit slot and has no basic ATK or THW. If he leaves play by defeat, return, removal or another destination, the players lose. Completing stage 2 defeats him. The singleton NPC zone is saved independently from players' ordinary ally arrays so inspection, damage, control and physical-ID conservation remain unambiguous. An explicit Beguiled conversion can move that same card into the actual minion zone while retaining `kellyId`; it must occupy one physical zone, without an NPC/ally mirror. Its printed dash powers remain unmodifiable zeroes when referenced, under RRG 1.8 page 15, unlike Mystique's variable stars.

[Official FFG answer 113, August 26, 2022](https://hallofheroeslcg.com/latest-ffg-rulings/#113) states: “the Forced Interrupt on Robert Kelly resolves before damage would be dealt. If the attack is undefended, Robert Kelly will take the damage.” The controller's Tough is retained; the forced interrupt precedes Energy Barrier and hero damage-taken reactions that now lack a trigger. The answer also requires immediately passing the first-player token and Kelly if the first player is eliminated. [Answer 161](https://hallofheroeslcg.com/latest-ffg-rulings/#161) confirms an ally defense makes the attack defended. Current RRG 1.8 defense/defender-leaving timing must be evaluated at the actual replacement window; an old Nightcrawler example must not be generalized to unrelated leave timing.

[Official post-1.5 answer 221, July 11, 2024](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/#221) redirects undefended indirect attack damage to Kelly as well. The [post-1.6 clarification](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/) caps indirect assignment at Kelly's remaining HP; excess cannot be assigned to other characters. His own Tough can prevent the assigned damage. [Post-1.5 answer 125](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/#125) confirms moving damage away counts as healing, so a player-card move cannot bypass Protect's healing block. Medical Emergency's encounter-card heal is permitted; its physical side scheme moves to the Victory display instead of the encounter discard. RRG 1.8 pages 46 and 48 express Victory and the printed heal as When Defeated abilities; all must resolve, with the first player ordering simultaneous forced abilities under page 20.

Protect's optional Hero Response follows an actual defense by the controller's **hero** against Sabretooth, including a valid defense-labeled event. An ally defense alone does not make the hero the defender. Pay two resources of any type to ready that hero; an already-ready hero provides no valid ready effect. The actual defense receipt and unused response survive saves and seat changes.

Each stage's mandatory heal response requires an actual Sabretooth activation against a player. Discard one encounter card even at full health and heal only its numerical boost icons; a boost star counts as zero and its boost ability is not resolved by this discard. [Official answer 282, February 23, 2023](https://hallofheroeslcg.com/latest-ffg-rulings/#282) confirms the mandatory full-health discard. Stun/Confused replace an activation, so a canceled activation supplies no completed-activation receipt and no heal. Unrelenting Savage's conditional +1 is sampled for its designated attack/scheme before it happens, rather than after Sabretooth's post-activation heal.

Claws and Ferocity attach to Sabretooth, including when revealed as boosts, and their printed Energy + Mental + Physical Hero Action costs remove them. A boost attachment retains the same physical card and avoids ordinary boost-discard cleanup. Claws' printed +1 ATK is a printed statistic; text blanking can suppress its Piercing but does not erase that printed modifier. Strikes' boost refers to an ally actually defeated **by that attack**, including Kelly; a separate boost-damage defeat is not that condition. Its reveal offers the actual hero an optional exhaust to prevent the one damage to Kelly.

Feral Rage attacks the player who defeated it even in alter ego. [Official post-1.5 answer 81, September 7, 2023](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/#81) permits “after defeating a side scheme” responses before the attack's steps. Medical Emergency starts at **2 + 2N**, The Brotherhood at **3 + 2N**, Feral Rage at **4**, and Metamorphic Mayhem at **3**; these printed fixed bases must not all be scaled by player count.

## Brotherhood and Mystique

| Printing | Physical quantity | Numerical boost / printed powers |
| --- | ---: | --- |
| `32073` Avalanche | 1 | Boost 1 + star; SCH 1, ATK 3, HP 5; unique |
| `32074` Blob | 1 | Boost 2; SCH 1, ATK 2, HP 6; unique; Guard |
| `32075` Pyro | 1 | Boost 2; SCH 2, ATK 0, HP 4; unique |
| `32076` Toad | 1 | Boost 1 + star; SCH 2, ATK 2, HP 3; unique |
| `32077` Homo Superior | 2 | Boost 1 + star; attached minion +5 HP and Tough |
| `32078` Mutant Terrorists | 1 | Boost 2; reveal The Brotherhood or mill/reveal a Brotherhood minion |
| `32079` The Brotherhood | 1 | Boost 3; fixed base 3; Hinder 2 per player; Hazard |
| `32080` Mystique | 1 | Boost 3; HP 9; unique; Toughness; variable SCH/ATK stars |
| `32081` Metamorphic Mayhem | 1 | Boost 3; fixed base 3; Amplify 1 icon |
| `32082` Infiltration | 2 | Boost 1; Shapeshifter; no resources |
| `32083` Shapeshifter Surprise | 1 | Boost 2; Shapeshifter; no resources |

Avalanche's attack response exhausts a controlled character; Blob/Toad require actual attack damage to a character. Pyro's post-attack discard counts **printed player resource icons**, never encounter boost triangles, for indirect damage. Homo Superior can attach to an already-Tough minion without Surge: “otherwise” applies only when the preceding instruction cannot resolve at all ([official answer 134](https://hallofheroeslcg.com/latest-ffg-rulings/#134)). Its boost still contributes its one numerical triangle to the current activation when it attaches ([post-1.5 answer 134](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/#134)); the attached same-ID card is not discarded in boost cleanup. The Brotherhood grants live Quickstrike to every Brotherhood of Mutants minion, including Mystique, while its text is active; unblanking an already-entered source does not retroactively trigger Quickstrike.

Mystique's live SCH and ATK equal the villain's respective current statistics; her stars are not imported numeric zeroes. Her global “players cannot attack the villain” is not Guard, so Shadowcat cannot bypass it by ignoring Guard. Text blanking removes the variable-value text and attack restriction while retaining her printed traits and existing status cards. Metamorphic's defeat shuffles actual Shapeshifter IDs from the encounter discard into the defeating player's deck.

The original rulebook page 7 explicitly makes a Shapeshifter drawn from a player deck count as a card drawn and contribute to hand size. Its Forced Response triggers on **actual entry into hand from any source**, including searches/returns, rather than only ordinary draw or deck milling. The [official August 14, 2025 answer](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/) states: “cards are drawn one at a time, so if you draw Shapeshifter Surprise when drawing up to your hand size, you immediately resolve it before finishing drawing cards.” RRG 1.8 pages 17 and 21 likewise require one-at-a-time drawing and hand-size checks after each card. A callback after a complete multi-card draw is too late: pending draws resume only after the forced entry response resolves, and a game-ending response prevents further draws.

A Shapeshifter remains in hand until discarded and may be discarded when another player card could be discarded. Discarding it from **hand or deck** places it in the **encounter discard**, not the player's discard; it has no player resource icons. Infiltration forces the acting player to discard a controlled ally or support. Shapeshifter Surprise makes Mystique activate against that player or searches/reveals her from encounter deck/discard, without inventing an engagement transfer on an existing Mystique. All moves preserve the encounter card's physical identity and ownership.

## Acceptance boundary

[The independent source-contract suite](../tests/sabretooth-source-contract.test.ts) freezes the source bytes, exact faces/quantities, original numeric/icon fields, stage registrations, distinct modular slots, recommended and overridden Kelly damage, exact Standard/Expert encounter populations for one through three players, and physical NPC/Find setup conservation. These assertions exercise the connected native host; imports and isolated exported hooks alone are insufficient.

All **22 independent source cases pass** against the connected native host, alongside the preserved **31 hero metadata/deck cases**. The primary-module configuration gate also passes and collects **5,760 mission configurations**; that collection assertion does not certify those missions executed.

[Twenty replay/account controls](../tests/mission-history.test.ts) preserve a nondefault distinct modular pair, exact zero starting damage, original seeded opening and singleton NPC through guest history, JSON/team restoration and actual account projection. They reject malformed pairs and out-of-range or noninteger damage. Legacy records retain absent plural metadata and resolve the recommended distinct second set rather than fabricating an invalid one-slot Sabretooth pair. These controls and the preserved experience/account suites pass **196 cases across three files**.

Native modules, cooperative/defense boundary tests, full regression, accessible browser checks at all required widths, production build, source-hash inventory freeze and publication remain separate gates. This contract makes no claim to support Project Wideawake, Master Mold, Mansion Attack, Magneto, their dependency modules or the Mutant Genesis campaign.
