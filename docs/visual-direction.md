# Visual direction

The game combines comic-cover composition with a tactical mission table: ivory paper, dark ink outlines, halftone texture, condensed display lettering, red actions, and yellow emphasis. Individual hero and aspect colors remain meaningful selection cues.

## References and artwork

- [Marvel Champions, Fantasy Flight Games](https://www.fantasyflightgames.com/en/products/marvel-champions-the-card-game/): existing official banner artwork, hero identities, card presentation, and the core-set palette. The banner is cached at `public/art/core-banner.jpg`; card scans retain their existing provenance in `src/data/provenance.json`.
- [Marvel Rivals hero presentation](https://www.marvelrivals.com/heroes/): reference for putting character identity, abilities, and hero selection at the center of a game interface. The implementation does not copy its UI or import its artwork.

The attempted generated illustration was rejected by the image tool. No generated image is included or claimed. The hero banner uses the existing official artwork, framed with CSS. `public/favicon.svg` is a native vector monogram.

## Decisions that affect play

- Hero identity and signature cards can be inspected before starting. The mission brief confirms the chosen hero, aspect, and 40-card deck.
- The battlefield distinguishes villain territory, the player's identity and reinforcements, and the hand. The current victory objective and scheme threshold are visible above the table.
- Playable cards have yellow borders plus a text label. A hand filter shows available plays without removing resource cards from the game state.
- Payment dialogs show the resource deficit or readiness and warn about extra resources. Selection controls expose their pressed state; keyboard focus stays on the selected resource.
- Dialogs trap keyboard focus, support Escape when cancellation is legal, restore prior focus, and lock background scrolling.
- Mobile uses an action dock with safe-area spacing. Card rows scroll within their own area. All primary card and action controls remain accessible by touch.
- Reduced-motion preferences disable interface transitions. The red action and text colors were adjusted to pass contrast checks against their actual backgrounds.

## Verification

`npm run test:design` captures the lobby and battlefield at 320, 390, 768, 1024, and 1440 pixels, checks for horizontal page overflow, and exercises hand filtering, selection state, focus trapping, Escape, scroll locking, and payment focus. It runs axe against the lobby, archive, battlefield, mulligan, inspection, help, and payment dialogs. Screenshots and findings are written to `output/design/`.

These automated audits complement visual inspection; they do not constitute comprehensive accessibility certification. The existing browser test still covers the complete setup/payment/villain-turn/save-resume flow, and engine rules coverage is unchanged.


## Desktop hot-seat and action clarity

A persistent cream-and-yellow action panel sits beside the blue game table. Each checkpoint names the actor and source, lists changes as before → after values, and keeps Proceed in a consistent footer. Attack explanations show ATK, defense, prevention, and resulting damage. All automatic resolution is explicitly acknowledged. The scrollable action/history regions are keyboard accessible.

The team strip keeps all 1–3 identities visible with health, hand counts, form/readiness, a first-player token, and current actor emphasis. Selecting another hero exposes that hero's cards and permitted Action abilities without changing turn order. Scenario scaling is shown before starting. Colored, embossed token emblems distinguish health, attack, threat/thwart, defense, and card counters; statuses include icons and descriptive tooltips.

Desktop layouts (1280, 1440, 1920px), real three-hero progression, checkpoint reload, keyboard focus, and WCAG AA checks are the current verification scope. Dedicated mobile design is deferred at the user's request.
