# NeXt Evolution: Morlock Siege

This import adds NeXt Evolution's first scenario, Morlock Siege, and its two modular sets, Military Grade and Mutant Slayers. Mister Sinister's Marauders storm the Morlock Tunnels one at a time from a hidden villain deck. The players win by routing three of them. Once the Morlocks join the fight, the players lose if the last one falls.

## Original source and scope

`src/game/morlock-siege.ts` registers 43 original faces:

- **Marauders (14):** the seven double-sided villains Arclight, Blockbuster, Chimera, Greycrow, Harpoon, Riptide and Vertigo.
- **Morlock Siege (16):** both sides of Knock, Knock and of Mutant Massacre, the Morlock ally (4), Hide!, both sides of Routed, Bolstered by Wrath, Pushed to the Limit, By Any Means, In the Midst of Chaos, Maraudin' Ain't Easy, Territorial Control, Back in Action (2) and Seek the Weak (3).
- **Military Grade (4):** Heavy Armament, Titanium Exoskeleton, Inhibitor Collar (2) and The Senator's Support.
- **Mutant Slayers (9):** the seven Marauder minions, the Mutant Slayers side scheme and Bound by Business (2).

The imported catalog, original source decks and artwork remain unchanged.

Standard uses the Marauders' A sides and Routed's Standard side, Expert their B sides and Routed's Expert side. The encounter deck holds the Morlock Siege and Standard sets and two modular sets, with the Expert set in Expert. Military Grade and Mutant Slayers are preselected, and both can be chosen in every other scenario with modular sets.

## Native rules

- **Setup:** the seven Marauders are shuffled into a villain deck, and the top one is the villain in play with its hit points per player. Routed enters play, and Hide! and the four Morlocks are set aside. Knock, Knock starts with 1 threat per player.
- **Routed:** after the villain is defeated, it goes under Routed, and its attachments, tokens and status cards are discarded. The top villain of the villain deck then enters play and discards each minion that shares its title. It activates against each player in player order. Three villains under Routed win the game. On its Expert side, Routed gives the villain retaliate 1 for each villain under it.
- **Knock, Knock:** after step one of the villain phase it gains a knock counter. Three knock counters, or its threat completing it, reveal Mutant Massacre:
  - each player puts a set-aside Morlock into play, or two in a solo game;
  - Hide! is shuffled into the encounter deck;
  - if knock counters advanced the scheme, each Morlock gets a tough status card.
- **Mutant Massacre:** the players lose if it is completed or if no Morlock is in play. Its Action exhausts a Morlock to shuffle Hide! from the encounter discard pile back into the encounter deck. The table offers it on each ready Morlock.
- **Morlocks:** they do not count against the ally limit. An enemy that attacks a player attacks a Morlock that player controls instead, and the player picks which one. A defeated Morlock enters the victory display (Victory -1).
- **The Marauders:** when a Marauder villain or minion attacks you or an ally you control, its Forced Interrupt offers its two choices. The penalties are confusing or stunning one of your characters, giving it a tough status card, spending mental resources, discarding your highest-cost card, taking indirect damage, or threat on every scheme. The other choice strengthens the attack: +2 ATK, +X ATK for Greycrow or an additional boost card for Harpoon, with overkill, ranged or piercing on the B sides. A penalty that cannot be resolved is not offered.
- **Morlock Siege encounter cards:**
  - **Hide!:** gives a Morlock a tough status card.
  - **Bolstered by Wrath:** +1 ATK and SCH. Its Hero Action exhausts a character and spends 1 resource for each villain under Routed. Its boost has 1 extra icon for each villain under Routed.
  - **Pushed to the Limit:** +1 ATK, steady with one villain under Routed and stalwart with two. Its Hero Action lets the villain attack you.
  - **By Any Means, In the Midst of Chaos, Maraudin' Ain't Easy and Territorial Control:** each gets 1 more threat per player for each villain under Routed. Territorial Control has assault.
  - **Back in Action:** gives the villain a tough status card and puts threat on the main scheme for each villain under Routed.
  - **Seek the Weak:** surges in alter-ego form. In hero form the villain attacks, with overkill once a villain is under Routed.
- **Military Grade:**
  - **Heavy Armament:** attaches to the enemy with the highest ATK, which gains +2 ATK and retaliate 2. After you attack that enemy, you may spend 2 resources of one type to discard it.
  - **Titanium Exoskeleton:** attaches to the enemy with the fewest remaining hit points, which takes no more than 2 damage from a single attack. Its Hero Action spends 3 resources, or removes a stunned or confused status card from that enemy, to discard it.
  - **Inhibitor Collar:** attaches to your identity, which gets -1 ATK and a blank printed text box. Any player's Action exhausts a character they control or takes 3 damage to discard it.
  - **The Senator's Support:** Hinder 1 per player. When it is defeated, the first player discards encounter cards until an attachment is discarded and reveals it.
- **Mutant Slayers:**
  - **The Marauder minions:** they have their printed keywords and Forced Interrupts.
  - **Mutant Slayers:** this side scheme gives each Marauder minion quickstrike. It enters with 1 more threat for each Mutant, X-Factor, X-Force or X-Men character in play.
  - **Bound by Business:** brings a Marauder minion into play engaged with you, one whose title is not already in play.

## Interface

- Mission setup explains the villain deck, Routed and the Morlocks, and preselects Military Grade and Mutant Slayers.
- The villain is labelled with its side and how many Marauders are routed. Its caption counts the villain deck.
- Routed counts the routed Marauders and, on its Expert side, the villain's retaliate.
- The main scheme counts Knock, Knock's knock counters and states Mutant Massacre's loss condition.
- The Morlocks sit with the allies, outside the ally count, with their Action buttons. The attachments' Hero Actions and Inhibitor Collar's Action are buttons.
- The objective reads "Rout 3 Marauders · N routed".

## Coverage boundaries

- A Morlock leaves play only when defeated by the scenario's own effects in normal play. The engine does not separately block player cards that would return or discard an ally, despite "card abilities cannot remove this ally from play."
- Heavy Armament's response follows attacks by your identity against the attached enemy.
- The campaign log (Marauders defeated, Morlocks saved) is not automated.
- The executable registry contains 3,045 faces, including 2,607 dedicated faces, with 1,506 imported faces still unsupported. There are 57 playable identities, thirty-seven scenarios and seventy-one modular sets. The inventory pins 159 source files.

The configured source matrix contains 261,352 cases in sixteen disjoint shards of 16,334 or 16,335; CI runs the sixteen shards in parallel. This import adds 14,560 cases:

- 7,384 for Morlock Siege: 52 expansion starter identities × two difficulties × all 71 modular sets as the first of its two;
- 104 with Standard II and Expert II;
- 7,072 for Military Grade and Mutant Slayers in the 34 other scenarios with modular sets.

Manifest hashes retain all 246,792 previous mission names and seeds, checked against the complete grid of `5a9f498`.

Rules references: the NeXt Evolution rulebook (Morlock Siege, Multiple Villains) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Assault, Hinder, Overkill, Retaliate, Stalwart, Steady, Victory).
