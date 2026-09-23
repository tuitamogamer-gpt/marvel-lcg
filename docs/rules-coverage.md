# Rules implementation and validation

## Sources

- [FFG Learn to Play](https://images-cdn.fantasyflightgames.com/filer_public/ab/be/abbef836-d5ef-4241-b2bd-1062df73f367/mvc01_learn_to_play_eng-compressed.pdf): core setup, sequence, starter deck recipes, basic powers, and ally use.
- [FFG Rules Reference v1.7](https://images-cdn.fantasyflightgames.com/filer_public/11/9f/119fdb98-cabe-4de3-8be8-4c4dbcae9d7c/mc_rulesreference_v17-web.pdf): guard, status replacement, hit-point modifiers, hand-size handling, and keyword timing.
- Exact card text and printed values are preserved in `src/data/core-player.json` and `src/data/core-encounter.json`.

## Automated systems

Core hero and encounter cards have explicit handlers or native stat/keyword processing. The engine includes payments (including conditional Power-of resources, Web-Shooter, Scientist, and Pepper Potts), response prompts, once-per-round flags, target selection, Black Panther sequence ordering, Iron Man Tech hand size, Ultron drones, ordinary/boost encounters, villain stages, side-scheme icons, deck exhaustion, attachments and removal payments, obligations, and nemesis sets.

Important mechanics are tested independently: exhausted heroes, both forms, allied actions in alter-ego, consequential damage, tough/stunned/confused, guard for hero and ally attacks, crisis, Webbed Up, printed drone modifiers, resource validation, max-HP changes, replacement allies at the ally limit, attack boost ordering, and serialized pending choices.

## Multiplayer and guided resolution

Queued effects carry an actor seat. Cards retain ownership when control changes (Make the Call, Inspired, and transferable upgrades); discarded player cards return to their owner's pile. Team targets include healing, readying allies, Commander, Stark Tower, Energy Daggers, Lead from the Front, Maria Hill, Avengers Mansion, and Helicarrier. Guard and Ultron's engaged-drone effects use the appropriate hero's play area. Any eligible hero or ally may defend for a teammate, and the attack's target becomes the defender's controller. A teammate may offer Action abilities and Action events during the active hero's turn; basic powers, ally attacks/thwarts, and playing permanent cards require their own turn.

Core encounter effects that refer to each player, each hero, the first player, or an obligation's owner have separate seat routing. Great Responsibility, I Object!, Emergency, Black Widow, and Get Behind Me offer eligible team responses. Black Widow's controller reveals the replacement encounter, following the [published designer ruling](https://hallofheroeslcg.com/official-ffg-rulings/).

Guided mode records an atomic action's visible changes, then stops the effect queue until `PROCEED`. A choice produced by that action remains pending behind its review. Invalid or premature commands are rejected without advancing the state. Pauses, queued actor context, RNG, and all hero zones survive JSON save/reload. Older solo saves are migrated on load.

An explicit change to hero form skips the identity-change review, so Suit up requires only one click. The form change remains logged, and queued abilities triggered by the change retain their own choices and reviews. Changing back to alter-ego retains its existing review.

Reviews include visible card movements and payment receipts, not just zone counts. Encounter reveal, encounter resolution, each attack boost, its star ability, and attack damage use separate queued steps. Klaw's two attack boosts are individually acknowledged. Typed payment validation is shared between the preview and engine; spent hand cards and resource generators retain distinct identities in the saved receipt. Face-down cards and hidden deck order are not exposed by review metadata.

## Remaining boundaries

- One human controls 1–3 hero seats on one device. Each has separate owned zones, resources, health, flags, and minion engagement. Turns, end-of-phase discard/refill/ready, villain activations, hazard distribution, encounter reveal order, first-player rotation, and elimination are implemented. The per-player multiplier retains the starting team size.
- Mandatory gameplay and primary optional response windows are scripted, but the complete general-purpose timing framework (arbitrary nesting/order of every simultaneous response) is not a formal rules engine. A handler resolving without errors is not proof of every possible card interaction.
- Several optional beneficial entrance effects resolve automatically (for example, Spider-Woman's confuse and Maria Hill's draw). Shuri/Foresight search prompts show eligible cards rather than supporting an intentional failed search.
- Resource generators are evaluated before hand-payment cards are discarded. Wild resources use one chosen type per payment, with distinct mandatory requirements allocated automatically. The UI does not support assigning different optional wild types within a single payment.
- Tied highest-health minion attachments use the first eligible minion. Encounter effects that explicitly permit damage assignment do prompt for allocation.
- Obligation removal changes form and exhausts the identity; taking the alternate penalty currently preserves the existing form. The extra optional form-change decision before accepting that penalty is not exposed.
- Only core-set decks and scenarios have been implemented; no expansion compatibility is claimed.

## Verification

`npm test` runs deterministic rule fixtures plus full seeded missions across the five heroes and three villains, checking that missions terminate and every player card remains accounted for. The smoke strategy is deliberately simple; those simulations test progression and invariants, not balance or an optimal policy.

The current suite has 118 tests, including focused transparency tests for immediate hero form changes with preserved triggered-effect reviews, pending paid cards, reloadable payment receipts, rejected typed payments, single-use wild requirements, last-counter resource generators, unchanged-count card replacements, hidden encounters, reveal-before-resolution, star-ability timing, and Klaw's individual boosts.

`scripts/browser-check.mjs` tests the real UI: hero selection, deck viewer, collection search, card inspection, mulligan, form change, basic attack, paying for a card, villain-phase progression, save/resume, all three hero turns, teammate defense/actions, shared targeting, paused boost/damage resolution, first-player rotation, and checkpoint save/resume. Desktop layouts are checked at 1280, 1440, and 1920 pixels. Screenshots and the result record are written to `output/hotseat/`.

The standard web-game skill client also runs against the application, using `window.render_game_to_text` and the deterministic `window.advanceTime` hook. This turn-based game has no wall-clock-driven rules.
