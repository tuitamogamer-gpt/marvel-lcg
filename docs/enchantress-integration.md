# Trickster Takeover: Enchantress

This import adds Trickster Takeover's first scenario, Enchantress, with the Trickster Magic modular set. Enchantress casts a hypnotic gaze on each hero: the charm counters she and her minions place can flip it into a trance, while she crowns herself queen of the land she has seized. Trickster Magic brings four beguiled villains who join the players once defeated.

## Original source and scope

`src/game/enchantress-villain.ts` registers 44 original faces:

- **Enchantress (33):** Enchantress (I), (II) and (III); both sides of Prime Real Estate and of Sovereign Sorceress; Future of Despair; the five Hypnotic Gazes with their Trances of Envy, Greed, Pride, Sloth and Wrath; Alluring Call, Kiss of Temptation, Love Concoction, Seduced, Crown of the Enchantress, Enthralled Lackey (2), Enthralled Brute (2), Sindr, Ulik, Law of Attraction (2), Spellbound (2), "Do My Bidding", Magical Restraints (2), Spell Blast (2) and Spell Shards.
- **Trickster Magic (11):** the Absorbing Man, Titania, Whirlwind and Zzzax minions, The Trickster Tango, Puppet Master, Love Triangle and the four linked allies, Absorbing Man (Carl Creel), Titania (Mary MacPherran), Whirlwind (David Cannon) and Zzzax.

The imported catalog, original source decks and artwork remain unchanged. The God of Lies scenario, with its 37 faces, is not part of this import.

Standard uses Enchantress (I) and (II), Expert (II) and (III). The encounter deck holds the Enchantress and Standard sets and one modular set, with the Expert set in Expert; Trickster Magic is preselected and can be chosen in every other scenario with modular sets.

## Native rules

- **Setup (1A):** Future of Despair is set aside. Each identity gets a random Hypnotic Gaze; the others are set aside, and nobody sees their Trance sides.
- **Charm counters and trances:** a Hypnotic Gaze gives its identity the Defiant trait. With 5 or more charm counters, they come off and it flips to its Trance, whose When Revealed ability resolves: the identity is now Enthralled. "X. Otherwise, Y" resolves Y only when X cannot resolve at all.
- **Prime Real Estate (1B) and Sovereign Sorceress (2B):** a charm counter that would go on an Enthralled identity's Enchantment is 1 threat on the main scheme instead. Completing Sovereign Sorceress loses; when it is revealed (2A), each identity is stunned if the Crown of the Enchantress is in play, otherwise the Crown is found in the encounter deck or discard pile and revealed.
- **Enchantress:** 15, 16 or 18 hit points per player. After she attacks you, a charm counter goes on your Enchantment. Enchantress (II) in Standard and (III) put the set-aside Future of Despair into play with 3 (or 4) more threat per player: while it is in play she gains stalwart and cannot take damage, and when it is revealed later, a charm counter goes on each Enchantment.
- **Forced Actions:** each Trance and Temptation has a Forced Action that exhausts it. It is a button in the player's area, and any still due resolves before the player's turn ends, one at a time; the ready step readies them.
- **Trances:** Envy discards a card you control (otherwise the top 8 cards of your deck), then each round gives Enchantress a facedown boost card and readies you. Greed confuses you (otherwise 2 damage), then each round draws a card you must play, paying its cost, or take 1 damage. Pride exhausts you (otherwise a random discard), then places 1 threat on the main scheme and removes 2 from a side scheme. Sloth stuns you (otherwise 2 threat), then heals 1 damage from Enchantress and makes you draw 1 and discard 1. Wrath reveals a card from the top 5 of the encounter deck, then deals you 1 indirect damage and 2 damage to a minion.
- **Temptations:** Alluring Call, Kiss of Temptation and Love Concoction attach to your identity. Each Forced Action places a charm counter, then plays a card for 1 less, draws 1 and discards 1, or readies you. Their Alter-Ego Action exhausts and discards them, and as a boost each is revealed.
- **Seduced** reprints the nemesis card: no basic attacks or Attack events until an alter-ego spends energy and mental resources.
- **Crown of the Enchantress:** attaches to her; after she schemes against you, a charm counter; stalwart in Expert. Its Hero Action makes each player exhaust their identity and take 1 damage to discard it.
- **Minions:** the Enthralled Lackey (quickstrike) places a charm counter after attacking you; the Enthralled Brute (guard) has 3 more hit points engaged with an Enthralled player; each one's boost places a charm counter or confuses (or exhausts) you. Sindr's attacks deal indirect damage, and when revealed he activates against a Defiant identity or gains a tough status card against an Enthralled one. Ulik attacks the player who damages Enchantress; when he is defeated, she attacks his defeater with +1 ATK; he gains toughness in Expert.
- **Side schemes and treacheries:** Law of Attraction discards to the next Enthralled minion and reveals it. Spellbound places a charm counter for each Defiant player and makes each Enthralled player discard a card they control. "Do My Bidding", Magical Restraints and Spell Blast give a Defiant identity one choice and make an Enthralled one do both, in the order the player chooses. Spell Shards deals 3 indirect damage and places a charm counter if the identity took any. Law of Attraction, Spell Shards and the Temptations charm you as boosts.
- **Trickster Magic:** Absorbing Man gets +X ATK from the highest printed cost among the cards you control; Titania's attacks gain overkill; Whirlwind deals 1 indirect damage per side scheme after attacking you; Zzzax discards your top 4 cards for 1 indirect damage per printed energy resource. Each is Victory 1, and its defeater puts its ally into play. The allies do not count against the ally limit and are Victory 0: Carl Creel exhausts an upgrade or support for +X (up to 3) to an attack or thwart, Mary MacPherran's attacks gain overkill and piercing, David Cannon removes 1 threat from each scheme for +1 ATK each, and Zzzax searches the top 5 cards of your deck for a card with a printed energy resource. The Trickster Tango gives the villain stalwart and, as a boost, gives the attack overkill. Allies cannot thwart Puppet Master or defend against the villain while it is in play, and it gains hinder 1 per player in Expert. Love Triangle attaches to one of your allies, which cannot attack the villain or defend against him, or surges without one; its Alter-Ego Action exhausts the ally and spends a mental resource to discard it.

## Interface

- Mission setup explains the scenario and preselects Trickster Magic.
- The objective reads "Defeat Enchantress · N of M heroes entranced". Her caption repeats her Forced Response and, with Future of Despair in play, her stalwart and immunity. The main scheme's note says that an Enthralled hero's charm counters come there as threat, and on Sovereign Sorceress that completing it loses.
- Each Hypnotic Gaze is captioned with its charm counters, "N charm counters of 5 · Defiant", and each Trance and Temptation with its Forced Action, due this turn or used this round. The Forced Actions, the Temptations' Alter-Ego Action, Seduced, the Crown and Love Triangle offer their abilities as buttons.

## Coverage boundaries

- "Per player" values use the number of players who started the game, and the Future of Despair's additional threat follows the card's per-player icon.
- A Forced Action still due when a player ends the turn resolves then, rather than at any other moment of the player phase.
- Ulik's Forced Response answers damage dealt by a player card or an identity; damage from encounter cards does not trigger it. His attack waits until the card being played or resolving, or the activation in progress, has finished.
- An eliminated player's Enchantment is set aside again, Hypnotic Gaze side up.
- A linked ally that leaves play other than by defeat is removed from the game, since a linked card never joins a deck.
- The executable registry contains 3,478 faces, including 3,040 dedicated faces, with 1,073 imported faces still unsupported. There are 57 playable identities, fifty-two scenarios and ninety-six modular sets. The inventory pins 175 source files.

The configured source matrix contains 504,088 cases in sixteen disjoint shards of 31,505 or 31,506; CI runs the sixteen shards in parallel. This import adds 15,288 cases:

- 9,984 for Enchantress: 52 expansion starter identities × two difficulties × all 96 modular sets;
- 312 with Standard II and Expert II, with Standard III, or with the S.H.I.E.L.D. Executive Board added;
- 4,992 for the Trickster Magic set in the 48 other scenarios that allow it.

Manifest hashes retain all 488,800 previous mission names and seeds, checked against the complete grid of `80a3be9`. The unsharded matrix registers more cases than the default 2 GB Node heap holds; run it in shards, as CI does, or with a larger heap.

Rules references: the Trickster Takeover rules insert (Forced Actions, Enchantment attachments and the Enchantress FAQ) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Forced Action, Guard, Hinder, Linked, Overkill, Permanent, Piercing, Quickstrike, Retaliate, Stalwart, Steady, Surge, Toughness, Victory X, When Revealed).
