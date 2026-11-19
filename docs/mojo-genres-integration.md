# MojoMania genre sets

MojoMania's six genre modular sets are playable: Crime, Fantasy and Western, imported first, and Horror, Sci-Fi and Sitcom. Each can be chosen as the modular set of every scenario that uses modular sets. The box's three scenarios and its Longshot card follow in later imports.

## Original source and scope

`src/game/mojo-genres.ts` registers the six sets' 36 original faces on 37 physical cards:

- **Crime (6):** Dial M for Mojo, Build the Case, Crime Scene Investigation, Law & Order, Dragnet and Elementary, My Dear Mojo.
- **Fantasy (6):** A Game of Mojo's, Dragon, Goblin, Troll, Fetch Quest and Mana Drain.
- **Horror (6):** The Mojo Files, Bandolier of Stakes, Cultist, The Kraken, Vampire and Werewolf Pack.
- **Sci-Fi (7):** Mojo Runner, Avalanche 9.0, Blob 3.14, Magneto 2.6, Pyro 4.0, Toad 2.0 and ICE-Teroid M.
- **Sitcom (6):** Mojo in the Middle, Family Matters, Growing Pains, The Odd Couple, The One with the Breakup and Watch Me Play.
- **Western (6):** Wild Wild Mojo, Dead or Alive, Card Shark, Gunslinger (2) and A Game of Cards.

The imported catalog, the original source decks and the artwork remain unchanged.

## Native rules

Each set's Show is a Setting environment. When it is revealed it discards each other Setting environment in play, and when it was revealed from the encounter deck it gains surge.

### Crime, Fantasy and Western

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

### Horror

- **The Mojo Files:** each minion gains quickstrike, and an ally takes 1 less consequential damage after attacking a minion, as printed.
- **Bandolier of Stakes:** surges. You may spend 1 resource of any type to attach it to your identity with 3 stake counters; otherwise it is discarded. When your hero makes a basic attack you may remove a stake counter: that attack gets +1 ATK and piercing. It is discarded with its last counter.
- **Cultist:** after it activates against you, The Kraken is found in the encounter deck or discard pile and put into play engaged with you, the encounter deck is shuffled and Cultist is discarded.
- **The Kraken:** after it activates, each other character takes 1 damage: the villain, the other minions, each identity and each ally. When it is defeated, each friendly character heals 1 damage.
- **Vampire:** attacks with piercing deal double damage to it. After it attacks and damages a character, it heals all its damage; if it heals none, it gains a tough status.
- **Werewolf Pack:** when revealed, you defeat an ally you control and place it facedown under the pack. When the pack would be defeated with an ally under it, an ally under it is discarded instead and the pack heals all its damage.

### Sci-Fi

- **Mojo Runner:** each minion and ally gains toughness, so it enters play with a tough status.
- **Avalanche 9.0:** after it engages you, you exhaust a character you control and deal 1 damage to it. As a boost, you exhaust a character you control.
- **Blob 3.14:** it takes at most 2 damage from each attack. As a boost, you are stunned.
- **Magneto 2.6:** villainous. After it activates against you, it gains a magnetic counter and you choose and discard a card from your hand for each counter on it.
- **Pyro 4.0:** when it attacks you, you take 2 indirect damage first. As a boost, you take 2 indirect damage.
- **Toad 2.0:** after it engages you, an upgrade you control goes facedown under it. When it is defeated, each card under it returns to its owner's hand.
- **ICE-Teroid M:** a side scheme that gives each minion guard and patrol. At the end of the round, after the first player token is passed, the first player puts a minion from the encounter deck or discard pile into play engaged with them.

### Sitcom

The sitcom obligations stay in their player's play area, each with an Alter-Ego Action that discards it.

- **Mojo in the Middle:** each obligation in play gains an acceleration icon, and after a player discards an obligation, that player may draw 1 card.
- **Family Matters:** each support you control has a blank text box, except for its traits. Alter-Ego Action: exhaust your identity and each support you control.
- **Growing Pains:** each of your upgrades costs 2 more to play. Alter-Ego Action: discard an upgrade you control or from your hand; it is discarded once your discard pile holds more upgrades than you have in play.
- **The Odd Couple:** your ally limit is 2 lower. Alter-Ego Action: exhaust 2 characters you control and shuffle an ally from your discard pile into your deck.
- **The One with the Breakup:** each encounter card gains peril. Alter-Ego Action: discard 3 cards from your hand and choose a player, who draws 1 card.
- **Watch Me Play:** incite 3 and peril. Opening the app's rules help or a keyword explanation looks up a rule, which confuses you. Alter-Ego Action: exhaust your identity and discard a confused status card from it.

## Interface

- The six genre sets appear in the modular encounter list of every scenario with modular sets.
- A Show sits with the environments, labelled "Setting · Show" with its ongoing effect.
- Crime side schemes and ICE-Teroid M show their constant under the threat; a crime Hero Action asks for X before the payment.
- Obligations that stay in play sit in your play area with their constant beneath the name and their Alter-Ego Action as a button. Build the Case shows its clue counters.
- Bandolier of Stakes appears with your identity's attachments with its stake counters, Dead or Alive among its minion's attachments, Magneto 2.6 with its magnetic counters, and Werewolf Pack and Toad 2.0 with the number of facedown cards under them. Minions with guard or patrol from ICE-Teroid M show those keywords.

## Coverage boundaries

- A printed resource is a resource icon printed on the player card that deals the damage. Identity cards and encounter cards have none, so they cannot damage the Goblin and never double or increase damage to the Dragon or the Troll.
- Hinder follows the reminder text printed on each side scheme.
- Peril follows the engine's existing peril rule: other players cannot play reaction cards for a reveal with peril.
- A player discarding an obligation covers obligations that leave a player's play area; an obligation that resolves and goes to the encounter discard pile never entered play.
- The mission sweep also corrected two player cards that offered Tower Defense's other main scheme as a side scheme: Spider-Woman's Spider-Man and Domino's Team Investigation now offer side schemes only.
- The Horror, Sci-Fi and Sitcom sweep corrected older gaps they expose: payment now reads whether the physical source is blank, so Family Matters and Panic in the Streets also blank a support's resource ability; Shield Toss's play check counts the engine's own attack targets, so it cannot be played while Kang has no villain in play; and Powerful Enchantments only stops players discarding attachments, not Frozen in Time discarding itself or attachments leaving play with their host.
- The executable registry contains 2,957 faces, including 2,519 dedicated faces, with 1,594 imported faces still unsupported. There are 57 playable identities, thirty-three scenarios and sixty-eight modular sets. The inventory pins 155 source files.

The configured source matrix contains 221,728 cases in sixteen disjoint shards of 13,858; CI runs the sixteen shards in parallel. The Horror, Sci-Fi and Sitcom import adds 9,672 cases, 3,224 for each set in the 31 scenarios with modular sets. Manifest hashes retain all 212,056 previous mission names and seeds, checked against the complete grid of `ecc71e8`, which itself retains the 202,384 before Crime, Fantasy and Western, checked against `e9145ea`.

Rules references: the original card texts and [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Boost, Guard, Incite, Overkill, Patrol, Peril, Piercing, Quickstrike, Surge, Toughness, Villainous).
