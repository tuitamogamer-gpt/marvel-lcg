# Ghost-Spider identity integration contract

`src/game/ghost-spider.ts` owns the original Ghost-Spider identity, eight
signature faces, obligation and five-card nemesis set. Canonical catalog hero
and set ID: **`ghost_spider`**. Original product: **`sm`**, Sinister Motives.
`GHOST_SPIDER_SCRIPT_CODES` contains exactly fifteen raw faces: `27001a/b`,
`27002–27009`, and `27025–27029`.

This is a pure module and serialized host contract. Its focused tests exercise
actual source IDs, callbacks and protocol packets; they do not certify an
integrated engine or the entire Sinister Motives box. Supplementary player
cards, Miles Morales, villains, scenarios and campaign rules are separate
imports.

Sources: local original scans in `public/cards/catalog/270xx.webp`,
[Sinister Motives original gallery](https://hallofheroeslcg.com/sinister-motives/),
[official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/), and
[RRG 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf).
Worried Father follows the current erratum on RRG p. 68. The old printed
set-aside wording must not override that erratum.

## Original physical accounting

The source starter has **40 physical player cards: 15 Hero, 15 Protection and
10 Basic**. It has no setup reserve or Permanent card. Nemesis cards are five
separate physical encounter cards; the obligation is one separate card.

| Code   | Printed card             |              Quantity | Cost | Printed player resource / numeric boost |
| ------ | ------------------------ | --------------------: | ---: | --------------------------------------- |
| 27001a | Ghost-Spider             |         identity face |    — | —                                       |
| 27001b | Gwen Stacy               | reverse identity face |    — | —                                       |
| 27002  | Ghost Kick               |                     3 |    2 | Physical 1                              |
| 27003  | Parental Guidance        |                     1 |    0 | Energy 1                                |
| 27004  | Phantom Flip             |                     3 |    2 | Energy 1                                |
| 27005  | Pirouette and Punch      |                     2 |    2 | Mental 1                                |
| 27006  | Web Binding              |                     2 |    2 | Mental 1                                |
| 27007  | George Stacy             |                     1 |    1 | Energy 1                                |
| 27008  | Ticket to the Multiverse |                     1 |    3 | **Wild 2**                              |
| 27009  | Web-Bracelet             |                     2 |    2 | Physical 1                              |
| 27025  | Worried Father           |          1 obligation |    — | Boost 2                                 |
| 27026  | Regenerative Research    |             1 nemesis |    — | Boost 3                                 |
| 27027  | The Lizard               |             1 nemesis |    — | Boost 2                                 |
| 27028  | Experimental Injection   |             1 nemesis |    — | **Boost 0, no star**                    |
| 27029  | In Cold Blood            |             2 nemesis |    — | Boost 1                                 |

Hero: HP 10, ATK 2, THW 1, DEF 3, hand size 5, Web-Warrior. Alter ego:
REC 3, hand size 6, Civilian. Regenerative Research has fixed base threat 5.
The Lizard is a unique Brute/Creature minion with ATK 3, SCH 1 and HP 5.

`ghostSpiderInitializeNemesis` creates the five encounter pieces only when
`player.setAside` is absent. An existing empty or partially depleted zone stays
unchanged. Allocate IDs from the root state's `nextId` across seats. Shadows
of the Past moves those same IDs, reveals Lizard then Research, and shuffles
the actual Injection and two In Cold Blood pieces. It never reconstructs a
missing source or signature event.

## Actual basic uses and event timing

The host supplies `GhostSpiderBasicReceipt` only **after the complete basic
power**. An attack completes after its native resolution; a thwart completes
after its threat removal; a defense completes after the enemy attack damage
and belongs to the actual defending Ghost-Spider seat. Exhausting a character
alone does not produce this receipt. Stun/Confuse replacement means
`performed:false`; alter-ego recovery does not qualify.

Each receipt carries a unique basic-use `token`. Ghost Kick and Phantom Flip
can each be played once after that use, with the Max shared across all copies
of each named event. A later basic use gets a new token. Native paid PLAY must
call `ghostSpiderCommitReaction` when play commits, before status replacement;
even an all-effect canceled event counts toward its printed Max. Canceling a
payment keeps the source and allowance untouched. Saved options revalidate
source, current form, payment, native restrictions and the same-use Max.

`playReaction` plays the actual hand or George-stored event, applies printed
resource requirements and ordinary discounts, and resolves
`ghostSpiderReactionEffects`. Ghost Kick is one six-damage hero attack through
`attackProgram`, including native Guard, Tough, Retaliate and response windows.
Phantom Flip is one five-threat hero thwart with `action:true`, `basic:false`
and the physical `abilitySource`. These are event actions, not basic powers.

The host creates `GhostSpiderEventReceipt` only when an Interrupt or Response
ability on an actual event resolved at least one effect. All-effect status
replacement or cancellation is `resolved:false`; simply playing or discarding
an event does not qualify. Every actual event PLAY gets a new `token`, even
when a recycled physical event is played again. Multiple ability resolutions
from that same PLAY retain the token for Web-Bracelet's printed Max.

`ghostSpiderEventResolutionOptions` must join the **same still-open native
response window** as responses to the event's attack/thwart. A player may
resolve Web-Bracelet before Turn the Tide, draw Turn the Tide, and then play
that newly drawn card in this same window, per the official ruling. Do not
close the native attack/thwart window before exposing these options. The
standalone `ghostSpiderEventResolved` helper is appropriate where the host
has no other responses; native hosts should merge options and refresh the
common window after each chosen response.

Dizzying Reflexes is optional, readies the actual identity and uses
`ghostSpiderDizzyPhase = round:phase`. It respects identity blanking and native
cannot-ready restrictions. Each physical Web-Bracelet exhausts as its own
cost to draw one; `ghostSpiderBracelet:<eventToken>` enforces Max 1 per event
across both copies. Blanking the identity does not blank the upgrade. A
different hero controlling Web-Bracelet can use its own printed Hero Response
without gaining Ghost-Spider's identity ability.

An Interrupt such as Skilled Strike may resolve after paying basic attack
exhaustion and ready Ghost-Spider before that attack's damage. Continue the
same native attack and do not exhaust her a second time. This early event
response is independent of the later completed-basic-power receipt.

## George Stacy and physical storage

George's actual `Piece.storedCards` holds facedown physical events. They are
not in play and are not resource sources. `ghostSpiderStoredPlayable` and
`ghostSpiderTakeStoredForPlay` expose only actual events stored under an
unblanked George controlled by the acting player. The host must use these
sources in every legal event window and actual paid PLAY; it must not copy a
stored card to hand as a temporary clone. Payment cancellation leaves the
stored piece in place. Upon committed PLAY the same piece moves to resolving,
then its actual owner's discard.

George's action exhausts his actual support to attach one actual hand event.
Parental Guidance in alter ego attaches one actual hand/discard event when
George is in play; otherwise it searches the actual deck/discard for George,
adds that ID to hand and shuffles. **Max 3 attached events** applies to both
ways of storing events. The currently resolving Parental Guidance cannot
attach itself. Parental Guidance can attach to another player's George, even
when that George is blank; blanking still suppresses his permission to play
stored events. Preserve every stored event's `ownerId` when another controller
plays it.

When George leaves play, discard his stored events to their actual owners.
They did not leave play, so Collector captures only George, not those events.
This leave-play work belongs in the native host, including when the current
Worried Father erratum captures him directly under the obligation.

Gwen's alter-ego action chooses either the actual discarded Ticket to shuffle
into her deck or any actual George Stacy to ready. It needs no identity
exhaustion and uses `ghostSpiderGwenRound = round`. Native ready restrictions
apply to the selected George. Its unqualified name reference can ready a
George controlled by another player.

## Ticket reset and current obligation erratum

Ticket's action removes its actual upgrade from the game as cost, discards
the entire current hand through ordinary owner-aware discard, **merges** the
actual discard into the existing deck and shuffles once. This printed shuffle
does not invoke a draw/reset penalty or create an encounter card. It draws
up to the current native hand size, including form and active modifiers, then
readies each controlled Ghost-Spider signature card and the actual Ghost-Spider
identity. Blanking does not change a card's identity-specific name/set; each
native cannot-ready restriction still applies. Other player cards stay as
they are. Ticket itself remains removed from the game.

Worried Father is given to the actual Gwen seat. Its current search covers
that player's deck, hand, discard and play area. `captureGeorgeForObligation`
performs native leave-play cleanup, discards actual stored events to their
owners, and attaches the same George facedown to the obligation's
`storedCards`. George is **not set aside**. The alter-ego action exhausts the
actual Gwen identity and removes the actual obligation from the game as cost,
then adds that same George ID to hand. A missing George is never generated;
without that valid stored George target this action cannot be initiated.

## Actual reveal, activation and nemesis hooks

Pirouette and Punch triggers only on a card revealed from the encounter deck.
`GhostSpiderRevealReceipt` retains the actual revealed `pieceId`, original
revealer and native `windowId`. `countEncounterBoostIcons` uses that physical
card and ordinary native count controls, including Scarlet Witch's option;
only numeric boost icons count, excluding stars and Amplify. Deal the villain
one plus that count as **nonattack** damage, then `cancelWhenRevealed` cancels
only that card's When Revealed group. Its physical entry, Surge/Incite and
other text remain; preserve the original receipt if this damage advances a
villain stage.

Web Binding has **Requirement Mental**, returned by
`ghostSpiderEventRequirements`. Native payment must actually spend that
required resource; a Wild may substitute under the standard requirement
rule. Cost reduction to zero does not waive it. Its saved activation receipt
identifies the actual enemy, activation instance and activated player. It can
cancel an enemy attack or scheme, including another player's activation. If
that canceled enemy is a minion still present, deal four nonattack damage to
that same minion. Canceling a villain activation creates no minion damage.
The host must cancel the pending native activation, not prevent damage after
an attack has already started.

Experimental Injection attaches its actual card to a minion with the most
**remaining** HP, using current native HP modifiers. The first player chooses
ties; then resume the original revealer's context. No minion grants Surge.
`ghostSpiderEnemyModifiers` grants +4 HP and Creature only while that actual
attachment's text is active.

At the start of the villain phase, Research heals each actual enemy by one
and each Lizard separately heals itself by one. Thus a Lizard with both
unblanked sources heals two. These are forced Interrupts before ordinary
phase activations and do not resurrect a removed minion.

In Cold Blood asks `attackLizard` to perform one actual forced attack against
its revealer, including an alter ego. The native defender/late-defense owner
and full attack program remain authoritative. A scalar, per-revealer
`ghostSpiderColdBloodLock` blocks only that player's event PLAY until native
attack completion; teammates can still play their legal events. Deliver the
completion at RRG enemy-attack step 6, **before** opening after-attack and
completed-basic-defense responses, so the revealer can play Ghost Kick or
Phantom Flip after that attack has resolved. Preserve ordinary forced
aftermath/Retaliate priority. A completion
receipt with `performed:false`, including Stun/Webbed cancellation before
attack initiation, gains Surge after releasing the lock. An attack that
started and later lost its attacker is `performed:true` and does not gain
Surge. Missing Lizard gains Surge immediately. Nested locks use a counter.

All choices and continuations are plain Effect records, unique physical IDs,
tokens and scalar flags. No saved function, temporary hidden clone or shared
engine/payment/metadata mutation is introduced by this module.

## Pure verification

On 2026-10-08, **67 pure tests** and the full workspace `tsc -b` passed. The
focused test fixture hydrates JSON before every decision, restores the
acting seat, and checks physical source movements, native packet fields and
actual callback ordering. It covers original accounting, setup migration,
completed basic powers, Max consumption and payment cancellation, optional
phase readiness, event-instance limits, a drawn response in the original
window, George ownership/storage, current Ticket reset and obligation erratum,
numeric reveal counts, Mental activation cancellation, attachment modifiers,
native drone target labels, separate phase healing and revealer-only Lizard restrictions. Native engine,
full regression and browser verification remain separate host checks.

Twenty-six native acceptance cases pass in
`tests/ghost-spider-engine.test.ts`. They include the
actual source40/nemesis IDs, native defense and event windows, current
obligation, Ticket/Parental source movement, zero-cost Mental Requirement,
numeric Pirouette cancellation with printed Surge, and a stored Turn the Tide
in the same Phantom Flip thwart-response window, a stored Skilled Strike's
Dizzy interrupt before basic damage, and actual Counterspell cancellation
without false resolved-ability responses.
The fixture source walker now counts actual nested storage and George beneath
the obligation without deduplicating IDs. Its regression check passed 68
existing War Machine/Venom native tests.
