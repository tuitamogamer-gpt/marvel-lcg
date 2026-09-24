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
- Production inspection found a cold-image screenshot with a collapsed card face before its network load completed. Card images now reserve their portrait/landscape dimensions and show a named loading placeholder. Browser screenshot helpers explicitly decode visible images before capture, so production visual verification cannot pass on a missing face.

## Immediate suit-up and rounded design — 2026-09-23

- User requested no Proceed checkpoint when flipping to hero form and a general move away from sharp corners. Desktop remains the priority.
- Hero form changes now return control immediately and remain visible in the battle log. Queued triggered abilities retain their separate choices/reviews; a She-Hulk regression verifies her damage review still blocks premature continuation.
- Added shared radii for panels, dialogs, controls, card frames, labels, and grouped selectors. Rounded the cover-art boundary and softened panel/button shadows while retaining the Marvel typography, artwork, and palette.
- Local validation: 118 engine tests and the production build passed. The real three-hero UI reaches round 2 through 54 acknowledged steps, explicitly verifies immediate suit-up, and restores a pending attack checkpoint after reload. Ten flow and ten design accessibility audits report zero violations; eight desktop design layouts pass without browser errors. Standard web-game client completed; lobby, tabletop, and selected-payment screenshots were visually inspected.

## Core rules audit — 2026-09-23

- User requested an engine/rules audit focused on keywords, errata, edge cases, and interactions. Reviewed commit `d05b2b15383cf800f4e6e8afbe08f89d63b22452`; no engine/UI edits or deployment were made for this audit.
- FFG now publishes Rules Reference 1.8 (July 2026); project coverage documentation still cites 1.7. Verified official changes to Surge, Overkill, timing, and Iron Man wording.
- Existing 118 tests pass. Added an isolated audit harness under ignored `output/rules-audit/`: 51 targeted scenarios yield 12 passes, 39 rule mismatches, and zero fixture errors. This adversarial sample is not an overall correctness percentage.
- Findings, source pages, engine locations, evidence and repair order are documented in `docs/rules-audit-2026-09-23.md`. Top issues: stale card state on re-entry, Toughness/status handling, missing defender damage, attack/boost timing, premature discards, deck exhaustion, and Surge sequencing/cancellation.
- Required next work is to repair the audited failures and promote each repaired scenario into the regular regression suite; the findings are not yet fixes. Preserve manual action reviews and the requested immediate hero-form flip.

## Rules Reference 1.8 repairs — 2026-09-23

- User authorized repairing all findings. Fixed all 25 audited groups; promoted all 51 audit scenarios to regular tests and added 36 completion/interaction/save checks. All 205 tests pass locally.
- Added serialized resolving cards and facedown boost queues; corrected entry/exit state, Toughness, Quickstrike, Guard, Retaliate/consequential damage, ally-limit and HP checks, discard exhaustion, Futurist, Surge sequencing/cancellation, costs, targets, and card-specific fallbacks.
- Added final attack and scheme calculations before Proceed, with explicit threat units; ordinary suit-up remains immediate. Official Iron Man text and Surge reminders survive future card-data refreshes and link to FFG in card inspection.
- Final local validation: all 205 tests, production build, formatting and diff checks pass. Three-hero browser flow reaches round 2 through 68 acknowledged steps; 10 accessibility audits report zero violations and no browser errors. Focused browser checks verify Under Fire ordering, hidden Surge/save restoration, visual Legal Practice costs, scheme math before Proceed, and corrected Iron Man text. The standard skill client and screenshots were inspected. Push/deployment verification follows.

## Physical tabletop research and frontend — 2026-09-24

- User requested frontend research based on how Marvel Champions actually looks during physical play, followed by implementation. Inspected the original FFG Learn to Play PDF (especially pages 5 and 8), official gameplay overview, a photographed playmat session, and secondary setup imagery. Sources and design mapping are in `docs/tabletop-design-research.md`.
- Reworked gameplay into a continuous textured playmat with restrained stitching and card shadows, matching villain/hero health dials, blue/orange draw stacks, full face-up discard piles, complete minion/attachment/side-scheme artwork, real 90-degree exhaustion, separate ally/setup groups, and a hand spread at the bottom. Teammate public cards remain visible below the active hero's tableau.
- Kept the engine and save schema unchanged, along with immediate suit-up, explicit payment, and guided Proceed checkpoints. Hidden decks and dealt encounters remain face down. Styling is isolated in `src/tabletop.css`; lobby and dialogs retain the existing rounded comic treatment.
- Initial verification passed all 205 engine tests, the production build, ten desktop design/accessibility audits, and the real three-hero flow through round two (68 acknowledged steps, zero browser errors or accessibility violations). A duplicate accessible label introduced by teammate navigation was caught by the browser test and corrected.
- Added a crowded saved-layout regression for exhaustion geometry, full artwork, visible discard order, hidden-information boundaries, and six viewport widths. Final results and visual review to follow below.
- Final verification: production build, formatting, and diff checks pass. Desktop design checks pass all 8 layouts and 10 accessibility audits. The crowded-table test passes 7 behavior checks, all 6 widths (320, 390, 768, 1280, 1440, 1920), and both additional accessibility audits; no browser errors. Fixed a 5px small-screen navigation overflow found by this test. Visually inspected opening, populated/exhausted, three-hero round-two, payment/mulligan, and official-reference screenshots. Hero/alter-ego stat labels now follow the exposed identity face. The standard web-game client completed with no browser-error output in `output/tabletop-research/skill-final/`.
- Delivery is local at http://localhost:5174; preview server is running. No commit, push, or deployment in this task. Optional future work: draggable layout and dedicated touch ergonomics.

## Gameplay interface flow — 2026-09-24

- User feedback: villain attacks were visually focusing incidental cards, attached upgrades were not visible on their targets, and Peter Parker's Scientist was hard to discover. Preserve the existing design and rules behavior.
- Added saved attack participants to action reviews and the defense decision, with the attacked hero, chosen ally defender, and protected identity. Attack participants stay prominent while drawn/boost cards remain inspectable. The table marks the attacked identity. Defeated allies remain identifiable in the attack recap.
- Render player and encounter attachments directly with their hosts (villain, minion, allied character, including teammates). Attached upgrades no longer duplicate in the loose upgrades area. Attachment assignment gets its own visible confirmation.
- Added Scientist availability/used/form status and a card-selection entry point beside Peter's identity. Resource abilities appear first in payment, with explicit mental resource, once-per-round, and no-exhaust text. No standalone resource is spent; confirmation remains required.
- Fixed mobile review-footer clipping found in visual verification. Preserved the rules engine, card assets, and existing saved-game format with optional review metadata.
- Validation: 208 Vitest tests passed; production build and formatting passed; existing multiplayer browser checks passed (68 review steps, 10 accessibility audits, no errors); existing tabletop checks passed across 320/390/768/1280/1440/1920 widths. New `npm run test:flow` passes Scientist cancellation/payment, Tracer target selection/inspection, hero and ally defense, mobile footer containment, four accessibility audits, and zero console errors. Standard web-game client also ran successfully.
- Visually reviewed final desktop/mobile attack displays, Scientist payment, ally defense, and attachments. Artifacts: output/flow/report.json and screenshots; output/tabletop; output/hotseat.
- Local Vite preview: http://127.0.0.1:5174. Changes are uncommitted and not deployed. No outstanding issue found in the requested flows.

## Fewer confirmations and polished action workspace — 2026-09-24

- User requested fewer repetitive Proceed clicks, a desktop attack popup without scrolling, better status/resource symbols, an illustrated Scientist ability, improved Attack/Thwart controls, and commit/push/deploy.
- Grouped explicit command confirmation, preparation, ordinary boost revelation, and card disposal into meaningful action summaries. Target, defense, payment and prevention choices open directly with their saved context; payment receipts and before/after changes survive grouping and reload. Star boosts and incoming damage/threat retain their pre-resolution stops. Duplicate printed card names use stable change keys; boost thumbnails retain actual piece IDs.
- Rebuilt attack review and defense/prevention decisions into a wide three-column workspace. Participants, full card faces, attack math, messages and changes are visible together. The four desktop checks at 1280x720, 1366x768, 1440x900 and 1920x1080 assert zero dialog-content overflow. Smaller screens retain accessible scrolling and reachable controls.
- Used the official FFG Learn to Play component illustration (page 5, already cached in output/tabletop-research) to match physical status-card colors: orange Tough, yellow Stunned, purple Confused. Added distinct vector emblems and concise effect text; resource badges use an atom, fist, lightning and wild star. Image generation was considered; crisp scalable vector UI symbols and existing identity art fit this task better than bitmap replacements.
- Scientist is now a full-width illustrated identity ability with Peter Parker art, mental-resource output, availability and one clear payment entry point. Attack and Thwart use differentiated action emblems, readable values, and short outcomes. Fixed an existing unscoped pile-shadow class that also affected review panels.
- Validation: 214 engine tests pass, including six new grouped-flow regressions. Three-hero browser play reaches round two with 28 acknowledged reviews (previous recorded flow: 68), 10 clean accessibility audits and no browser errors. Flow tests pass with six clean audits, four no-scroll desktop sizes, mobile footer containment, Scientist/attachments and hero/ally defense. Design checks pass 8 layouts/10 audits; crowded-table checks pass 6 widths/2 audits. Screenshots inspected; fixed laptop overflow and status contrast found during verification.
- Final local production build, formatting and diff checks pass. The prevention dialog also fits 1280x720 and Backflip was exercised through actual damage resolution. Release verification follows. No unresolved issue in the requested flows; future expansion-card content may require additional density handling.

## Collector playmats, card backs, and tokens — 2026-09-24

- User requested imagegen-designed playmats, card backs, premium tokens, and commit/push/deploy. Generated three separate playmat artworks (Midnight Manhattan, Helicarrier, Cosmic Rift), sapphire hero and copper encounter backs, and a four-face metal/enamel token atlas using the built-in imagegen tool. WebP assets live in `public/art/tabletop/`; original PNGs are preserved in ignored `output/premium/source/`. Full final prompts and provenance are in `docs/collector-tabletop-art.md`.
- Added an accessible Customize table dialog with artwork previews and persistent selection independent of mission saves. Unknown preferences safely select the default. Integrated card backs into draw piles, facedown encounters, and hidden review cards; empty piles retain empty slots. Added illustrated health, threat, defense, card counters and first-player markers, foil highlights, stitched trim, metal health dials, and deck-edge depth. Values remain real text and unrevealed card identities are never passed to the decorative components.
- Extended the existing tabletop browser checks to verify all artwork decodes, three theme selections, reload persistence, invalid preference fallback, unchanged mission saves, keyboard focus, and small-screen containment. Local checks passed: 214 engine tests, TypeScript/production build, formatting/diff checks; six crowded viewport widths; all 33 accessibility audits across tabletop/design/flow/gameplay; three-hero real play to round two with 28 acknowledged reviews; zero browser errors. Standard web-game client completed. Visually inspected all three surfaces, collection dialog, crowded/exhausted state, mobile picker, and opening hand.
- Final focused browser check confirms both empty draw piles show empty slots instead of card backs, low HP retains its warning border, and customization works at 1280px. Final production build and diff check pass. Production release is authorized and follows. No outstanding issue in the requested feature set.

## Original Marvel Champions visual identity — 2026-09-24

- User clarified that the whole design, including fonts, must follow the original game. Inspected the official Learn to Play PDF visually and read its embedded font names: Exo 2, Avenir, Avenir Next Condensed, Komika, and other artwork fonts. The original core-set print design now takes precedence over the collector ornament direction.
- Bundled Exo 2 for section/action headings and Source Sans 3 as the fallback to system Avenir. Removed Manrope; kept Barlow Condensed only for the existing MARVEL wordmark approximation. Added extended Latin coverage. Updated setup, card library, gameplay and dialogs through shared typography tokens and `src/champions-theme.css`.
- Added cyan rules-panel headers, ink outlines, compact corners and cardboard shadows. Replaced visible metal tokens and foil backs with flat colored icons and blue/orange comic-art backs. Player and villain HP dials follow the orange/dark components and contrasting number windows; first-player emphasis uses the printed exclamation motif. These are documented adaptations, not exact component scans. Existing playmats, card faces, saves and gameplay logic remain intact.
- Validation: production build, formatting and diff checks pass. Existing design suite passes 8 layouts and 10 accessibility audits; tabletop suite passes 6 crowded viewport widths and 7 audits; action-flow suite passes 6 audits including payment, defense, attachments and desktop dialog containment. Zero reported accessibility violations or browser errors. Visually reviewed the lobby, table, payment and 1280x720 attack dialog. Logs: `output/champions-*-check.log`; screenshots in `output/design/`, `output/tabletop/`, `output/flow/`.
- Local preview is running at http://localhost:5174. User authorized commit, push, and production deployment after validation; production verification follows.
