# Nebula native scenario

This continuation starts from `dad4885cf226081e93d949bd18c15759e1a48a50` and adds the fourth scenario of The Galaxy's Most Wanted.

## Original source and scope

Nebula registers all 17 original scenario faces `16088`–`16102`: Nebula (I)–(III), both sides of The Art of Evasion and Warp Drive Initiated, Nebula's Ship, the five Technique attachments, Lethal Intent, Barrel Roll, Combat Ready and Ruthless. The required Power Stone set registers its single face `16149`, and the Space Pirates modular set its four faces `16138`–`16141`. All 22 faces are dedicated registrations in `src/game/nebula-villain.ts` (the hero Nebula keeps `src/game/nebula.ts`); the imported catalog, original source decks and artwork remain unchanged. Ship Command, also required, was registered by the Brotherhood of Badoon import.

Standard selects Nebula (I) and (II), Expert Nebula (II) and (III). Each game uses 21 physical scenario cards: two villain stages, two main schemes, Nebula's Ship, eight Techniques (two Cutthroat Ambition, Evasive Maneuvering, Unyielding Persistence, two Weapon Mastery and two Wide Stance) and two copies each of Lethal Intent, Barrel Roll, Combat Ready and Ruthless. The Power Stone and the seven Ship Command cards are added: the Milano and the Power Stone start in play and the other six Ship Command cards are shuffled into the encounter deck. Space Pirates (eight physical cards) is the default modular set; it is also a new selectable modular set for every other scenario, so the selector lists thirty-three sets.

## Native rules

- **Setup (1A):** Nebula's Ship and the Milano enter play, the Power Stone attaches to Nebula, and the top 2 encounter cards per player are discarded; each Technique among them attaches to Nebula. The Art of Evasion (1B) starts with 2 threat per player.
- **Evasion counters:** both main schemes accelerate by X per player, X the evasion counters on Nebula's Ship. The Ship gains 1 counter when each villain phase begins. Its First Player Action exhausts the Milano and spends 1 or 2 resources to remove that many counters.
- **Main schemes:** completing The Art of Evasion (6 per player) reveals Warp Drive Initiated, which places 2 evasion counters and then, for each evasion counter, discards the top 2 cards of each player deck and of the encounter deck. Warp Drive Initiated starts with 3 threat per player; completing it (9 per player) loses the game.
- **Techniques:** each attaches to Nebula when revealed, and the first one revealed each round gains surge. While attached, Cutthroat Ambition caps the damage Nebula takes from a single attack at 5, Wide Stance reduces the damage she takes from each attack by 1, Evasive Maneuvering and Unyielding Persistence give her stalwart, and Weapon Mastery gives her retaliate 1. As a boost, a Technique attaches to Nebula after the activation ends and resolves its Special ability.
- **Specials:** Cutthroat Ambition places 1 threat on the main scheme; Evasive Maneuvering stuns you, or gives Nebula a facedown boost card if you are already stunned; Unyielding Persistence gives Nebula a tough status card, or a facedown boost card if she is already tough; Weapon Mastery deals you 1 damage; Wide Stance discards a random card from your hand. A boost card given during Nebula's activation joins it; one given after an activation or outside one waits for her next activation.
- **Nebula's Forced Interrupt:** when Nebula initiates an activation against you, each attached Technique resolves its Special. Then Nebula (I) discards all of them, Nebula (II) makes you choose and discard one, and Nebula (III) lets you remove the top card of your deck from the game to choose and discard one.
- **Encounter cards:** Lethal Intent (hazard) and Combat Ready discard encounter cards until a Technique is discarded and reveal it; Combat Ready then resolves its Special. Barrel Roll (incite 1, surge) places an evasion counter when revealed or as a boost. Ruthless makes Nebula scheme against an alter-ego or attack a hero; threat placed or damage dealt by that activation places an evasion counter.
- **Power Stone:** Permanent. When a hero deals 3 or more damage to its holder with a single attack, it attaches to that hero; when the villain deals 3 or more damage to the hero holding it with a single attack, it returns to the villain.
- **Space Pirates:** Pirate Commander and Pirate Lackey (quickstrike) remove a random card in your hand or your top card from the game after they attack and damage you; as a boost each gives the villain an additional boost card, but only while the villain itself is activating. Sound the Alarms gives each enemy +1 ATK and, as a boost, enters play. Honor Among Thieves discards until a Criminal minion is discarded, reveals it, gives it a tough status card and gives the villain a facedown boost card.

## Coverage boundaries

The executable registry contains 2,461 faces, including 2,022 dedicated faces, with 2,090 imported faces still unsupported. There are 57 playable identities, nineteen scenarios and thirty-three modular sets. The Galaxy's Most Wanted has 144 of its 207 faces registered: Ronan the Accuser, its modular sets (including Kree Militant), the market and the campaign remain pending. The inventory pins 137 source files. No official campaign rules are automated.

The configured source matrix contains 64,688 cases in eight disjoint shards of 8,086. Nebula adds 3,432 cases (52 expansion starter identities × two difficulties × thirty-three primary modular sets), and Space Pirates adds 1,872 cases to the eighteen earlier scenarios. Manifest hashes retain all 59,384 previous mission names and seeds.

Rules references: The Galaxy's Most Wanted rules insert, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), and the original imported card texts.

## Measured local validation — 2026-11-11

- 22 focused engine cases pass, covering registration, setup for one to three players in both difficulties, the evasion-based acceleration, Warp Drive Initiated and its loss, both villain sequences and the win, Technique reveals with the once-per-round surge, all three versions of Nebula's Forced Interrupt, the granted stalwart and retaliate, Wide Stance's reduction with Cutthroat Ambition's cap, Technique boosts (including a facedown boost card given after the activation), Nebula's Ship and its thrusters action, Barrel Roll, Ruthless, Combat Ready, Lethal Intent, the Power Stone moving both ways and every Space Pirates card. Each command crosses a JSON save/reload boundary.
- All 57 complete seeded missions against Nebula reach a result without losing cards or locking. One exposed a Space Pirates boost trying to boost a Villainous minion's activation; it now only adds a boost card while the villain itself activates.
- The inventory (19 cases) pins all 137 source hashes; manifest hashes retain every previous mission name and seed.
- The new browser check (`npm run test:nebula`) passes 16 flows, 16 accessibility audits and 16 layout checks at 1280, 768, 390 and 320 px with no browser errors: standalone setup for both difficulties, the Milano's thrusters with a real payment, Nebula's Techniques resolving and discarding, the Power Stone moving to a hero and Warp Drive Initiated.
- TypeScript and formatting pass.
- The 5,304 new source configurations were still running locally when this was written; a first sample of 330 exposed a Technique boost that gave its facedown boost card to the finished activation, which lost that card. That is fixed and covered by a focused case.

Remote CI runs the full matrix and browser groups, including the new `nebula` group.
