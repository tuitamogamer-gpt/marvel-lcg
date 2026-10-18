# Deadpool and the original Pool pack

The original retail printing is implemented as 59 executable faces (44001a/b through 44058), representing 77 physical cards. The original starter is the exact 40-card composition: 15 Deadpool cards, 24 Pool cards and Frenemies. Imported JSON and scans remain immutable.

`src/game/deadpool.ts` implements native player and encounter programs with engine ports. The pure card-definition layer prevents an initialization cycle through the script registry. The engine registers the hero, all original faces, source deck, identity actions, player side scheme, reactions, control changes and physical zones.

## Printed rules and physical ownership

- Regeneration is a forced defeat replacement: the same identity becomes Wade Wilson at 1 HP, with one main-scheme acceleration token and no voluntary-flip usage. Maximum Effort and Yoo-Hoo still resolve after that replacement. Concurrent Git Gud and regeneration replacements offer their legal order.
- Montage and Cable cap their own acceleration bonuses. Acceleration tokens never count as acceleration icons. All four printed icon types on player cards contribute to their native scenario effects and Pool abilities. Live Dangerously is the same physical player side scheme in the shared area, with Victory 0 and the ordinary side-scheme limit.
- One shared Dreadpool set is installed if any player chooses Pool as an aspect. The actual Crisis enters the encounter deck; six actual remaining cards occupy `state.deadpool.poolSetAside`. Merely borrowing a pink card does not choose the aspect. Crisis reveals the same reserved minion and scheme, shuffles the four remaining instances, and removes itself.
- Pool-ized retains the original ally, owner and controller while changing its current type. It uses the same newest-control-source precedence as Mind Control, Karma, Possessed and Beguiled. Dreadpool is dealt back as the same physical encounter card to the defeating player.
- Armed to the Teeth searches the supported aspect-Weapon collection, excluding Basic, identity-specific and removed-from-game cards. Swapping retains the location/attachment target but readies the incoming Weapon with its printed Uses; the outgoing card loses counters and is stored facedown. Plot Convenience preserves physical IDs and original ownership.
- Tabula Rasa and Anti-Regeneration Ray blank only the relevant printed text. Identity constants and printed actions/responses are suppressed while upgrades, existing effects, counters, traits, basic powers and ordinary form changes remain. Ray lasts through the actual attack and its aftermath. The shared legacy guard tests cover older heroes as well as Deadpool.
- Negasonic pays a DEAL-damage cost, so Tough prevention or defeat does not invalidate payment. TAKE-damage costs on Deadpool's cards require the full damage to be taken. Laser Swords occupies two Restricted slots. An exhausted Bazooka may still pay its discard cost.

## Explicit tabletop inputs

The physical metagame conditions use visible player choices and serialized state, not inferred outcomes:

- Git Gud exposes a Game history action when it is in hand. The player reports a previous win, a non-win, or a first/unknown game. The latter two enable the printed discount.
- The Merc with the Mouth asks at player-phase end whether its controller talked during that phase. Its other-player restriction is confined to that player's active turn; it does not prohibit basic defense or constant effects.
- Break Time saves the break start timestamp and pauses until the player confirms the group has returned. Healing uses actual elapsed whole minutes. Reloading retains the timestamp.
- Blackout displays six printed resource spaces (two each energy, mental and physical). Tic-Tac-Toe displays its actual 3×3 board: energy top row, mental middle row and physical bottom row. Payment, legal movement, occupied spaces, lines and total damage are tracked natively. Threat movement uses ordinary removal/defeat rules; damage movement uses actual healing.
- Rock, Paper, Scissors chooses an actual hand card before discarding. Energy beats mental, mental beats physical, physical beats energy, and wild beats those three but never wild. A winning last deck card is recovered by physical ID after the mandatory deck reset.
- War uses the actual discarded encounter card's printed boost area and actual discarded player card's printed cost.

## Sources

- Original scans: `public/cards/catalog/44001a.webp` through `44058.webp`, sourced in the immutable catalog from Cerebro's official English card images.
- Original insert: https://hallofheroeslcg.com/wp-content/uploads/2023/11/deadpool-insert.pdf
- Rules Reference 1.8: https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf
- Official FFG rulings archive: https://hallofheroeslcg.com/official-ffg-rulings/ (including Armed to the Teeth May 10, 2024; Maximum Effort June 13, 2024; Metaknowledge November 23, 2024; collection exclusions December 17, 2025; Exhausting Personality June 2, 2026).

## Validation

`tests/deadpool-engine.test.ts` exercises the full source registration/deck, public identity action, damage/defeat replacements, resource payments, original encounters, native reactions, physical ownership and metagame state. `tests/deadpool-review.test.ts` independently exercises cooperation, mandatory response restrictions, basic defense, two Restricted slots, public encounter-attachment actions, movement/defeat, actual stored Weapon Uses, deck reset and attack-bound receipts. `tests/deadpool-legacy-blank.test.ts` verifies that printed identity blanking preserves independent effects across the older implemented heroes. The Drax regression suite and the affected legacy suites also pass. Release-wide matrix/browser validation is owned by the parent import batch.
