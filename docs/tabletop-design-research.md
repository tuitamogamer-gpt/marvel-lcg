# Frontend research: a real Marvel Champions table

Research and implementation: 24 September 2026.

The gameplay screen should feel like looking down at a laid-out card game. The card faces, their position, orientation, and nearby counters carry the state. Interface controls help resolve the game without becoming the main visual object.

## References inspected

1. [Fantasy Flight Games — Learn to Play](https://images-cdn.fantasyflightgames.com/filer_public/ab/be/abbef836-d5ef-4241-b2bd-1062df73f367/mvc01_learn_to_play_eng-compressed.pdf). Downloaded and visually inspected the original PDF. Page 5 shows the player deck, counters, status cards, and health dial. **Page 8, “Mid-game play area example,” is the primary layout reference**: a shared villain area, landscape main/side schemes, separate encounter draw/discard piles, engaged enemies, and a player area containing the identity, allies, upgrades, supports, and personal piles.
2. [Fantasy Flight Games — Marvel Champions product and gameplay overview](https://www.fantasyflightgames.com/en/products/marvel-champions-the-card-game/). Confirms the relationship between hero/alter-ego forms, cards in play, resource payment from the hand, and the shared villain scenario. Used to preserve the purpose of controls during the redesign.
3. [SpiderFan — Marvel Champions tabletop photograph](https://spiderfan.org/item/beyond/02688.html) ([full photograph](https://spiderfan.org/images/item/beyond/02688/captain_america_vs_red_skull.jpg)). Visually inspected Captain America versus Red Skull on separate printed playmats. Shows sleeves, piled cards, sideways exhausted cards, tokens on cards, and dials beside identities. This is an example of player practice, not a mandatory arrangement.
4. [UltraBoardGames — illustrated core setup and ready/exhausted explanation](https://www.ultraboardgames.com/marvel-champions/game-rules.php). Secondary reproduction used to locate and cross-check the core setup imagery. The original FFG PDF is the primary reference.

The research photographs and PDF are reference material only, stored in ignored `output/tabletop-research/`. They are not shipped as application assets. Existing card artwork retains its original provenance. The blue/orange card-back patterns and the health dials are CSS interpretations, not scans of official components.

## What the references change

| Physical game observation | Implemented frontend decision |
| --- | --- |
| A shared villain area sits beyond the player's area. | A continuous, stitched-edge playmat with a clear divider; villain and schemes above, the selected identity and setup below. |
| Cards are the main objects on the table. | Complete minion, attachment, and side-scheme faces replace cropped portraits and text-only tiles. Every face-up card opens its existing inspector. |
| Schemes lie in landscape orientation. | Main and side schemes share a horizontally scrollable row; a yellow threat counter sits at the main scheme's edge. |
| Health is tracked on separate cardboard dials. | Dark villain and red hero dials show current/max health, with accessible meter values. |
| Player and encounter decks have distinct backs and separate discard piles. | Blue player / orange encounter stacks; visible counts; face-up discard tops open the full pile. Empty discards retain a marked position. |
| Exhaustion is represented by turning a card sideways. | Actual 90-degree rotation for exhausted identities and cards in play. Reserved space prevents rotated cards covering neighbouring cards or actions. Text still identifies exhaustion. |
| Allies and permanent setup accumulate around the identity. | Separate allies and upgrades/supports groups, with an ally-limit count, damage/health information, status labels, and use counters. Crowded rows wrap. |
| Other players' public cards remain visible. | Compact teammate tableaus show identities and cards in play. Selecting a teammate exposes that seat's hand and permitted actions using the existing hot-seat model. |
| A hand is held or spread along the near edge. | A lightly overlapping hand at the bottom, with resource icons and playable-card emphasis. Hover/focus lifts a card; click opens the full readable face. |

## Adaptation to a screen

Left/right placement is a convention rather than a rules requirement. Piles sit to the right to leave room for growing tableaus. The hand is always visible on the table rather than physically held. Controls and the guided action/history rail remain digital aids. A dense mid-game table can grow vertically; the interface does not shrink every card indefinitely to force a full board into one viewport.

The desktop opening layout uses substantially less vertical space than the previous dashboard layout. The mission heading and solo seat share a row, health bars are replaced with dials, and the hand filter shares its header. Smaller screens stack zones and preserve access to piles, controls, and card inspection.

The redesign does not alter rules, timing, game state, payment, manual Proceed checkpoints, or save format. Draw-deck order and unrevealed encounter identities are never shown. An Ultron drone continues to use a player-card back rather than its hidden underlying card.

## Verification

- `npm test`: existing rules, timing, transparency, and hot-seat regressions.
- `npm run build`: TypeScript and production bundle.
- `npm run test:ui`: actual three-hero progression through round two, payments, immediate form changes, checkpoints, defense, and save/resume.
- `npm run test:design`: desktop layouts, card inspection, keyboard focus, hand filtering, and accessibility audits.
- `npm run test:tabletop`: a deliberately crowded saved-layout fixture, exhausted cards, complete card faces, face-down information boundaries, discard inspection, and 320–1920px containment. This fixture tests presentation, not gameplay reachability.
- Screenshots and test output are under `output/tabletop/`; research/before views are under `output/tabletop-research/`.

Full native mobile ergonomics, manual dragging, free placement, and simultaneous online multiplayer remain outside this redesign.
