# Project Wideawake standalone original-source contract

This batch imports **27 English retail faces representing 38 physical box cards**: Project Wideawake (`32084`–`32100`, including the reverse faces of `32087` and `32088`), required Zero Tolerance (`32101`–`32104`), and recommended Sentinels (`32105`–`32108`). Master Mold, Mansion Attack, Magneto and campaign/role/Future Past cards remain outside this batch. The earlier [Sabretooth contract](sabretooth-source-contract.md) covers the preceding scenario.

## Evidence and immutable snapshots

The evidence is the [original Mutant Genesis gallery](https://hallofheroeslcg.com/mutant-genesis/), the original English scans in `public/cards/catalog`, the [original rulebook](https://hallofheroeslcg.com/wp-content/uploads/2022/10/mutant-genesis-rulebook.pdf), and [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf). All 27 local original faces were visually checked. Imported JSON remains unchanged; corrected printing metadata and published errata belong in separate runtime overlays.

| Immutable file | SHA-256 |
| --- | --- |
| `catalog-cards.json` | `c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb` |
| `catalog-decks.json` | `6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886` |
| `catalog-images.json` | `fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d` |

Four differences require runtime correction:

| Face | Frozen imported value | Original/current authoritative value |
| --- | --- | --- |
| `32086` Sentinel III | “Deal each other player…” | Original scan: **“Deal each player…”**, including the first player |
| `32088a` Mutants at the Mall | No `boost` field | Original scan: **one numerical boost triangle** |
| `32092` Wolfsbane | “Wolfbane's attacks…” | Original scan: **“Wolfsbane's attacks gain piercing.”** |
| `32106` Sentinel Mark VI | `health: 6` | Original scan: **5 HP** |

Separately, the **published RRG 1.8 erratum on page 68** changes Mall's instruction to “discarding any other **ally** version of Jubilee from play.” The printing corrections above are not invented errata. All other numerical metadata, fixed-threat flags, quantities, boost stars and unique flags agree with the inspected scans.

## Faces, quantities and printed numbers

`N` below means the number of players. A boost star adds zero numerical boost icons.

| Printing | Physical quantity | Printed contract |
| --- | ---: | --- |
| `32084` Sentinel I | 1 | SCH 2, ATK 2, HP 16N; Toughness; no unique icon |
| `32085` Sentinel II | 1 | SCH 2, ATK 3, HP 18N; Steady, Toughness; no unique icon |
| `32086` Sentinel III | 1 | SCH 3, ATK 3, HP 22N; Stalwart, Toughness; no unique icon |
| `32087a/b` Night of the Sentinels | 1 double card | Initial threat N, escalation N, **no threat limit** |
| `32088a/b` Mutants at the Mall / Jubilee | 1 double card | Mall: **fixed 4** threat, Acceleration, boost 1. Jubilee: cost 0, THW/ATK 1 with one consequence each, HP 3, unique, wild resource, **Victory -1** |
| `32089` Rictor / Julio Richter | 1 | Cost 2, THW/ATK 1, one consequence each, HP 3, unique, wild, ATK star |
| `32090` Boom Boom / Tabitha Smith | 1 | Cost 2, THW/ATK 1, one consequence each, HP 3, unique, wild, ATK star |
| `32091` Cannonball / Sam Guthrie | 1 | Cost 2, THW 1, ATK 2, one consequence each, HP 3, unique, wild, ATK star |
| `32092` Wolfsbane / Rahne Sinclair | 1 | Cost 2, THW 1, ATK 2, one consequence each, HP 3, unique, wild, ATK star |
| `32093` Sentinel Mark IV | 2 | SCH/ATK 2, HP 4, Guard, Patrol; star-only boost |
| `32094` Gauntlet Beam | 2 | Printed +1 ATK and ATK star; boost 1 plus star |
| `32095` Learning A.I. | 1 | Printed +1 SCH; star-only boost |
| `32096` Adaptive Armor | 1 | Text +8 HP; star-only boost |
| `32097` Self-Repair | 1 | Star-only boost |
| `32098` Mutant Detected | 2 | Boost 2 |
| `32099` Warn the Others | 2 | Scenario obligation; boost 2 |
| `32100` Abduction Protocols | 4 | **Fixed 2** threat, Hinder 2N, Crisis, Victory 2, boost 2 |
| `32101` Sentinel Mark II | 2 | SCH 1, ATK 2, HP 2, boost 1 |
| `32102` Sentinel Mark III | 2 | SCH 2, ATK 3, HP 3, Toughness; star-only boost |
| `32103` Energy Barrier | 2 | Printed +2 ATK and ATK star; boost 1 |
| `32104` Operation Zero Tolerance | 1 | Initial **3N** threat, boost 3; loss at **3 + N** captured cards |
| `32105` Sentinel Mark V | 2 | SCH 1, ATK 3, HP 5, boost 2 |
| `32106` Sentinel Mark VI | 2 | SCH/ATK 2, **HP 5**, Quickstrike; star-only boost |
| `32107` Targeted for Elimination | 2 | Identity attachment, boost 2 |
| `32108` Relentless Robots | 1 | Initial **3N** threat, Hazard, boost 3 |

The scenario has **19 faces / 24 physical cards**, Zero Tolerance **4 faces / 7 cards**, and Sentinels **4 faces / 7 cards**. Reverse faces are not separate cards. The shuffled scenario portion is 15 cards; four Captive allies, Mall, three villain stages and the main scheme are setup/staging pieces. OZT is revealed at setup, leaving six shuffled Zero Tolerance cards. Sentinels adds seven. Thus the box contributes **28 initially shuffled cards**, before the initial villain searches one Abduction Protocols out of the deck. Core Standard adds seven, Expert adds three, and each identity adds its obligation. With the recommended modular set, after the initial Abduction search there are **34 + N** encounter cards in Standard or **37 + N** in Expert, distributed among deck and facedown dealt cards.

## Required sets and setup

Rulebook page 9 and main scheme 1A require **Zero Tolerance**, plus **exactly one replaceable modular slot**, recommended Sentinels. Zero Tolerance is not a second selectable slot in this scenario and cannot be chosen twice. Both modular sets remain independently usable with other supported scenarios. Unsupported catalog sets are not playable merely because artwork exists.

RRG 1.8 Appendix II, page 51, places scenario setup before opening hands: step 12a resolves main 1A Setup, 12b flips the main scheme, and 12c resolves villain Setup/When Revealed; step 14 draws opening hands, 15 resolves mulligans, and 16 resolves player Setup abilities. Set aside the four actual Captives; **reveal** the actual OZT and Mall; then reveal the initial villain's searched Abduction Protocols, including Hinder. Initial Abduction threat is **2 + 2N**, Mall remains fixed 4, and OZT starts at 3N. Every villain stage gets Toughness. I searches/reveals Abduction; II additionally deals each **other** player one encounter; III deals **every** player one encounter. Search and reveal use the same physical card, with normal reveal windows and mandatory deck shuffle.

The original rulebook's page 9 “Modular Difficulty” paragraph says players **may** place top-deck cards under OZT “during setup”; “the number ... is up to the players as a group.” Recommendations are **Skirmish 0, Standard 1, Expert 2, Heroic 3 total cards**, not one allocation per player. Zero is a legal optional override in any difficulty. The [official July 25, 2025 clarification](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/) says: “Any player can place any number of cards beneath Operation Zero Tolerance ... who places and how many cards they place is up to the group's discretion, so long as the total facedown cards matches their desired difficulty.” This implementation defaults to the recommended total allocated to the first player. `captureAllocation` records one nonnegative integer per team seat; an explicit all-zero array disables setup captures. The total must remain below the immediate loss threshold, allowing up to N + 2 cards. Saves/replays preserve the resolved array, including zeros and allocations to other seats. Captures occur before opening draws, hide the captured faces, and move actual player-owned pieces rather than creating placeholders.

## Capture, defeat and ownership

The main scheme has no ordinary defeat goal. Its Forced Response resolves **once per actual positive threat placement** when the resulting total is at least 5N: capture **one** actual top card from the first player's deck, **then** remove 5N threat. RRG page 45 permits each response once per triggering occurrence; threat removal does not create another placement. A single placement of 15N does not capture three cards. RRG page 44 “Then” requires the preceding capture to resolve fully: if the deck and discard are genuinely empty and no card can be captured, the threat removal does **not** occur. Removing a deck's last card immediately recycles its owner's discard and deals that player an encounter card under Player Deck, page 33; the captured card stays outside the recycled deck. OZT's loss condition can end the game before later effects continue.

Night grants OZT Permanent. RRG page 32 forbids defeat, leaving play or text blanking except by abilities in the same set; threat can still be removed to zero without defeating it. The printed alternative loss condition cannot be blanked or canceled (Winning the Game, page 48). OZT's Forced Response is narrower: an **enemy attack must actually defeat an ally**. Consequential damage, unlabelled damage or a separate boost ability defeating an ally is not the attack itself defeating it. A stunned/replaced attack supplies no completed attack receipt.

[Official FFG answer 216, December 1, 2022](https://hallofheroeslcg.com/latest-ffg-rulings/#216) says earned Captives become part of their owner's player deck and go to that player's discard. RRG page 31 explicitly says a player taking control of a scenario-specific player card with a player back “becomes the owner ... until the game ends or another player takes control.” The rescuing player therefore owns the actual rescued card; later control transfer changes this scenario card's owner. Its encounter faction does not send it to encounter discard.

The same answer 216 requires **Jubilee to enter the Victory display first, then move under OZT immediately after an enemy attack defeats her**. RRG page 46 defines character Victory as a When Defeated ability. Signed Victory -1 remains negative. OZT can retrieve a defeated ally from any resulting zone, including hand, deck or Victory display, under the current FAQ on page 63. [Post-1.5 answer 136](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/#136) confirms double-sided Jubilee still goes under OZT. An ordinary non-defeat return to hand/deck instead removes Jubilee from the game under Double-Sided Card, page 17. The April 4, 2025 [post-1.6 ruling](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/) supersedes older advice about converted minions: a minion treated as an ally reverts when discarded and **cannot** be found as an ally for OZT.

Regroup replaces a defeated ally's **discard**, rather than its defeat, as [official answer 232, January 11, 2023](https://hallofheroeslcg.com/latest-ffg-rulings/#232) explicitly states. Active Victory instead supplies Jubilee's mandatory When Defeated destination before the default discard (RRG pages 46 and 48), leaving no discard for Regroup to replace. This eligibility conclusion follows those rules; no separate Jubilee/Regroup ruling was identified. If Jubilee's Victory text is blanked, the normal discard replacement becomes relevant, and a separate return-to-hand operation removes the double-sided card from the game. RRG page 36 says a removed card cannot reenter “through any means.” Answer 136 authorizes the **direct Victory-to-OZT movement**, overriding removal that would otherwise occur during that movement; it does not expressly authorize retrieving an already removed card after a separate earlier effect. Native OZT lookup therefore must not search the removed-from-game area without specific authority.

Outside Wideawake, OZT lacks the main scheme's Permanent grant. If it leaves play, discard the actual tucked cards under Leaves Play, page 27, and Tuck, page 45; ordinary player cards go to their owners' discard, encounter cards to encounter discard, and double-sided Jubilee is removed from the game. Stored cards are out of play, are not attachments, and cannot be used as public hand/deck substitutes.

## Printed abilities and native host boundaries

Mall searches and **reveals** a Sentinel minion before flipping the same physical piece into Jubilee. That reveal can trigger Mark III/V abilities and other normal entry effects. The current erratum discards another matching **ally**, never a hero identity. A matching hero Jubilee prevents scenario Jubilee from entering through uniqueness; remove the scenario ally from the game, without awarding Victory for an entry that never occurred. Jubilee follows the first-player token, without leaving play, and ignores the ally limit while her text is active. Her energy-paid 2 damage Action is not an attack.

Abduction's actual defeating player gets one random remaining set-aside Captive, using saved native RNG and normal uniqueness/ally-limit entry. Rictor's optional response damages the villain and minions engaged with his controller; that damage is not a second attack. Cannonball reduces consequential damage only when his actual attack defeated a minion. Wolfsbane's actual attacks are Piercing. Boom Boom's optional response places a counter and creates a delayed effect. Each use creates a separate saved receipt; at player-phase end the first resolves by removing **all** actual bombs and dealing 2 per counter removed from each enemy, and subsequent receipts normally find zero bombs. Delayed effects survive the source leaving play, have constant timing priority (page 16), and resolve after the end-of-phase draw/ready steps (page 18). The first player orders simultaneous effects (page 20). [Post-1.6 answer 9, September 5, 2024](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/#9) explicitly confirms Boom Boom continues to affect multiple enemies as printed. Removing an enemy from play removes its counters and prevents later bomb damage to a new enemy or new villain stage. Creator elimination does not erase an already-created automatic delayed effect: the elimination rules on page 34 remove that player's cards and participation, while the delayed effect on page 16 is not a new triggered ability. Retain the original source/controller for attribution without requiring the eliminated player to take an action. This elimination conclusion is a rules inference, not a separate published Boom Boom ruling.

Gauntlet Beam grants Piercing/Ranged in text, with printed +1 ATK outside the text box; Learning A.I. grants Retaliate 1 with printed +1 SCH. Blanking their text removes keywords but preserves printed modifiers. Adaptive Armor's +8 HP is text, preserves sustained damage when entering/leaving, and disappears when blanked. Their Hero Actions require exactly three Physical/Mental/Energy resources respectively, using native wild allocation, payment cancellation and actual physical attachment IDs. Their boost entry/exhaust effects use the same pieces. Self-Repair clears all villain statuses, gives Tough and heals 5 when revealed; its boost only gives Tough before attack damage.

Mutant Detected offers a top-card capture or villain then engaged-minion attacks, even against alter-ego. Choose, page 12, prohibits selecting a capture option that cannot even partially resolve. Actual attack order is villain first, then minions in the attacked player's chosen order (Activation, page 6). Warn the Others captures its actual obligation after **its player's turn**, rather than at the end of the entire player phase; only that player may exhaust their alter-ego to discard it.

Mark III directly attaching a searched Energy Barrier does **not** execute the attachment's “attach to” instruction, so it does not add the instruction's Tough, apply its “without Energy Barrier” check, or Surge. Mark III's own Toughness still applies. RRG page 8 states that an attach-to phrase is not resolved when another ability attaches to a specific game element; [post-1.6 answer 53, December 10, 2024](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/#53) confirms the same Energy Barrier distinction. Ordinary revealed Barrier must find a Sentinel minion without Barrier, give Tough, or Surge. After the attached minion actually attacks, its mandatory response gives Tough. Mark III's star samples whether the identity was already stunned before attempting the new status.

Mark V either makes its immediate attack when its resolving identity already has Targeted for Elimination or searches/reveals that attachment. Searches of any portion of a deck mandate a full shuffle upon ability completion, even where “Shuffle” is omitted (Search, page 40). Mark VI's star moves the same zero-numerical-boost piece to a qualifying identity's player's facedown dealt zone; if more than one qualifies, **the first player chooses** (First Player, page 20). Quickstrike applies when it later enters as a revealed minion, not when merely dealt.

Targeted for Elimination blocks Hero→Alter-Ego only while its identity is engaged with a Sentinel minion. Its Action can be paid in either form, but **only the attached identity's controller** can trigger/pay it; a teammate cannot exhaust their own identity to remove it. This is the specific Attachment rule on page 8, overriding generic encounter-action permission. Relentless Robots blocks thwarts by players engaged with Sentinel minions; other seats may thwart it, and unlabelled threat removal is not a thwart.

Targeted for Elimination prevents only the final form-change effect of SP//dr's Ejection Protocol (`31008`), not its entire Hero Action. The printed cost is discarding Protocol; exhaustion of Interfaces, setting HP to 6, Tough and the flip are effects. RRG pages 7 and 11 let the earlier independent effects resolve while the prohibited flip fails. Target, page 43, requires at least one effect to affect a valid target and excludes costs from that assessment: Ejection remains eligible when an Interface can exhaust, HP can change to 6, Tough can be gained or a legal flip remains. If all those effects are unchanged or prohibited, its discard cost alone cannot enable it.

The independent source suite checks frozen bytes, actual retail quantities/numbers and corrected runtime presentation separately from executable registration. Native acceptance must use complete original 40-card decks, real encounter/setup piece IDs, current controller/owner state, and save/restore continuations; catalog presence alone is not evidence of execution.
