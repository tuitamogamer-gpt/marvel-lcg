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

The single-screen table set its labels at 6–8px. On the desktop table uppercase labels now start at 9px and captions, card names and log text at 9–10px. A few captions with no room to grow stay at 8–8.5px: the tagline in the wordmark, the attachment caption and name, the exhausted label, in-play action buttons and, in windows up to 800px tall, in-play card names. Each label is pinned to the line box it already had, so the table's zones stay where they were. Phones and tablets scroll the table and use 10–10.5px; in-play actions stack one per row there, and below 600px a teammate's cards in play start their own row under the teammate's identity and attached cards. (CI run 90 found that at 320px the larger teammate label squeezed that row into a 6px scrolling sliver with no focusable content, an axe `scrollable-region-focusable` violation.) Lobby, library, campaign, account and dialog fine print starts at 10px.

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

## Two villains on one table — Tower Defense, 2026-11-17

Tower Defense is the first scenario with two villains and two main schemes in play at once, and its villain play area stays close to the height of a one-villain scenario so the hero's area stays in view: 241px at 1280 × 900, or 292px when one villain carries two attachments, against about 180px for Ebony Maw.

- **Villains.** Proxima Midnight and Corvus Glaive are two compact rows in the villain column, always in that order: a 64px card, attachments stacked in a narrow column beside it, then the stage label, name, hit-point dial, ATK and SCH. The active villain's row is lit in gold and labelled "Active villain"; during the player phase the other row says it activates in the next villain phase. A villain held at 0 hit points says it cannot be defeated while the other has hit points remaining.
- **Main schemes.** Both main schemes sit side by side in a two-column grid, Under Siege (1B) then The Armies of Thanos (2B), each with its threat token and per-phase threat. Focused Defense is a gold "Focused · 1B/2B" chip in the active scheme's heading, which inspects the card; the scheme also gets a gold outline. Each scheme's completion effect is in the title of its threat line.
- **Avengers Tower** is a full-width strip under the two schemes: a small card, its side ("Stronghold" or "Damaged"), a damage count against the per-player limit with a meter, and what happens at the limit.
- On phones the rows, the two schemes and the Tower strip stack in the single opposition column; nothing scrolls sideways at 320px. The Tower Defense browser check audits the table at 1280, 768, 390 and 320px.


## Hela's two sides and the Journey Through Hel, 2026-11-18

Hela's information lives in the columns the table already has, so her villain play area stays the height of a one-villain scenario and the side schemes keep their place in the scheme lane.

- **Hela's side.** The villain label reads "Villain · A · Mystic" or "Villain · A · Wounded" (B in Expert). On the Wounded side the hit-point dial shows ∞ instead of 0/0 and is announced as infinite; a caption says she cannot be defeated and flips back when a side scheme is defeated. On the Mystic side a caption says whether Odin is still captive (defeat only flips her) or free (defeat her to win). The mission objective in the header follows the same state.
- **Journey Through Hel.** A compact track under Hela's captions: three numbered chips for Gnipahellir, Gjallerbru and Hall of Nastrond (green when cleared, red while their minion locks them, gold when in play, dim while set aside) and an Odin chip ("Odin · Captive" or "Odin · Free"). Each chip is a list item whose name spells out the state, for example "Gjallerbru: locked by Skurge".
- **Locks and Odin.** A locked Journey side scheme says "Locked by Garm" (or Skurge, Nidhogg) under its threat. Odin, attached to the main scheme, is captioned "Captive"; once free he is an ordinary ally card in the first player's area.
- A first version put the Journey list in the scheme lane and then under the main scheme; both pushed the side schemes or the hero's area out of view at 1280 × 900, so the track moved to the villain column. The Hela browser check audits the table at 1280, 768, 390 and 320px.

## Loki's five villain cards, 2026-11-18

Loki reuses the one-villain table. Under his ATK and SCH a caption counts the Lokis defeated against the victory condition and the Lokis still set aside ("Lokis defeated · 1 of 2 · 3 set aside", announced as a full sentence), and the Infinity Stone deck caption from the Thanos scenario follows. While Loki 21160 cannot take damage because a side scheme is in play, a status caption says so. The mission objective in the header reads "Defeat 2 Lokis · 1 defeated", and an Infinity Stone's caption names Loki as the villain whose activation resolves it. The Loki browser check audits the table at 1280, 768, 390 and 320px.

## The Wrecking Crew's four villains, 2026-11-18

The villain column becomes a grid of four compact villain rows, two per row when there is room and one per row on phones. Each row shows the villain's card with his attachments in a narrow column, ACTIVE VILLAIN or VILLAIN with his A or B version, his hit points, ATK and SCH, status cards, his side scheme's threat out of 10 and his own encounter deck and discard counts; the active villain's row is lit and says that he has the active counter or activates this villain phase. A defeated villain stays as a slim dashed marker. Above the grid, "Defeat all four villains · 0 of 4 defeated" is announced as a status, and the header objective repeats it. Each signature side scheme is labelled with its villain ("WRECKER'S SIDE SCHEME") and "Forced Response at 10 · stays in play", which turns red from 7 threat; Held Hostage sits on its scheme with its Hero Action. The encounter deck label names the active villain whose deck it is. The setup screen shows no modular choice for this scenario, only a short explanation. The Wrecking Crew browser check audits the table at 1280, 768, 390 and 320px.

## Kang's stages and separate game areas, 2026-11-19

Kang reuses the one-villain table. Every Kang shares the title, so the villain heading shows KANG with the version's subtitle on its own smaller line, "(THE CONQUEROR)" or "(SCARLET CENTURION)", instead of letting the long name break inside a word on phones. Under the villain's status a short timeline names the stage ("Stage 1 · Kang's Arrival", "Stage 3 · 2 separate game areas", "Stage 4 · Kang's Wrath") and, as a status, why Kang cannot take damage (a Kang's Dominion, or Immortus with a minion in play) or that no villain is in play until the phase ends. In stage 3 it counts the Kang's Dominions waiting under Kang's Wrath and the acceleration tokens on The Master of Time, and lists every other game area as a compact bordered box: its heroes, their Kang (II) with hit points, and their stage 3B scheme with its threat and target, side schemes and minions, each announced as one sentence. The play area label reads "YOUR GAME AREA · 2 SEPARATE AREAS" when several heroes are apart. The header objective follows the stage ("Defeat Kang (I)", "Defeat Kang (Scarlet Centurion) in your game area", "Defeat Kang (III)"), and the per-round threat line leaves out the acceleration tokens while they wait on stage 2B. Encounter obligations show their Alter-Ego Action buttons on the card in play. The Kang browser check audits the table at 1280, 768, 390 and 320px.
