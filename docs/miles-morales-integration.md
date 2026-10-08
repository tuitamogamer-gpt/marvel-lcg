# Miles Morales identity integration

Canonical hero/set `spider_man_morales` uses `27030a`/`27030b`. The pure adapter
exports `MILES_MORALES_SCRIPT_CODES`: **16 faces**, comprising two identity faces,
nine signature printings `27031`–`27039`, Keeping Secrets `27056` and four nemesis
printings `27057`–`27060`. The original Justice source contains **40 physical
playing cards: 15 signatures, 13 Justice cards and 12 Basic cards**. There is no
extra setup card. The five physical nemeses are Tracking Prey, Prowler and Razor
Claws once each, and Slice and Dice twice; retain their actual IDs outside the
player source.

The unchanged catalog supplies HP9, Hero ATK2/THW2/DEF2 and hand5, Champion and
Web-Warrior traits, plus alter-ego REC4/hand6 and Civilian. No derived identity
stat replacement is needed.

The source is the [original Sinister Motives cards and rulesheet](https://hallofheroeslcg.com/sinister-motives/)
and [current RRG1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf).
Original scans and text references are retained under `output/miles-*`. The
physical Slice and Dice says **“or no attack was made this way”**; the catalog's
“or not attack” typo is interpreted accordingly without changing imported data.
The older official Venom Blast and Jefferson rulings agree with the current
printed rules used here; current RRG controls timing where older rulings differ.

## Host adapter and payment

Register `resolveMilesMoralesEffect` for the `miles:` namespace. Each choice,
receipt and continuation is serializable. Native effects use `draw.amount`,
ordinary `damage`, `status`, `ready`, `thwart`, `reveal` and `surge` conventions;
player-qualified actors and actual physical IDs survive reloads.

Call `milesPlayRestriction` before a card play and `milesEvent` after ordinary
payment. `milesEventAction` identifies Arachnobatics/Web-Shot as attacks and
Swing In as a thwart. Native Stun/Confuse replacement cancels the entire event
ability, including its conditional Special. The pure resolver also handles
these replacements when exercised independently; native consumption must not
leave a duplicate status replacement queued.

Add `27032`, `27033` and `27034` to the payment allocation classifier. Pass
`MilesPaymentReceipt.paidForCard` containing the actual Physical/Mental/Energy
resources allocated to the card cost. Exclude overpayment, convert wilds to their
chosen types and pass an empty array for zero-cost plays. The compatibility
`paid` fallback applies only when no explicit allocation receipt exists.

Double Life's **Max1 per round is global across all copies and all players**
(RRG p28), including a player who was subsequently eliminated. Call
`milesCardPlayCommitted(s,p,playToken)` at actual PLAY commit even if the ability
is canceled, then pass the same unique native PLAY token to `milesEvent`.
Cancellation before PLAY commits does not consume Max. A card ID or round alone
is not a native PLAY token. Duplicate commit notifications are harmless; its
printed body can resolve only once for the same token. The resolver has a
compatibility receipt for independent pure fixtures, but the native adapter must
use the real commit hook to count canceled cards correctly.

Double Life's form change is an effect change and does not consume or require
the normal once-per-turn Hero/AE flip budget. Absolute form locks still apply.
Its Physical ready clause is independent: if form change is prohibited, the
card can still resolve an otherwise legal ready. Before spending concrete
resources, `milesPaymentAllowed` requires that locked-form play's actual
allocation to include Physical and that the exhausted identity can ready.
`flip` must finish ordinary form response windows before the ready continuation.

## Explicit Specials and reaction windows

**There are no manual free Special buttons.** `milesSpecialEffects` is called
only by explicit printed instructions. RRG p40 permits a Special only through
another card ability. Venom Blast deals nonattack2, then stuns that same actual
enemy if it remains in play. It ignores Guard and does not consume the identity's
Stun. Tough can prevent its damage while the following stun still resolves.
A defeated target is never replaced with the villain.

Web-Shot resolves its native four-damage attack, including ordinary attack
keywords/responses, then opens a separate Venom Blast target choice when Energy
was allocated. Its Special remains nonattack damage and may select another
enemy. Do not place it inside the original attack's damage program. Swing In
removes4 through normal thwart restrictions, then resolves Camouflage when
Mental was allocated. Spider Camouflage gives the actual Miles Hero Tough, then
confuses an eligible enemy separately. Partial effects still resolve; if another
controller borrowed the printed instruction, Tough goes to Miles. The referenced
Special requires an actual unblank Miles Hero in play.

Arachnobatics makes one native attack packet of2,5 or8. Its bonuses check actual
stun/confuse **card presence**, including one status card on a Steady enemy that
does not yet make it stunned/confused. Additional damage modifies that one attack
packet, rather than creating independent hits through Tough.

Feed `milesBasicPowerOptions` into the ordinary response window using an actual
`MilesBasicReceipt`: unique USE token, owning player, basic power, whether it was
performed and whether the identity was Hero. Alternatively,
`milesAfterBasicPower` creates the pure local window. Power Within and Defense
Mechanism each pay their own actual upgrade discard before resolving their
Special. No response follows Stun/Confuse replacement, another player's or an
ally's power, or AE recovery. Basic defense qualifies even when its damage packet
is zero. Use the same token while reoffering a shared response window; do not
turn one basic power into multiple triggers.

Feed `milesFormResponseOptions` into the shared form response window with a
`MilesFormReceipt` describing an actual change to AE. The standalone
`milesFormChanged` wrapper is available when no shared window is used; call one
integration path once. It retrieves the same actual Spider-Man signature card
from discard and shuffles the actual deck once. Pool cards and obligations are
excluded. The currently resolving Double Life cannot be retrieved. Setup and
same-form refreshes are not changes. Native shuffle/reset and hidden-information
handling finish before the saved continuation.

## Physical supports, Uses and encounters

`milesAbilityOptions`/`milesAbility` cover Ganke Lee and Jefferson Davis. Ganke
exhausts before native draw1; Hero form then chooses an actual hand card to
discard after draw/reset windows. AE keeps the draw. Jefferson is AE-only and
compares **all** schemes, including those with zero threat. If the minimum is
zero, he cannot remove threat elsewhere. Positive ties use actual choices;
non-thwart removal ignores Patrol and does not consume Confuse. Crisis still
blocks player-card removal from the main scheme (RRG 1.8 p14), including
Jefferson. If the main scheme is uniquely least and Crisis is in play, his
exhaustion cost cannot be paid; tied least side schemes remain eligible.

Call `milesCardEntered` for Web-Shooter on PLAY and PUT entry to initialize three
Uses. `milesResourceSources` supplies one wild per actual ready, unblank,
positive-counter Web-Shooter in Hero form. `milesResourceSpent` exhausts and
removes one actual counter; its final counter discards the physical card before
resource-spend responses. It is not an alter-ego resource.

Call `milesInitializeNemesis` once during setup/migration, then
`milesShadowOfPast` for the native Shadows path. Reveal actual Prowler first,
then actual Tracking Prey, and shuffle only the remaining three reserved cards.
No physical instance is recreated from its printing during resolution.

`milesEncounterReveal` checks the actual revealing player's form for Tracking
Prey and Prowler. Tracking's base threat is fixed4, with its printed acceleration
icon. Its AE When Revealed places one **additional physical acceleration token
on that side scheme**, separate from the encounter deck's main-scheme tokens.
RRG p3 requires it to add main-scheme acceleration while in play and to leave
when the side scheme leaves. Text blanking does not remove a placed token.
`placeAccelerationToken` must store this on the actual card and generic native
acceleration/cleanup must honor it. Prowler gains Tough only for the revealing
player's AE form and retains ordinary printed Stalwart.

Razor Claws attaches the same actual encounter card to the minion with highest
**printed** HP, not current remaining or modified HP. It gains Surge without
a minion. The first player chooses among tied targets (RRG p19). Ordinary native
attachment stats already supply printed+2 ATK; `milesEnemyAttackKeywords` adds
Piercing only for an unblank attached Claws. Do not count its printed ATK twice.

Slice and Dice selects the surviving player with the fewest **remaining** HP,
including AE; the first player chooses ties. `enemyAttack` must initiate the
actual physical Prowler attack against that player, allowing normal defender,
boost and damage windows despite AE. Its saved continuation requires an actual
`MilesEnemyAttackReceipt`: `performed` and `defeatedCharacter` caused by this
attack. A missing Prowler, failed startup, canceled/Stun-replaced attack or actual
defeat by that attack gains Surge. A completed attack that defeats no character
does not. Do not infer defeat from unrelated boost damage or Retaliate, substitute
the villain, or dispatch this as a scheme against an AE player.

Keeping Secrets goes to the actual Miles owner even when another player reveals
it. Its optional AE flip finishes form responses before the obligation choice.
Removing it exhausts actual ready Miles in AE and removes that same obligation
ID. Its other choice discards both named supports from play, including another
controller's cards, and gains Surge only when neither was actually discarded.
The obligation itself then goes to encounter discard; it does not go into the
player's deck or discard.

All five encounter printings have only their numeric boosts:2/3/2/2/1. None has
a printed starred boost ability. `milesBoost` returns no invented effect.

## Validation boundary

Pure fixture proof covers the exact original source, every owned ID across
serialized decisions, printed Specials, typed receipts, global maximum and
commit tokens, basic/form responses, actual support costs, Uses and all printed
nemesis/obligation clauses. The native acceptance suite additionally verifies
actual engine PLAY, PAY, basic-power and form commands, physical acceleration
tokens, actual attack defeat receipts and original encounter IDs. Mission
coverage and the production browser have separate verification owners.

Pure proof: **68 tests passed** in `tests/miles-morales.test.ts`, recorded with
42 native acceptance controls in `output/miles-host-second.log` (110 total).
The final native suite passed **52 tests** in `output/miles-native-final.log`,
including basic defense, zero-cost allocation, actual canceled PLAY tokens,
separate Retaliate defeats, native Drone conservation and all five printed
numeric boosts. The full `tsc -b --pretty false` check passed after the host
changes (`output/miles-host-types-second.log`, exit0).
