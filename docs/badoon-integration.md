# Brotherhood of Badoon native scenario

This continuation starts from `3bd16fa0c06565934793c06107266ecd02b96ec8` and adds the first scenario of The Galaxy's Most Wanted.

## Original source and scope

Brotherhood of Badoon registers all 14 original scenario faces `16058`–`16069`, including both sides of Terrestrial Invasion and Protect the Planet. The required Ship Command set registers its seven faces `16142`–`16148`, and the Band of Badoon modular set its five faces `16117`–`16121`. All 26 faces are dedicated registrations in `src/game/badoon.ts`; the imported catalog, original source decks and artwork remain unchanged.

Standard selects Drang (I) and (II), Expert Drang (II) and (III). Each game uses twelve physical scenario cards: two villain stages, two main schemes, the Badoon Ship, Drang's Spear, two Badoon Engineers and four side schemes. Ship Command adds its seven cards: the Milano starts in play and the other six are shuffled into the encounter deck. Band of Badoon (ten physical cards) is the default modular set; it is also a new selectable modular set for every other scenario, so the selector lists thirty-one sets. Ship Command is a fixed set of this scenario and is never offered as a modular choice.

## Native rules

- **Setup (1A):** the Badoon Ship environment and the Milano support start in play; Terrestrial Invasion (1B) receives 2 threat per player. Expert's Drang (II) resolves its When Revealed during setup and attaches Drang's Spear from the encounter deck.
- **Milano:** the first player controls it, and its single physical piece moves to the new first player whenever the token passes, including when the first player is defeated. It is Permanent and ownerless. *Piloting* generates a wild resource for any player: the paying player sees it as a payment source, and spending it exhausts the actual Milano under its controller.
- **First Player Actions:** offered only to the first player during the player phase while the Milano is ready. Exhausting the Milano removes 3 threat from Terrestrial Invasion, Protect the Planet, Blockade, Bombardment, Oppressive Armada, Spatial Positioning or Cannonade; Protect the Planet may instead deal 3 damage to a minion. Rogue Vessel's action exhausts the Milano and then requires 2 resources of any type before it is discarded.
- **Badoon Ship · Charge Up:** each resolution places 1 barrage counter; at 4 or more counters every player takes 2 indirect damage and the counters are removed. Charge Up resolves after Drang (I/II) schemes, after Drang (III) activates, after villain phase step one while Terrestrial Invasion or Protect the Planet is the main scheme and for each Bombardment in play, when Protect the Planet is revealed, and after a Badoon Engineer engages a player or activates against them, or is used as a boost.
- **Drang:** Drang (II) gives himself a facedown boost card if the Spear is already attached, otherwise searches the encounter deck and discard pile for it and reveals it. Drang (III) discards the top 4 cards per player; each discarded minion engages the player engaged with the fewest minions (ties are chosen). Drang's Spear grants stalwart and can be discarded by a hero for mental + physical + physical.
- **Main schemes:** Terrestrial Invasion advances to Protect the Planet (4 threat per player, threshold 8 per player); completing Protect the Planet loses the game.
- **Ship Command treacheries:** Blind Side, Hull Breach and Power Siphon are Peril choices between exhausting the Milano, spending the two printed resources, or stunning / dealing 3 damage to / randomly discarding from the first player. Special Delivery lets the player exhaust the Milano or face a villain scheme (+1 SCH) or attack (+1 ATK). Rogue Vessel surges and deals 1 damage to each player when the villain phase ends. Hinder on the side schemes uses the existing native keyword.
- **Band of Badoon:** Badoon Assassin attacks with +2 ATK after engaging a hero, and its boost gives the current attack overkill, piercing and ranged. Badoon Grunt deals its player a facedown encounter card when it engages alone, and its boost puts that same card into play engaged with the player. Badoon Lieutenant (Patrol) adds two icons to a scheme, Badoon Sentry (Retaliate 1) gives the villain tough or two icons if it is already tough, and Badoon Warlord's attacks have overkill and its boost adds two icons to an attack.

## Coverage boundaries

The executable registry contains 2,403 faces, including 1,964 dedicated faces, with 2,148 imported faces still unsupported. There are 57 playable identities, sixteen scenarios and thirty-one modular sets. The Galaxy's Most Wanted has 86 of its 207 faces registered: its other four scenarios, their modular sets and the campaign remain pending. The inventory pins 134 source files. No official campaign rules are automated.

The configured source matrix contains 51,064 cases in eight disjoint shards of 6,383. Brotherhood of Badoon adds 3,224 cases (52 expansion starter identities × two difficulties × thirty-one primary modular sets), and Band of Badoon adds 1,560 cases to the fifteen earlier scenarios. Manifest hashes retain all 46,280 previous mission names and seeds.

Rules references: The Galaxy's Most Wanted rules insert, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), and the original imported card texts.

## Measured local validation — 2026-11-11

- The complete regular regression passes 10,547 tests across 288 files, with one intentional skip.
- All 4,784 new source configurations pass with the physical-card audit: 3,224 Brotherhood of Badoon missions (52 expansion starters × two difficulties × thirty-one modular sets) and 1,560 Band of Badoon missions in the fifteen earlier scenarios. One mission exposed a harness gap rather than an engine defect: a recover that ends the mission (Domino defeated by Superpower Feedback) was followed by another command; the harness now stops there. The other 46,280 configured cases were not rerun locally.
- 28 focused engine cases pass, covering setup for one to three players, both villain sequences, main-scheme advance and loss, Charge Up triggers and firing, Drang's Spear, Drang (III)'s discard, First Player Actions, the Milano paying another player's cost and moving with the first-player token, Rogue Vessel, the Peril treacheries, Special Delivery and every Band of Badoon minion and boost. Each command crosses a JSON save/reload boundary.
- The inventory (19 cases) pins all 134 source hashes; manifest hashes retain every previous mission name and seed.
- The new browser check (`npm run test:badoon`) passes 14 flows, 14 accessibility audits and 14 layout checks at 1280, 768, 390 and 320 px with no browser errors: standalone setup for both difficulties, the Milano action, a firing barrage and Hull Breach. Retained design, tabletop, viewport-fit, flow, campaigns, Zola and Red Skull browser checks pass.
- TypeScript, formatting, the production build and the native API entry pass.

Remote CI runs the full matrix and browser groups, including the new `badoon` group.
