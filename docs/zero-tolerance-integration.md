# Zero Tolerance modular encounter integration

`src/game/zero-tolerance.ts` implements the four original Mutant Genesis
faces `32101`–`32104`, representing seven actual encounter cards. The native
set ID is `zero_tolerance`. Catalog JSON, original artwork, quantities and
printed names remain unchanged. This is an independent modular encounter set;
Project Wideawake additionally requires its original copy of this module.

| Code  | Name                     | Copies | Printed statistics and icons                     |
| ----- | ------------------------ | -----: | ------------------------------------------------ |
| 32101 | Sentinel Mark II         |      2 | SCH 1, ATK 2, HP 2, boost 1                      |
| 32102 | Sentinel Mark III        |      2 | SCH 2, ATK 3, HP 3, Toughness, star boost        |
| 32103 | Energy Barrier           |      2 | Printed +2 ATK, starred forced response, boost 1 |
| 32104 | Operation Zero Tolerance |      1 | Base threat 3 **per player**, boost 3            |

The original Operation Zero Tolerance image shows the per-player icon next to
its three threat. `ZERO_TOLERANCE_SIDE_SCHEME` therefore records
`{ baseThreat: 3, perPlayer: true }`. The native entry amount is `3N`, using
the number of players who started the game.

## Physical searches and ordinary attachment instructions

`zeroToleranceReveal` and `zeroToleranceBoost` recognize these four faces and
return `null` for unrelated cards. Printed Toughness and numeric boost values
remain in the ordinary keyword/boost engine; the module does not duplicate
those effects.

Mark II checks for the actual Operation Zero Tolerance already in play. Its
own When Revealed ability grants Surge when that scheme exists, even if the
scheme's ordinary text is blank. Otherwise, search only the actual encounter
deck and discard pile for the original side-scheme instance and **reveal** it.
Search choices use the physical scheme ID. A failed search shuffles the
encounter deck without inventing a scheme or Surge. Native reveal owns entry,
threat, uniqueness and When Revealed windows.

Mark III searches the actual encounter deck and discard pile for Energy
Barrier and attaches the chosen original piece to that specific Mark III.
It does not reveal the Barrier. This distinction follows current RRG 1.8,
“Attach To,” page 8:

> “The ‘attach to’ phrase on a card is not resolved if another ability causes
> that card to attach to a specific game element.”

The [official December 10, 2024 ruling, question 53](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/)
confirms that a Barrier attached by such a specific effect does not resolve
its opening Tough instruction. Mark III's own Toughness is still resolved by
native entry rules. Its direct attachment also skips Barrier's ordinary
“without Energy Barrier” restriction and its alternative Surge. It can attach
a second actual Barrier if another effect already attached one before the
search resolves. A departed Mark III does not create a substitute target.

Both searches shuffle the encounter deck when their ability completes. RRG
1.8, “Search,” page 40 requires this after searching any portion of a deck,
including Mark III's text without a printed “Shuffle” reminder.

An ordinarily revealed Barrier resolves its own instructions instead: select
an actual Sentinel **minion** without any Energy Barrier already attached,
attach that exact source ID, then give it Tough. Actual gained traits qualify;
a Sentinel villain or a friendly card outside the minion zone does not.
An attached blank Barrier still counts as an Energy Barrier for this
restriction. An already-Tough eligible minion still receives the attachment;
failure to add another Tough does not grant Surge. With no eligible minion,
the normally revealed Barrier gains Surge.

The ordinary attach instructions have no “When Revealed” header. Native
attachment reveal must explicitly dispatch `zeroToleranceReveal` before
generic attachment fallbacks, retaining the physical source in its resolving
zone until the attach port moves it.

## Boost status and live Barrier attack responses

Mark III's star boost checks the actual receiving identity at resolution.
If that identity already has a Stun status card, it takes a native two-damage
**nonattack boost** packet. Otherwise, attempt to give it Stun. A native
Stalwart restriction preventing that initial status does not invent the
already-stunned damage branch. A Steady identity with one Stun card is already
stunned for this conditional, even though that one card does not yet cancel a
basic attack. Native status limits, Tough, prevention, identity form and
while-defending damage prohibitions apply normally.

Barrier's printed +2 ATK is outside its text box. The ordinary native
`enemyAttachmentModifier` supplies it exactly once per physical attachment,
including while the attachment's abilities are blank. The module adds no
second attack modifier. An actual source attached by a specific effect can
therefore contribute another printed +2; source text controls only its
triggered ability.

`zeroToleranceAfterAttack` queues Barrier's forced Tough response after an
actual completed attack by its attached minion. Dealing no damage, full
prevention, and failing to defeat a character do not remove that trigger.
Stun-replaced, canceled or aborted attacks are `performed: false` and do not
trigger it. Freeze the actual attachment sources at that completed attack's
trigger using `zeroToleranceBarrierSources`. Later text blanking or source
departure does not cancel an already captured response. Giving Tough to an
attacker that has since left play resolves as far as possible; no character is
fabricated.

Each callback commits once per actual attack token and physical source ID.
A later real attack creates a new token, allowing that same Barrier to react
again. The receipt flag lives in the first physical seat's persistent flags,
so actor changes and first-player rotation cannot duplicate the response.

## Ally defeat receipts and actual facedown captures

The host exports confirmed ally defeats from the actual enemy attack:

```ts
ZeroToleranceAttackReceipt {
  token, attackerId, attackerCode, playerId,
  performed, enemyAttack, defeatedAllies,
  barrierSources?, schemeSources?
}
ZeroToleranceAllyDefeatReceipt {
  id, code, ownerId?, controllerId?, actualAlly
}
```

The ally receipt is captured only when a real defeat commits. Preventing a
defeat does not create it. Consequential damage, a player attack and separate
boost damage do not become enemy-attack ally defeats. Preserve the actual
controller and physical owner separately. A printed ally currently treated as
a minion is not an actual ally at defeat.

The [official April 4, 2025 ruling](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/)
further specifies:

> “a minion being treated as an ally would not get placed under OZT when
> defeated; once it’s discarded from play, it reverts to being a minion, and
> there will be no ally for OZT to find.”

The module therefore also checks the original/post-defeat face's ally type.
This current ruling supersedes the older answer that included mind-controlled
minions. Rescued Captive faces and Jubilee are originally ally cards, despite
their raw encounter faction, and remain eligible actual owned allies.

Freeze active OZT sources using `zeroToleranceSchemeSources` at the completed
attack's trigger. Its capture response can be suppressed by blanking before
that trigger; later blanking does not cancel a captured response. Each
attack/scheme/ally receipt commits once.

`captureDefeatedAlly` moves the same defeated physical ally from its actual
post-defeat zone into the actual in-play OZT's `Piece.captured` array. This is
a facedown out-of-play tuck zone. It creates no second leave-play or defeat
event, and never clones a source. Existing source-specific defeat handling
occurs first: the ally may be in its owner's discard, Regroup's hand, Clea's
deck or the victory display. Current RRG Victory X is a When Defeated ability;
Jubilee's actual Victory -1 placement therefore precedes OZT's After Attack
response, which retrieves that same instance afterward. A missing actual ally
or departed destination cannot produce a fabricated piece or out-of-play
scheme destination.

Captured contents remain facedown. Public UI displays only their count and
the loss threshold, never their artwork or identity. Raw encounter Captives
that were rescued into a player's control retain the actual owner established
by that rescue; their raw faction must not reroute them to encounter discard.

If non-Permanent OZT leaves play, current RRG “Leaves Play,” page 27 requires
discarding each card tucked beneath it. The host performs that native cleanup
once with actual ownership: ordinary player cards and rescued Captives go to
their owners' discard piles; encounter-owned cards use encounter discard;
double-sided Jubilee uses her native removed-from-game destination when she
would be discarded. Tucked cards were already out of play, so this cleanup
does not manufacture another leave-play trigger.

## Permanent grant and immediate alternate loss

`zeroToleranceIsPermanent(s, piece?)` derives the grant from the actual current
main `32087b` with live text and the actual in-play OZT `32104`. It is false
for an independent modular OZT in another scenario. Blanking OZT itself cannot
remove an external grant from the live main. The host uses this same predicate
for UI and ordinary defeat/leave legality. Permanent OZT can lose all threat
without being defeated or leaving play. Current RRG Permanent exceptions are
limited to abilities in the same set.

`zeroToleranceLossThreshold(s)` returns `3 + s.playerCount`.
`zeroToleranceCheckLoss(s, { lose })` scans actual in-play OZT and counts **all**
actual facedown `captured` cards, including nonallies tucked by scenario
effects or setup. At or above that threshold it immediately calls native loss
and returns `true`. An empty array or absent OZT does not lose the game.

This check deliberately ignores text blanking. Current RRG 1.8, “Winning the
Game,” page 48 states:

> “Alternate win or loss conditions cannot be blanked or canceled.”

Invoke it in the native state check and immediately after every physical
capture/tuck commit. A terminal loss stops pending draws, attacks and authored
continuations; it does not wait for an optional response choice.

## Native ports and verification

`ZeroTolerancePorts` supplies native queue/choice, text/trait/status queries,
status placement, nonattack boost damage, exact physical Barrier attachment,
same-instance searched scheme reveal, encounter shuffle, hidden-information
advancement, actual defeated-ally capture, and terminal loss. Port callbacks
preserve generated native windows before their supplied `after` effects.
Every module effect uses the serialized `zero-tolerance:` prefix. Search and
attachment choices use actual piece IDs.

The original four local artwork files were directly inspected. The original
[Mutant Genesis rulebook](https://hallofheroeslcg.com/wp-content/uploads/2022/10/mutant-genesis-rulebook.pdf),
[FFG Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf),
and current official rulings linked above supply the timing, search,
attachment, capture, ownership and loss authority.

`tests/zero-tolerance.test.ts` exercises these original-source contracts using
real physical IDs, native port boundaries and JSON saves between effects and
choices. It covers metadata/accounting, both search zones and failures,
ordinary versus specific attachment rules, printed modifiers, status/boost
conditions, actual attack receipts, repeated-source deduplication, ownership,
Victory/hand/deck capture sources, transformed-card exclusions, empty storage
and all three player-count loss thresholds. Native engine and browser suites
remain separate integration verification owned by the host team.

The focused pure suite passes all 71 tests.
