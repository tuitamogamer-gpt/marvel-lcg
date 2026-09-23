Original prompt: I want to create fully playable and scripted Marvel Champions LCG. Check if there is API for cards and start building it. It need to be very beautiful designed and functional. Start with core set.

## Foundation

- Empty starting directory. React + TypeScript + Vite; deterministic rules engine separated from UI.
- MarvelCDB public API confirmed live: https://marvelcdb.com/api/public/cards/core.json (205 API records). Community data fallback: zzorba/marvelsdb-json-data.
- Initial delivery targets solo core-set play, five heroes, three villains, selectable aspects, local save, searchable card collection, scripted choices and battle log.
- Sources, implementation coverage, and validation recorded in docs and tests.

## First playable build — 2026-09-23

- Implemented all five heroes, four aspects, three villains, five modular encounter sets, Standard/Expert setup, seeded shuffles, scripted card effects, explicit payment/target/defense decisions, and victory/defeat.
- Built responsive mission selection, tabletop, searchable collection, card/deck inspection, help, battle log, and serialized local save/resume.
- Cached all 209 card faces. Corrected six main-scheme A/B image mappings using Hall of Heroes. The final refresh succeeded through maintained JSON after the public API request temporarily failed; gameplay uses local assets.
- Verified 74 deterministic engine tests, including all 15 hero/villain pairings, status and resource interactions, and card conservation.
- Real browser checks passed for selection, mulligan, payments, basic actions, villain phase, autosave/resume, and desktop/mobile layout, with zero browser errors. Visually reviewed lobby, gameplay, and mobile screenshots.
- Final standard web-game client passed against http://localhost:5174. Text state matches the lobby. Production build and formatting checks pass; dependency audit reports zero vulnerabilities.
- Preview remains running at http://localhost:5174. Port 5173 belongs to an unrelated process. No deployment or commits have been made.

## Next work

- Follow the explicit limitations in docs/rules-coverage.md: general response ordering, optional search/entrance choices, obligation free-form change choice, tied attachment targets, and per-resource optional wild assignment.
- Extend browser coverage to complete victories and additional hero-specific interaction sequences before claiming comprehensive rules certification.
- Multiplayer, deck construction/import, and expansion support are separate future features.
