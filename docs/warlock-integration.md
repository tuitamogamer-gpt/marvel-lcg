# Adam Warlock integration

`src/game/warlock.ts` implements canonical hero `warlock` from the original
Mad Titan's Shadow catalog. `WARLOCK_SCRIPT_CODES` contains 16 faces:
`21031a/b`, `21032–21040`, and `21066–21070`. Nine signature definitions supply
15 physical cards: Pip, Soul World, Karmic Staff, Cape, two Cosmic Wards, two
Mystic Senses, three Karmic Blasts, two Cosmic Awareness, and two Quantum Magic.
The catalog supplies identity stats, traits, resources, costs and keywords.

Sources are the [original scans](https://hallofheroeslcg.com/the-mad-titans-shadow/#adam),
the [original expansion insert](https://hallofheroeslcg.com/wp-content/uploads/2021/08/mad-titans-shadow-insert-compressed.pdf),
the [official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/#adam),
and [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf).
FFG explicitly confirms that discarding **any** card with Battle Mage, including
Basic or identity cards, resolves the ability and permits Mystic Senses. FFG
also requires the Karmic Blast/Cosmic Awareness discard count to be chosen
before revealing cards and their discards to be simultaneous. Current RRG
p. 14 requires at least one game element for an **up to** cost. These spells
therefore choose 1–4 cards, bounded by the original deck's actual size; they
cannot pay zero. Dealing damage as a cost remains paid when some/all damage
is prevented (p. 14), unlike a TAKE damage cost.

## Identity actions and round bonuses

The native action IDs are `battle-mage` and `avatar-of-life`. Battle Mage
selects an actual hand-card ID, discards that same card, and records
`warlockMagePhase = round:phase`. Its effects depend on the original faction:

- Aggression deals 2 damage without attacking, so Guard/Stun do not apply.
- Justice removes 2 threat without thwarting, so Patrol/Confused do not apply.
  Crisis and the global scheme locks still apply.
- Protection heals 1 damage from a damaged ally controlled by any player.
- Leadership selects a hero and gives +1 ATK/THW/DEF this round.

A Basic/hero discard, or an aspect subeffect with no eligible recipient,
still resolves the initial discard and opens Battle Mage's response window.
Each actual Mystic Senses and Cape present at that trigger can respond once.
The owner chooses the order and may decline the remaining responses. Senses
draws one actual card per copy. Cape spends its exhaustion to ready Adam;
it cannot spend that cost when he is already ready or cannot be readied.
Saved continuations carry physical `sourceIds` and `usedIds`, so a later
upgrade cannot retroactively join the old trigger.

Leadership bonuses are scalar flags on the **receiving player's** seat:
`warlockLeadershipRound` and `warlockLeadershipAmount`. They stack within the
same round, apply only in hero form, and do not require that recipient to be
Warlock. `warlockStats(view)` must therefore be added to every hero's derived
ATK, THW and DEF. Call `warlockPhaseEnded` at both phase boundaries and
`warlockRoundEnded` at round end.

Avatar of Life selects an actual hand card and then an actual status. Only
after both remain available does it discard that card and remove exactly
**one** Stun, Confused or Tough card. `removeIdentityStatusCard` must preserve
other copies and resynchronize Steady/continuous modifiers. Native
`consumeStatus`, which removes status cards as attack/thwart replacement,
must not replace this one-card removal. Avatar has no printed use limit.

## Additional costs, events and resources

`warlockBeforeEvent(s,p,after)` applies only to Karmic Blast/Cosmic Awareness.
Call it after cancelable resource payment, before native event Stun/Confuse
replacement. It selects the discard count before looking, commits one batch
of actual original top cards, and attaches `warlockDiscarded` plus
`warlockDiscardCostPaid` to the serialized continuation. The host passes that
receipt into `warlockEvent(s,p,discarded)`. Receipts contain face snapshots;
the actual cards live in ordinary deck/discard zones.

`discardPlayerCards` must discard simultaneously, handle normal deck exhaustion
and reset, and stop at original deck exhaustion. It cannot continue through
the newly shuffled deck (RRG p. 33). The module preserves newly queued forced
and optional deck responses before its event or obligation continuation.
This lets a Church reset effect or Soul World response resolve in its proper
window even during an additional cost. The initial 4 damage/3 threat removal is
also before the printed cost arrow. If Stun/Confuse replaces the attack/thwart,
that initial cost still resolves as nonattack/nonthwart before the status is
removed; the additional damage/threat does not resolve. This follows the
official Karmic Blast cost ruling and the Steel Fist ruling explaining why its
original damage cost survived Stun before that card received an erratum.
The preserved cost obeys Crisis and Church's absolute player-card locks; Guard
and Patrol restrict attack/thwart operations rather than this replaced cost.

Distinct aspect count includes each of Aggression, Justice, Leadership and
Protection once and excludes Basic/hero cards. Karmic Blast deals one modified
attack packet of `4 + count`; Cosmic Awareness removes one modified thwart
packet of `3 + count`. Additional damage modifies the original damage instance
(the Repulsor Blast FAQ, RRG p. 57), preserving one Tough and Retaliate window.
Use native `attackProgram`/thwart routing with identity source `hero`, ordinary
Guard/Patrol/Crisis, event modifiers and status replacement.

Quantum Magic is usable in either form and chooses an actual preexisting
discard-card ID to move into hand. The currently resolving Quantum Magic is
not in the discard pile and cannot return itself. Returned cards retain their
physical ownership and ID.

Karmic Staff exposes its physical ID as a wild resource source in either form.
Commit its exhaustion only when payment is committed. A blank or exhausted
Staff is unavailable. Native payment cancellation must leave it ready.

## Pip, Cosmic Ward and Soul World

Pip the Troll's hand interrupt has no form restriction and can respond when
**any player** is attacked. `warlockAttackInitiatedOptions` belongs in the
shared native initiation window before defender declaration, including cards
owned by alter-egos. His owner pays 2 resources including Energy and Mental;
Pip is excluded from those selected hand resources. The `payRequest` carries
`abilityCost:true` and `targetCode:21032`: this is an ability cost considered
paid for that card, followed by putting the actual Pip into play under the
initial attacked player's control. It never qualifies for a hand-PLAY
discount or a played-ally response. Preserve original owner ID, uniqueness,
ordinary ally limit/entry handling, and printed Toughness. Pip has no printed
Retaliate; incoming/outgoing Retaliate and consequential damage use the
host's ordinary ally rules and consume Tough as applicable.

`warlockForcedTreacheryInterrupt` runs for the actual revealer **before**
optional cancellation windows, in either form. With two ready text copies,
the forced chooser selects the actual Ward to consume. It cancels only When
Revealed groups, discards the actual treachery, then discards that Ward.
An already canceled reveal cannot consume the other copy. The host's
`cancelWhenRevealed` preserves printed Incite/Surge and any captured encounter
modifiers, such as Mister Knife's first-treachery modifier. A canceled card
is still revealed for those observers. Uncancelable text must remain protected.

`warlockDeckExhausted(view)` captures actual Soul World sources at a real
empty-deck transition; it returns optional responses to place one soul counter
per copy. Do not call it for repeated empty observations or a search that did
not empty the deck. `warlockDeckReset(view)` is a separate forced hook for
each real reset, so Church effects precede optional Soul World responses.
Soul World's `soul-heal` action is alter-ego only; it simultaneously exhausts
the actual support and removes one actual counter, then heals all missing
identity HP through normal healing/max-HP rules.

## Physical nemesis and obligation

`warlockInitializeNemesis` creates exactly five actual pieces in existing
`player.setAside`: Magus, Church, two Zealots and Cosmic Inquisition. Call once
in native creation and once for an old save whose field is missing. Never
replenish an existing empty zone. Migration allocates IDs from the root
game's shared `nextId`, including every team seat.

`warlockShadowOfPast` reserves actual IDs and delays movement until each
reveal begins, putting Magus and Church through their ordinary reveal paths,
then moving only the actual remaining three cards into the encounter deck
and shuffling. It handles an already moved Church without manufacturing
another copy. A second Shadows surges. Nested encounter searches should
respect `warlockReservedNemesis` IDs until their committed reveal starts.

Regeneration Cycle optionally flips Adam freely to alter-ego, then either
exhausts his actual alter-ego to remove the actual obligation from the game,
or discards the original top five cards as far as possible, places main-scheme
threat for the distinct aspects discarded, and discards the obligation.
This mandatory discard is not an **up to** cost and may resolve as far as
possible from a short/empty deck.

Magus keeps printed Quickstrike/Toughness through ordinary keyword handling.
`warlockEnemyActivated(view,id,performed)` runs only after a real completed
attack or scheme against the original attacked/schemed player, while Magus
remains in play; it discards the original top five cards. Canceled and
Stun/Confuse-replaced activations do not call this forced response.

Universal Church of Truth exhausts/stuns the resetting player's identity in
either form after each actual player deck reset. Zealot's global lock prevents
all threat removal from actual Church schemes while an unblanked Zealot is
in play, regardless of engagement seat. Add `warlockSchemeLocked` to both
target legality and common threat-removal execution.

Cosmic Inquisition's Incite 2 belongs to the normal reveal-keyword window.
Its When Revealed ability discards top ten if Church is in play; otherwise,
`findAndRevealEncounter` searches only encounter deck, discard and actual
set-aside areas for the physical Church, reveals it and shuffles the encounter
deck. Its boost helpers retain each actual Church/Zealot boost source from
pending cleanup before revealing/putting it into play.

All module choices and continuations are plain serialized effect records.
`tests/warlock.test.ts` covers original quantities, costs, physical ownership,
team recipients, response ordering, phase/round limits, status-card counts,
actual deck exhaustion, nemesis conservation, and saved choice continuations.
`tests/warlock-engine.test.ts` additionally exercises the original forty-card
source through saved native dispatches, two-card simultaneous payment/reset,
Church and Soul World cost timing, actual transferred Pip ownership/defense,
Cosmic Ward with Mister Knife's captured Surge, and physical nemesis entry,
search, boost retention and completed activations. Each finished source fixture
checks that every original player-card ID still exists exactly once.
