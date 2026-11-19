# Sinister Motives: Osborn Tech and Sinister Assault

This import adds the last two modular sets of the Sinister Motives campaign expansion: Osborn Tech and Sinister Assault. Both can be chosen as the modular set of every scenario that uses modular sets; no scenario recommends them.

## Original source and scope

`src/game/sinister-modulars.ts` registers 12 original faces on 12 physical cards. Osborn Tech has six attachments: Arm Cannon, Ionic Boots, Kinetic Armor, Neocarbon Scales, Spiked Gauntlet and Tracking Display. Sinister Assault has six elite minions, Doctor Octopus, Electro, Hobgoblin, Kraven the Hunter, Scorpion and Vulture. The imported catalog, original source decks and artwork remain unchanged. With them every Sinister Motives scenario and modular set is playable; only the campaign's own sets remain.

## Native rules

- **Osborn Tech:** each attachment surges and attaches to the villain. Arm Cannon gives the villain's attacks overkill and piercing; its Hero Action discards the highest-cost upgrade you control. Ionic Boots place 2 threat on the main scheme after the villain attacks and damages your identity; their Hero Action spends an energy, a mental and a physical resource. Kinetic Armor gives the villain retaliate 1; its Hero Action deals you 3 indirect damage. Neocarbon Scales reduce the damage the villain takes from each attack by 1; their Hero Action gives the villain a tough status card and a facedown boost card. Spiked Gauntlet gives the villain +1 ATK; its Hero Action has the villain attack you, and the Gauntlet is discarded only if your identity takes no damage from that attack. Tracking Display keeps every character from defending against the villain's attacks; its Hero Action exhausts a character you control and discards a random card from your hand. Each Hero Action discards its attachment.
- **Sinister Assault:** each minion is villainous, so it gets a boost card when it activates. Doctor Octopus (incite 2) places 1 threat on each scheme after he activates against you. Electro (retaliate 1) discards cards from the top of your deck until he discards an energy or wild resource, after he engages you or activates against you. Hobgoblin (patrol) deals you 2 indirect damage after he attacks you. Kraven the Hunter (steady) has you discard an upgrade or support you control after he attacks and damages a character you control. Scorpion (toughness) stuns the character he damages, or deals it 2 damage if it is already stunned. Vulture (quickstrike) discards a random card from your hand after he activates against you.

## Interface

- Both sets appear in the modular encounter list of every scenario with modular sets.
- Osborn Tech's Hero Actions appear in the villain's attachment row and name their cost, for example "Take 3 indirect damage · discard Kinetic Armor". Sinister Assault's minions use the ordinary minion row.
- Armadillo and Tracking Display now share one defense restriction, so every defense window treats them alike.

## Coverage boundaries

- Spiked Gauntlet compares your identity's hit points before and after its attack; healing during that attack would hide damage taken.
- Doctor Octopus's "each scheme" includes only the main scheme with the glider counter among Venom Goblin's main schemes, as for every encounter card there.
- The executable registry contains 2,916 faces, including 2,478 dedicated faces, with 1,635 imported faces still unsupported. There are 57 playable identities, thirty-three scenarios and sixty-one modular sets. The inventory pins 153 source files.

The configured source matrix contains 199,160 cases in sixteen disjoint shards of 12,447 or 12,448; CI runs the sixteen shards in parallel. This import adds 6,448 cases: 3,224 for each set, in the 31 scenarios with modular sets. Manifest hashes retain all 192,712 previous mission names and seeds, checked against the complete grid of `da7dd55`.

The first mission sweep found Kraven the Hunter choosing Permanent supports and upgrades to discard; Permanent cards are no longer offered, and Arm Cannon's Hero Action needs an upgrade that can be discarded.

Rules references: the original card texts and [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Attachments, Boost, Incite, Indirect Damage, Overkill, Patrol, Piercing, Quickstrike, Retaliate, Steady, Surge, Toughness, Villainous).
