# Tower Defense native scenario

This continuation starts from `519fdc8` and adds the second scenario of The Mad Titan's Shadow: Proxima Midnight and Corvus Glaive attack Avengers Tower together.

## Original source and scope

Tower Defense registers all 22 original faces `21092`–`21110`: Proxima Midnight (I)–(III), Corvus Glaive (I)–(III), both sides of Under Siege and The Armies of Thanos, both sides of Avengers Tower, Focused Defense, Black Order Besieger, Proxima's Spear, Corvus's Glaive, Direct Assault, Proxima's Power, Corvus's Cunning, Bound by Blood, Rain Fire and City Under Attack. They are dedicated registrations in `src/game/tower-defense.ts`; the imported catalog, original source decks and artwork remain unchanged.

Standard selects Proxima Midnight (I) and (II) and Corvus Glaive (I) and (II); Expert selects stages (II) and (III) of both. Each game uses 25 physical scenario cards: four villain stages, two main schemes, Avengers Tower, Focused Defense and seventeen encounter cards (four Besiegers, two each of Direct Assault, Proxima's Power, Corvus's Cunning, Rain Fire and City Under Attack, and one each of Proxima's Spear, Corvus's Glaive and Bound by Blood). The scenario has one modular slot, Armies of Titan by default, and any of the thirty-six selectable sets can replace it. The core Standard set and, in Expert, the Expert set are added as in every scenario. No new modular set is introduced.

## Two villains and two main schemes

The engine keeps one native villain and one native main scheme, so Tower Defense keeps each villain paired with its own scheme (Proxima Midnight with Under Siege 1B, Corvus Glaive with The Armies of Thanos 2B) and swaps the pairs:

- **At rest** the active villain and its main scheme are native. Everything that refers to "the villain" or "the main scheme" without a choice therefore uses the active villain and the scheme with Focused Defense, as the scenario rules require for encounter cards and for constant effects on player cards.
- **Targets:** both villains are legal enemy targets (with the same guard restriction) and both main schemes are legal thwart targets (with the same crisis and patrol restrictions). The scheme out of focus has the target ID `tower:main`.
- **Focus windows:** an effect that names the villain or main scheme out of focus resolves inside a focus window: that pair is swapped in, the effect and everything it causes resolve, and the previous pair returns. The window opens synchronously, so payment commits and other synchronous callers keep their order, and closes at once when the effect leaves nothing pending, otherwise right after everything it queued or prompted. Inside a window the two main scheme IDs swap meaning in every top-level field. Direct damage, healing, threat and thwart calls on the pair out of focus use the same swap synchronously.
- **Activation:** only the active villain activates in step 2 of the villain phase. When a card makes the other villain activate (Proxima's Power, Corvus's Cunning), it activates in a focus window, so its threat goes on its own scheme and its boosts and abilities are its own. Minion threat goes on the scheme with Focused Defense (Rules Reference FAQ).
- **Focused Defense** begins attached to stage 2B, so Corvus Glaive is active in the first player phase. After each player phase it moves to the other main scheme, so Proxima Midnight activates in the first villain phase and the villains alternate after that.
- **Step 1:** each main scheme gains its own threat, and each is affected by acceleration tokens and acceleration icons.
- **Completion:** neither main scheme advances. When Under Siege would be completed its threat is removed and Avengers Tower takes 6 damage per player; when The Armies of Thanos would be completed its threat is removed and each player is dealt a facedown encounter card.
- **Defeat:** each villain cannot be defeated while the other has hit points remaining. A villain at 0 hit points stays at 0 (and can still be healed). When both reach 0 they are defeated together and both advance to their next stage; the players win when both final stages are defeated.

## Avengers Tower and the encounter cards

- **Avengers Tower** enters play on its Stronghold side. After damage is placed on it, at 9 damage per player it removes all damage and flips to its Damaged side, which discards each Avengers Tower support card from play. At 9 damage per player on the Damaged side the players lose. While the Stronghold side is in play the unique rule does not apply to Avengers Tower, so each player can have an Avengers Tower support; the Damaged side reinforces the unique rule. Damage to Avengers Tower always goes to the environment.
- **Setup** (Under Siege 1A and The Armies of Thanos 2A): Avengers Tower and Focused Defense enter play, then each player in order searches the encounter deck for a Black Order Besieger, which engages them, and the encounter deck is shuffled.
- **Black Order Besieger:** after it engages you, including during setup, you choose to deal 1 damage to Avengers Tower or 2 damage to your identity.
- **Proxima Midnight:** when she attacks you, you choose to deal 1 damage to Avengers Tower or give her +2 ATK for that attack. A stunned Proxima removes the status card instead of attacking, so this does not trigger.
- **Corvus Glaive:** after his undefended attack, the top card of the encounter deck is discarded and Avengers Tower takes 1 damage per boost icon on it.
- **Proxima's Spear** attaches to Proxima Midnight wherever she is; her attacks gain overkill and piercing. **Corvus's Glaive** attaches to Corvus Glaive and gives him retaliate 1, also when he is attacked out of focus. Each has a Hero Action: take 1 damage and spend energy and mental (Spear) or energy and physical (Glaive) to discard it.
- **Direct Assault** attaches to the villain who is not active (+2 ATK). When that villain attacks, the attack gains ranged; if it defeats an ally Avengers Tower takes 3 damage, and the attachment is discarded at the end of the attack.
- **Proxima's Power / Corvus's Cunning** make that villain activate against you. As a boost, the activating villain adds the other villain's ATK (attack) or SCH (scheme) for that activation.
- **Bound by Blood** heals 2 damage from each villain and gives each a tough status card; as a boost, only the active villain.
- **Rain Fire** deals 3 damage to Avengers Tower; as a boost, 3 more if that attack defeats an ally.
- **City Under Attack** (crisis, hinder 1 per player) blocks removing threat from either main scheme; the player who defeats it draws 1 card.

## Coverage boundaries

- Player cards whose text names "the villain" or "the main scheme" without offering a target choice (and "each enemy" effects that list only native enemies) affect the active villain and the scheme with Focused Defense; the scenario rules let the player choose. Effects that choose a target offer both villains and both main schemes.
- Encounter effects that place threat on "the main scheme" place it on the scheme with Focused Defense, not on both schemes. None of the Tower Defense, Armies of Titan, Standard or Expert cards do this; some cards of other modular sets do.
- The optional modular difficulty of placing damage on Avengers Tower during setup is not offered.
- The executable registry contains 2,526 faces, including 2,087 dedicated faces, with 2,025 imported faces still unsupported. There are 57 playable identities, twenty-two scenarios and thirty-six modular sets. The Mad Titan's Shadow has 118 of its 213 faces registered; Thanos, Hela, Loki, their modular sets and the campaign account for the 95 pending faces. The inventory pins 140 source files. No official campaign rules are automated.

The configured source matrix contains 81,848 cases in eight disjoint shards of 10,231. Tower Defense adds 3,744 cases (52 expansion starter identities × two difficulties × thirty-six primary modular sets). Manifest hashes retain all 78,104 previous mission names and seeds; the hash of the earlier configurations was checked against the full grid of `519fdc8`.

Rules references: The Mad Titan's Shadow rulebook (Scenario #2: Two Main Schemes, Two Villains, The Active Villain, Avengers Tower), [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Tower Defense FAQ: minion threat goes on the scheme with Focused Defense), and the original imported card texts.

## Measured local validation — 2026-11-17

- The complete regular regression passes 11,025 tests across 294 files in 4 min 26 s, with one intentional skip.
- 26 focused engine cases pass, covering registration, setup for one to three players in both difficulties (both villains, both schemes, Avengers Tower, Focused Defense and a Besieger for each player), the Besieger's identity option, Focused Defense moving after each player phase with only the active villain activating, step 1 threat and acceleration on both schemes, villain and minion threat placement, attacking and thwarting either side through the real basic powers, statuses on the villain out of focus, the simultaneous defeat and win in both difficulties, both main scheme completions, the Tower flip with supports discarded and the unique rule, the loss, Proxima's interrupt both ways, Corvus's undefended and defended attacks, and every encounter card. Each command crosses a JSON save/reload boundary.
- All 3,744 new source configurations pass with the physical-card audit in 16 min 12 s. The other 78,104 configured cases were not rerun locally. The mission sweep found three engine boundaries that are now fixed: the advisor treated the villain out of focus as a minion, Storm's Torrential Rain and other threat distributions did not know the second main scheme, and an effect committed with a payment (Nightcrawler's Teleport Drop) resolved after its play when its window was queued; windows now open synchronously.
- The inventory (19 cases) pins all 140 source hashes; manifest hashes retain every previous mission name and seed.
- The new browser check (`npm run test:tower-defense`) passes 16 flows, 16 accessibility audits and 16 layout checks at 1280, 768, 390 and 320 px with no browser errors, against both the development server and the production build: standalone setup for both difficulties from the scenario picker, attacking the villain out of focus with the basic power, Focused Defense moving at the end of the player phase, Avengers Tower flipping, and Proxima's Spear's Hero Action with a real payment. Retained Ebony Maw, design, tabletop and flow browser checks pass.
- TypeScript, formatting, the production build and the native API entry pass.

Remote CI runs the full matrix and browser groups, including the new `tower-defense` group.

