# Shadowcat native integration

`src/game/shadowcat.ts` owns eighteen imported faces from Mutant Genesis:
Kitty Pryde/Shadowcat `32030a/b`, the single reversible Permanent
Solid/Phased `32031a/b`, signatures `32032`–`32040`, Permanently Phased
`32055`, and the five physical nemesis cards `32056`, `32057`, two `32058`,
and `32059`. Imported catalog JSON is unchanged.

The printed original deck contains forty playing cards, including fifteen
signature playing cards, plus one physical mass-form Permanent. One identity
card, one Permanent, one obligation and five nemesis cards account for eight physical cards
outside the forty-card draw deck. The eighteen listed faces are not eighteen
physical cards.

| Face | Name | Original playing copies | Cost / icons |
| --- | --- | ---: | --- |
| 32030a/b | Shadowcat / Kitty Pryde | Identity | HP 9; ATK/THW/DEF 2; REC 3; hand 5/6 |
| 32031a/b | Solid / Phased | 1 Permanent outside forty | Mass form |
| 32032 | Lockheed | 1 | Cost 2; Wild |
| 32033 | Kitty's Room | 1 | Cost 1; Physical |
| 32034 | Acute Control | 1 | Cost 1; Mental |
| 32035 | Intangible Interference | 1 | Cost 1; Mental |
| 32036 | Phased and Confused | 2 | Cost 3; Mental |
| 32037 | Shadowcat Surprise | 3 | Cost 2; Physical |
| 32038 | Phased Strike | 2 | Cost 3; Energy |
| 32039 | Airwalk | 2 | Cost 1; Mental |
| 32040 | Quick Shift | 2 | Cost 0; Energy |
| 32055 | Permanently Phased | Obligation | Boost 2 |
| 32056 | White Queen | 1 nemesis | HP 5; ATK/SCH 1; numeric boost 1 + star |
| 32057 | The Hellfire Club | 1 nemesis | Base threat 2 per player; acceleration 1; boost 3 |
| 32058 | Hellfire Pawn | 2 nemesis | HP 3; ATK 2/SCH 1; numeric boost 0 + star |
| 32059 | Telepathic Restraint | 1 nemesis | Boost 2 |

## Setup, identity form and mass form

Before opening draws, `shadowcatInitializeMass` removes the actual Permanent
from hand/deck/discard and holds it in `player.setAside`. Its real ID,
ownership, exhaustion, counters and damage persist. Kitty's printed Setup
moves that same card into `player.inPlay`, Solid faceup, after mulligan.
Setup is idempotent. Duplicate physical Solid/Phased instances are rejected.

Call `shadowcatInitializeNemesis` during fresh mulligan/setup. It creates only
the original five physical encounter cards using the root allocator. Existing
played, empty or partially depleted reserves remain authoritative; loading a
save does not rebuild missing Pawns. Native setup must preserve the one-shot
flags and physical zones.

`player.form` is the ordinary Hero/Alter-Ego form. `shadowcatMassForm` reads
only the face of the real Permanent. Changing mass form updates `Piece.code`
and calls `massFormChanged`; it does not exhaust, ready, move, clone or reset
the card, and it does not use the once-per-turn identity form allowance.
Absolute cannot-change restrictions still apply. `shadowcatMassChanged`
exposes ordinary form-change responses through serializable continuations.

Kitty's Phase Control is an optional alter-ego Action, once per round, with no
identity exhaustion. Its flag is `shadowcatPhaseControlRound`. Identity
blanking suppresses this ability. Blanking the mass upgrade suppresses its
own printed text and leaves Selective Intangibility on the identity active.

## Completion receipts and nested attacks

For every actual identity attack or completed defense, retain a unique
`ShadowcatCompletionReceipt`:

```ts
{ token, playerId, kind: "attack" | "defense", performed,
  massForm: "solid" | "phased", massId, massTextBlank }
```

Snapshot the mass form after the entire attack-labeled ability or enemy
attack completes, before after-attack/after-defense responses. The snapshot also retains textbox blanking at the trigger, so later unblanking
does not manufacture a missed response. The physical
Permanent ID belongs to the actual attacking/defending seat. A status-replaced
attack has `performed:false`. Ally attacks, exhaustion alone, thwarting and
recovery never create an identity attack/defense receipt.

Run `shadowcatAttackDefenseCompletion` before optional response collection:
Phased has a **Forced Response**. Merge
`shadowcatAttackDefenseOptions` into the common optional response window:
Solid has an optional **Response**. The unique token prevents duplicate flips
of one actual completion. Every new attack instance needs a new token, even
when the same physical event is recycled and played again.

An Attack/Defense event such as Powerful Punch has two separate completions.
Its nested player attack completes immediately, offering Solid's optional
flip (or forcing Phased's flip); the enclosing enemy attack continues with
the resulting physical form. Defense completes when that enemy attack ends
and receives a different token. Paying/playing a Defense event alone does not
complete a defense or force an early Phased flip. Native abort paths must
complete an already initiated defense when its attacker leaves play.

Shadowcat Surprise's three damage and ready instruction both belong inside
one native `attackProgram`. Phased Strike's six damage and optional attachment
clause also stay inside that program, before its completion responses. Whole
ability Stun replacement cancels all printed effects, including Surprise's
ready and the mass completion. Native `ready` enforces cannot-ready rules.

## Phased damage and actual ignored restrictions

`shadowcatPreventsDamage(s, defending, ports)` is a prohibition on Shadowcat
**taking** damage throughout her actual defending window. It applies to attack
damage, nonattack boost damage, indirect damage assigned to her and other
incoming damage while defending. It ends when the enemy attack completes.
Do not infer defending from an exhausted identity or from the mere presence
of a pending attack. A defending ally receives its own normal damage, and
Phased without defending grants no protection. Native damage handling must
apply the prohibition before consuming Tough or paying a take-damage cost.

While Shadowcat's unblanked Hero identity is Phased, it ignores Guard and
Patrol keywords and Crisis icons. This permission does not come from the
upgrade's text, so upgrade blanking does not suppress it. Use current native
target restrictions for attacks and thwarts, with the appropriate ignore
permission. Attacking a minion does not bypass Guard; thwarting a side scheme
does not bypass Patrol or Crisis. Other players' unrelated restrictions do
not create Shadowcat receipts.

At the actual successful initiating action, native targeting creates a
`ShadowcatIgnoreReceipt` with unique token, actual acting player, `performed`,
`kind: "guard" | "patrol" | "crisis"`, and the **exact physical sourceIds**
whose restriction was bypassed. Never reconstruct this list from the board
after damage, defeats or form changes. Stun/Confuse replacements produce no
successful ignore receipt.

Merge `shadowcatIgnoredKeywordOptions` into that ignore response window.
Acute Control exhausts its actual controlled upgrade and deals two nonattack
damage to one of the exact ignored Guard/Patrol minions. Intangible
Interference exhausts its actual upgrade and removes two threat from the
exact ignored Crisis scheme as non-thwart removal. Saved options revalidate
the source upgrade and physical target before committing exhaustion. Each upgrade
may respond once to each actual ignore token, even if readied within that window.

## Signature effects and payments

Solid's Hero Resource ability exhausts the actual Solid Piece to generate one
Physical only for an Attack- or Defense-traited **event**. It is unavailable
in alter ego, Phased, while exhausted or while its text is blank. Payment must
pass the real event code into `shadowcatResourceSources` and
`shadowcatResourceSpent`. Its printed physical resource icon does not make a
Permanent in play a hand resource. Exhaustion persists when the card flips.

Quick Shift is a zero-cost Hero Interrupt at enemy attack initiation.
`shadowcatDefenseOptions` exposes actual hand/permitted stored Defense events
and native paid PLAY. The paid host calls `shadowcatDefenseEvent`; its effect
calls `declareDefense` **before** the printed branch. Solid changes to Phased,
subject to absolute locks; Phased draws two actual cards. Declaring an event
defense adds no basic DEF and requires no identity exhaustion. Playing a
second legal Quick Shift may draw two while still defending the same attack;
it does not create an additional completed defense. Payment cancellation
keeps the physical source and original attack continuation intact.

Airwalk is one Hero thwart, removing two threat, or four when Phased at its
effect. Phased Strike's optional attachment removal checks mass form at the
printed clause, before the subsequent forced mass flip. Eligible targets are
actual **encounter attachment cards** on that enemy with printed Hero Action
or Hero Response text, respecting native cannot-discard/Permanent rules.
Attached player upgrades do not become attachment cards. The host's
`wasDamageDealtTo` reads the native damage-dealt receipt: prevention/Tough
with zero damage taken still permits the clause; entirely redirecting or
replacing damage away from that original enemy does not.

Lockheed's optional entry response uses the acting controller's current mass
form: two nonattack damage in Solid, or two non-thwart threat removal in
Phased. Entry is distinct from PLAY. Kitty's Room is an alter-ego Action
exhausting its actual support, healing two in Solid or drawing one in Phased;
current native maximum HP applies to its legal healing action.

`shadowcatAttachmentTargets` enforces Phased and Confused's Hero-only entry
and Max 1 per enemy across all players. Native paid upgrade PLAY selects and
attaches the actual owned Piece. At the attached enemy's would-attack window,
`shadowcatEnemyAttackReplacement` replaces that attack by discarding the
actual upgrade and then confusing the enemy. Native simultaneous replacement
priority chooses this versus Stun/Webbed Up; only the chosen replacement
commits. The canceled attack produces no actual attack completion.

## Obligation, continuous statuses and nemesis zones

Permanently Phased routes to the real Kitty player. It changes the actual
mass card to Phased before establishing its continuous attack/defense/mass
change lock. Existing absolute locks still take precedence. Ordinary
Hero/Alter-Ego form changes are permitted. In alter ego, ready Kitty may
exhaust to remove the actual obligation from the game. Blanking the obligation
suppresses its lock; it does not blank the identity or mass card.

White Queen's Villainous keyword is ordinary native encounter text. Her
constant ability continuously gives Confused status cards to her actual
engaged player up to that identity's native limit, including two with Steady.
Telepathic Restraint attaches its actual encounter Piece to the revealer's
identity and continuously gives Stunned cards by the same rule. These effects
respect Stalwart and native status immunities.

Run `shadowcatRefreshContinuousStatuses` before and after status replacement
and after source/keyword changes. These are real status cards: an attempted
attack/thwart may consume them, and the active continuous source immediately
replenishes them. Removing, defeating or blanking the source stops future
replenishment and does **not** clear remaining status cards. Restraint's
unqualified Action may be used by another player, costs exactly two Mental
resources through native payment and discards the actual attachment. Canceling
payment leaves that attachment unchanged; successful removal retains existing
Stunned cards until their ordinary removal.

Shadows of the Past reveals the actual set-aside White Queen and Hellfire
Club, shuffles the actual two Pawns and Restraint into the encounter deck, and
gains Surge when the nemesis minion is unavailable. It never creates a missing
nemesis Piece. The Hellfire Club's When Defeated belongs to the defeating
player; search encounter deck, discard and every relevant set-aside area for
one actual Hellfire Pawn, PUT it engaged with that player, then shuffle the
encounter deck even after a failed search. PUT does not reveal Pawn's Surge.

White Queen's boost applies Confused to the attacked player. Hellfire Pawn's
boost moves the same actual physical boost card into play engaged with that
player, with no clone or reveal. The host must retain its boost ID through
native finish-resolution cleanup so it cannot also reach the encounter
discard. Pawn's ordinary Guard/Patrol/Surge keywords still resolve on a normal
reveal. Encounter numeric boost values and star effects remain separate.

## Sources and verification

Printed faces were checked against the immutable original catalog and the
original artwork at `public/cards/catalog/32031b.webp`, `32038.webp`,
`32040.webp`, `32055.webp` and `32059.webp`, with product provenance in
`src/data/catalog-provenance.json` and the original
[Mutant Genesis gallery](https://hallofheroeslcg.com/mutant-genesis/).

Current timing follows [FFG Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf):
Appendix V's Mutant Genesis Powerful Punch FAQ and White Queen FAQ on page
63, plus standard Attack/Defense, Ignore, Cannot, status replacement, damage
timing, ownership and form-change rules. The actual PDF was downloaded and
read for this implementation. [Archived official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/)
confirm Quick Shift's defense completion at enemy attack completion,
Powerful Punch's nested attack/defense ordering, Shadowcat's nonattack boost
damage prohibition while defending, and whole-ability Stun replacement for
Shadowcat Surprise. The RRG1.8 FAQ is authoritative for White Queen's real
persistent status cards.

`tests/shadowcat.test.ts` supplies 74 pure controls with JSON hydration before
queued effects and choices, actual IDs, physical ownership and native port
receipts. `tests/shadowcat-engine.test.ts` adds 23 native acceptance cases using real
`newGame`/`dispatch`, paid PLAY and JSON reloads. They verify physical setup,
identity/mass flip budgets, actual completion ordering, constrained Solid
resources, ignored-source responses before damage/threat, ordinary ally
restrictions, the printed Shadowcat ally's own bypass, Quick Shift prevention,
Phased Strike's clause before its forced flip, Lockheed's alter-ego non-thwart
removal, native obligation removal, actual Shadows reserves, Hellfire Club
PUT without Surge and Pawn boost retention. Both focused suites and workspace
`tsc -b` passed on 2026-10-13.
`output/mutant-genesis/shadowcat-host-fragment.ts` supplies the native port
adapter. Production build and browser checks are separate release verification. The UI source-deck check accounts for one
Permanent outside forty, the current real mass face/readiness renders from
its persistent Piece, and Phase Control stays visible and disabled after use.
