# Escape the Museum native scenario

This continuation starts from `d17307ddedd078a49136ffa817a50874590ce2ca` and adds the third scenario of The Galaxy's Most Wanted.

## Original source and scope

Escape the Museum registers all 14 original scenario faces `16080a`–`16087`: both sides of Collector (A1) and (B1), both sides of The Missing Milano, Lost in the Museum and The Great Escape, Library Labyrinth / Museum Ship, "I Have You Now!" and Impossible Geometry. All 14 are dedicated registrations in `src/game/escape-museum.ts`; the imported catalog, original source decks and artwork remain unchanged. Its required Galactic Artifacts and Ship Command sets and its default Menagerie Medley modular set were already registered by the Infiltrate the Museum and Brotherhood of Badoon imports, so this scenario adds no new modular set.

Standard uses Collector (A1), Expert Collector (B1); there is only one villain card. Each game uses eleven physical scenario cards: the villain, three main schemes, Library Labyrinth and three copies each of the two treacheries. Galactic Artifacts adds its nine cards to the encounter deck. The seven Ship Command cards start set aside. Menagerie Medley is the default modular set, and any of the thirty-two modular sets can replace it.

## Native rules

- **Setup (1A):** Library Labyrinth starts in play and the Ship Command set is set aside. The Missing Milano (1B) starts with 7 threat per player.
- **A reversed main scheme:** the players remove threat to advance. When the last threat leaves The Missing Milano or Lost in the Museum, the next stage is revealed (the players win by advancing). Lost in the Museum (11 threat per player) puts the set-aside Milano into play under the first player's control. The Great Escape (8 threat per player) flips Library Labyrinth into the Museum Ship, places 1 acceleration token and shuffles the other six Ship Command cards into the encounter deck. With no threat on The Great Escape the players win. Each stage is lost as usual when its threat reaches its threshold (11, 15 and 12 per player).
- **Collector cannot be defeated:** on his A side he gets +X ATK and +X SCH, X the main scheme's stage number. When he would be defeated he removes 3 threat per player from the main scheme and flips instead, which can advance the main scheme. The wounded side cannot be defeated; when the round ends Collector flips back and his hit points reset to their printed value. A blanked side would be defeated normally, which wins the game.
- **Library Labyrinth:** once per round per player, a hero may deal themselves a facedown encounter card to remove 5 threat from the main scheme.
- **Museum Ship:** when the villain phase begins, the first player chooses either to exhaust the Milano and assign 2 indirect damage per player among the players, or to assign 3 indirect damage per player. The assignment is chosen one point (or all the rest) at a time, and each player then assigns their share among the characters they control.
- **The Great Escape's First Player Action:** exhaust the Milano to remove 3 threat. The Milano's Piloting, Peril treacheries, Special Delivery, Rogue Vessel and Cannonade work exactly as in Brotherhood of Badoon.
- **Treacheries:** "I Have You Now!" exhausts an alter-ego and Collector schemes, or stuns a hero and Collector attacks; its boost gives Collector a tough status card. Impossible Geometry incites 1 and confuses you, or makes you discard a card you control if you are already confused.

## Coverage boundaries

The executable registry contains 2,439 faces, including 2,000 dedicated faces, with 2,112 imported faces still unsupported. There are 57 playable identities, eighteen scenarios and thirty-two modular sets. The Galaxy's Most Wanted has 122 of its 207 faces registered: Nebula and Ronan the Accuser, their modular sets and the campaign remain pending. The inventory pins 136 source files. No official campaign rules are automated.

The configured source matrix contains 59,384 cases in eight disjoint shards of 7,423. Escape the Museum adds 3,328 cases (52 expansion starter identities × two difficulties × thirty-two primary modular sets). Manifest hashes retain all 56,056 previous mission names and seeds.

Rules references: The Galaxy's Most Wanted rules insert, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), and the original imported card texts.

## Measured local validation — 2026-11-11

- The complete regular regression passes 10,699 tests across 290 files, with one intentional skip.
- 15 focused engine cases pass, covering registration, setup for one to three players in both difficulties, Collector's stage bonus, the wounded flip and its threat removal (including an advance it causes), recovery when the round ends, all three main scheme stages with the Milano, the shuffled Ship Command set and The Great Escape's First Player Action, the win and the stage loss, Library Labyrinth, Museum Ship's two choices with the assignment among players, and both treacheries with the boost. Each command crosses a JSON save/reload boundary.
- All 57 complete seeded missions against Escape the Museum (one per playable identity) reach a result without losing cards or locking.
- The inventory (19 cases) pins all 136 source hashes; manifest hashes retain every previous mission name and seed.
- The new browser check (`npm run test:escape`) passes 16 flows, 14 accessibility audits and 14 layout checks at 1280, 768, 390 and 320 px with no browser errors: standalone setup for both difficulties, Library Labyrinth, the wounded Collector, The Great Escape's Milano action and the escape win.
- TypeScript, formatting, the production build and the native API entry pass.
- All 3,328 new source configurations pass with the physical-card audit (52 expansion starters × two difficulties × thirty-two modular sets). The other 56,056 configured cases were not rerun locally.

Remote CI runs the full matrix and browser groups, including the new `escape` group.
