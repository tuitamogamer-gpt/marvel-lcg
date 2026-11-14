# Visual direction

The original Marvel Champions core set is the visual reference for the whole interface, including typography. Use the printed cards, components, and Learn to Play book to guide decisions. The lobby, collection, and decision windows use paper backgrounds, ink outlines, halftone texture, bold italic headings, cyan rules panels, red actions, and yellow emphasis. Gameplay uses a physical card table: an illustrated playmat, complete card faces, blue/orange draw piles, face-up discards, health dials, and sideways exhausted cards. See [tabletop design research](tabletop-design-research.md) for the sources and the physical-to-digital decisions. Individual hero and aspect colors remain meaningful selection cues.

Use compact printed frames: 8px panel and dialog corners, 7px card containers, 5px controls, and 3px small labels. Dark offset shadows suggest layered cardboard. Preserve rounded playing-card corners and curved HP dials. Metallic trim, engraved fantasy ornament, and foil tokens are superseded by the core-set print direction. The print theme is `src/champions-theme.css`; shared typography and radius tokens are in `src/styles.css`. `src/premium-polish.css` loads last and holds the scenario picker, the type floor and the large-display scaling described under [Polish pass](#polish-pass--2026-11-14).

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

## Polish pass — 2026-11-14

This pass keeps the print direction above and refines its execution. Nothing here changes rules, saves or card data.

### Scenario picker

Twenty scenarios no longer fit a row of large tabs. The lobby lists them under the product they come from, in release order, each with a crop of the villain's printed art and a four-step difficulty meter. The list scrolls inside its own 404px frame, so the briefing and settings below it stay in place; product names stay pinned while their scenarios scroll. Columns come from the list's own width (one, two from 460px, three from 720px), so the same component serves the narrow desktop panel, tablets and phones. A scenario chosen elsewhere is scrolled into view inside the list only, never the page. Scenario buttons keep their accessible names, so existing browser checks select them unchanged. Difficulty-4 scenarios read "A brutal showdown"; they previously had no label.

### Type floor

The single-screen table set its labels at 6–8px. On the desktop table uppercase labels now start at 9px and captions, card names and log text at 9–10px. A few captions with no room to grow stay at 8–8.5px: the tagline in the wordmark, the attachment caption and name, the exhausted label, in-play action buttons and, in windows up to 800px tall, in-play card names. Each label is pinned to the line box it already had, so the table's zones stay where they were. Phones and tablets scroll the table and use 10–10.5px; in-play actions stack one per row there. Lobby, library, campaign, account and dialog fine print starts at 10px.

Three related defects are fixed: counter and health tokens rest inside the card's lower edge instead of covering the card's name, in-play names paint over the hard shadow of the card above them, and an environment's reminder text gets a 150px column on the desktop table (at the new size it would wrap to six lines in the old 100px).

### Large displays

The table was drawn for a 1440 × 900 window and kept that size on larger screens, leaving small cards and labels beside a wide empty band of playmat on a 1080p or 1440p monitor. From 1580 × 940 upward the table and its header scale up with CSS `zoom`:

| Window at least | Scale |
| --- | --- |
| 1580 × 940 | 1.1 |
| 1720 × 1030 | 1.2 |
| 1870 × 1120 | 1.3 |
| 2090 × 1250 | 1.45 |
| 2300 × 1380 | 1.6 |
| 2740 × 1640 | 1.9 |
| 3310 × 1980 | 2.3 |

Each step leaves the scaled layout at least the 1436 × 854 it was drawn for. The three card-size variables that follow the window height divide that height by the scale. Dialogs, card previews and combat ribbons render through portals outside the table and keep their own size. The rules sit behind `@supports (zoom: 1)`; without it the table keeps its previous size.

### Smaller refinements

- Panels keep their hard ink offset and gain a soft contact shadow beneath it.
- Primary and secondary buttons keep their ink edge while they move: it deepens on hover and closes on press. They previously switched to a blurred shadow on hover.
- Library tiles align their titles at the top and their details along the bottom of each row. The library note counts supported card faces from the registry instead of naming products, so it cannot go out of date.
- On phones the mission panel's team summary takes the panel's width instead of breaking a deck line in a half-width column.

### Measured verification — 2026-11-14

Two saved tables were measured before and after with the same script: a crowded Spider-Man against Rhino (six cards in play, two side schemes, an engaged minion, an attachment, seven cards in hand) and three heroes against Ronan the Accuser.

- **Text size.** Groups of visible text below 9px on the crowded table: 55 → 6 at 1440 × 900, 55 → 8 at 1366 × 768, 54 → 8 at 1280 × 720 and 69 → 1 on a 390 × 844 phone. The smallest text on the table went from 6px to 8px at every size.
- **Table zones.** On the crowded table every zone (villain, schemes, minions, encounter deck, identity, tableau, piles, action bar, hand) keeps its position to within 1px at 1440 × 900 and 1366 × 768, 2px at 1024 × 768 and 3px at 1280 × 720. The largest size change is the tableau lane, 6px taller at 1280 × 720, followed by the encounter deck zone, 4px taller at 1024 × 768. On the three-hero table the opposition zone is 13–14px shorter, because the environment's name and reminder now fit their column, so the play area below it starts 13–15px higher. The document height equals the window height in every case, as before.
- **Large displays.** At 1920 × 1080 (1.2×), 1920 × 950 and 1680 × 1050 (1.1×) and 2560 × 1440 (1.6×) both tables fit the window with no page scrolling. At 1600 × 900 nothing is scaled and the layout is the 1440 × 900 one.
- **Regression and build.** 10,856 tests pass across 292 files with one intentional skip (the source-mission matrix runs in CI). TypeScript, formatting, the production build and the native API entry pass.
- **Browser checks against the development server**, all passing with no browser errors: design, tabletop, viewport fit, flow, onboarding, catalog, expansion, engine continuation, hero packs, experience (7 flows, 10 audits), accounts, campaigns (10 flows), hero Nebula (129 audits), Brotherhood of Badoon, Infiltrate the Museum, Escape the Museum, Nebula, Ronan the Accuser, Red Skull (29 flows, 44 audits) and Zola (21 flows, 24 audits). The scenario checks select their villain through the new picker.
- **Browser checks against the production build:** Crossbones passes 84 checks, 120 accessibility audits and 120 layout checks at 1280, 768, 390 and 320px, switching scenario through the picker four times per run. Magneto, a difficulty-4 scenario near the end of the list, passes 104 checks, 260 accessibility audits and 260 layout checks.

Not run locally: the remaining production-build checks (Sabretooth, Project Wideawake, Master Mold, Mansion Attack and the other import groups), the other hero checks and the 70,200-configuration source matrix. They run in CI. The phone and tablet table was inspected by screenshot at 390 and 820px wide; dedicated mobile design remains out of scope.
