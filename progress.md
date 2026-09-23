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

## Marvel visual redesign — 2026-09-23

- User requested a full Marvel-inspired UI/UX treatment after the first GitHub/Vercel release.
- Rebuilt the visual system: comic-cover lobby using the existing FFG artwork, paper/ink/halftone styling, colored hero and aspect selection, a deck-aware mission brief, tactical battlefield zones, archive, help, card inspection, result, and decision panels.
- Added identity/signature previews, a hand filter, persistent victory/threat objectives, health feedback, explicit resource progress, and a mobile action dock. Kept engine behavior and existing saves compatible.
- Fixed dialog rerender focus jumps, added scroll locking and pressed-state semantics, and verified keyboard focus trapping and cancellation.
- First visual review led to tighter portrait crops, a mobile dock layout fix, and corrected text contrast. The ten axe audits then reported zero violations; 12 layout checks passed across 320–1440 px. Browser checks reported zero errors and all 74 engine tests passed.
- Image generation was rejected; the delivered artwork is the preexisting official core banner. See docs/visual-direction.md for references and validation limits.
- Release target remains the existing private GitHub repository and https://marvel-lcg.vercel.app.

## Guided desktop hot-seat — 2026-09-23

- User requested transparent player/villain actions with Proceed, improved tokens/stats, and solo control of 1–3 heroes. Follow-up prioritizes desktop; mobile polish is deferred.
- Implemented saved engine checkpoints with source/explanation/stat deltas; queued effects carry actor context and stop until Proceed. Added independent hero seats, owner-aware zones, teammate Action events/abilities, shared targets/interrupts, defensive redirection, per-hero encounters/minions, scaling, first-player rotation, and elimination. Existing solo saves migrate.
- Desktop setup includes team size and per-seat loadouts. Table has a team strip, persistent action/history rail, stat/status/counter tokens, and read-only/basic-action gating for off-turn seats while permitting requested Action abilities.
- Validation so far: 109 engine tests pass, including seeded two/three-hero missions with save hydration and exact card ownership; real three-hero browser mission reaches round 2 with 53 acknowledged steps; 7 flow accessibility audits and 10 design audits report no violations; 1280/1440/1920 desktop layouts checked. Screenshots inspected; contrast and scroll-region keyboard fixes made.
- Final local checks: teammate Commander works during Spider-Man’s turn and preserves the once-per-round limit; 109 tests, production build, formatting, 7 three-hero flow audits, and 10 desktop design audits passed. Final screenshot review tightened the identity stat-row spacing at laptop widths. Release work: push to main, verify Vercel READY + source commit parity + canonical browser smoke.

## Visual payment and explicit action review — 2026-09-23

- User reinforced that all events must be visible, continuation must remain under player control, and resource payment must show actual cards rather than names. Desktop remains the priority.
- Replaced resource-name rows with full card faces, printed resource icons, discard/ability groups, clear selected states, preserved selections during enlargement, typed-cost readiness, overpayment information, and a fixed confirmation footer. Scientist and other resource generators use their actual card artwork.
- Every checkpoint opens a focus window with its cards, explanation, stat deltas, attack math, and fixed Proceed/next-step footer. View table and card inspection leave the action pending. The side panel remains available. Dialogs use a portal after visual inspection caught the navigation overlapping a nested review header.
- Saved review metadata now includes drawn/discarded/played cards and payment receipts. Encounter revelation, individual boost revelation, star abilities, and attack damage are separate queued steps. Hidden encounters retain card backs. Empty reveal queues do not repeat stale encounter artwork.
- Validation: 117 engine tests; real three-hero browser play reaches round 2 through 57 acknowledged steps. New UI checks cover identity artwork, cancel without spending, enlargement without losing selection, laptop footer visibility, no progress under elapsed time, and exact receipt restoration. Ten flow axe audits and ten design audits report zero violations; browser errors are absent. Standard skill client and actual payment/action screenshots were inspected. The final portal build, formatting, all 20 accessibility audits, and visual review passed. Release next: commit/push the verified source, verify Vercel READY and commit parity, and exercise the live deployment.
