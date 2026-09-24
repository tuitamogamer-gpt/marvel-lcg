# Visual direction

The original Marvel Champions core set is the visual reference for the whole interface, including typography. Use the printed cards, components, and Learn to Play book to guide decisions. The lobby, collection, and decision windows use paper backgrounds, ink outlines, halftone texture, bold italic headings, cyan rules panels, red actions, and yellow emphasis. Gameplay uses a physical card table: an illustrated playmat, complete card faces, blue/orange draw piles, face-up discards, health dials, and sideways exhausted cards. See [tabletop design research](tabletop-design-research.md) for the sources and the physical-to-digital decisions. Individual hero and aspect colors remain meaningful selection cues.

Use compact printed frames: 8px panel and dialog corners, 7px card containers, 5px controls, and 3px small labels. Dark offset shadows suggest layered cardboard. Preserve rounded playing-card corners and curved HP dials. Metallic trim, engraved fantasy ornament, and foil tokens are superseded by the core-set print direction. The final visual layer is `src/champions-theme.css`; shared typography and radius tokens are in `src/styles.css`.

## Typography and component reference — 2026-09-24

The [official Learn to Play PDF](https://images-cdn.fantasyflightgames.com/filer_public/ab/be/abbef836-d5ef-4241-b2bd-1062df73f367/mvc01_learn_to_play_eng-compressed.pdf) was inspected visually and its PDF font names were read. It contains Exo 2 (including modified/scaled styles), Avenir, Avenir Next Condensed, Komika Title, Komika Text Tight, and other fonts in embedded card artwork.

- Section and action headings use locally bundled **Exo 2**, including its real bold italic face. This is the same family used in the rulebook, not a claim of an exact match to every proprietary or modified card font. The package is [OFL licensed](https://fontsource.org/fonts/exo-2/about).
- Body copy prefers system **Avenir Next / Avenir**, with locally bundled **Source Sans 3** as the cross-platform fallback. No proprietary fonts are copied out of the PDF. Latin and extended Latin subsets support B/H/S characters. Manrope is removed; Barlow Condensed is retained only for the existing MARVEL wordmark approximation.
- Pages 3–5 guide the orange player HP dial, dark villain dial, colored number windows, flat colored tokens, yellow/purple/orange status cards, and red first-player emphasis. Values remain accessible live text. Symbols help distinguish tokens without relying on color alone.
- Card backs are CSS adaptations with the existing attributed banner artwork, a blue or orange tint, and the MARVEL wordmark. They do not reveal deck contents and are not exact scans of official backs. The generated playmat choices and saved preferences remain available.

## References and artwork

- [Marvel Champions, Fantasy Flight Games](https://www.fantasyflightgames.com/en/products/marvel-champions-the-card-game/): existing official banner artwork, hero identities, card presentation, and the core-set palette. The banner is cached at `public/art/core-banner.jpg`; card scans retain their existing provenance in `src/data/provenance.json`.
- [Marvel Champions Learn to Play](https://images-cdn.fantasyflightgames.com/filer_public/ab/be/abbef836-d5ef-4241-b2bd-1062df73f367/mvc01_learn_to_play_eng-compressed.pdf): primary reference for lettering, panel colors, printed frames, and physical components. General superhero videogame interfaces are secondary to the original card game.

The lobby banner uses the existing official artwork, framed with CSS. `public/favicon.svg` is a native vector monogram. Gameplay includes three imagegen playmats (Midnight Manhattan, Helicarrier, Cosmic Rift), with selection saved independently of the mission. The earlier generated foil backs and token atlas remain archived in the project; the active interface uses the printed component adaptations described above. See [collector tabletop artwork](collector-tabletop-art.md) for the historical assets and prompts.

## Decisions that affect play

- Hero identity and signature cards can be inspected before starting. The mission brief confirms the chosen hero, aspect, and 40-card deck.
- The battlefield distinguishes villain territory, the player's identity and reinforcements, and the hand. The current victory objective and scheme threshold are visible above the table.
- Playable cards have yellow borders plus a text label. A hand filter shows available plays without removing resource cards from the game state.
- Payment uses a desktop resource desk: the purchased card stays beside a grid of full resource-card faces. Selected cards explicitly say they will be discarded; resource abilities are a separate group with their own identity/support/upgrade artwork and costs. Enlarging a card preserves the selection. A fixed footer reports the resource total, missing types, excess payment, and the confirmation button.
- Dialogs trap keyboard focus, support Escape when cancellation is legal, restore prior focus, and lock background scrolling.
- Mobile uses an action dock with safe-area spacing. Card rows scroll within their own area. All primary card and action controls remain accessible by touch.
- Reduced-motion preferences disable interface transitions. The red action and text colors were adjusted to pass contrast checks against their actual backgrounds.

## Verification

`npm run test:design` checks desktop layouts at 1280, 1440, and 1920 pixels for horizontal page overflow and exercises hand filtering, selection state, focus trapping, Escape, scroll locking, and payment focus. It runs axe against the lobby, archive, battlefield, mulligan, inspection, help, and payment dialogs. Screenshots and findings are written to `output/design/`.

These automated audits complement visual inspection; they do not constitute comprehensive accessibility certification. The browser test also exercises the complete setup/payment/villain-turn/save-resume flow, resource-card enlargement, cancellation, saved receipts, and the absence of timed advancement.


## Desktop hot-seat and action clarity

A cream-and-yellow focus window opens for each action checkpoint. Card faces occupy the main area; the source, explanation, payment receipt or attack calculation, and before → after values stay alongside them. Proceed and the next-step description remain in a fixed footer, including on 1280×800 laptops. View table returns to the persistent side panel without advancing the game. Card inspection also leaves the step pending. Dialogs render above the navigation through a shared portal. The scrollable action/history regions are keyboard accessible.

The explicit Suit up click immediately changes the identity to hero form and records it in the battle log. It does not open a second confirmation. Any ability triggered by the change, such as She-Hulk's damage, still has its own choice or effect review.

The engine separates encounter revelation from its text, each attack boost from its star ability, and payment from the resulting play. Draws and discards show the actual card identities even if the hand count stays unchanged. Face-down encounter cards show a back until they are revealed. Pending reviews, including their card images and receipt details, survive save/resume.

The team strip keeps all 1–3 identities visible with health, hand counts, form/readiness, a first-player token, and current actor emphasis. Selecting another hero exposes that hero's cards and permitted Action abilities without changing turn order. Scenario scaling is shown before starting. Colored, embossed token emblems distinguish health, attack, threat/thwart, defense, and card counters; statuses include icons and descriptive tooltips.

Desktop layouts (1280, 1440, 1920px), real three-hero progression, checkpoint reload, keyboard focus, and WCAG AA checks are the current verification scope. Dedicated mobile design is deferred at the user's request.
