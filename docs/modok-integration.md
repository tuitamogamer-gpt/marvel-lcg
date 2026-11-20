# Agents of S.H.I.E.L.D.: M.O.D.O.K.

This import adds Agents of S.H.I.E.L.D.'s third scenario, M.O.D.O.K., with the Scientist Supreme set. M.O.D.O.K. holds four kidnapped Inhumans in the Holding Cell deck on A.I.M. Island and copies their powers into his Adaptoids. The players free each Inhuman by removing the lock counters from its Holding Cell, and only once all four are free does defeating M.O.D.O.K. win the game.

## Original source and scope

`src/game/modok.ts` registers 32 original faces:

- **M.O.D.O.K. (28):** both sides of M.O.D.O.K. and of Upgrading Adaptoids, the four Holding Cells with Flying Inhuman, Psionic Inhuman, Sarah Garza and Strong Inhuman on their backs, the Flying, Psionic, Sarah Garza and Strong Upgrade environments, Adaptoid (4), Automated Mobile Unit, Focusing Crystal, Nanobots, Psionic Force Field, Psionic Machetes, Reverse Engineering, A.I.M. Jailer (2), Hostage Situation, Psionic Enhancement, "It's Alive!" and Psionic Blast (2).
- **Scientist Supreme (4):** Scientist Supreme, Monica Rappaccini, Diplomatic Immunity and Diplomatic Sanctions (2).

The imported catalog, original source decks and artwork remain unchanged.

Standard uses M.O.D.O.K. (A), Expert M.O.D.O.K. (B). The encounter deck holds the M.O.D.O.K. and Standard sets and one modular set, with the Expert set in Expert. Scientist Supreme is preselected, and it can be chosen in every other scenario with modular sets. The Holding Cells and the Adaptoid upgrades stay out of the encounter deck.

## Native rules

- **Setup (1A):** the four Holding Cells are shuffled into the Holding Cell deck, and its top card enters play with 2 lock counters per player. One random Adaptoid upgrade enters play (two in Expert) and the others are set aside. Each player searches the encounter deck for an Adaptoid and reveals it.
- **M.O.D.O.K.:** 10 hit points (A) or 14 (B), without a per-player icon, with retaliate 1 (A) or retaliate 2 and steady (B). When he would be defeated with a Holding Cell in play, 2 lock counters come off it and his hit points reset instead; Automated Mobile Unit, Focusing Crystal, Nanobots, Psionic Machetes and Reverse Engineering are then discarded. With no Holding Cell in play, the players win.
- **Upgrading Adaptoids (1B):** 1 threat per player to start. When it would be completed, a random set-aside Adaptoid upgrade enters play instead. If none is left set aside, the players lose; otherwise all its threat comes off and each Adaptoid in the encounter discard pile is shuffled into the encounter deck.
- **Holding Cells:** each Hero Action spends the cell's own resources (2 energy, 2 mental, a wild or 2 physical) or 3 resources of any type to remove 1 lock counter. When the last one comes off, the cell flips and its Inhuman enters play under a player's control, and the next Holding Cell enters play with 2 lock counters per player.
- **The Inhumans:** they do not count against the ally limit. When one leaves play, it flips and goes to the bottom of the Holding Cell deck; with no Holding Cell in play, it enters play again with its locks. After Flying Inhuman thwarts, its player may remove 1 threat from another scheme; after Psionic Inhuman thwarts, 1 lock counter from the Holding Cell. Sarah Garza's attacks gain overkill and ranged, and Strong Inhuman has toughness.
- **Adaptoid upgrades:** every Adaptoid gets +1 SCH, incite 1 and the Aerial trait from the Flying Upgrade; villainous and the Psionic trait from the Psionic Upgrade; +1 ATK, overkill, ranged and the Elite trait from the Sarah Garza Upgrade; and +1 ATK, toughness and the Brute trait from the Strong Upgrade.
- **Adaptoid:** when defeated, it removes 1 lock counter from the Holding Cell, or else 1 counter from another environment. As a boost, it is shuffled into the encounter deck after the activation.
- **The attachments:** each attaches to M.O.D.O.K. Automated Mobile Unit gives him 5 hit points while attached. Nanobots heals 1 damage after he activates. Psionic Force Field gives stalwart and takes the damage he would take, until it holds 5 and is discarded; as a boost it attaches to the activating enemy. Psionic Machetes gives his attacks piercing, and as a boost the attack gains piercing. Reverse Engineering tucks an upgrade you control under itself, or the top card of your deck, and gives him ATK and SCH equal to that card's printed cost.
- **A.I.M. Jailer:** guard. When revealed, it attacks the Rescued ally with the fewest remaining hit points, or with none in play, places 1 lock counter on the Holding Cell.
- **Hostage Situation:** when revealed, a Rescued ally is held there, under no player's control. M.O.D.O.K. cannot take damage while it is in play, and the player who defeats it takes control of the ally.
- **Psionic Enhancement:** hinder 1 per player; as a boost, the activating enemy gets another boost card.
- **"It's Alive!":** each player finds an Adaptoid in the encounter deck or discard pile and reveals it; a player who does not engage a minion this way is dealt a facedown encounter card.
- **Psionic Blast:** in alter-ego form, you are confused and M.O.D.O.K. schemes. In hero form, you take indirect damage equal to his SCH, and each character that takes damage this way is confused.
- **Scientist Supreme:**
  - **Scientist Supreme:** victory -1, villainous and vulnerable; his attacks gain piercing and ranged.
  - **Monica Rappaccini:** victory -1, villainous and vulnerable; she gains villainous while Scientist Supreme is in the victory display.
  - **Diplomatic Immunity:** when revealed, it gets an acceleration token for each A.I.M. minion in the victory display.
  - **Diplomatic Sanctions:** surge. When revealed, you discard a card from your hand for each A.I.M. minion in the victory display, and as a boost it has one boost icon for each of them.

## Interface

- Mission setup explains the scenario and preselects Scientist Supreme.
- The objective reads "Free the Inhumans · N of 4 free", then "Defeat M.O.D.O.K." once every Inhuman is free. His label shows his side, and his caption says that he resets while a Holding Cell is in play.
- The main scheme's note counts the Adaptoid upgrades left and says that the last one loses.
- The Holding Cell is labelled, captioned with its locks, the Inhumans still held and the one it frees, and offers its Hero Action as two buttons: its own resources, or 3 of any type.
- Each Adaptoid upgrade is labelled and captioned with what it gives every Adaptoid.
- Hostage Situation's caption names the ally it holds.

## Coverage boundaries

- "Per player" values use the number of players who started the game.
- The player who takes a freed Inhuman is chosen when two players are in the game.
- An ally held by Hostage Situation is kept with the scheme. Card abilities do not count or target it, and the attachments on it are discarded when it is taken.
- Adaptoid's When Defeated takes its counter from the Holding Cell first, since lock counters are the scenario's only all-purpose counters on an environment.
- If M.O.D.O.K.'s text is blank when he would be defeated, he is defeated and the players win, as with the last villain of any scenario.
- The S.H.I.E.L.D. campaign, its evidence and the Executive Board are not automated.
- The executable registry contains 3,356 faces, including 2,918 dedicated faces, with 1,195 imported faces still unsupported. There are 57 playable identities, forty-nine scenarios and eighty-eight modular sets. The inventory pins 172 source files.

The configured source matrix contains 438,672 cases in sixteen disjoint shards of 27,417; CI runs the sixteen shards in parallel. This import adds 14,144 cases:

- 9,152 for M.O.D.O.K.: 52 expansion starter identities × two difficulties × all 88 modular sets as his one;
- 208 with Standard II and Expert II or with Standard III;
- 4,784 for the Scientist Supreme set in the 46 other scenarios with modular sets.

Manifest hashes retain all 424,528 previous mission names and seeds, checked against the complete grid of `7b6aa57`. The unsharded matrix registers more cases than the default 2 GB Node heap holds; run it in shards, as CI does, or with a larger heap.

Rules references: the Agents of S.H.I.E.L.D. rulebook (M.O.D.O.K., the Holding Cell deck) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Guard, Hinder, Incite, Indirect Damage, Overkill, Permanent, Piercing, Ranged, Retaliate, Stalwart, Steady, Surge, Toughness, Victory, Villainous, Vulnerable).
