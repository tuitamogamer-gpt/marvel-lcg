# Age of Apocalypse: Standard III

This import adds Age of Apocalypse's Standard III encounter set as a third choice of encounter sets, next to the core Standard set and The Hood's Standard II. It changes the way nemesis sets enter the game: instead of Shadow of the Past, the Pursued by the Past environment collects pursuit counters, and once there are enough, the player who placed the last one is attacked by their nemesis minion or brings their nemesis set into play.

## Original source and scope

`src/game/standard-iii.ts` registers 7 original faces: both sides of Pursued by the Past, Dark Designs (2), Sinister Strike (2), Evil Alliance, Nowhere is Safe and Drawing Near.

The imported catalog, original source decks and artwork remain unchanged.

The rulebook allows Standard III wherever a scenario requires the Standard set, and it is about as difficult as the original. The mission setup's **Encounter sets** choice offers Original, Standard II and Standard III in every scenario with modular sets; Standard III keeps the core Expert set in Expert. Standard II and Standard III cannot be combined.

## Native rules

- **Pursued by the Past (Permanent, Setup):** begins the game in play with no counters and cannot leave play. After a player places a pursuit counter on it, if it has at least 3 more counters than the number of players, every counter comes off: that player's nemesis minion in play activates against them (attacking in hero form, scheming in alter-ego form), or, with none in play, the card flips.
- **Pursued by the Past (B side):** the player's nemesis minion is found and revealed, their nemesis side scheme is revealed from the set-aside area and the rest of their set-aside nemesis set is shuffled into the encounter deck, exactly as Shadow of the Past does for each identity, including the identities with their own nemesis rules; then the card flips back. Once that player's nemesis set has entered, the flip finds their nemesis minion in the encounter deck or discard pile and reveals it.
- **Dark Designs:** 1 pursuit counter, then, if Pursued by the Past still has counters, the villain schemes against you. As a boost, 1 pursuit counter after the activation resolves.
- **Sinister Strike:** 1 pursuit counter, then, if it still has counters, the villain attacks you in hero form, or the card gains surge in alter-ego form.
- **Evil Alliance:** each nemesis minion in play, whoever's it is, activates against you; with none, 3 pursuit counters. As a boost, 1 pursuit counter after the activation resolves.
- **Nowhere is Safe:** 1 pursuit counter, then, if it still has counters, you discard an upgrade or support you control. As a boost, 1 pursuit counter after the activation resolves.
- **Drawing Near:** an obligation that stays in your play area. After your turn begins, the top card of your deck is discarded and Pursued by the Past gains a pursuit counter for each printed resource icon on it. Its Alter-Ego Action discards an identity-specific card from your hand to discard it.

## Interface

- Mission setup offers Standard III in the Encounter sets choice and explains Pursued by the Past.
- The mission line shows Standard III.
- Pursued by the Past is labelled as a permanent environment, with its pursuit counters against the number it takes and what happens then.
- Drawing Near's Alter-Ego Action is a button on the card.

## Coverage boundaries

- "The number of players" is the number of players who started the game, as with per-player values.
- If a player has more than one nemesis minion in play, each of them activates when that player's counters come off.
- The executable registry contains 3,279 faces, including 2,841 dedicated faces, with 1,272 imported faces still unsupported. There are 57 playable identities, forty-six scenarios and eighty-four modular sets. The inventory pins 169 source files.

The configured source matrix contains 392,288 cases in sixteen disjoint shards of 24,518; CI runs the sixteen shards in parallel. This import adds 4,576 cases: one per expansion starter identity, difficulty and scenario that uses the Standard set, each with Standard III and the scenario's recommended modular set.

Manifest hashes retain all 387,712 previous mission names and seeds, checked against the complete grid of `8387e99`.

Rules references: the Age of Apocalypse rulebook (Standard III encounter set) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Nemesis, Obligation, Permanent, Setup, Surge).
