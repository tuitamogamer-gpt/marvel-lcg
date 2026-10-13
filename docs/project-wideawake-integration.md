# Project Wideawake native integration

The scenario is `project_wideawake`, with required `zero_tolerance` and one
replaceable modular set, `sentinels` by default. The authored module is
[`project-wideawake.ts`](../src/game/project-wideawake.ts); the native engine
owns card entry, payments, searches, damage, defeat, boosts, statuses and hidden
information. The module never creates gameplay cards or substitutes a standalone
simulation for those engine paths.

## Original physical source

The 19 original scenario faces represent 24 physical cards. A front/back pair is
one piece. Raw catalog JSON remains the imported source; verified corrections
belong in the authored runtime overlay.

| Original codes | Printed role and native behavior                                                                                                                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 32084–32086    | Sentinel I/II/III. Native Toughness; II Steady; III Stalwart. Search/reveal one real Abduction Protocols from encounter deck/discard, then shuffle. I deals no additional card, II deals each other player one, III deals **every** player one.                                                            |
| 32087a/b       | Night of the Sentinels. Set Captives aside and reveal OZT/Mall. Main starts at 1N, escalates by 1N and has no threat goal. Each qualifying positive placement triggers one top-card capture, then removes 5N only if that capture actually completed.                                                      |
| 32088a/b       | Mall has fixed base 4 and acceleration. When defeated, first player searches/reveals a Sentinel minion, then the same Mall piece becomes Jubilee. Jubilee has Victory -1, first-player control, no ally-limit contribution, and an unlabeled Action costing exhaustion plus one energy for 2 enemy damage. |
| 32089          | Rictor: optional after-attack response, 1 unlabeled damage to villain and every minion engaged with the attacking controller.                                                                                                                                                                              |
| 32090          | Boom Boom: optional after-attack bomb placement and a saved delayed effect for player-phase end.                                                                                                                                                                                                           |
| 32091          | Cannonball: -1 consequential attack damage only after that actual attack defeats a minion.                                                                                                                                                                                                                 |
| 32092          | Wolfsbane: live printed attacks gain Piercing; execution uses code 32092 rather than the raw text's spelling typo.                                                                                                                                                                                         |
| 32093 ×2       | Sentinel Mark IV: native Guard/Patrol. Its boost puts the actual boost piece into play engaged with the attacked player.                                                                                                                                                                                   |
| 32094 ×2       | Gauntlet Beam: printed +1 ATK, live Piercing/Ranged; removal costs three physical resources. Boost exhausts the attacked identity.                                                                                                                                                                         |
| 32095          | Learning A.I.: printed +1 SCH, live Retaliate 1; removal costs three mental resources. Boost attaches this actual piece to villain.                                                                                                                                                                        |
| 32096          | Adaptive Armor: fixed +8 maximum/remaining villain HP, not per player; removal costs three energy resources. Boost attaches this actual piece.                                                                                                                                                             |
| 32097          | Self-Repair: discard every villain status, give Tough, heal 5. Boost only gives Tough.                                                                                                                                                                                                                     |
| 32098 ×2       | Mutant Detected: choose actual top capture or explicit villain/all-engaged-minion attacks, even in alter ego. An impossible empty-deck capture is unavailable.                                                                                                                                             |
| 32099 ×2       | Warn the Others: actual revealed player's obligation; after that player's turn ends, capture this piece. Alter-Ego Action exhausts that identity to discard it.                                                                                                                                            |
| 32100 ×4       | Abduction Protocols: fixed base 2 plus native Hinder 2N, Crisis, Victory 2. Actual defeating player receives one random physical set-aside Captive.                                                                                                                                                        |

N is the original player count. Sentinel III's printed “each player,” Mall's
printed single boost icon, and the current Mall erratum “any other **ally**
version of Jubilee” require runtime corrections. Do not change the frozen source
to conceal those discrepancies.

## Persistent state and physical ownership

`s.projectWideawake` contains the actual `setAsideCaptives: Piece[]`, optional
`jubileeId`, scalar setup IDs/allocation, bomb counts by enemy ID, saved delayed
receipts, and handled receipt lists. It uses JSON-safe arrays and scalar values.
`projectWideawakeInitialize` fills missing arrays without duplicating pieces.

Live Jubilee is in exactly one player's ordinary `inPlay`. The ID is a pointer,
not a second NPC zone. `flipMallToJubilee` transfers the actual Mall ID and flips
its face; generic encounter discard or a newly created Jubilee is forbidden.
Discard only other ally versions, preserving a Jubilee hero identity. The first
player controls the live ally while her text is active; blanking stops future
control transfer and does not erase the existing controller. A blank Jubilee
contributes to the ordinary ally limit.

Rescue removes one actual Captive from the set-aside pool using the native shared
RNG, then `putAlly` assigns the defeating player's ownership/control and runs
ordinary ally entry/uniqueness/limit handling. That Captive becomes part of its
owner's deck and discard. An empty captive pool creates no card and uses no RNG.

OZT's hidden physical cards belong to its actual `Piece.captured`; neither this
module's state nor `storedCards` duplicates them. The Zero Tolerance module owns
capture and its constant loss threshold. Jubilee defeated by an enemy attack
enters the victory display first, then OZT moves the **same** physical piece from
there facedown under itself. An ordinary leave is distinct from actual attack
defeat. Preserve the signed Victory -1 value.

## Setup and native hook order

1. Extract the four original Captives, Mall 32088a and OZT 32104 from their setup
   source zones and pass those actual pieces to `projectWideawakeSetup`.
2. Resolve main 1A setup: set Captives aside, reveal OZT then Mall through full
   native REVEAL/Hinder windows. Flip main to 1B.
3. Run the initial Sentinel's native When Revealed, including Sentinel I in
   Standard. Search actual encounter deck/discard, reveal one selected real
   Abduction Protocols for first player, shuffle, then perform that stage's
   facedown encounter deal. A failed search does not fabricate a card or suppress
   an independently printed later deal.
4. The first `wideawake:stage-deal` queues
   `projectWideawakeSetupCaptureEffects`. Apply the configured group allocation
   using native physical top captures, before opening hands. Setup receipts make
   replay idempotent; later villain stages never repeat this adjustment.
5. Draw opening hands, mulligan, then player Setup under RRG1.8 Appendix II
   steps14–16. Campaign step13 is outside this standalone import.

The optional `captureAllocation:number[]` config/state uses setup-seat order
p1…pN. Default recommendations allocate total Standard1/Expert2/Heroic3 to p1;
those are recommendations, not mandatory rules. Explicit all-zero or distributed
allocations are legal. The setup UI guard requires nonnegative integers and a
total below OZT's loss threshold to keep a new game playable. Capture remains a
group total and occurs before opening draws.

## Exact host boundaries

`ProjectWideawakePorts` in the module is the authoritative typed adapter
contract. Every `wideawake:` effect dispatches through
`resolveProjectWideawakeEffect` in the existing native queue.

| Native boundary           | Export and required timing                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main threat placement     | `projectWideawakeAfterMainThreatPlaced`: one stable token, actual post-prevention amount and threat-after snapshot. Call after actual positive placement, never on mere assignment/removal. Queue as forced response; no loop over multiples of5N.                                                                                                                          |
| Capture continuation      | `capturePlayerTop` must resume each continuation with `captured:boolean` after the physical tuck and native empty-deck/recycling/dealt encounter windows. `threshold-remove` removes5N only for `captured===true`; a truly empty deck/discard fails the pre-Then instruction.                                                                                               |
| Permanent                 | `projectWideawakeGrantsPermanent`: live main32087b with native ID `main` grants OZT32104 Permanent even if OZT's own text is blank. Blank main removes its external grant. OZT may be thwarted to0 but cannot then be defeated or leave while Permanent.                                                                                                                    |
| Side-scheme defeat        | `projectWideawakeSideSchemeDefeated`: Mall's native search/reveal completes before physical flip; retain the same pending-defeat piece. Abduction receives actual defeating seat, not first player. Its mandatory rescue and Victory2 resolve in the native When Defeated window.                                                                                           |
| First-player change       | `projectWideawakeFirstPlayerChanged`: transfer the exact live Jubilee piece, preserving health/statuses/exhaustion/attachments. Call after native rotation/elimination changes the first player.                                                                                                                                                                            |
| Native actions            | `projectWideawakeActionOptions`: authorizes attachment, Jubilee and Warn actions. Typed/wild payment and cancellation stay native. Jubilee's exhaustion belongs in payment `commit`, with resources before resource-spend responses; cancel commits neither cost nor damage.                                                                                                |
| Enemy attacks             | `enemyAttack` initiates explicit attack requests against the designated seat even in `alter` form; status replacement, cooperative defense, Armor Up, boost/damage/defeat all remain native. Snapshot the requested enemy group, skip later departed targets, do not convert it into a scheme activation.                                                                   |
| Ally attack aftermath     | `projectWideawakeAllyAttackResponseOptions`: actual performed attack receipt with token, ally/source/controller and target ID/code; optional response window before consequential damage. Stun replacement, dead/blank source and an already-used occurrence provide no option.                                                                                             |
| Ally attack keywords      | `projectWideawakeAllyAttackModifiers`: live Wolfsbane Piercing.                                                                                                                                                                                                                                                                                                             |
| Consequential damage      | `projectWideawakeConsequentialReduction`: Cannonball requires a ledger of a minion actually defeated by that attack's damage. Missing-target inference is insufficient; a return/leave/prevented defeat is not a defeat.                                                                                                                                                    |
| Player turn end           | `projectWideawakeEndPlayerTurn`: actual ending seat/token, before rotating to another seat. Each live Warn copy produces its own mandatory same-piece capture once.                                                                                                                                                                                                         |
| Player phase end          | `projectWideawakeEndPlayerPhase`: after readying/drawing and their windows, immediately before villain phase. Each Boom Boom response created its own automatic delayed receipt. These are delayed effects, not new optional responses. First player orders simultaneous receipts; first actual effect removes ALL counters before native batch damage, later receipts do0. |
| Enemy leave/stage advance | `projectWideawakeEnemyLeftPlay`: remove that enemy's bomb counters. Call for actual leave, including villain stage replacement even when its ID is reused. Saved delayed receipts remain.                                                                                                                                                                                   |
| Attachment modifiers      | `projectWideawakeModifiers`: adds only +8 HP, Retaliate, Piercing/Ranged from live attachments. Native printed ATK/SCH fields supply Gauntlet+1ATK/LearningAI+1SCH exactly once. Removing Armor recomputes max/remaining HP and native villain defeat.                                                                                                                      |
| Boost entry               | `projectWideawakeBoost`: moving MarkIV/AI/Armor suppresses ordinary boost cleanup; numeric icons retain their original physical boost contribution. Star effects never generate a replacement card.                                                                                                                                                                         |

Rictor, Jubilee and bombs deal unlabeled damage, not attacks. `damageBatch` must
use native player-card origin, actual controller attribution, prevention/Tough,
damage placement and defeat windows. Rictor and bombs can affect multiple enemies.
Boom Boom's delayed receipts survive her leaving and the original controller's
elimination: their automatic effects run without asking an eliminated seat to
trigger an action. The ordering context is current first player; frozen original
source/controller still supplies attribution. This elimination behavior follows
RRG1.8 pp16/34, not a separately invented card ruling.

## Verified sources and focused validation

- [Original Mutant Genesis cards](https://hallofheroeslcg.com/mutant-genesis/).
- [Original rulebook p9](https://hallofheroeslcg.com/wp-content/uploads/2022/10/mutant-genesis-rulebook.pdf#page=9): optional group setup capture recommendations.
- [Current RRG1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf): Choosep12, Delayed Effectsp16, phase endp18, first playerp20, ownershipp31, deck exhaustionp33, player eliminationp34, Thenp44, setupp51, Mall erratump68.
- [Official Q216, Dec1 2022](https://hallofheroeslcg.com/latest-ffg-rulings/#216): Jubilee Victory before OZT; earned Captives join their owner's deck/discard.
- [Official Q136, Jan2024](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/#136): Jubilee's double-sided card and OZT.
- [Official Q9, Sept5 2024](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/#9): Boom Boom can damage multiple enemies.
- [Official July25 2025 allocation ruling](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/): “Any player can place any number” during setup, with group-selected total.

The pure suite is [`project-wideawake.test.ts`](../tests/project-wideawake.test.ts).
It verifies physical source/IDs, setup order/allocation, actual capture-before-Then,
source-scoped Permanent, native action/payment commits, original stageIII deal,
ally receipts, simultaneous delayed bomb effects, elimination persistence,
boost retention and JSON-safe hydration. Native engine and browser integration
are validated separately against these ports.
