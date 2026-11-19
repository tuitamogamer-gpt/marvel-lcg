# NeXt Evolution: On the Run

This import adds NeXt Evolution's second scenario, On the Run, and the Nasty Boys modular set. The Marauders are getting away with Hope, and one of them holds her with Hope's Captor. The players must defeat that Marauder twice: Hope's Captor stops the first defeat and turns Desperate, and the Marauders make their last run on Escaping with Hope.

## Original source and scope

`src/game/on-the-run.ts` registers 18 original faces:

- **On the Run (12):** both sides of Gotta Get Away, of Escaping with Hope and of Hope's Captor, Hidden in the Clutter (2), Favored Weapon, Bushwhack, Pure Force, Dizzying Deeds and Tag Team (2).
- **Nasty Boys (6):** the minions Gorgeous George, Hairbag, Ramrod, Ruckus and Slab, and the Get Nasty side scheme.

The scenario also uses the Marauders and the Mutant Slayers set imported with [Morlock Siege](morlock-siege-integration.md). The imported catalog, original source decks and artwork remain unchanged.

Standard uses the Marauders' A sides and Expert their B sides. The encounter deck holds the On the Run, Mutant Slayers and Standard sets and two modular sets, with the Expert set in Expert. Mutant Slayers is always included, and Military Grade and Nasty Boys are preselected. Nasty Boys can be chosen in every other scenario with modular sets.

## Native rules

- **Setup (Gotta Get Away 1A):** one random Marauder is the villain, with its hit points per player. The Mutant Slayers minion with its title leaves the game, and the other six Marauders are not used. Hope's Captor attaches to the villain Confident side up; it is a single card and never enters the encounter deck. Gotta Get Away starts with 1 threat per player, and each player then searches the encounter deck for a Marauder minion that engages them.
- **Gotta Get Away (1B):** each Marauder minion is steady. The players lose if it is completed.
- **Hope's Captor (Confident):**
  - when the villain would attack you while a Marauder minion is engaged with you, it schemes instead;
  - the first time the villain would be defeated, its hit points reset to its printed value and the Captor flips Desperate.
- **Hope's Captor (Desperate):** +1 ATK, +1 SCH and +6 hit points per player for the villain, and it keeps the Forced Interrupt that makes the villain scheme instead of attacking. Revealing it advances the main scheme to Escaping with Hope (2A), which cannot be canceled:
  - each player searches the encounter deck and discard pile for a Marauder minion that engages them;
  - each Marauder enemy gets a tough status card.
- **Escaping with Hope (2B):** each Marauder minion has guard and steady, and in Expert the villain is steady too. Defeating the villain wins; completing the scheme loses.
- **On the Run encounter cards:**
  - **Hidden in the Clutter:** attaches to the enemy with the fewest remaining hit points, and the players choose among tied enemies. Damage to that enemy goes onto this card instead. At 3 or more, the enemy attacks the player who dealt the damage just placed, and the card is discarded.
  - **Favored Weapon:** attaches to Greycrow or Harpoon, otherwise to the Marauder enemy with the lowest ATK. It gives +1 ATK, and that enemy's attacks gain overkill, piercing and ranged. After your hero defends against that enemy's attack and takes no damage, you may discard it.
  - **Bushwhack:** when defeated, the active player searches the encounter deck and discard pile for a Marauder minion that engages them.
  - **Pure Force:** gains the crisis icon while Blockbuster is in play and the amplify icon while Chimera is, as the villain or a minion.
  - **Dizzying Deeds:** you exhaust a character you control. Then Arclight in play stuns one of your characters, Riptide deals you 3 indirect damage and Vertigo confuses one of your characters.
  - **Tag Team:** you choose one. Either each Marauder minion engaged with you activates against you, or the top 7 encounter cards are discarded and the topmost Marauder minion in the discard pile engages you.
- **Nasty Boys:**
  - **Teamwork (Nasty Boy):** a Nasty Boy that enters play while another Nasty Boy is in play activates against the player it engages.
  - **Gorgeous George:** when he attacks you, and as his boost, you exhaust a character you control.
  - **Hairbag:** surge. His boost shuffles him back into the encounter deck after the activation.
  - **Ramrod:** retaliate 1 and piercing attacks. His boost gives a villain attack piercing.
  - **Ruckus:** when revealed, he stuns each character you control; his boost stuns you.
  - **Slab:** toughness. Each time he attacks, he gains a growth counter and +1 ATK for each growth counter for that attack.
  - **Get Nasty:** each minion gets +1 ATK. It enters with 1 threat for each minion in play, 2 for each Nasty Boy. A Nasty Boy from the encounter deck or discard pile is then revealed, and the players choose when there are several.

## Interface

- Mission setup explains Hope's Captor and the scheme-instead rule, includes Mutant Slayers and preselects Military Grade and Nasty Boys.
- The villain is labelled with its side and the Captor's side, Confident or Desperate. Its caption says what the Captor does next.
- The objective reads "Defeat (villain) twice · N of 2".
- Hidden in the Clutter shows its damage out of 3, and Slab shows his growth counters and the ATK they add.

## Coverage boundaries

- Bushwhack's searcher is the active player, which is the player who thwarts it in normal play.
- The campaign log (Hope's rescue) is not automated.
- The executable registry contains 3,063 faces, including 2,625 dedicated faces, with 1,488 imported faces still unsupported. There are 57 playable identities, thirty-eight scenarios and seventy-two modular sets. The inventory pins 160 source files.

The configured source matrix contains 272,480 cases in sixteen disjoint shards of 17,030; CI runs the sixteen shards in parallel. This import adds 11,128 cases:

- 7,384 for On the Run: 52 expansion starter identities × two difficulties × all 71 modular sets other than Mutant Slayers as the first of its two;
- 104 with Standard II and Expert II;
- 3,640 for Nasty Boys in the 35 other scenarios with modular sets.

Manifest hashes retain all 261,352 previous mission names and seeds, checked against the complete grid of `1cb1d9f`.

Rules references: the NeXt Evolution rulebook (On the Run) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Guard, Overkill, Permanent, Piercing, Ranged, Retaliate, Steady, Surge, Teamwork, Toughness).
