# Mansion Attack engine contract

`src/game/mansion-attack.ts` contains scenario decisions and saved receipts. It imports types and catalog data, never the engine. Native engine ports own physical movement, reveal windows, damage prevention, indirect-damage allocation, activation, search, and player-deck exhaustion.

## Physical ownership

- Setup receives the ten original physical cards: four double-sided villains, four room mains, The Brotherhood Strikes!, and Save the School. It never manufactures a replacement or edits catalog definitions.
- The active villain occupies native `s.villain`; unused villains occupy `mansionAttack.villainDeck`. A/B is its physical face, rather than a sequence of numeric villain stages. Standard uses A and expert uses B.
- `mansionAttack.currentMain` owns the active physical main. Native `s.scheme` is its public code/threat view. The remaining actual room fronts occupy `mansionAttack.mainDeck`.
- The first main enters victory during setup. Two completed rooms therefore produce the printed total of three main schemes and a loss.
- `victoryDisplay` owns defeated villains and completed mains. At terminal villain victory, the required native villain UI object is a retired view: `mansionAttack.activeVillainRetired` excludes it from physical zone enumeration. A subsequent villain reveal overwrites that view with the next actual piece.
- `setupIds` and handled receipt arrays contain identifiers only. They are metadata, not additional card zones. `cancelledActivations` identifies native continuations ended by an actual villain defeat.

## Native boundaries

Call `mansionAttackSetup` after extracting original setup pieces from their source zones. Default victory targets are two villains in standard and three in expert, independent of player count. Its optional explicit target supports the rulebook's one/four-villain variants.

`revealMain` handles the actual A-to-B flip, preserving the same physical ID and resolving native reveal effects. Room B starts at one threat per player and has a seven-per-player threshold. Room continuous modifiers are queried dynamically. Basketball Court toughness is evaluated only at actual ally/minion entry, so changing rooms does not give existing characters tough.

`mansionAttackVillainDefeated` receives a confirmed actual defeat receipt before the old physical villain is replaced. Ordinary Victory routing is independent of Save the School's triggered progression. `addToVictory` and `removeDefeatedVillain` retire the old live villain, clean up its attachments/statuses, and end its activation. Pending boosts and continuations tagged with that activation must finish their native cleanup without resolving later activation abilities. Remaining encounter effects from independent sources continue normally.

`mansionAttackCheckOutcome` checks the existing victory display without consulting text blanking. The embedded alternate win/loss conditions cannot be blanked; this does not make Save the School's deal/reveal/engaged-minion response or a room's When Completed ability immune to blanking.

After a new villain enters, Save the School discards a matching **engaged enemy minion**, then activates the new villain against that minion's player. A same-title minion controlled as an ally remains in play. A matching unique minion revealed later uses ordinary native uniqueness rules, including the replacement facedown encounter for an unsuccessful reveal.

## Attack receipts and effect timing

`MansionAttackEnemyAttackReceipt.playerId` is the final target player after defense, including defense by a different player's character. Each damage entry records its target's controller at the actual damage window. Damage values contain actual attack damage after prevention, including Overkill; boost and indirect damage are separate effects.

- Avalanche exhausts an eligible ally of the final target, regardless of damage dealt.
- Blob stuns each character actually damaged by that attack, once per character.
- Pyro discards two actual cards from that player's deck through the native exhaustion flow. `discardPlayerTop` augments its continuation with `printedResourceIcons`, the sum of all printed icons on cards actually discarded; the continuation requests that much native indirect damage.
- Toad discards one random hand card only when actual attack damage reached a character controlled by the final target. Multiple damaged characters do not repeat the discard.

An after-attack occurrence does not initiate every simultaneous response. `mansion:attack-response` rechecks the live physical villain before initiating its ability. If Cafeteria retaliate defeated that villain first, its old response does not initiate. An already initiated choice may finish after its source leaves.

Named treacheries and Brotherhood Beatdown compare printed titles across all encounter sets. Searches select actual deck/discard cards. Their boost abilities add a boost card only when the active villain has the specified title.

The original-source mission sweep also exposed a shared Mystic Spell payment ordering issue. Zone of Silence now chooses its real scheme and discards its additional cost before Determination's spent-resource response. If that response removes the last threat, the fully paid Spell resolves for zero threat. The same payment boundary covers Magic Attack and Summoning Spell. RRG 1.8 Costs and [official answer 207](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/#207) require all printed costs to be paid together before these responses. The exact Warlock/Mansion Attack/Expert/Under Attack seed `28816` has a native regression with JSON reloads and original-card conservation.

## Verification

`tests/mansion-attack.test.ts` exercises physical identity, setup replay, hidden shuffles, objectives, room progression/keywords, final-target responses, actual-resource receipts, native-port encounter behavior, title matching, and source/response timing. Native engine tests independently cover integration with real queue, reveal, attack, search, and payment flows.
