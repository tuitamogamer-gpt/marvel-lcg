# Rules implementation and validation

## Sources

- [FFG Learn to Play](https://images-cdn.fantasyflightgames.com/filer_public/ab/be/abbef836-d5ef-4241-b2bd-1062df73f367/mvc01_learn_to_play_eng-compressed.pdf): core setup, sequence, starter deck recipes, basic powers, and ally use.
- [FFG Rules Reference v1.7](https://images-cdn.fantasyflightgames.com/filer_public/11/9f/119fdb98-cabe-4de3-8be8-4c4dbcae9d7c/mc_rulesreference_v17-web.pdf): guard, status replacement, hit-point modifiers, hand-size handling, and keyword timing.
- Exact card text and printed values are preserved in `src/data/core-player.json` and `src/data/core-encounter.json`.

## Automated systems

Core hero and encounter cards have explicit handlers or native stat/keyword processing. The engine includes payments (including conditional Power-of resources, Web-Shooter, Scientist, and Pepper Potts), response prompts, once-per-round flags, target selection, Black Panther sequence ordering, Iron Man Tech hand size, Ultron drones, ordinary/boost encounters, villain stages, side-scheme icons, deck exhaustion, attachments and removal payments, obligations, and nemesis sets.

Important mechanics are tested independently: exhausted heroes, both forms, allied actions in alter-ego, consequential damage, tough/stunned/confused, guard for hero and ally attacks, crisis, Webbed Up, printed drone modifiers, resource validation, max-HP changes, replacement allies at the ally limit, attack boost ordering, and serialized pending choices.

## Boundaries of this first build

- Solo only. Effects that choose a player use the sole player. Multiplayer ordering and player elimination are not implemented.
- Mandatory gameplay and primary optional response windows are scripted, but the complete general-purpose timing framework (arbitrary nesting/order of every simultaneous response) is not a formal rules engine. A handler resolving without errors is not proof of every possible card interaction.
- Several optional beneficial entrance effects resolve automatically (for example, Spider-Woman's confuse and Maria Hill's draw). Shuri/Foresight search prompts show eligible cards rather than supporting an intentional failed search.
- Resource generators are evaluated before hand-payment cards are discarded. Wild resources use one chosen type per payment, with distinct mandatory requirements allocated automatically. The UI does not support assigning different optional wild types within a single payment.
- Tied highest-health minion attachments use the first eligible minion. Encounter effects that explicitly permit damage assignment do prompt for allocation.
- Obligation removal changes form and exhausts the identity; taking the alternate penalty currently preserves the existing form. The extra optional form-change decision before accepting that penalty is not exposed.
- Only core-set decks and scenarios have been implemented; no expansion compatibility is claimed.

## Verification

`npm test` runs deterministic rule fixtures plus full seeded missions across the five heroes and three villains, checking that missions terminate and every player card remains accounted for. The smoke strategy is deliberately simple; those simulations test progression and invariants, not balance or an optimal policy.

`scripts/browser-check.mjs` tests the real UI: hero selection, deck viewer, collection search, card inspection, mulligan, form change, basic attack, paying for a card, villain-phase progression, save/resume, and mobile overflow. Screenshots and the result record are written to `output/browser/`.

The standard web-game skill client also runs against the application, using `window.render_game_to_text` and the deterministic `window.advanceTime` hook. This turn-based game has no wall-clock-driven rules.
