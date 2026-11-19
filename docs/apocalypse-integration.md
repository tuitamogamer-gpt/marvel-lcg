# Age of Apocalypse: Apocalypse

This import adds Age of Apocalypse's third scenario, Apocalypse, with his Prelates and the Dark Riders modular set. The eternal tyrant heals instead of being defeated and grows stronger each time his main scheme is completed, until the heroes fight through his citadel and prove him No Longer Worthy.

## Original source and scope

`src/game/apocalypse.ts` registers 27 original faces:

- **Apocalypse (16):** both sides of Apocalypse (I/II) and (III/IV), both sides of The Age of Apocalypse, Heart of the Empire with The Towering Citadel on its reverse, The Tyrant's Throne with No Longer Worthy on its reverse, Cyberpathy, Biomorphing, Molecular Control, The Fittest (2), Wolf Among Sheep (3) and The Apocalypse Solution (2).
- **Prelates (5):** Mister Sinister, The Shadow King, Abyss, Sugar Man and Mikhail Rasputin, the reverse sides of the campaign's Overseer minions.
- **Dark Riders (6):** Gauntlet, Barrage, Hard-Drive, Tusk, Psynapse and The Dark Riders.

The imported catalog, original source decks and artwork remain unchanged.

Standard starts with Apocalypse (II), Expert with Apocalypse (III). The encounter deck holds the Apocalypse and Standard sets and two modular sets, with the Expert set in Expert. The Prelates are always included. Dark Riders and Infinites are preselected, and Dark Riders can be chosen in every other scenario with modular sets. With Infinites, Gene Pool begins the game in play, as in every scenario.

## Native rules

- **Setup (1A):** the Prelates and The Tyrant's Throne are set aside and Heart of the Empire is revealed. The first player reveals a random set-aside Prelate.
- **The Age of Apocalypse (1B):** 1 threat per player to start. It is completed at X threat per player, X being the numeral in Apocalypse's printed hit points (9 for II, 10 for III, 11 for IV). When Apocalypse would be defeated, his attachments are discarded, he heals all damage and the scheme loses X threat instead.
- **Apocalypse:** toughness. When the main scheme is completed, its threat is removed and the next Apocalypse is revealed with his hit points and a tough status card; Apocalypse (II) and (III) are steady. Completing it at Apocalypse (IV), who is stalwart and attacks with overkill, loses the game.
- **The citadel:** threat cannot be removed from Heart of the Empire, The Towering Citadel or The Tyrant's Throne while a Prelate is in play. Each one's acceleration icons add threat to the main scheme. When one is defeated, the first player reveals a random set-aside Prelate and each other player is dealt an encounter card. Heart of the Empire then flips to The Towering Citadel, The Towering Citadel leaves the game and reveals The Tyrant's Throne, and The Tyrant's Throne flips to No Longer Worthy.
- **No Longer Worthy:** attaches to Apocalypse and heals 5 hit points per player. He cannot take damage while a Prelate is in play, the main scheme's Forced Interrupt is ignored, and defeating him wins the game.
- **Apocalypse encounter cards:**
  - **Cyberpathy, Biomorphing and Molecular Control:** attach to Apocalypse, also as boosts. After he schemes, Cyberpathy places 1 threat on each side scheme; Biomorphing gives his attacks overkill; Molecular Control gives him retaliate 1 and stalwart.
  - **The Fittest:** attaches to the minion with the highest printed hit points, the player choosing among ties, with a tough status card and 5 more hit points; otherwise it surges.
  - **Wolf Among Sheep:** the Prelate activates against you, otherwise Apocalypse. As a boost, the Prelate gets a tough status card, otherwise Apocalypse.
  - **The Apocalypse Solution:** when defeated, the top X cards of the encounter deck are discarded.
- **Prelates:** elite, toughness, Victory 3, and each engages the first player. Mister Sinister has retaliate 1 and villainous. After The Shadow King attacks you, you discard the ally you control with the highest THW or place threat equal to its THW on the main scheme. After Abyss activates against you, the top card of your deck is attached to him facedown, each one giving him 2 more hit points; they go to their owners' discard piles when he is defeated. Sugar Man's attacks gain piercing and heal him 5 damage when they defeat a character. When Mikhail Rasputin attacks you, your identity takes 1 damage.
- **Dark Riders:** each Dark Rider has Teamwork and activates when it enters play while another Dark Rider is in play. After attacking you, Gauntlet makes you discard an upgrade, Barrage deals 1 damage to each character you control, Hard-Drive places 1 threat on each scheme, Tusk stuns you and Psynapse confuses you; Tusk and Psynapse do the same as boosts. The Dark Riders side scheme has hinder 1 per player, gives each Dark Riders minion toughness, and when revealed discards encounter cards until a Dark Riders minion is discarded and reveals it.

Testing The Dark Riders exposed an older gap: a minion that gains toughness from another card while entering play never received its tough status card, so Stryfe's Mutant Insurrection did not toughen the minions it names. Every minion now checks for gained toughness as it enters play, with a regression test, and the Stryfe and Mutant Insurrection configurations were rerun.

## Interface

- Mission setup explains the stages, the main scheme's threshold, the citadel's locks and No Longer Worthy, and preselects Dark Riders and Infinites.
- The villain label carries the stage and whether Apocalypse still regenerates or is No Longer Worthy; the caption gives the threat the main scheme loses when he would be defeated, or when he can be hurt.
- The objective counts the cleared citadel schemes, then asks for Apocalypse's defeat, and the main scheme's note names the Apocalypse it reveals or the loss.
- Each citadel scheme shows its lock while a Prelate is in play and what clearing it leads to. Abyss shows his facedown cards and the hit points they give him.

## Coverage boundaries

- The campaign log, Overseer minions and Mission side schemes are not automated.
- The executable registry contains 3,214 faces, including 2,776 dedicated faces, with 1,337 imported faces still unsupported. There are 57 playable identities, forty-four scenarios and seventy-nine modular sets. The inventory pins 166 source files.

The configured source matrix contains 348,504 cases in sixteen disjoint shards of 21,781 or 21,782; CI runs the sixteen shards in parallel. This import adds 12,584 cases:

- 8,216 for Apocalypse: 52 expansion starter identities × two difficulties × all 79 modular sets as the first of his two;
- 104 with Standard II and Expert II;
- 4,264 for Dark Riders in the 41 other scenarios with modular sets.

Manifest hashes retain all 335,920 previous mission names and seeds, checked against the complete grid of `7b9ec3d`.

Rules references: the Age of Apocalypse rulebook (Apocalypse: Stop the Apocalypse) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Acceleration, Elite, Hinder, Overkill, Piercing, Retaliate, Stalwart, Steady, Surge, Teamwork, Toughness, Victory, Villainous).
