# Age of Apocalypse: Unus

This import adds Age of Apocalypse's first scenario, Unus, with the Infinites and Dystopian Nightmare modular sets. Unus and his Infinites grow stronger with the threat on Gene Pool, and every ally the heroes lose feeds it.

## Original source and scope

`src/game/unus.ts` registers 17 original faces:

- **Unus (11):** Unus (I), (II) and (III), both sides of Hunting Gene Traitors, Prelate Sidearm, Prelate Armor, Infinite Hunter (2), Genetic Experiments (2), Infinite Prelate (2) and Endless Ranks (2).
- **Infinites (3):** Infinite Soldier (5), Culling the Weak (2) and the Gene Pool side scheme.
- **Dystopian Nightmare (3):** the Hunted obligation (2), War-Weary (2) and Targeted for Extermination (2).

The imported catalog, original source decks and artwork remain unchanged.

Standard uses Unus (I) and (II), Expert (II) and (III). The encounter deck holds the Unus, Infinites and Standard sets and one modular set, with the Expert set in Expert. Dystopian Nightmare is preselected. Infinites is required for Unus and cannot be his modular set. Infinites and Dystopian Nightmare can be chosen in every other scenario with modular sets.

## Native rules

- **Gene Pool:** permanent and setup. It begins the game in play with 4 threat whenever the Infinites set is used, in any scenario, and stays out of the encounter deck. It cannot leave play: removing its last threat leaves it at 0. After an ally is defeated by anything other than consequential damage, it gains 3 threat.
- **Hunting Gene Traitors (1A):** in Expert, each player is dealt a facedown encounter card.
- **Hunting Gene Traitors (1B):** after step one of the villain phase, Gene Pool gains 1 threat. The players lose if it is completed.
- **Unus:** toughness. With at least 3 threat on Gene Pool he gains retaliate 1, with 6 also stalwart, and with 9 also an amplify icon: each boost card turned faceup during an enemy activation gets one more boost icon.
- **Unus encounter cards:**
  - **Prelate Sidearm:** +1 ATK. After Unus attacks and defeats an ally, Gene Pool gains 1 more threat.
  - **Prelate Armor:** +1 SCH. After Unus schemes, he gets a tough status card.
  - **Both Prelate attachments:** after you make a basic attack against Unus, a Hero Response spends the printed resources to discard the attachment: energy and physical for the Sidearm, mental and physical for the Armor.
  - **Infinite Hunter:** when revealed, deals 3 damage to an ally you control. Its boost places 2 threat on Gene Pool or gives the activating enemy +2 SCH and +2 ATK for the activation, as you choose.
  - **Genetic Experiments:** attaches to an Infinite minion for +1 SCH, +1 ATK and +2 hit points, or surges without one. When its minion is defeated, Gene Pool gains 2 threat. Its boost attaches it to an Infinite minion.
  - **Infinite Prelate:** Unus activates against you. With at least 3 threat on Gene Pool he then gets a tough status card, with 6 he also heals 3, and with 9 he also gets an additional boost card for the activation.
  - **Endless Ranks:** when defeated, Gene Pool gains 3 threat.
- **Infinites:**
  - **Infinite Soldier:** guard. With at least 3 threat on Gene Pool it gains quickstrike, with 6 also surge, and with 9 also +3 hit points.
  - **Culling the Weak:** places 4 threat on Gene Pool, or 2 as a boost.
- **Dystopian Nightmare:**
  - **Hunted:** stays in your play area, and its hazard icon deals one more encounter card each villain phase. Its Alter-Ego Action discards a card from your hand to discard it.
  - **War-Weary:** you are stunned, or take 2 damage if you are already stunned, when it is revealed and as a boost.
  - **Targeted for Extermination:** the player who defeats it confuses their identity.

## Interface

- Mission setup explains Gene Pool and its thresholds, and preselects Dystopian Nightmare.
- The villain is labelled with its stage and the threat on Gene Pool. Its caption lists what Gene Pool gives Unus and the next threshold.
- Gene Pool's caption marks it permanent and names the next threshold, and each Infinite Soldier lists what Gene Pool gives it.
- The main scheme notes the threat placed on Gene Pool after step one, and Hunted's Alter-Ego Action is a button.

## Coverage boundaries

- The optional modular-difficulty threat on Gene Pool from the rulebook is not placed; Gene Pool starts at its printed 4 threat.
- Standard III is not imported: Unus uses the core Standard set, or Standard II with the Encounter sets choice.
- The campaign log, the Age of Apocalypse modular set, the Mission side schemes and the Overseer minions are not automated.
- The executable registry contains 3,162 faces, including 2,724 dedicated faces, with 1,389 imported faces still unsupported. There are 57 playable identities, forty-two scenarios and seventy-seven modular sets. The inventory pins 164 source files.

The configured source matrix contains 323,544 cases in sixteen disjoint shards of 20,221 or 20,222; CI runs the sixteen shards in parallel. This import adds 16,120 cases:

- 7,904 for Unus: 52 expansion starter identities × two difficulties × the 76 modular sets other than Infinites;
- 104 with Standard II and Expert II;
- 8,112 for Infinites and Dystopian Nightmare in the 39 other scenarios with modular sets.

Manifest hashes retain all 307,424 previous mission names and seeds, checked against the complete grid of `253c9fe`.

Rules references: the Age of Apocalypse rulebook (Unus, the Infinites modular set and the amplify icon) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Amplify, Guard, Hazard, Permanent, Quickstrike, Retaliate, Setup, Stalwart, Surge, Toughness).
