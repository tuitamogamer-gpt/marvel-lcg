# Marvel Champions — The Tabletop

A playable, scripted **solo core-set** fan implementation built with React, TypeScript, and Vite. Choose a hero, aspect, villain, difficulty, and modular encounter; play a complete mission with visible rules decisions and an automatic local save.

## Run

```sh
npm install
npm run dev
```

Open the local address printed by Vite. In the current workspace the preview runs at **http://localhost:5174** (5173 was already occupied).

```sh
npm test          # rules and complete seeded missions
npm run build    # TypeScript and production bundle
npm run preview  # serve the production bundle
npm run sync:cards
npm run test:ui   # with the dev server running at localhost:5174
```

## Deploy

`vercel.json` configures the Vite production build. Import the GitHub repository into Vercel or run `vercel --prod` from the linked project. No environment variables are needed. Local Vercel account/project metadata is excluded from Git.

Run the same browser checks against a deployment with `BASE_URL=https://your-project.vercel.app npm run test:ui`.

## Included

- Spider-Man, Captain Marvel, Iron Man, Black Panther, and She-Hulk.
- Four selectable aspects with the official core starter-deck recipes: 15 hero + 14 aspect + 11 basic cards.
- Rhino, Klaw, and Ultron; Standard I/II or Expert II/III.
- Bomb Scare, Masters of Evil, Under Attack, Legions of Hydra, and The Doomsday Chair.
- Mulligan, payments with typed and wild resources, identity abilities, basic actions, allies, upgrades/supports, encounter/boost cards, defense and interrupt windows, nemeses, obligations, status cards, scheme and villain transitions, and victory/defeat.
- Card inspection, searchable 209-face collection, deck inspection, discard inspection, battle log, optional sound, responsive layouts, keyboard focus, reduced-motion support, and fullscreen with `F`.
- Local autosave, including mid-payment and mid-encounter decisions. Resume from the lobby after a reload.

## Card API and artwork

**Yes: [MarvelCDB provides a public API](https://marvelcdb.com/api/).** No credential is required for the public endpoints. The live core endpoint is `https://marvelcdb.com/api/public/cards/core.json`.

The engine uses the canonical split-face JSON from [zzorba/marvelsdb-json-data](https://github.com/zzorba/marvelsdb-json-data), with locally cached MarvelCDB card art. These snapshots contain 209 individual faces; the live API returned 205 records because linked faces and alternative printings are represented differently. Active main-scheme art is sourced from [Hall of Heroes](https://hallofheroeslcg.com/core-set-2/), since the original MarvelCDB filename mapping returned setup art for those faces.

See `src/data/provenance.json` for retrieval details. The app never needs a live card service during play. `npm run sync:cards` refreshes snapshots and downloads missing artwork with bounded requests. The engine has explicit scripts for core card IDs; run tests and review any data changes after syncing.

## Implementation and scope

The rules engine is a serializable state machine in `src/game/engine.ts`. Commands operate on a cloned state; invalid commands leave gameplay unchanged and return an error. Effects enter a queue that pauses for an explicit choice, payment, or selection. Shuffle RNG is seeded and part of the saved state. The UI does not implement game effects.

This is the first playable implementation, **not a claim of exhaustive rules certification**. Tests cover all proactive core event handlers, all core encounter handlers, key rule interactions, and complete seeded missions for all 15 hero/villain pairings. See [rules coverage](docs/rules-coverage.md) for remaining limitations and validation boundaries.

Online co-op, multiple player seats, custom deck construction/import, campaigns, and expansions are not included. One save slot is stored in the current browser. Starting a new mission asks before replacing an unfinished one.

This is an unofficial fan project. Marvel characters and card artwork/text belong to Marvel and Fantasy Flight Games. Community API availability does not transfer those rights. The source attribution is shown in the interface; no affiliation is implied.
