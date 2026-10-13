# Mystique modular encounter integration

`src/game/mystique.ts` implements the four original Mutant Genesis Mystique
faces `32080`–`32083`, accounting for five physical encounter cards: one
Mystique, one Metamorphic Mayhem, two Infiltration and one Shapeshifter Surprise.
`MYSTIQUE_SET` is the canonical `mystique` set code. Imported catalog JSON,
quantities, names and source printings remain unchanged.

| Code  | Name                  | Copies | Printed statistics and icons                                                  |
| ----- | --------------------- | -----: | ----------------------------------------------------------------------------- |
| 32080 | Mystique              |      1 | Unique; HP 9; ATK/SCH stars; Toughness; Brotherhood of Mutants/Elite; boost 3 |
| 32081 | Metamorphic Mayhem    |      1 | Fixed base threat 3; Amplify 1; boost 3                                       |
| 32082 | Infiltration          |      2 | Shapeshifter; boost 1; no player resources                                    |
| 32083 | Shapeshifter Surprise |      1 | Shapeshifter; boost 2; no player resources                                    |

All four faces have ordinary numeric boost icons and no star boost ability.
Metamorphic Mayhem's three threat is fixed, independent of player count.
Amplify is a scheme icon and contributes through the ordinary native boost
count; it is not extra base threat or a printed boost star.

## Absolute villain attack prohibition and dynamic statistics

`mystiqueVillainAttackProhibited` checks every actual unblanked Mystique minion
in play, regardless of engagement or active player. Her “Players cannot attack
the villain” is an absolute prohibition. It applies to player identity events,
basic attacks, player card attack abilities and controlled ally attacks. It
must remain effective when another ability ignores Guard, including Phased
Shadowcat and the printed Shadowcat ally. Native attack target lists and
saved-choice revalidation both enforce it. Nonattack damage to the villain
remains permitted. Enemy attacks are governed by their own native source
classification.

`mystiqueStats(s, piece, ports)` supplies the actual current base ATK/SCH values
for the actual in-play Mystique. The host's `villainStats` supplies current
native villain statistics including applicable modifiers, rather than copying
a printed stage snapshot. Recalculate when derived enemy statistics are
requested. Mystique's own attached/granted native modifiers apply afterward.
Do not copy unrelated activation boost icons into her base statistics.

Blanking Mystique's printed text removes the prohibition and makes her
copied star values zero. Her printed HP, unique symbol, traits and boost icons
are unchanged. Ordinary native keyword/blanking rules apply to Toughness;
an existing Tough status obtained earlier remains until its native removal.
The module does not re-grant or remove Tough every time it calculates stats.

## Physical reveal and Mayhem movement

When Infiltration or Shapeshifter Surprise is actually revealed, native
`mystiqueReveal` queues `mystique:infiltrate-deck` with the original physical ID
and revealer. `shuffleIntoPlayerDeck` takes that exact card out of its actual
resolving/encounter zone, shuffles it into the receiving player's existing
deck, and only then continues with gained Surge. It retains encounter
ownership and must keep native finish-resolution cleanup from also putting
that same card in encounter discard. A resolving card is moved, not copied.
Blank/canceled When Revealed text grants neither the printed shuffle nor its
gained Surge.

Metamorphic Mayhem's When Defeated belongs to the actual defeating player.
The module selects **every actual Shapeshifter card in encounter discard** at
resolution and passes those IDs to the same physical movement port. It does
not substitute cards from player hands/decks/discards, encounter deck,
set-aside areas or removed cards. The trait selector includes Shapeshifters
from other sets if actually present, such as Misled `38027`. No eligible
cards means no fabricated cards or invented discard/reset. An existing player
deck is retained when actual selected cards are shuffled into it.

## Authoritative hand entry and discard destinations

The original [Mutant Genesis rulebook, page 7](https://hallofheroeslcg.com/wp-content/uploads/2022/10/mutant-genesis-rulebook.pdf)
provides the specific zone authority:

> “If one of these treachery cards subsequently enters your hand, trigger its
> Forced Response at that time.”
>
> “Drawing a treachery card from your deck counts as drawing a card.”
>
> “When you discard a treachery card from your hand or deck, it is placed in the
> encounter discard pile.”

The [official August 14, 2025 ruling](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/)
specifically confirms the draw-up-to-hand-size interruption:

> “cards are drawn one at a time, so if you draw Shapeshifter Surprise when
> drawing up to your hand size, you immediately resolve it before finishing
> drawing cards.”

The native fixed-draw continuation preserves only its remaining draw count.
The refill continuation rechecks the current hand-size deficit after each
Forced Response. Thus Infiltration discarding Asgard can reduce the remaining
draws. Multiplayer refill resumes the interrupted seat before drawing for the
next seat, and a terminal Kelly loss stops all remaining draws.

These cards occupy real player deck/hand slots. Drawing one counts toward
that draw instruction and hand size; it is not replaced by drawing a player
card. Its printed boost triangles are not player resources. It remains in
hand after its Forced Response and may be discarded whenever a player card
could be discarded from hand, including end-of-phase cleanup and effects
requiring a hand discard.

`mystiqueDiscardFromPlayerZone(piece, "hand" | "deck" | "discard")` identifies
the source-authorized encounter-discard destination for `32082` and `32083`
when discarded from **hand or deck**. Apply it to ordinary hand discard,
random/selected discard, milling and any legal hand discard cost. A discard
from deck which never enters hand does not trigger the hand response. The
function returns false for existing player-discard cards; it does not
silently migrate legacy cards or fabricate copies. Preserve each actual
encounter ID and ownership throughout these movements.

Shuffle-in effects are not draws or player-deck reset penalties. Native
player-deck exhaustion remains authoritative when a real draw/mill empties
that deck. These treacheries normally return to encounter discard on their
hand/deck discard, so they do not become normal owned player cards recycled
from player discard. Save migration and any exceptional pre-existing zones
must preserve physical cards using actual source authority.

## Hand-entry receipt contract

Immediately after every actual addition to a player's hand, native movement
creates a `MystiqueHandEntryReceipt`:

```ts
{
  (token, playerId, pieceId, code);
}
```

Each actual entry gets a fresh unique token, including draws, searches,
returns to hand, retrieval of an attached/stored card and other direct hand
moves. Repeated callbacks for that **same entry** retain its token. The
identity of the physical card is not an entry token: the same physical
Infiltration/Surprise can enter hand again and trigger again later.

Call `mystiqueHandEntered` only after that exact ID is present in the actual
recipient's hand. It verifies the receiving seat and original physical face,
and queues a Forced Response effect with that player's `actorId`. Milling,
looking at hidden cards, failed searches, moving a card between deck and
discard, and merely revealing an encounter card do not create a hand-entry
receipt. A blanked source cannot capture a new printed trigger.

Resolve the generated effects at that actual entry boundary, before completing
the parent draw/search/return program. This ensures a mandatory response to
one draw can resolve before the next draw instruction. The receipt flag
`mystiqueHandEntry:<token>` prevents duplicate resolution of one actual entry.
If another mandatory effect later moves the triggering card out of hand, the
already captured response still retains its receipt; it is not canceled
because its source's location changed. A missing/eliminated recipient cannot
receive an invented activation or discarded target.

Native mutation detection may be implemented at the shared movement/scheduler
boundary, provided it captures actual unique entry instances and forces these
responses before a following queued parent effect. A once-per-piece flag or
an end-of-command board comparison loses repeated/nested hand-entry timing.

The host persists `mystiqueHandPresence` by actual seat and physical ID,
observes movement before and after each native effect/command, and immediately
observes each card drawn. An old save without this field seeds its existing
hand as a baseline, preventing retroactive hand-entry responses. Receipt flags
and queued continuations survive JSON saves. Hand/deck source snapshots route
generic direct-discard effects without moving unrelated legacy discard cards.

## Infiltration and scenario allies

Infiltration's Forced Response discards one actual controlled ally or support
when possible. There is no optional pass and it does not discard Infiltration
itself. `controlledPieces` supplies actual native controlled cards, including
scenario allies held outside the ordinary `player.inPlay` array.

This matters for Sabretooth's singleton Robert Kelly. The actual controlling
player must be able to select that real Kelly ID if native discard legality
permits it. Discard uses the native scenario leave/defeat/loss machinery; it
must not create a second Kelly or silently exclude him from a forced target
choice. A different player's controlled Kelly and unrelated teammate cards
are not eligible targets. Printed allies currently treated as minions are
not controlled allies. Native cannot-discard restrictions and ownership
apply to each selected physical source.

Saved choices revalidate the same actual controlled ally/support before
committing its discard. `discardControlled(s, id, after)` owns ordinary
leave-play interrupts/responses, attached-card cleanup, owner-aware discard
and continuation. With no eligible target the response resolves as far as
possible, leaving the treachery in hand.

## Shapeshifter Surprise

When Surprise enters hand and actual Mystique is already in play, call
`activateMystique` for that physical minion against the hand-entry player.
Her engagement with another seat does not redirect this explicit activation.
Native current Hero/Alter-Ego form decides attack versus scheme, and native
Stun/Confuse replacement, boosts, defense and completion rules apply. A
blanked Mystique still exists and activates with her current zero copied
statistics; it does not force the search branch instead.

Nested activation saves the actual outer attack/scheme and pending boosts in
`mystique-native:activation-finish`, then restores that state after the native
activation and response windows finish. Outer hero-defense scope continues to
apply during the nested activation, including Phased Shadowcat's damage
prohibition. Terminal scenario cleanup retains those physical saved boosts
before clearing continuations.

Otherwise, search the actual **encounter deck and discard pile** for Mystique
and reveal that exact piece to the hand-entry player. Do not search player
zones, set-aside cards, removed cards or fabricate a missing minion. Saved
search options use real physical IDs and revalidate those searched zones.
`revealSearchedMystique` owns source removal, native encounter exhaustion,
actual REVEAL/entry/Toughness/When Revealed timing, then resumes the serialized
search-finish continuation. The encounter deck is shuffled after the search,
including a failed search. Search/reveal is not PUT and does not grant an
additional invented activation of the newly revealed Mystique.

Surprise remains in hand after the activation or search, just as Infiltration
does. A later new actual entry of that same card creates another response.

## Sources and verification

The immutable original catalog already correctly records the four-face,
five-card module, Mystique's uniqueness/stars, Mayhem's fixed base threat,
Amplify, and all numeric boost values. Original local artwork `32080.webp`
and `32083.webp` was directly inspected. Shapeshifter Surprise's printed image
says “and reveal her”; the raw imported text has the typographical “an reveal”.
The authored effect implements the printed operation without mutating the
import or inventing an errata overlay.

The original product rulebook above was downloaded and read, including the
entire Mystique modular-set paragraph. The [original product gallery](https://hallofheroeslcg.com/mutant-genesis/)
and source image URLs in the catalog supply printing provenance.
[FFG Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf)
supplies ordinary Cannot/Ignore precedence, triggered abilities, card entry,
status replacement, activation, blanking, ownership, reveal, search and deck
exhaustion timing. The printed rulebook provides the explicit encounter-card
hand/deck discard exception used here.

`tests/mystique.test.ts` exercises original accounting, current stat copies and
blanking, global absolute prohibition, real reveal/shuffle/Surge order, Mayhem's
all-Shapeshifter selector, actual hand-entry tokens, repeat entries,
controller/owner-aware discard, scenario Kelly eligibility, native activation
ports, real deck/discard searches, failed searches, saved-choice validation,
resource-icon separation and the printed discard destination. Each queued
effect/choice crosses JSON serialization and retains actual physical IDs.
`tests/mystique-engine.test.ts` additionally drives native reveal, hand-entry,
draw/refill, search/return, discard/mill/reconciliation, activation, stat,
prohibition, ally and Mayhem paths using the actual original source pieces and
JSON saves, checking their physical conservation. Scenario fixtures, full
regression and browser checks provide separate integration verification.

The focused Mystique suites pass 56 pure tests and 26 native engine tests.
The native cases include Defensive Energy interrupting Mutant Protectors
before its pending ally enters play, and a nested Surprise activation during
Preemptive Strike payment while Phased defends the outer attack. The original
boosts, paid resources, event sources, and encounter-owned hand cards remain
actual unique physical pieces through both saved programs.
