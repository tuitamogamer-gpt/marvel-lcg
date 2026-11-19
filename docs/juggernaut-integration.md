# NeXt Evolution: Juggernaut

This import adds NeXt Evolution's third scenario, The Unstoppable Juggernaut, with the Hope Summers set and the Black Tom Cassidy modular set. Every charge builds Juggernaut's momentum, his Helmet keeps him stalwart until the players knock it off, and his main scheme never ends the game: it resets and sends him crashing through each player. Hope Summers fights beside the first player, and losing her loses the game.

## Original source and scope

`src/game/juggernaut.ts` registers 20 original faces:

- **Juggernaut (14):** Juggernaut (I), (II) and (III), both sides of The Unstoppable Juggernaut and of Juggernaut's Helmet, Head of Steam, Building Momentum, Breakthrough (2), Flatten (2), Ground Pound (2), Trample (2) and Cyttorak's Exemplar (3).
- **Hope Summers (2):** the Hope Summers ally and the Captive Hope side scheme.
- **Black Tom Cassidy (4):** the Black Tom Cassidy minion, Creeping Willow (4), Making Green and A Sound Thrashing.

The imported catalog, original source decks and artwork remain unchanged.

Standard uses Juggernaut (I) and (II), Expert (II) and (III). The encounter deck holds the Juggernaut, Hope Summers and Standard sets and one modular set, with the Expert set in Expert. Black Tom Cassidy is preselected and can be chosen in every other scenario with modular sets.

## Native rules

- **Setup (1A):** Juggernaut's Helmet attaches to Juggernaut and Hope Summers enters play under the first player's control. Both are single cards kept out of the encounter deck. The Unstoppable Juggernaut (1B) starts with 1 threat per player.
- **Momentum:** Juggernaut gets +1 ATK for each momentum counter on him. The counters stay when he advances to his next stage.
- **The villain stages:** each stage's When Revealed ability resolves when it enters play, including Juggernaut (I) at setup.
  - **Juggernaut (I):** 1 momentum counter and a tough status card.
  - **Juggernaut (II):** 1 momentum counter. Juggernaut Exposed flips back to the Helmet, or he gets a tough status card if it is not in play.
  - **Juggernaut (III):** Head of Steam is revealed from the encounter deck or discard pile. Juggernaut Exposed flips back, or he gets a tough status card.
- **The Unstoppable Juggernaut (1B):** when it would be completed, its threat is removed instead, Juggernaut Exposed flips back and Juggernaut gains a momentum counter. He then attacks each player in player order, even in alter-ego form. The scheme never loses the game.
- **Juggernaut's Helmet:** Juggernaut is stalwart and his attacks gain overkill. Its Hero Action spends 3 resources of the same type to remove each momentum counter and flip it to Juggernaut Exposed. The table offers one button per resource type the player can pay.
- **Juggernaut Exposed:** Juggernaut takes 1 additional damage from each card with a printed mental resource. After he schemes, he gains a momentum counter and the Helmet flips back on.
- **Hope Summers:** she does not count against the ally limit. Her base ATK and THW are her controller's hero ATK and THW. The players lose if she leaves play, including when her controller is eliminated.
- **Juggernaut encounter cards:**
  - **Head of Steam:** attaches to Juggernaut with a momentum counter and gives him retaliate X, X being his momentum counters. After Juggernaut attacks you, you may spend 1 resource for each damage that attack dealt to discard it.
  - **Building Momentum:** after you defend against an attack from Juggernaut, you may remove 1 threat from it.
  - **Breakthrough:** you take damage equal to Juggernaut's ATK, or discard your highest-cost upgrade or support.
  - **Flatten:** you take damage equal to Juggernaut's ATK, or he gains a momentum counter. Its boost gives him a tough status card.
  - **Ground Pound:** the players as a group take indirect damage equal to Juggernaut's ATK. In a multiplayer game they assign each point to a player. Its boost deals you 1 indirect damage.
  - **Trample:** in alter-ego form you take 2 indirect damage. In hero form Juggernaut attacks the ally with the fewest remaining hit points, Hope Summers included, and the players choose among tied allies. Its boost deals 1 damage to an ally you control.
  - **Cyttorak's Exemplar:** if Juggernaut Exposed is in play, it flips back and Juggernaut gains a momentum counter. Otherwise threat equal to his ATK goes on the main scheme. It gains incite 1 in Expert.
  - **Captive Hope:** exhausts Hope Summers, and she cannot ready while it is in play.
- **Black Tom Cassidy:**
  - **Black Tom Cassidy:** villainous. When revealed, a Creeping Willow from the encounter deck or discard pile engages you. He cannot take damage while a Creeping Willow is in play.
  - **Creeping Willow:** guard and quickstrike. After it attacks and damages a character, that character is stunned. Its boost stuns you.
  - **Making Green:** hinder 2 per player, and each Creeping Willow gains surge.
  - **A Sound Thrashing:** each Creeping Willow attacks the player it is engaged with, even in alter-ego form. If none attacked you, a Creeping Willow from the encounter deck or discard pile is revealed.

## Interface

- Mission setup explains momentum, the Helmet, the main scheme and Hope Summers, and preselects Black Tom Cassidy.
- The villain is labelled with its stage and momentum counters. Its caption gives the ATK the momentum adds and the Helmet's side.
- The objective reads "Keep Hope Summers in play", and the main scheme notes that completing it makes Juggernaut charge.
- The Helmet's Hero Action is a button, and Head of Steam shows its retaliate value.
- Hope Summers sits with the allies, outside the ally count, with her attack and thwart values.

## Coverage boundaries

- The campaign log is not automated.
- The executable registry contains 3,083 faces, including 2,645 dedicated faces, with 1,468 imported faces still unsupported. There are 57 playable identities, thirty-nine scenarios and seventy-three modular sets. The inventory pins 161 source files.

The configured source matrix contains 283,920 cases in sixteen disjoint shards of 17,745; CI runs the sixteen shards in parallel. This import adds 11,440 cases:

- 7,592 for Juggernaut: 52 expansion starter identities × two difficulties × all 73 modular sets;
- 104 with Standard II and Expert II;
- 3,744 for Black Tom Cassidy in the 36 other scenarios with modular sets.

Manifest hashes retain all 272,480 previous mission names and seeds, checked against the complete grid of `9672756`.

Rules references: the NeXt Evolution rulebook (The Unstoppable Juggernaut) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Guard, Hinder, Incite, Overkill, Permanent, Quickstrike, Retaliate, Stalwart, Surge, Villainous).
