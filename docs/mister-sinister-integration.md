# NeXt Evolution: Mister Sinister

This import adds NeXt Evolution's fourth scenario, Mister Sinister, with its Flight, Super Strength and Telepathy sets. Sinister's plan runs through two of three random stage 2 schemes. Each one gives him a superpower and brings its encounter set into the deck. Status cards placed on him only feed his scheme, and Sinister Ends turns him on Hope Summers.

## Original source and scope

`src/game/mister-sinister.ts` registers 32 original faces:

- **Mister Sinister (20):** Mister Sinister (I), (II) and (III), both sides of Sinister Intent, Taking Off, Bulking Up, Focusing In and Sinister Ends, Sinister Disguise, Sinister Soldier (2), Teleported Away, Genetic Mastery (2), Molecular Control, Sinister Schemes and Sinister Strike.
- **Flight (4):** the Flight superpower, Aerial Bombardment, Out of Reach and High Ground (2).
- **Super Strength (4):** the Super Strength superpower, Impervious, Thrown Object and "I'll Take That" (2).
- **Telepathy (4):** the Telepathy superpower, the Manufactured Drama and Sowing Discord obligations and One Step Ahead (2).

The scenario also uses the Hope Summers set imported with [Juggernaut](juggernaut-integration.md). The imported catalog, original source decks and artwork remain unchanged.

Standard uses Mister Sinister (I) and (II), Expert (II) and (III). The encounter deck holds the Mister Sinister, Hope Summers and Standard sets and one modular set, with the Expert set in Expert. Nasty Boys is preselected.

## Native rules

- **Setup (Sinister Intent 1A):** the Flight, Super Strength and Telepathy sets are set aside, and Hope Summers enters play under the first player's control.
- **Sinister Intent (1B):** one random stage 2 is removed from the game, and the main scheme advances to one of the other two at random.
- **The stage 2 schemes:** Taking Off, Bulking Up and Focusing In each start with 1 threat per player.
  - When revealed, its superpower attaches to Mister Sinister and the rest of its set is shuffled into the encounter deck.
  - When completed, the main scheme advances to the other stage 2. If both have been revealed, it advances to Sinister Ends instead.
- **Sinister Ends (3A/3B):** when revealed, each player is dealt a facedown encounter card. When Mister Sinister attacks, he attacks Hope Summers instead, and her controller's other characters may defend. The players lose if it is completed.
- **The villain:** after a status card is placed on Mister Sinister, threat goes on the main scheme: 1 for stage I, 2 for stage II and 3 for stage III. Mister Sinister (II) places 1 threat per player when revealed, or 2 with fewer than 2 superpowers. Mister Sinister (III) places 2 per player, or 3 with fewer than 2 superpowers. Expert resolves (II)'s at setup.
- **Superpowers:** each is permanent and gives its stat bonus.
  - **Flight:** +1 ATK, the Aerial trait and overkill.
  - **Super Strength:** +1 ATK, the Brute trait and steady.
  - **Telepathy:** +1 SCH, the Psionic trait and retaliate 1.
- **Hope Summers:** as in Juggernaut. She does not count against the ally limit, uses her controller's hero ATK and THW, and losing her loses the game.
- **Mister Sinister encounter cards:**
  - **Sinister Disguise:** attaches to the villain. When a player would deal damage to him, that player spends 2 mental resources to let it through, or deals it to the friendly character with the fewest remaining hit points. Either way the Disguise is discarded.
  - **Sinister Soldier:** +1 ATK and SCH for each superpower. As a boost, Mister Sinister gets the same for the activation.
  - **Teleported Away:** hinder 1 per player. Mister Sinister cannot take damage and schemes instead of attacking.
  - **Genetic Mastery:** 2 indirect damage with Aerial, your identity exhausted with Brute, 2 threat on the main scheme with Psionic.
  - **Molecular Control:** gives him a tough status card, and he heals 4 with Brute. Its boost gives him a tough status card.
  - **Sinister Schemes:** he schemes, and Psionic confuses you. Its boost confuses you.
  - **Sinister Strike:** surges in alter-ego form. In hero form he attacks you, and Aerial stuns you. Its boost stuns you.
- **Flight set:**
  - **Aerial Bombardment:** +1 ATK while attacking a non-Aerial character, and he ignores retaliate then. Its Hero Action exhausts your hero and spends 2 mental resources to discard it.
  - **Out of Reach:** he takes no damage unless the attacker or attack is Aerial or the attack has ranged. Its Hero Action exhausts your hero and spends 2 energy resources to discard it.
  - **High Ground:** each friendly character's tough status cards are discarded, and the players as a group take 2 indirect damage, 4 with Brute. In a multiplayer game they assign each point to a player. Its boost gives a villain attack piercing.
- **Super Strength set:**
  - **Impervious:** 1 less damage from each attack. Its Hero Action spends 2 physical resources to give him a tough status card and discard it.
  - **Thrown Object:** +3 ATK and ranged, discarded after he attacks.
  - **"I'll Take That":** discards your lowest-cost upgrade, the highest with Psionic, or surges.
- **Telepathy set:**
  - **Manufactured Drama:** stays in your play area. Your supports cannot ready, and it exhausts them when revealed, or surges if none was exhausted. Its Alter-Ego Action exhausts your identity and discards a card from your deck for each support you control.
  - **Sowing Discord:** stays in your play area. Your allies cannot ready, and it exhausts them when revealed, or surges if none was exhausted. Its Alter-Ego Action spends 2 mental resources.
  - **One Step Ahead:** discards a random card from your hand, 2 with Aerial. Its boost gives a villain attack overkill.

## Interface

- Mission setup explains the random stage 2 schemes, the status-card threat and Sinister Ends, and preselects Nasty Boys.
- The villain is labelled with its stage and superpowers. Its caption lists his traits and the threat each status card places.
- The main scheme notes where its completion leads, and Sinister Ends notes that he attacks Hope Summers.
- The Hero Actions on Aerial Bombardment, Out of Reach and Impervious are buttons, and the Telepathy obligations offer their Alter-Ego Actions.

## Coverage boundaries

- Sinister Disguise lets damage through as a new damage packet after the resources are spent, so attack-only effects of the original attack do not apply to it.
- The campaign log is not automated.
- The executable registry contains 3,115 faces, including 2,677 dedicated faces, with 1,436 imported faces still unsupported. There are 57 playable identities, forty scenarios and seventy-three modular sets. The inventory pins 162 source files.

The configured source matrix contains 291,616 cases in sixteen disjoint shards of 18,226; CI runs the sixteen shards in parallel. This import adds 7,696 cases:

- 7,592 for Mister Sinister: 52 expansion starter identities × two difficulties × all 73 modular sets;
- 104 with Standard II and Expert II.

Manifest hashes retain all 283,920 previous mission names and seeds, checked against the complete grid of `e21b14c`.

Rules references: the NeXt Evolution rulebook (Mister Sinister) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Hinder, Overkill, Permanent, Piercing, Ranged, Retaliate, Steady, Surge).
