# Agents of S.H.I.E.L.D.: Thunderbolts

This import adds Agents of S.H.I.E.L.D.'s fourth scenario, Thunderbolts, with the six modular sets that each bring an Elite Thunderbolt minion: Gravitational Pull, Hard Sound, Pale Little Spider, Power of the Atom, Supersonic and The Leaper. Citizen V and his Thunderbolts have come to arrest the heroes, and he cannot be defeated until one Thunderbolt per player is in the victory display.

## Original source and scope

`src/game/thunderbolts.ts` registers 39 original faces:

- **Thunderbolts (13):** both sides of Citizen V, of Apprehending Rogue Agents and of Justice, Like Lightning (Thunderbolt Backup), Citizen V's Sword, Jolt, Innocent Bystanders (3), The Coming Storm, Rumbling Thunder, Down but Not Out (2) and Tap In (2).
- **Gravitational Pull (4):** Moonstone, Rule the Skies, Gravitational Pull (2) and Psychological Manipulation (2).
- **Hard Sound (5):** Songbird, Solid Sound Constructs, Hard Sound Bindings, Sonic Bubble and Hard Sound (2).
- **Pale Little Spider (4):** Black Widow, Handspring (2), Pride of the Red Room and Pale Little Spider (2).
- **Power of the Atom (4):** Radioactive Man, Radiation Exposure (2), Runaway Nuclear Reaction and Power of the Atom (2).
- **Supersonic (5):** MACH-IV, Blasters, Heat-Seeking Missiles, Aerial Dogfight and Supersonic (2).
- **The Leaper (4):** Batroc, Coup de Foudre, Batroc the Leaper (2) and Parcours du Combattant (2).

The imported catalog, original source decks and artwork remain unchanged.

Standard uses Citizen V (A), Expert Citizen V (B). The encounter deck holds the Thunderbolts and Standard sets, with the Expert set in Expert, and one modular set plus one more per player. Only the six sets with an Elite Thunderbolt minion can be chosen for this scenario, and each of them can be chosen in every other scenario with modular sets.

## Native rules

- **Setup (1A):** the Elite Thunderbolt minion of each chosen set is set aside. Justice, Like Lightning is revealed: each player reveals a random set-aside Thunderbolt, the remaining one is attached to it faceup, and in Expert each of them gets a tough status card. It then flips to Thunderbolt Backup.
- **Citizen V:** 12 hit points per player (A) or 16 (B). He cannot be defeated unless at least one Thunderbolt minion per player is in the victory display; until then he stays at 0 hit points, and once there are enough, he is defeated and the players win. When he would activate against a player during the villain phase while that player is engaged with a Thunderbolt minion, he does not activate and heals 4 damage (6 in Expert) instead.
- **Apprehending Rogue Agents (1B):** 1 threat per player to start. Each Thunderbolt minion gains guard, and after a player attacks a Thunderbolt minion, it engages that player. Completing it loses the game.
- **Thunderbolt Backup:** the attached minion is in play and can be attacked and targeted, but it is engaged with no player and does not activate. When the round ends, the Thunderbolt minion with the most damage is attached here and heals 1 damage per player (2 per player and a tough status card in Expert); the minion it replaces engages the player that minion was engaged with.
- **Citizen V's Sword:** attaches to Citizen V, and he activates against you. After you attack and damage him, you may spend 2 physical resources to discard it.
- **Jolt:** villainous. Her Hero Action exhausts your hero to place a parley counter on her; with 3, she is removed from the game rather than defeated. When defeated, 3 threat goes on the main scheme.
- **Innocent Bystanders:** enters your play area with 4 bystander counters. After you attack an enemy or an enemy attacks you, you spend 1 resource or place 1 threat on the main scheme (2 in Expert), and a counter comes off; with none left, it is discarded.
- **The Coming Storm and Rumbling Thunder:** when revealed, each player engages each minion engaged with the player clockwise from them.
- **Down but Not Out:** a random Thunderbolt minion from the victory display is revealed with 5 hit points remaining, and this card is removed from the game. If no minion entered play this way, it gains surge.
- **Tap In:** the Thunderbolt minion with the least damage that is not engaged with you engages you and activates against you; with none, Citizen V activates against you.
- **The Elite Thunderbolt minions:** each has villainous and Victory 1. Each set's treachery finds its minion and reveals it, or engages you with it if it is in play, and it activates against you; with no minion, the treachery gains surge.
- **Gravitational Pull:** Moonstone gets a tough status card after she activates. Rule the Skies gives each Aerial character +1 ATK, and as a boost, an Aerial activating enemy gets another boost card. As a boost, Gravitational Pull exhausts a character you control. Psychological Manipulation discards an ally or support you control in alter-ego form, with surge if you have none; in hero form, the friendly character with the fewest remaining hit points takes damage equal to your hero's ATK.
- **Hard Sound:** Songbird gets one more boost card when she activates. Solid Sound Constructs attaches to her, or the villain, and the attached enemy loses stalwart; it is discarded instead of the enemy being stunned or confused. Hard Sound Bindings attaches to your identity and is discarded instead of your next attack, which stuns you; as a boost, you are stunned, or the activating enemy gets another boost card if you already were. Sonic Bubble takes damage dealt to any enemy as threat removed from itself instead. As a boost, Hard Sound gives the activating enemy another boost card.
- **Pale Little Spider:** after Black Widow schemes against you, a Handspring from the encounter deck or discard pile attaches to her, or you are confused. Handspring attaches to her, or the villain, and the next attack damage to that enemy is dealt to the attacking character instead. Pride of the Red Room gains 1 threat for each Preparation card in play. As a boost, Pale Little Spider confuses you, or places 1 threat on the main scheme if you already were.
- **Power of the Atom:** after Radioactive Man activates against you, each character you control takes 1 damage. Radiation Exposure attaches to your identity with -1 ATK (+1 on a Gamma identity) and -1 THW; after you recover, you discard a card from your hand to discard it. Runaway Nuclear Reaction gains threat equal to the damage dealt to Radioactive Man; at 10 it deals 10 damage to each character and is discarded. As a boost, Power of the Atom deals you 2 indirect damage.
- **Supersonic:** a character without the Aerial trait cannot make basic defenses against MACH-IV's attacks. Blasters attaches to him, or the enemy with the highest ATK, giving overkill and ranged; after you attack and damage that enemy, you may spend 2 energy resources to discard it. Heat-Seeking Missiles attaches to him, or the villain, with 4 missile counters; after the enemy attacks you, a counter comes off and you take 2 indirect damage. Aerial Dogfight reduces attack damage to an Aerial character by 2 unless the attacker is Aerial or the attack is ranged. As a boost, Supersonic gives the attack overkill and ranged.
- **The Leaper:** when Batroc engages you, you discard a card from your hand. While Coup de Foudre is in play, a player engaged by a minion discards the top cards of their deck equal to its boost icons, and it gains 1 threat for each printed energy resource discarded. As a boost, Batroc the Leaper discards a card from your hand. Parcours du Combattant has surge and rotates engagements like The Coming Storm; as a boost, after the attack you engage a minion that is not engaged with you.

## Interface

- Mission setup explains the scenario, and the modular choice offers only the six Elite Thunderbolt sets, one plus one per hero.
- The objective reads "Defeat N Thunderbolts, then Citizen V · X of N", then "Defeat Citizen V". His label shows his side, and his caption gives his defeat condition and his heal.
- The main scheme's note says that each Thunderbolt has guard and engages the player who attacks it.
- Thunderbolt Backup is labelled and captioned with the minion it holds and its end-of-round swap, and that minion's tile reads "On Thunderbolt Backup · engaged with no hero".
- Jolt's tile shows her parley counters and offers her Hero Action as a button, and Innocent Bystanders is captioned with its counters in your play area.

## Coverage boundaries

- "Per player" values use the number of players who started the game.
- When the attached minion is tied for the most damage at the end of the round, it stays attached; the first player chooses among other ties. The players choose among ties for Tap In and for Blasters' highest ATK.
- A few hero card abilities written for a minion engaged with you can also choose the minion on Thunderbolt Backup.
- Hard Sound Bindings replaces an attack by your identity, not by your allies. Innocent Bystanders counts attacks by your identity, and enemy attacks against you even when an ally defends.
- MACH-IV's restriction applies to a hero's basic defense; an ally has no basic defense and can still defend.
- Radiation Exposure's printed -1 SCH lowers the identity's THW.
- Handspring's returned damage is not an attack, and Sonic Bubble replaces all the damage, even beyond its remaining threat.
- Down but Not Out is removed from the game even when no minion returns.
- The S.H.I.E.L.D. campaign, its evidence and the Executive Board are not automated.
- The executable registry contains 3,395 faces, including 2,957 dedicated faces, with 1,156 imported faces still unsupported. There are 57 playable identities, fifty scenarios and ninety-four modular sets. The inventory pins 173 source files.

The configured source matrix contains 468,832 cases in sixteen disjoint shards of 29,302; CI runs the sixteen shards in parallel. This import adds 30,160 cases:

- 624 for Thunderbolts: 52 expansion starter identities × two difficulties × each of the six Elite Thunderbolt sets as the first of its two;
- 208 with Standard II and Expert II or with Standard III;
- 29,328 for the six Elite Thunderbolt sets in the 47 other scenarios with modular sets.

Manifest hashes retain all 438,672 previous mission names and seeds, checked against the complete grid of `c684ea9`. The unsharded matrix registers more cases than the default 2 GB Node heap holds; run it in shards, as CI does, or with a larger heap.

Rules references: the Agents of S.H.I.E.L.D. rulebook (Thunderbolts, Thunderbolt Backup) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Find, Guard, Hinder, Indirect Damage, Obligation, Overkill, Ranged, Retaliate, Stalwart, Surge, Uses, Victory, Villainous).
