# MojoMania genre sets: Crime, Fantasy and Western

This import makes the first three of MojoMania's six genre modular sets playable: Crime, Fantasy and Western. Each can be chosen as the modular set of every scenario that uses modular sets. The other three genre sets (Horror, Sci-Fi and Sitcom) and the box's scenarios follow in later imports.

## Original source and scope

`src/game/mojo-genres.ts` registers the three sets' 17 original faces on 18 physical cards:

- **Crime (6):** Dial M for Mojo, Build the Case, Crime Scene Investigation, Law & Order, Dragnet and Elementary, My Dear Mojo.
- **Fantasy (6):** A Game of Mojo's, Dragon, Goblin, Troll, Fetch Quest and Mana Drain.
- **Western (6):** Wild Wild Mojo, Dead or Alive, Card Shark, Gunslinger (2) and A Game of Cards.

The imported catalog, the original source decks and the artwork remain unchanged.

## Native rules

Each set's Show is a Setting environment. When it is revealed it discards each other Setting environment in play, and when it was revealed from the encounter deck it gains surge.

- **Dial M for Mojo:** each other encounter card gains incite 1, and each friendly character gets +1 THW.
- **Build the Case:** an obligation that stays in your play area. After each side scheme is defeated it gains a clue counter, and at 3 clue counters it is discarded.
- **Crime Scene Investigation, Law & Order and Dragnet:** side schemes with hinder 1 per player. Crime Scene Investigation keeps threat from being removed from every other scheme, including Tower Defense's other main scheme and Venom Goblin's districts, Law & Order gives each friendly character −2 ATK, and Dragnet keeps the villain from taking damage. Each has a Hero Action: spend X resources of its printed type (mental, energy or physical) to remove X threat from it. X is chosen when the action is used, up to the threat on the scheme and the resources you can pay.
- **Elementary, My Dear Mojo:** either move all threat from a side scheme to the main scheme, which defeats that side scheme, or discard encounter cards until a side scheme is discarded and reveal it. Moving threat removes it, so a side scheme locked by Crime Scene Investigation cannot be chosen.
- **A Game of Mojo's:** each player gets +1 hand size.
- **Dragon, Goblin and Troll** read the printed resources of the card that deals them damage. The Dragon takes double damage from cards with a printed energy resource and, when defeated, each player draws 4 cards. The Goblin takes damage only from cards with a printed physical resource and, when defeated, removes 2 threat from a scheme. The Troll takes 1 more damage from each card with a printed mental resource and, when defeated, the player who defeated it may put an ally from their discard pile into play.
- **Fetch Quest:** surges. When it is defeated, each player in player order may search their deck for a card and play it, ignoring its resource cost. As a boost it enters play.
- **Mana Drain:** you choose a non-wild resource type, then each player draws 2 cards and discards each card in hand with that resource type. As a boost, you discard a card from your hand.
- **Wild Wild Mojo:** each enemy attack gains overkill, and damage a character takes is increased by 1.
- **Dead or Alive:** attaches to the minion with the highest printed hit points, or gains surge if there is none. The minion gets +3 hit points per player, and when it is defeated, each player adds a card from their discard pile to their hand.
- **Card Shark:** after it attacks you, you discard the top 3 cards of your deck and take indirect damage equal to the number of different printed resource types among them.
- **Gunslinger:** quickstrike. When it engages you, before quickstrike resolves, you may spend two energy resources to deal it damage equal to your hero's ATK.
- **A Game of Cards:** you draw 5 cards, then choose and discard 5. For each different printed resource type discarded this way, you discard an upgrade or support you control.

## Interface

- Crime, Fantasy and Western appear in the modular encounter list of every scenario with modular sets.
- A Show sits with the environments, labelled "Setting · Show" with its ongoing effect.
- Crime side schemes show their constant under the threat and their Hero Action as a button; choosing it asks for X before the payment.
- Build the Case sits in your play area with its clue counters, and Dead or Alive appears among its minion's attachments.

## Coverage boundaries

- A printed resource is a resource icon printed on the player card that deals the damage. Identity cards and encounter cards have none, so they cannot damage the Goblin and never double or increase damage to the Dragon or the Troll.
- Hinder follows the reminder text printed on each side scheme.
- The mission sweep also corrected two player cards that offered Tower Defense's other main scheme as a side scheme: Spider-Woman's Spider-Man and Domino's Team Investigation now offer side schemes only.
- The executable registry contains 2,938 faces, including 2,500 dedicated faces, with 1,613 imported faces still unsupported. There are 57 playable identities, thirty-three scenarios and sixty-five modular sets. The inventory pins 155 source files.

The configured source matrix contains 212,056 cases in sixteen disjoint shards of 13,253 or 13,254; CI runs the sixteen shards in parallel. This import adds 9,672 cases, 3,224 for each set in the 31 scenarios with modular sets. Manifest hashes retain all 202,384 previous mission names and seeds, checked against the complete grid of `e9145ea`.

Rules references: the original card texts and [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Boost, Incite, Overkill, Quickstrike, Surge, Toughness).
