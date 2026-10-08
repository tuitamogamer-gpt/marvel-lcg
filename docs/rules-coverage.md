# Rules implementation and validation

## Sources

- [FFG Learn to Play](https://images-cdn.fantasyflightgames.com/filer_public/ab/be/abbef836-d5ef-4241-b2bd-1062df73f367/mvc01_learn_to_play_eng-compressed.pdf): core setup, sequence, starter deck recipes, basic powers, and ally use.
- [FFG Rules Reference v1.8](https://images-cdn.fantasyflightgames.com/filer_public/ee/30/ee304242-73cd-4f70-bcdd-b904a5fecad5/mc_rulesreference_v18_compressed.pdf): guard, status replacement, hit-point modifiers, hand-size handling, and keyword timing.
- Downloaded card text and printed values are preserved in `src/data/core-player.json` and `src/data/core-encounter.json`. The runtime applies the official Iron Man correction from `src/data/core-errata.json` and updates printed Surge reminders for RRG 1.8. Card inspection links to the applicable rule; artwork retains its original printing.

## Automated systems

Core hero and encounter cards have explicit handlers or native stat/keyword processing. The engine includes payments (including conditional Power-of resources, Web-Shooter, Scientist, and Pepper Potts), response prompts, once-per-round flags, target selection, Black Panther sequence ordering, Iron Man Tech hand size, Ultron drones, ordinary/boost encounters, villain stages, side-scheme icons, deck exhaustion, attachments and removal payments, obligations, and nemesis sets.

Dedicated expansion modules add Captain America, Hulk, Ms. Marvel, Thor, Black Widow and Doctor Strange, both Green Goblin scenarios and all four modular sets from its pack. Exact dependency and face-registration counts are in [engine-expansion-coverage.md](engine-expansion-coverage.md); registered cards and passing fixtures do not certify every interaction or the unfinished collection.

Shared native timing includes deferred attack responses after all clauses of a compound attack, first-player ordering of mandatory Retaliate before optional responses, identity-attributed non-attack event defeats, and reloadable Core/Goblin When Revealed windows. Media Coverage repeats applicable abilities without duplicating physical entries; gained Surge has a distinct non-stacking keyword group. Personal effects skip eliminated players while shared continuations and encounter cleanup complete. Form and ready locks apply to basic actions, obligations, printed ready effects and refill. Separate attack contexts let Dance of Death finish each attack's mandatory and optional responses before its next attack. Preparations retain their completion context after discard costs; Widowmaker and Synth-Suit follow actual resolution, with no followers for canceled abilities.

Doctor Strange has five physical Invocation cards in separate per-seat deck/discard zones, a public top card, printed-cost ability payments and deck recycling without an encounter penalty. Master of the Mystic Arts pays its event and Invocation costs together, discards/resets the Invocation deck, then restores the original physical card to the top. Counterspell follows status replacement and applies to played events; Invocation Specials resolve outside the event-play hook. The [Hero Pack integration contract](engine-hero-pack-integration.md) distinguishes current primary rules, interpretations and native tests.

Important mechanics are tested independently: exhausted heroes, both forms, allied actions in alter-ego, consequential damage, tough/stunned/confused, guard for hero and ally attacks, crisis, Webbed Up, printed drone modifiers, resource validation, max-HP changes, replacement allies at the ally limit, attack boost ordering, and serialized pending choices.

## Multiplayer and guided resolution

Queued effects carry an actor seat. Cards retain ownership when control changes (Make the Call, Inspired, and transferable upgrades); discarded player cards return to their owner's pile. Team targets include healing, readying allies, Commander, Stark Tower, Energy Daggers, Lead from the Front, Maria Hill, Avengers Mansion, and Helicarrier. Guard and Ultron's engaged-drone effects use the appropriate hero's play area. Any eligible hero or ally may defend for a teammate, and the attack's target becomes the defender's controller. A teammate may offer Action abilities and Action events during the active hero's turn; basic powers, ally attacks/thwarts, and playing permanent cards require their own turn.

Core encounter effects that refer to each player, each hero, the first player, or an obligation's owner have separate seat routing. Great Responsibility, I Object!, Emergency, Black Widow, and Get Behind Me offer eligible team responses. Black Widow's controller reveals the replacement encounter, following the [published designer ruling](https://hallofheroeslcg.com/official-ffg-rulings/).

Guided mode records an atomic action's visible changes, then stops the effect queue until `PROCEED`. A choice produced by that action remains pending behind its review. Invalid or premature commands are rejected without advancing the state. Pauses, queued actor context, RNG, and all hero zones survive JSON save/reload. Older solo saves are migrated on load.

An explicit change to hero form skips the identity-change review, so Suit up requires only one click. The form change remains logged, and queued abilities triggered by the change retain their own choices and reviews. Changing back to alter-ego retains its existing review.

Reviews include visible card movements and payment receipts, not just zone counts. Encounter reveal, encounter resolution, each attack boost, its star ability, and attack damage use separate queued steps. Klaw's two attack boosts are individually acknowledged. Typed payment validation is shared between the preview and engine; spent hand cards and resource generators retain distinct identities in the saved receipt. Face-down cards and hidden deck order are not exposed by review metadata.

## Tempo

Guided mode records every resolved action; the tempo only decides where the effect queue waits for `PROCEED`. _Guided_ keeps the original behaviour. _Brisk_ and _Expert_ judge each resolved effect by its own review (`stopsFor` in `src/game/review.ts`): a hero losing hit points or gaining Stunned/Confused, a friendly character taking damage or leaving play, a villain stage change, or a card discarded from hand during the villain phase always pause; _Brisk_ additionally pauses for a revealed encounter card, placed threat and an enemy entering play. Prompts (payments, targets, defenders, choices) pause in every tempo, and the final review of a mission is always shown. Reviews that resolve without a pause are kept in `timeline` (last eight) so nothing is hidden. Turn hand-offs (`beginTurn`) and an empty stage setup no longer pause in any tempo. `tests/pacing.test.ts` checks that the faster tempos need fewer acknowledgements than Guided, that every pause has one of the reasons above, that decisions still pause, and that the click budget per round holds for solo and three-hero missions.

## Rules Reference 1.8 corrections

All 25 groups from the [core audit](rules-audit-2026-09-23.md) have regression coverage in `tests/rules-v18.test.ts`: the original 51 scenarios and 36 additional interaction, completion, and saved-state checks. This does not constitute exhaustive certification of every core combination.

- Entry/exit resets, Toughness, Quickstrike after When Revealed, Guard across attacks, status priority, consequential damage, surviving-character Retaliate, and separate duplicate Spider-Tracer triggers.
- Ally-limit and lethal-HP checks after modifiers leave play; dynamic Ultron II ATK uses the originally attacked player's drones. A defeated ally defender redirects the remaining attack to its controller.
- Events/treacheries remain in a serialized resolving zone until their effects finish. Facedown boosts are dealt before defense, revealed individually, discarded after their star abilities, and supported for both attacks and schemes. Final ATK/DEF and SCH/boost calculations pause before damage or threat is applied.
- Draw continues after reshuffling; discard-until stops at exhaustion. Futurist keeps looked-at cards in the deck until the choice. Black Cat cannot duplicate a card that already reshuffled.
- Surge deals a facedown encounter to the back of that player's queue. Printed Surge is canceled with the treachery's When Revealed effects. Under Fire retains its separate immediate reveal; the player chooses the order of its two When Revealed abilities.
- Additional Legal Practice costs, Focused Rage damage costs, exhausted Vision, Superhuman Strength, hero-only targets, shared Enhanced Spider-Sense, I Object timing, Cosmic Flight damage prevention, Crisis Interdiction's full-resolution requirement, and First Aid's character targets.

## Remaining boundaries

- One human controls 1–3 hero seats on one device. Each has separate owned zones, resources, health, flags, and minion engagement. Turns, end-of-phase discard/refill/ready, villain activations, hazard distribution, encounter reveal order, first-player rotation, and elimination are implemented. The per-player multiplier retains the starting team size.
- Mandatory gameplay and primary optional response windows are scripted, but the complete general-purpose timing framework (arbitrary nesting/order of every simultaneous response) is not a formal rules engine. A handler resolving without errors is not proof of every possible card interaction.
- Several optional beneficial entrance effects resolve automatically (for example, Spider-Woman's confuse and Maria Hill's draw). Shuri/Foresight search prompts show eligible cards rather than supporting an intentional failed search.
- Resource generators are evaluated before hand-payment cards are discarded. Wild resources use one chosen type per payment, with distinct mandatory requirements allocated automatically. The UI does not support assigning different optional wild types within a single payment.
- Tied highest-health minion attachments use the first eligible minion. Encounter effects that explicitly permit damage assignment do prompt for allocation.
- Obligation removal changes form and exhausts the identity; taking the alternate penalty currently preserves the existing form. The extra optional form-change decision before accepting that penalty is not exposed.
- The installed expansion modules cover the six listed Hero Packs, both Green Goblin scenarios and all four modular sets from that product. Exact Core aliases and strictly compiled whole-text programs expand deckbuilding. The rest of the imported catalog remains unavailable for automated play; see [the live coverage inventory](engine-expansion-coverage.md). The entire 69-hero collection and campaigns are not scripted.

## Verification

`npm test` runs deterministic rule fixtures plus full seeded missions across the 31 registered identities and five scenarios, checking that missions terminate and every player card remains accounted for. The exact-source suite additionally is configured for 2,340 configurations: twenty-six expansion preconstructed decks across five scenarios, both difficulties and nine modular sets. Doctor Strange invariants account for its five supplementary Invocation cards separately from the 40 ordinary cards. The smoke strategy is deliberately simple; those simulations test progression and invariants, not balance or an optimal policy.

The suite includes focused transparency tests for immediate hero form changes with preserved triggered-effect reviews, pending paid cards, reloadable payment receipts, rejected typed payments, single-use wild requirements, last-counter resource generators, unchanged-count card replacements, hidden encounters, reveal-before-resolution, star-ability timing, and Klaw's individual boosts.

`scripts/browser-check.mjs` tests the real UI: hero selection, deck viewer, collection search, card inspection, mulligan, form change, basic attack, paying for a card, villain-phase progression, save/resume, all three hero turns, teammate defense/actions, shared targeting, paused boost/damage resolution, first-player rotation, and checkpoint save/resume. Desktop layouts are checked at 1280, 1440, and 1920 pixels. Screenshots and the result record are written to `output/hotseat/`.

`scripts/expansion-check.mjs` additionally exercises real Hulk Smash payment/Overkill, Mutagen delayed boosts, indirect damage allocation, save/reload and responsive decision windows. `scripts/engine-continuation-check.mjs` covers Thor, Ms. Marvel, Risky Business counters, form/ready locks, ally limits and mandatory response ordering. `scripts/hero-pack-check.mjs` exercises the faceup Invocation inspector, hidden special-deck order, native Spell Mastery payment, physical Preparation discard and ordered followers, both original source-deck launches, pending-decision reloads and 1440/390/320-pixel layouts.

The account API also has a native Node production-entry smoke (`npm run test:production-entry`). It loads the actual transpiled function/dependency graph with explicit `.js` module specifiers and JSON import attributes, then verifies the unconfigured-storage response without network or local SQLite access. This catches serverless import failures that bundled Vitest/Vite checks can conceal; it does not certify cloud persistence or card rules.

The standard web-game skill client also runs against the application, using `window.render_game_to_text` and the deterministic `window.advanceTime` hook. This turn-based game has no wall-clock-driven rules.
