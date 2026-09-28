# Marvel Champions — The Tabletop

A playable, scripted **core-set, 1–3 hero hot-seat** fan implementation built with React, TypeScript, and Vite. Command one, two, or three heroes yourself. Choose each hero’s aspect and a shared villain, difficulty, and modular encounter. Play a mission at your own pace with explained action checkpoints and an automatic local save.

**[Play the game](https://marvel-lcg.vercel.app)**

## Run

```sh
npm install
npm run dev
```

Use Node.js **22.13+**. The development server includes the account API and
creates its private SQLite database in `.accounts/accounts.sqlite` (ignored by Git).

Open the local address printed by Vite. In the current workspace the preview runs at **http://localhost:5174** (5173 was already occupied).

```sh
npm test          # rules and complete seeded missions
npm run build    # TypeScript and production bundle
npm run preview  # serve the production bundle
npm run sync:cards
npm run test:ui   # with the dev server running at localhost:5174
npm run test:design # desktop layouts, keyboard behavior, and axe audits
npm run test:tabletop # crowded physical table, exhaustion, piles, and responsive layouts
npm run test:flow     # action flow, payments, defense, attachments and dialog containment
node scripts/make-icons.mjs   # regenerate the PWA icons from public/favicon.svg
```

GitHub Actions (`.github/workflows/ci.yml`) runs the tests, the production build, the formatting check and the Chromium action-flow suite on every push and pull request. Node `22.13+` is pinned in `.nvmrc` and `package.json`.

## Deploy

`vercel.json` configures the Vite production build, long-lived cache headers for `/cards`, `/art`, `/icons` and `/assets`, and the security headers (CSP, frame denial, referrer policy). Import the GitHub repository into Vercel or run `vercel --prod` from the linked project. Guest play needs no environment variables. Player accounts require a durable Upstash Redis database and server-only `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` variables in Vercel (the `KV_REST_API_URL` / `KV_REST_API_TOKEN` aliases also work). Until that database is connected the interface hides the sign-in and deck-saving controls; guest play is unaffected. See [account setup and verification](docs/player-accounts.md). Local Vercel account/project metadata is excluded from Git.

Run the same browser checks against a deployment with `BASE_URL=https://your-project.vercel.app npm run test:ui`.

## Included

- Player registration/sign-in with a username and password, a one-time recovery code, private account sessions, and sign-out.
- A player profile with up to 30 saved Core Set decks, editing and deck validation, direct use at mission setup, up to 5 resumable missions, and the last 100 completed results with win statistics.
- Account autosave preserves opening hands, decisions, payments, and action reviews. Guest progress stays separate; an unfinished guest mission can be explicitly added to an account.
- Spider-Man, Captain Marvel, Iron Man, Black Panther, and She-Hulk.
- Four selectable aspects with the official core starter-deck recipes: 15 hero + 14 aspect + 11 basic cards.
- Rhino, Klaw, and Ultron; Standard I/II or Expert II/III.
- Bomb Scare, Masters of Evil, Under Attack, Legions of Hydra, and The Doomsday Chair.
- Mulligan, payments with typed and wild resources, identity abilities, basic actions, allies, upgrades/supports, encounter/boost cards, defense and interrupt windows, nemeses, obligations, status cards, scheme and villain transitions, and victory/defeat.
- Card inspection, searchable 209-face collection, deck inspection, discard inspection, battle log, optional sound, responsive layouts, keyboard focus, reduced-motion support, and fullscreen with `F`.
- A desktop team strip, individual hands/decks/health, player-order turns, per-hero villain activations, engaged minions, teammate defense, shared card targets, and hero elimination. Scenario values scale with the starting team size.
- A full action review with card artwork, before/after stats, attack calculations, and a permanently visible **Proceed** button. **View table** closes the review without advancing the game; reopen it from the side panel. No automatic playback or timers. Enter or Space also acknowledges the current step.
- **Tempo** (mission setup and the action panel): _Guided_ pauses after every resolved step; _Brisk_ pauses only for decisions, damage or status on your side, revealed encounters, placed threat and villain stage changes; _Expert_ pauses only for decisions and damage or status on your side. Steps that resolve without a pause stay in the log and in the **Recent steps** timeline, where each can be opened in full. The rules never change with the tempo; only where the game waits for you.
- Suiting up changes to hero form immediately, without a redundant Proceed checkpoint. Abilities triggered by that change still expose their own choices and effect reviews.
- Visual resource payment: full card faces, enlarged inspection, resource icons, selected discard/ability labels, typed-cost validation, and a payment receipt. Paying pauses before the purchased card resolves.
- Encounter cards and individual attack boosts are revealed before their effects resolve, with separate acknowledgements for boost abilities and damage. Drawn/discarded cards are shown by image; unrevealed encounter cards stay face down.
- Local autosave, including a pending Proceed checkpoint, mid-payment and mid-encounter decisions. Resume from the lobby after a reload. A rendering error shows a recovery screen with reload and clear-save actions instead of a blank page.
- Installable as a web app with offline card art: a service worker caches card faces, playmats and build assets after first use, while pages and the account API always use the network first. Card art and hashed assets are served with one-year immutable cache headers.
- **Customize table** switches between three illustrated playmats and remembers your choice. Foil-style hero/encounter backs, metal health/threat/defense/counter tokens, stitched borders, and layered deck edges give the table a collector finish. [Artwork and prompts](docs/collector-tabletop-art.md).

## Card API and artwork

**Yes: [MarvelCDB provides a public API](https://marvelcdb.com/api/).** No credential is required for the public endpoints. The live core endpoint is `https://marvelcdb.com/api/public/cards/core.json`.

The engine uses the canonical split-face JSON from [zzorba/marvelsdb-json-data](https://github.com/zzorba/marvelsdb-json-data), with locally cached MarvelCDB card art. These snapshots contain 209 individual faces; the live API returned 205 records because linked faces and alternative printings are represented differently. Active main-scheme art is sourced from [Hall of Heroes](https://hallofheroeslcg.com/core-set-2/), since the original MarvelCDB filename mapping returned setup art for those faces.

See `src/data/provenance.json` for retrieval details. The app never needs a live card service during play. `npm run sync:cards` refreshes snapshots and downloads missing artwork with bounded requests. The engine has explicit scripts for core card IDs; run tests and review any data changes after syncing.

## Implementation and scope

The rules engine is a serializable state machine in `src/game/engine.ts`. Commands operate on a cloned state; invalid commands leave gameplay unchanged and return an error. Effects enter a queue that pauses at a meaningful action checkpoint or an explicit choice, payment, or selection. Player context is carried by queued effects; ownership and control are separate. `team.ts` rebinds the active view after save hydration, and `review.ts` records visible changes. The UI enables guided resolution by default; engine fixtures may use immediate resolution. Shuffle RNG is seeded and part of the saved state. The UI does not implement game effects.

This is the first playable implementation, **not a claim of exhaustive rules certification**. Tests cover all proactive core event handlers, all core encounter handlers, key rule interactions, and complete seeded missions for all 15 hero/villain pairings. See [rules coverage](docs/rules-coverage.md) for remaining limitations and validation boundaries.

Online co-op, external deck import, campaigns, and expansions are not included. Custom decks use the supported Core Set card pool. Gameplay layout verification prioritizes desktop (1280–1920px); account pages are also checked at 390px and 320px. Guests have one save slot in the current browser. Signed-in players save missions to their account. Starting a new mission asks before replacing the currently open table; account missions remain in the profile until completed or explicitly deleted.

The lobby, archive, and decision dialogs use a comic-book visual system. The battlefield recreates a physical card table with a textured playmat, health dials, full card faces, separate draw/discard piles, sideways exhausted cards, and visible teammate tableaus. See [tabletop design research](docs/tabletop-design-research.md) for the real-world references and [visual direction](docs/visual-direction.md) for the broader interface and verification scope.

This is an unofficial fan project. Marvel characters and card artwork/text belong to Marvel and Fantasy Flight Games. Community API availability does not transfer those rights. The source attribution is shown in the interface; no affiliation is implied.
