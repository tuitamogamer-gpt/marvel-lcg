# Age of Apocalypse: Dark Beast

This import adds Age of Apocalypse's fourth scenario, Dark Beast, with the Savage Land, Genosha and Blue Moon sets. The traitor drags the heroes through time: each of his stages brings in one of the three sets with its Setting environment, and the Setting's Special ability resolves whenever he attacks and whenever an encounter card calls for it.

## Original source and scope

`src/game/dark-beast.ts` registers 30 original faces:

- **Dark Beast (10):** Dark Beast (I), (II) and (III), both sides of Dark Beast's Bogus Journey, High-Tech Goggles, Genetic Enhancement, Cruel Experiment (2), Evil Genius (3) and Time-Travel Shenanigans (2).
- **Savage Land (6):** The Savage Land, Pterosaur, Velociraptor (2), Giant Ape (2), Land Out of Time and Village Under Attack.
- **Genosha (6):** Genosha, Magistrate (2), Armored Unibike (2), Genoshan Mech, Escaped Mutant and Police State.
- **Blue Moon (8):** Blue Area of the Moon, Gladiator, Oracle, Manta, Earthquake, Warstar, Imperial Guardsman and Trial by Combat.

The imported catalog, original source decks and artwork remain unchanged.

Standard uses Dark Beast (I) and (II), Expert (II) and (III). The encounter deck holds the Dark Beast and Standard sets and one modular set, with the Expert set in Expert. Dystopian Nightmare is preselected. The Savage Land, Genosha and Blue Moon sets are always part of Dark Beast, and each can be chosen in every other scenario with modular sets.

## Native rules

- **Setup (1A):** the Savage Land, Genosha and Blue Moon sets are set aside with their environments. In Expert, High-Tech Goggles attach to Dark Beast.
- **Dark Beast's Bogus Journey (1B):** 1 threat per player to start, 1 more per player each villain phase, and the players lose when it reaches 10 per player.
- **Dark Beast:** each stage's When Revealed reveals a random set-aside environment and shuffles the rest of its set into the encounter deck; stages II and III also deal each player an encounter card. Dark Beast (I)'s resolves at setup. When he attacks you, his Forced Interrupt resolves the Setting's Special ability for you first.
- **Settings:** each one discards every other Setting environment when revealed. The Savage Land gives the villain retaliate 1 and its Special discards your top 3 cards. Genosha gives the villain steady and its Special places 1 threat on the main scheme. Blue Area of the Moon gives each minion guard and its Special deals 1 damage to your identity. In another scenario, each chosen set's Setting begins the game in play.
- **Dark Beast encounter cards:**
  - **High-Tech Goggles and Genetic Enhancement:** attach to Dark Beast, also as boosts. Their Hero Action exhausts your hero, resolves the Special and discards the card.
  - **Cruel Experiment:** discards encounter cards until a minion is discarded, reveals it and attaches to it: +2 hit points and guard.
  - **Evil Genius:** in alter-ego, Dark Beast schemes and gets a tough status card; in hero form he attacks you with an additional boost card.
  - **Time-Travel Shenanigans:** its defeater discards encounter cards until one from the Setting's set is discarded and reveals it.
- **Savage Land:** Pterosaur resolves the Special when revealed and, as a boost while The Savage Land is in play, is dealt to you facedown. Velociraptor discards your top card when it attacks you and gets +1 ATK for each resource icon on it. Giant Ape's defeater resolves the Special. Land Out of Time resolves The Savage Land's Special with 1 indirect damage for each resource icon discarded, or finds The Savage Land and reveals it. Village Under Attack's defeat makes each player resolve the Special.
- **Genosha:** Magistrate's defeater finds Escaped Mutant and attaches it to their identity; as a boost it has three more boost icons while Escaped Mutant is attached to you. Armored Unibike engages Escaped Mutant's holder and resolves the Special after attacking. Genoshan Mech resolves the Special twice after it defeats one of your allies. Escaped Mutant gives each Genosha minion that engages you quickstrike, and its Alter-Ego Action resolves the Special and discards it. Police State's defeater finds Escaped Mutant and reveals it.
- **Blue Moon:** each Imperial Guard minion has Teamwork. Gladiator cannot take damage while Trial by Combat is in play and, as a boost while it is, is dealt to you facedown. Oracle confuses you, Manta stuns you and Earthquake exhausts your identity, each resolving the Special if you already were. Warstar reveals the top encounter card if it is an Imperial Guard minion, otherwise resolves the Special. Imperial Guardsman attaches to a minion, otherwise surges: +4 hit points, the Imperial Guard trait and the Special when that minion is defeated. Trial by Combat's defeat shuffles each Imperial Guard minion from the encounter discard pile into the deck.

## Interface

- Mission setup explains the set-aside sets, the Settings and the Special, and preselects Dystopian Nightmare.
- The villain label carries the stage and the Setting in play, and the caption gives the Special his attacks resolve.
- Each Setting environment is labelled as a Setting, with its constant ability and Special.
- The Goggles' and Genetic Enhancement's Hero Actions and Escaped Mutant's Alter-Ego Action are buttons on their cards.

## Coverage boundaries

- The campaign log, Overseer minions and Mission side schemes are not automated.
- In The Hood and Mojo scenarios, a modular set kept aside keeps its Setting until the set joins the encounter deck; the Setting is then revealed like any other card.
- The executable registry contains 3,244 faces, including 2,806 dedicated faces, with 1,307 imported faces still unsupported. There are 57 playable identities, forty-five scenarios and eighty-two modular sets. The inventory pins 167 source files.

The configured source matrix contains 369,928 cases in sixteen disjoint shards of 23,120 or 23,121; CI runs the sixteen shards in parallel. This import adds 21,424 cases:

- 8,216 for Dark Beast: 52 expansion starter identities × two difficulties × the 79 modular sets other than his three;
- 104 with Standard II and Expert II;
- 13,104 for the Savage Land, Genosha and Blue Moon sets in the 42 other scenarios with modular sets.

Manifest hashes retain all 348,504 previous mission names and seeds, checked against the complete grid of `4de0cc6`.

Rules references: the Age of Apocalypse rulebook (Dark Beast) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Elite, Guard, Hinder, Indirect Damage, Patrol, Quickstrike, Retaliate, Setup, Steady, Surge, Teamwork, Toughness).
