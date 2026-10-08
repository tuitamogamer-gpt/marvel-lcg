# Nebula supplementary player cards

`src/game/nebula-pack.ts` implements the original retail supplementary player pool: **20 printed faces**, consisting of **14 dedicated native faces** and **6 exact Core reprints**. It preserves each physical card's original `220xx` code, ID, owner, controller and zone. The source catalog and scan files remain unchanged.

| Native face                   | Behavior                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 22011 Eros                    | From-hand after-play response, one minion choice per actual Mental resource paid for this ally                                           |
| 22012 Wraith                  | Hero interrupt to a current faceup boost ability; exhaust and deal 1 damage before cancellation                                          |
| 22013 Venom                   | Current main-scheme threat controls consequential damage taken reduction                                                                 |
| 22014 Justice Served          | Player control choice; after own hero thwarts the last threat, discard to ready                                                          |
| 22015 One Way or Another      | Global Max 1 per round; reveal the selected physical encounter-deck side scheme as a cost, then draw 3 and shuffle                       |
| 22016 Determination           | Actual spent-resource Hero response; non-thwart removal from the main scheme                                                             |
| 22018 Brains Over Brawn       | Paid physical hand event after the hero's actual basic thwart; attack using current hero THW                                             |
| 22020 Cosmo                   | Name type before deck choice; discard a saved physical top card from a player or encounter deck; one-use consequential damage protection |
| 22021 Knowhere                | Guardian identity play restriction, controller ally-limit increase, actual Guardian ally play response across players                    |
| 22022 Daughters of Thanos     | Friendly Gamora/Nebula Team-Up check and draw 3                                                                                          |
| 22032 Energy Spear            | Guardian ally attachment; +2 ATK and piercing                                                                                            |
| 22033 Guardians of the Galaxy | Printed Team limit, controller choice, actual upgrade play on any ally when all own characters are Guardians                             |
| 22034 Defensive Training      | Actual two training counters, Alter-Ego action, atomic exhaust/counter/physical discard-event choice, last-Use discard                   |
| 22035 Honorary Guardian       | Guardian identity play restriction, friendly-character attachment, +1 HP and Guardian trait                                              |

The six physically equivalent Core aliases are 22017→01062, 22019→01065, 22023→01086, 22024→01088, 22025→01089 and 22026→01090. **Brains Over Brawn is dedicated**; 01061 is Great Responsibility. Determination, Cosmo and Knowhere are dedicated physical reprints and are not counted as Core aliases.

## Host hooks

Use the same ordinary event/payment/reveal/status/attachment machinery as existing native packs. No card is recreated to implement a search, a top-card discard or a control change.

- Chain `nebulaPackPlayRestriction`, `nebulaPackEvent`, `nebulaPackAbilityOptions`, `nebulaPackAbility` and `resolveNebulaPackEffect` with the other native modules. `NEBULA_PACK_SCRIPT_CODES` is the dedicated allowlist.
- Call `nebulaPackCardPlayed` **once for an actual play, before cancellation** in both ordinary and triggered physical hand-play paths. This marks One Way or Another's title-wide, all-player maximum. Putting a card into play does not call this hook. Clear its marker with `nebulaPackRoundEnded` at the round boundary.
- Call `nebulaPackBeforeEvent` before event status replacement and effects. For One Way or Another, ordinary complete side-scheme reveal/When Revealed/cancellation must resolve before its event continuation. A canceled reveal still fulfills this cost. The final shuffle stays after draw 3.
- Call `nebulaPackCardEntered` after the original physical card enters. It initializes Defensive Training's two Uses and queues attachment/control choices. These hooks return no after-play behavior for put-into-play origins.
- Call `nebulaPackAllyEnter` with the actual **from-hand** origin and **resources allocated to pay for the ally**, excluding surplus resources. Include Eros 22011 in the host's paid-resource allocation classification. Selected Wild resources allocated as Mental count as Mental. A double Mental card can fund two separate Eros choices.
- Call `nebulaPackAllyPlayed` only for an actual PLAY from any legal zone, after dynamic traits and control are established. Knowhere's controller chooses/exhausts their physical support; the player who played the ally draws.
- Call `nebulaPackUpgradePlayed` after the actually PLAYED upgrade has attached. A target ally may belong to another player. The support checks the playing player's identity and all their allies, excluding supports and upgrades, using current traits. Honorary Guardian can therefore enable this response during the same physical upgrade play.
- Chain `nebulaPackModifiers` into current ally attack, piercing, friendly maximum HP and trait queries. `nebulaPackAttachmentTargets` normalizes a local `hero` attachment destination to `hero:<playerId>` before choice, duplicate-limit checking and attachment. Chain `nebulaPackAllyLimit` into the controller's ally limit in both forms.
- Include `nebulaPackBeforeAllyBasicOptions` in the interrupt options before an actual unstunned/unconfused ally attack or thwart. Continue/decline should mark `nebulaPackCosmoHandled`. Preserve `nebulaPackCosmoId`, `nebulaPackCosmoSafe` and `nebulaPackCosmoHandled` from the resulting `allyAction` through its consequential damage effect.
- Call `nebulaPackConsequentialDamage` at **actual consequential damage resolution**, after the attack/thwart and its responses. Do not calculate Venom's reduction while first queuing his thwart: he may remove the last main-scheme threat during that use. Cosmo's resolved prediction is a delayed receipt for one physical use, so subsequent blanking does not remove it.
- Build `NebulaPackThwartSnapshot` from an actual completed thwart, with acting player, identity source, basic-power classification and actual last-threat removal. Chain `nebulaPackAfterThwartOptions` with other native responses. Non-thwart threat removal and status-replaced thwart attempts do not qualify. Brains Over Brawn uses native `payRequest`→`resolveHandEvent`, including physical resources, attack-status replacement, event cleanup and after-event responses.
- Offer `nebulaPackBoostInterruptOptions` to each live player's Hero view while the **current physical faceup boost ability** can still be canceled. Resolve the ordinary dealt-damage cost before `wraith-cancel`. Wraith may be defeated by that cost without canceling his already-paid effect. Boost ability cancellation does not cancel numeric boost icons.
- Chain `nebulaPackResourcesSpent` once after actual committed physical payment. Determination uses ordinary non-thwart main-scheme threat removal, respecting Crisis and absolute restrictions.

## Port requirements

`revealEncounterFromDeck` moves the chosen encounter-deck instance into the ordinary reveal path and queues its continuation after the full reveal. `discardPlayerTop` and `discardEncounterTop` return the **actual discarded Piece**, even when that discard immediately resets its deck. Cosmo keeps the returned ID and original printed type, not a lookup of the now-empty discard pile. Top-card predictions expose no image before the selected card is discarded. The serialized choice records the physical top ID; a changed top is rejected before any mutation.

`canCancelBoostAbility` must check the currently faceup physical boost, remaining uncanceled/cancelable ability and reveal timing. `cancelBoostAbility` suppresses its ability only. `discardPiece`, `attach` and `transferControl` retain physical ownership; after controller changes, discarded player cards return to their original owner. `hasTrait`, `canGiveStatus`, `canReady`, `heroThwart` and text blanking use current game state.

## Rules and validation

The implementation uses [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), particularly the Max/Maximum, Team-Up, Uses, costs, status and p.67 errata entries, with [official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/) for after-play origins, Wraith timing and One Way or Another cancellation.

RRG1.8 p.67 changes **both** Star-Lord and Nebula Cosmo to “a player deck or the encounter deck.” The older Invocation-deck FAQ is superseded. The existing Star-Lord native Cosmo already restricts choices to those two deck classes. Eros's current wording requires “for each Mental resource ... choose a minion and confuse it”; each choice is separate, so two Mental resources may choose the same Steady minion twice.

`tests/nebula-pack.test.ts` contains 63 independent pure/port tests covering printed/Core equivalence, current traits and blanking, controller/owner routing, multiplayer after-play responses, separate Steady status choices, hidden top-card predictions, save/reload/stale-choice validation, top-card reset receipts, before-arrow reveal cost, round-wide maxima, reaction hand payment, Wraith's Tough/defeat costs and atomic physical Training Uses. Engine/browser acceptance remains a separate host-integration check.

## Native host validation

`engine.ts` now implements the shared-pool hooks and serializable ports. Ordinary ally play carries `paidForCard` into the Eros entry receipt; putting an ally into play has its own origin and does not call Knowhere's after-play hook. Upgrade-play responses run after the actual attachment and control transfer, so the same Honorary Guardian play can enable Guardians of the Galaxy. Preselected discounted attachments use that same physical attachment path without a second target prompt.

The shared hero-thwart response window records completed power, source, acting player, basic classification and last-threat removal. It supports Justice Served and Brains Over Brawn in either order with existing Turn the Tide responses. Giant Wasp's actual basic distribution counts as one basic power; Giant Help's event distribution can trigger Justice Served but cannot trigger Brains Over Brawn. Status-replaced powers and Determination's non-thwart removal do not open these responses.

Cosmo's explicit player-deck discard activates that player's actual native state for the discard/reset and restores the original actor afterward. This commits both physical zones and global RNG/hidden-information state, including a teammate's immediate last-card reset. Consequential resolution receives the saved prediction receipt; Venom's continuous reduction reads current main-scheme threat at that later boundary. Wraith's boost interrupt keeps the actual revealed boost and ordinary numeric icons, including when its dealt-damage cost defeats him.

`tests/nebula-pack-engine.test.ts` adds 18 saved native cases covering these paths, the two complete original Nebula/Gamora forty-card source decks, cross-seat draw and owner routing, logical Team limits, actual Piercing, zero-cost resource spending, physical Training Uses and stale-target rejection. Every command hydrates a JSON save and every completed path preserves every original player-card ID and owner exactly once. The independent `tests/nebula-pack-native-review.test.ts` adds 22 further native timing, allocation, boost, current-trait and physical-conservation controls. The 63 pure/port cases remain separate. Browser verification is tracked by the release owner.
