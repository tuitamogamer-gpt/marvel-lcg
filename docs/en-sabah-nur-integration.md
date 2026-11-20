# Age of Apocalypse: En Sabah Nur

This import adds Age of Apocalypse's fifth scenario, En Sabah Nur, with the Celestial Tech and Clan Akkaba sets. Apocalypse is the game's first three-sided villain: he shifts between his Biomorph, Cyberpath and Giant forms, each with its own keyword and a Forced Response when he changes to it, while power counters on his main scheme dig out his Superpowers.

## Original source and scope

`src/game/en-sabah-nur.ts` registers 28 original faces:

- **En Sabah Nur (20):** the Biomorph, Cyberpath and Giant forms of Apocalypse (I), (II) and (III), both sides of En Sabah Nur's Pyramid and The Rise of Apocalypse, Staggering Strength (2), Biomorphic Blast (2), Technological Interface (2), Giant-Sized Despot (2), Source of Power, Plugged In and Giant Growth.
- **Celestial Tech (3):** Celestial Armor, Celestial Weapon and Celestial Tech (2).
- **Clan Akkaba (5):** Ozymandias, Scarab, Clan Akkaba Zealot (3), Tyrant Worship and Ancient Ritual.

The imported catalog, original source decks and artwork remain unchanged.

Standard uses Apocalypse (I) and (II), Expert (II) and (III). The encounter deck holds the En Sabah Nur and Standard sets and two modular sets, with the Expert set in Expert. Celestial Tech and Clan Akkaba are preselected, and each can be chosen in every other scenario with modular sets.

## Native rules

- **Setup (1A):** Apocalypse begins the game in his Biomorph form, and each player is dealt a facedown encounter card.
- **En Sabah Nur's Pyramid (1B):** 1 threat per player to start, 1 more per player each villain phase, and The Rise of Apocalypse follows when it reaches 8 per player. After step one of each villain phase it gains a power counter; when it has at least 4, the first player removes 4 and discards encounter cards until a Superpower card is discarded, then reveals it.
- **The Rise of Apocalypse (2A and 2B):** when revealed, the first player digs out a Superpower the same way. The Pyramid's power counters leave play with it, and The Rise of Apocalypse gains its own after step one the same way. The players lose when it reaches 10 threat per player.
- **Apocalypse's forms:** a form change is not a defeat or a reveal: Apocalypse keeps his damage, statuses and attachments, and his ATK and SCH become the new form's. Each form's Forced Response after he changes to it uses X, his stage: Biomorph deals X indirect damage to each player, Cyberpath places X threat on each scheme in play, and Giant heals X damage from him. Changing to the form he is already in does nothing.
- **Form keywords:** Biomorph's attacks gain overkill, Cyberpath has retaliate 1, and Giant is stalwart.
- **Superpowers:**
  - **Biomorphic Blast, Technological Interface and Giant-Sized Despot:** if Apocalypse is in that card's form he activates against you, attacking in hero form and scheming in alter-ego form; otherwise he changes to it and the main scheme gains a power counter, which digs out a Superpower only after the next step one. As boosts, he changes to that form after the activation.
  - **Source of Power, Plugged In and Giant Growth:** when defeated, Apocalypse activates against their defeater if he is in that form; otherwise he changes to it and gets a tough status card.
  - **Staggering Strength:** attaches to Apocalypse, +2 ATK, and changes him to Giant. When he attacks you, you are stunned and it is discarded after the attack. As a boost, it is revealed after the activation.
- **Celestial Tech:**
  - **Celestial Armor:** attaches to the villain. When that villain schemes against you, the top card of your deck is discarded: energy heals 2 damage from him, mental confuses you and discards the Armor, physical gives him a tough status card, and wild does all three.
  - **Celestial Weapon:** attaches to the villain. When that villain attacks you, the top card of your deck is discarded: energy deals 2 damage to your identity, mental makes you discard a card of your choice from your hand, physical stuns you and discards the Weapon, and wild does all three.
  - **Celestial Tech:** each Celestial attachment in play resolves as if its villain had just schemed against you and attacked you. With none on the villain, a Celestial attachment is found in the encounter deck or discard pile and revealed; if both are there, you choose which.
- **Clan Akkaba:**
  - **Ancient Ritual:** Permanent and Setup: with the Clan Akkaba set it begins the game in play in any scenario, with 5 threat, and cannot be defeated. After threat is placed on it, if it has at least 10, 5 are removed and each player is dealt a facedown encounter card.
  - **Ozymandias:** elite, toughness and villainous; his scheme places its threat on Ancient Ritual.
  - **Scarab:** quickstrike; after it attacks, 1 threat on Ancient Ritual, or 3 if the attack defeated an ally.
  - **Clan Akkaba Zealot:** guard; 2 threat on Ancient Ritual when defeated, and 1 as a boost.
  - **Tyrant Worship:** 5 threat on Ancient Ritual when revealed.
  - **Ozymandias' and Tyrant Worship's boosts:** choose 3 threat on Ancient Ritual, or three more boost icons on that card.

## Interface

- Mission setup explains the forms, the power counters and Ancient Ritual, and preselects Celestial Tech and Clan Akkaba.
- The villain label carries Apocalypse's stage and form, and the caption gives that form's keyword and the Forced Response of changing to it.
- The main scheme's one-line note counts the power counters toward the next Superpower, and on The Rise of Apocalypse that completing it loses.
- Ancient Ritual's caption gives its threshold and what it does.

## Coverage boundaries

- The campaign log, Overseer minions and Mission side schemes are not automated.
- When Apocalypse is defeated, the next stage enters in his Biomorph form, the card's default face. The rulebook does not say which form the next stage takes.
- Changing to his Giant form discards Apocalypse's stunned and confused status cards, as gaining stalwart does elsewhere in the engine.
- The executable registry contains 3,272 faces, including 2,834 dedicated faces, with 1,279 imported faces still unsupported. There are 57 playable identities, forty-six scenarios and eighty-four modular sets. The inventory pins 168 source files.

The configured source matrix contains 387,712 cases in sixteen disjoint shards of 24,232; CI runs the sixteen shards in parallel. This import adds 17,784 cases:

- 8,736 for En Sabah Nur: 52 expansion starter identities × two difficulties × all 84 modular sets as the first of his two;
- 104 with Standard II and Expert II;
- 8,944 for the Celestial Tech and Clan Akkaba sets in the 43 other scenarios with modular sets.

Manifest hashes retain all 369,928 previous mission names and seeds, checked against the complete grid of `7fcdac2`.

Rules references: the Age of Apocalypse rulebook (En Sabah Nur, changing form) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Elite, Guard, Indirect Damage, Overkill, Permanent, Quickstrike, Retaliate, Setup, Stalwart, Toughness, Villainous).
