# Ronan the Accuser native scenario

This continuation starts from `607331f` and adds the fifth and last scenario of The Galaxy's Most Wanted.

## Original source and scope

Ronan the Accuser registers all 16 original scenario faces `16103`–`16116`: Ronan the Accuser (I)–(III), both sides of Interception Imminent and "Take What Is Mine", the Kree Command Ship, the Universal Weapon, Fanaticism, Cut the Power, Pincer Maneuver, Superior Tactics, Single-Minded Fury, Kree Physiology and "You Stand Accused!". The Kree Militants modular set registers its four faces `16131`–`16134`. All 20 faces are dedicated registrations in `src/game/ronan.ts`; the imported catalog, original source decks and artwork remain unchanged. The required Power Stone and Ship Command sets were registered by the Nebula and Brotherhood of Badoon imports.

Standard selects Ronan the Accuser (I) and (II), Expert (II) and (III). Each game uses 19 physical scenario cards: two villain stages, two main schemes, the Kree Command Ship, the Universal Weapon, two Fanaticism, Cut the Power, two Pincer Maneuver, Superior Tactics, two Single-Minded Fury, two Kree Physiology and three "You Stand Accused!". The Power Stone and the seven Ship Command cards are added: the Milano, the Universal Weapon and the Power Stone start in play and the other six Ship Command cards are shuffled into the encounter deck. Kree Militants (nine physical cards) is the default modular set; it is also a new selectable modular set for every other scenario, so the selector lists thirty-four sets.

## Native rules

- **Setup (1A):** the Kree Command Ship and the Milano enter play, the Universal Weapon attaches to Ronan and the Power Stone to the first player. Interception Imminent (1B) starts with 2 threat per player. Expert's Ronan (II) reveals Cut the Power during setup.
- **Ronan:** Toughness on every stage and Retaliate 1 on stage III. When he activates against the player who controls the Power Stone, he gets 1 additional boost card. Ronan (II) and (III) search the encounter deck and discard pile for Cut the Power and Superior Tactics respectively and reveal it.
- **Main schemes:** Interception Imminent (7 per player) has a First Player Action that exhausts the Milano to remove 3 threat. Completing it reveals "Take What Is Mine", which attaches the Power Stone to Ronan, or gives him a facedown boost card if he already holds it. While Ronan holds the Power Stone, threat cannot be removed from "Take What Is Mine"; completing it (10 per player) loses the game.
- **Power Stone:** moves between a hero and Ronan by 3 or more damage in a single attack, as in the Nebula scenario, except that Superior Tactics keeps it on Ronan. It returns to the villain when the hero holding it is eliminated.
- **Kree Command Ship:** its hazard icon deals one additional encounter card each villain phase. When a treachery is revealed from the encounter deck, the first player may exhaust the Milano and spend 1 resource to cancel its When Revealed effects; its other keywords still resolve.
- **Attachments:** the Universal Weapon gives Ronan stalwart; a hero may take 2 damage and deal themselves a facedown encounter card to shuffle it into the encounter deck, and as a boost it attaches to Ronan. Fanaticism (surge) attaches to Ronan with 1 fury counter plus 1 per player and +1 ATK; his attacks gain overkill and piercing, and each attack removes a fury counter until it is discarded.
- **Side schemes:** Cut the Power (crisis) makes its boost exhaust the Milano or place 2 threat on the main scheme. Pincer Maneuver (hinder, two acceleration icons) has a First Player Action that exhausts the Milano for 3 threat. Superior Tactics attaches the Power Stone to Ronan, or gains 1 threat per player if he already holds it.
- **Treacheries:** Single-Minded Fury makes Ronan attack the player who controls the Power Stone, even in alter-ego form, and surges if no attack was made; as a boost it attaches the Power Stone to Ronan. Kree Physiology (surge) gives Ronan a tough status card, or deals you 1 damage if he already has one. "You Stand Accused!" makes him scheme with +1 SCH against an alter-ego or attack a hero with +1 ATK; as a boost it gives the villain an additional boost card while he activates.
- **Kree Militants:** Kree Combat Armor attaches to the enemy with the highest ATK and reduces the damage it takes from each attack by 1; a hero may spend 3 resources of one type to discard it. Kree Commando (patrol), Kree Lieutenant (guard, stalwart) and Kree Private (quickstrike) use native keywords, and as boosts give the current attack piercing, three boost icons or overkill.

## Coverage boundaries

The executable registry contains 2,481 faces, including 2,042 dedicated faces, with 2,070 imported faces still unsupported. There are 57 playable identities, twenty scenarios and thirty-four modular sets. The Galaxy's Most Wanted has 164 of its 207 faces registered: all five scenarios and their modular sets are playable, and the 43 pending faces are campaign content (the market, ten challenge side schemes and the Badoon Headhunter set). The inventory pins 138 source files. No official campaign rules are automated.

The configured source matrix contains 70,200 cases in eight disjoint shards of 8,775. Ronan the Accuser adds 3,536 cases (52 expansion starter identities × two difficulties × thirty-four primary modular sets), and Kree Militants adds 1,976 cases to the nineteen earlier scenarios. Manifest hashes retain all 64,688 previous mission names and seeds.

Rules references: The Galaxy's Most Wanted rules insert, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), and the original imported card texts.

## Measured local validation — 2026-11-12

- The complete regular regression passes 10,855 tests across 292 files, with one intentional skip. Two configuration tests used now-playable content (Kree Militants and the Ronan scenario id) as their unimplemented examples; they now name Beasty Boys and an unknown scenario id.
- 19 focused engine cases pass, covering registration, setup for one to three players in both difficulties, "Take What Is Mine" with its Power Stone lock and loss, the facedown boost when Ronan already holds the stone, both villain sequences with Superior Tactics and the win, Interception Imminent's Milano action, the extra boost against the stone's holder, Superior Tactics keeping the stone, Single-Minded Fury's attack and surge, the Universal Weapon, Fanaticism, Kree Physiology, "You Stand Accused!", the Kree Command Ship cancelling a When Revealed with a real payment, Cut the Power's boost and Kree Militants. Each command crosses a JSON save/reload boundary.
- All 57 complete seeded missions against Ronan the Accuser reach a result without losing cards or locking.
- The inventory (19 cases) pins all 138 source hashes; manifest hashes retain every previous mission name and seed.
- The new browser check (`npm run test:ronan`) passes 14 flows, 14 accessibility audits and 14 layout checks at 1280, 768, 390 and 320 px with no browser errors: standalone setup for both difficulties, the Kree Command Ship's cancellation with a real payment, the Universal Weapon's Hero Action and "Take What Is Mine". Retained design, tabletop, viewport-fit, flow, campaigns, hero Nebula, Brotherhood of Badoon, Infiltrate the Museum, Escape the Museum and Nebula scenario browser checks pass.
- TypeScript, formatting, the production build and the native API entry pass.
- All 5,512 new source configurations pass with the physical-card audit: 3,536 Ronan the Accuser missions (52 expansion starters × two difficulties × thirty-four modular sets) and 1,976 Kree Militants missions in the nineteen earlier scenarios. The other 64,688 configured cases were not rerun locally.

Remote CI runs the full matrix and browser groups, including the new `ronan` group.
