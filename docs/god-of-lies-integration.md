# Trickster Takeover: God of Lies

This import adds Trickster Takeover's second scenario, God of Lies, in Single Group Mode. Loki, God of Lies hides outside the heroes' reach while one Avatar of Loki after another spreads mischief and mayhem. Each Avatar that would be defeated shatters an illusion, and only the shatter counters it gathered ever wound the God of Lies. With it, all 81 Trickster Takeover faces are registered.

## Original source and scope

`src/game/god-of-lies.ts` registers 37 original faces: both sides of Loki, God of Lies and of Worlds Collide; Loki the Rascal, the Miscreant, the Knave and the Wretch with their Fading Figments; both sides of Mischief and Mayhem; Intense Focus and its Total Focus side; Wrapped in Chains, Dark Scepter, Draugr Buddy (2), Grendell, Malekith, Minotaur, The Mangog, Fenris Wolf, Hraesvelgr, Laufey, Aura of Stasis, Door Between Worlds, Lofty Goals (2), New Jotunheim, Dark Arts (2), Dirty Trick, Stories and Lies (3) and the Synergy environments Domineering Force, Feigned Retreat, Mounting Resistance and Unified Front.

The imported catalog, original source decks and artwork remain unchanged. The encounter deck holds the God of Lies and Standard sets and one modular set, with the Expert set in Expert; Trickster Magic is preselected.

## Native rules

- **Single Group Mode:** the players form one group, the only group in their pod. Loki, God of Lies and Worlds Collide are outside the group's game area: no card affects them unless it names them, and nothing places acceleration tokens on Worlds Collide. Each per-player icon on Loki counts the players, and Worlds Collide's target of 2 counts the one group.
- **Setup (Worlds Collide A, Mischief and Mayhem 1A):** a random Avatar of Loki is the villain and the other three are set aside; the four Synergy environments enter play; Intense Focus is set aside in Standard and attached to the Avatar in Expert. Loki, God of Lies has 20 hit points per player.
- **Shattering the illusion:** an Avatar of Loki that would be defeated gains 5 shatter counters per player and flips to his Fading Figment instead. Its When Revealed shatters the illusion: the shatter counters come off and deal that much damage to Loki, God of Lies, a random set-aside Avatar takes the Figment's place at his starting hit points, and the defeated Avatar is set aside again. Then the Figment's Synergy environment fills with synergy counters, one per player: Unified Front for the Rascal, Mounting Resistance for the Miscreant, Domineering Force for the Knave and Feigned Retreat for the Wretch.
- **Loki, God of Lies:** at 10 or fewer hit points per player he flips once the illusion has shattered. In Standard, Intense Focus attaches to the Avatar and its When Revealed discards the top 2 encounter cards per player and the top 5 cards of each player deck. In Expert, Intense Focus flips to Total Focus, which does the same, then finds Dark Scepter and reveals it, or gives the Avatar a tough status card if Dark Scepter does not enter play. Defeating Loki, God of Lies wins the game.
- **Intense and Total Focus:** the Avatar gets 2 (Total Focus: 3) more hit points per player, steady and the attachment's +1 ATK and +1 SCH.
- **Mischief and Mayhem (1B):** completed, it loses all its threat and places 1 threat on Worlds Collide instead. An identity that would be defeated changes to alter-ego form with 1 hit point, and 1 threat goes on Worlds Collide instead.
- **Worlds Collide:** at 2 threat the players lose at once in the villain phase; in the player phase they finish the phase and win if Loki, God of Lies falls before it ends.
- **The Avatars:** Loki the Rascal makes you deal yourself a treachery boost card resolved in his activation facedown, or spend a resource; after you resolve a treachery, Loki the Miscreant places 1 threat on the main scheme and 1 on a side scheme, and Loki the Knave deals 1 damage to your identity and 1 to one of your allies; Loki the Wretch discards the top encounter card as he activates against you and gets +1 SCH and +1 ATK for that activation if it is a treachery.
- **Stories and Lies** swaps the Avatar with a random set-aside one, who keeps his damage, attachments, status cards and shatter counters, then the Knave or Miscreant schemes or the Rascal or Wretch attacks you, with +1 in Expert.
- **Encounter cards:** Wrapped in Chains attaches to your identity, which cannot ready, and exhausts it; its Hero Action spends 2 resources of one type to discard it and place 1 shatter counter. Dark Scepter attaches to the Avatar: stalwart, treacheries cannot be canceled, and its Hero Response after you resolve a treachery spends 2 resources of one type to discard it. Draugr Buddy's defeater discards the top encounter card and takes Draugr Buddy facedown if it is a treachery. Grendell attacks with +1 ATK for each treachery among the top 3 encounter cards, Malekith deals you a treachery from the top of the deck after attacking you, Minotaur activates against you when revealed with 5 or more treacheries in the encounter discard pile, Hraesvelgr deals 2 indirect damage when a treachery is among the top 3, and Laufey stuns the character who attacks her when the top card is a treachery. Aura of Stasis exhausts you for a treachery among the top 2 (3 in Expert). Dark Arts reveals a minion from the encounter discard pile, otherwise places 3 threat, and gains incite 1 in Expert. Dirty Trick removes a shatter counter and deals 2 damage (3 in Expert). Lofty Goals, Dark Arts and Dirty Trick's boosts deal indirect damage or place threat for each character you control.
- **Shatter and synergy counters:** Grendell, Fenris Wolf, Hraesvelgr, Laufey, The Mangog, Door Between Worlds and New Jotunheim each leave 3 shatter counters, Malekith, Minotaur and Lofty Goals 2. Fenris Wolf adds a synergy counter to Mounting Resistance, Hraesvelgr to Domineering Force, Laufey to Unified Front and New Jotunheim to Feigned Retreat; The Mangog and Door Between Worlds add one to the Synergy environment the first player chooses. Both are Victory 1.
- **Synergy environments:** at most 1 synergy counter per player each. Remove one from Domineering Force as a friendly character attacks for 4 more damage, from Mounting Resistance as one thwarts for 4 more threat removed, from Feigned Retreat as an identity would take damage to prevent 4 of it, and from Unified Front to generate 2 wild resources.

## Interface

- Mission setup explains the scenario, shows the Avatars' and Loki's hit points and preselects Trickster Magic.
- The objective reads "Defeat Loki, God of Lies · N of M hit points · Worlds Collide X of 2". A panel outside the game area shows Loki, God of Lies with his hit points, the shatter counters on the Avatar and where he flips, Worlds Collide with its threat, and the set-aside Avatars.
- The Avatar's caption counts his shatter counters and repeats his Forced ability; the main scheme's note says that completing it places threat on Worlds Collide. Each Synergy environment shows its synergy counters and what removing one does.
- Wrapped in Chains offers its Hero Action for each resource type the player can pay twice; the Synergy environments are offered as interrupts on basic attacks and thwarts, in the damage windows of identities and as a payment source.

## Coverage boundaries

- Only Single Group Mode is playable; Epic Multiplayer Mode, with several groups and pods, is not.
- The Shatter the Illusion rules card is not in the imported catalog. Its steps follow the rules insert: the shatter counters wound Loki, God of Lies, and a random set-aside Avatar takes the Fading Figment's place, keeping its attachments and status cards, with his starting hit points; the defeated Avatar is set aside again.
- Attaching the set-aside Intense Focus in Standard resolves its When Revealed, as the card's Standard text intends.
- A defeated identity is set to 1 hit point and places its threat on Worlds Collide at once, but changes to alter-ego only once the attack, activation or card that defeated it has finished, with its responses, so that no ability in progress loses its hero.
- Canceling the payment for Dark Scepter's Hero Response or Wrapped in Chains' Hero Action declines it.
- Domineering Force and Mounting Resistance are offered for the basic attacks and thwarts of identities and allies, not for attacks and thwarts from events or other abilities.
- "Per player" values use the number of players who started the game.
- The executable registry contains 3,515 faces, including 3,077 dedicated faces, with 1,036 imported faces still unsupported. There are 57 playable identities, fifty-three scenarios and ninety-six modular sets. The inventory pins 176 source files.

The configured source matrix contains 514,384 cases in sixteen disjoint shards of 32,149; CI runs the sixteen shards in parallel. This import adds 10,296 cases:

- 9,984 for God of Lies: 52 expansion starter identities × two difficulties × all 96 modular sets;
- 312 with Standard II and Expert II, with Standard III, or with the S.H.I.E.L.D. Executive Board added.

Manifest hashes retain all 504,088 previous mission names and seeds, checked against the complete grid of `915d939`. The unsharded matrix registers more cases than the default 2 GB Node heap holds; run it in shards, as CI does, or with a larger heap.

Rules references: the Trickster Takeover rules insert (Single Group Mode, shatter counters, Shattering the Illusion, Swapping Avatars of Loki, Tracking Damage on Loki, God of Lies, Tracking Threat on Worlds Collide, Synergy environments and the God of Lies FAQ) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Guard, Incite, Patrol, Permanent, Retaliate, Stalwart, Steady, Toughness, Victory X, When Revealed).
