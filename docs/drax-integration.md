# Drax native integration contract

Drax (`drax`, released 18 June 2021) uses the original `19001a/b` identity
faces, ten signature definitions `19002–19011`, obligation `19025` and four
nemesis definitions `19026–19029`. These are seventeen scripted faces; signature
quantities total fifteen physical cards, and the nemesis has five physical cards.
The entire retail pack has thirty-four faces, including its double-sided identity.
The original forty-card starter remains Protection.

Drax has 14 HP, 1 ATK, 1 THW, 2 DEF and a four-card hero hand, with the Guardian
trait. His alter-ego has 4 REC and a six-card hand, with the Outlaw trait.
Native printed metadata must correct the imported JSON's omitted numeric boost
icons: Memories of Another Life 2, Cull the Weak 2, Yotat 3, Challenge Accepted 1,
and I Will Destroy You 2. None of these faces has a boost-star ability.
Challenge Accepted also has a printed attachment +2 ATK icon outside its text box.

## Identity and attack completion

`draxVengeanceCounters` reads the actual seat's nonnegative counter count;
`draxAddVengeanceCounters` supports external effects without an upper clamp.
The hero's response can place a counter only below three, and otherwise draws a
card. The latest official clarification makes that maximum local to the identity
ability: external effects can place a fourth or later counter. All counters count
toward ATK, Knife Leap's cost reduction, and alter-ego healing.

`draxStats` returns additive `{attack, retaliate}` for the native stat reader.
Its attack bonus includes vengeance counters and active Drax's Knife text only
in hero form. Drax's Other Knife grants Retaliate 1 only in hero form.
`draxEnemyStats` supplies Cull the Weak's text-based +2 ATK to every enemy.
Challenge Accepted's printed +2 is supplied by ordinary attachment metadata,
including when its text box is blank, and must not be counted again by the module.

`draxChangedForm(s, previousForm)` must run once after every actual change into
alter-ego, including an obligation or Too Stubborn to Die. It returns the forced
response, tagged with the actual actor. That response removes all counters and
heals twice the number removed. Setup in alter-ego does not trigger it. A forced
response to changing form resolves before the interrupted card effect resumes.

Call `draxAfterVillainAttack` after an actual completed villain attack, passing
`{attacker, isVillain, playerId, identityAttacked}`. `playerId` is the actual
attacked player after defense changes. `identityAttacked` means the named Drax
identity was the attacked character. An ally defending Drax permits Payback,
but does not permit Vengeance. Tough or full prevention still leaves an actual
attack against Drax. A Stun replacement or aborted initiation supplies no such
completed-attack hook. If Too Stubborn to Die already changed Drax to alter-ego,
the Hero responses are no longer eligible.

The native response prompt lets the player order Vengeance and each actual
Payback copy or pass. `draxVillainAttackResponseOptions` composes these choices
with other responses to that same attack, including Counter-Punch and Indomitable,
and stores used Drax abilities in the serialized shared continuation. Legal costs
and targets refresh after each response.
Vengeance can increase ATK before Payback; a draw at three or more counters
finishes before the prompt reopens, so a newly drawn Payback becomes eligible.
Each actual physical response card and the identity ability can resolve once
for that particular completed attack.

## Signature actions and interrupts

Mantis exposes ordinary ability action `mantis`. Her Action works in either
form and can heal any friendly identity. `identityTargets` must return identities
with healable damage. The chosen identity is revalidated before paying: exhaust
the actual Mantis and **deal** one damage to her, then heal three. Tough may
prevent that cost damage while still paying a cost that deals damage. If the
cost defeats Mantis, native damage/defeat processing finishes before healing,
and her leaving play does not cancel the already initiated effect.

Fight Me, Coward readies Drax, draws the actual next card, then invokes a full
native villain attack with boost cards and ordinary defense/response windows.
An already ready identity, or a readying prohibition, does not prevent its draw
and attack. Intimidation removes threat equal to the current derived ATK, using
ordinary Thwart/Confuse, Patrol and Crisis legality.

Knife Leap is offered by `draxBasicAttackOptions` before an actual basic attack,
after deciding that Stun did not replace that basic attack. `draxCardCostReduction`
supplies one reduction per vengeance counter; the host clamps final cost to zero.
The paid physical event resolves and is discarded before the saved basic attack
continues. Its continuation grants that one attack +5 ATK, Overkill and Piercing.
Separate physical copies stack; `draxKnifeLeaps` records used physical IDs and
`gmwBasicBonus` preserves the bonus when the engine recomputes current basic ATK.
Knife Leap has Skill rather than Attack and does not itself make an attack.
The host must preserve all existing basic-attack interrupt choices, including
Leading Blow, and mark a passed basic window to avoid reopening it indefinitely.

`draxAfterBasicAttack` opens DWI Theet Mastery's optional draw only after a real
basic attack. An attack prevented by Tough still qualifies; a Stun replacement
does not. This response does not exhaust the upgrade and must follow the actual
attack's native resolution, including its existing forced responses and damage
windows. Event attacks, including Payback, do not trigger it.

`draxDamageOptions` offers physical Parry copies when Drax's hero identity would
take positive damage, after Tough. Parry prevents twice the current derived ATK
on the same saved damage packet, including attack, overkill, retaliation, indirect
and card-effect damage. Its Defense label makes Drax the defender of an ongoing
attack when appropriate; `claimDefense` must preserve an existing ally defender
for ally-overkill damage. It does not require a basic-defense exhaust.
Stun and Confuse do not cancel the Defense ability.

Payback pays and resolves through ordinary native reaction-event processing.
It is an Attack ability targeting the villain, so Guard and Stun apply. A Stun
replacement can clear Stun even when Guard would prohibit the actual attack.
Its attack damage uses current derived ATK when its effect resolves and opens
native attack responses and Retaliate. Knife Leap, Parry and Payback are excluded
from ordinary hand-play actions by `draxPlayRestriction`.

`draxDefeatOptions` runs when a hero-form Drax with a physical Too Stubborn to Die
would be defeated, after the damage was placed. The optional replacement sets
his HP to four, changes to alter-ego when legal, then removes that exact upgrade
from the game. The forced alter-ego counter healing finishes before removal.
An absolute cannot-change-form effect prevents that change: HP becomes four and
the upgrade is removed, while Drax remains hero and keeps his counters. Removing
the upgrade must not produce an ordinary discard response. The saved defeat
continuation must recheck his resulting HP instead of completing elimination.
Damage already dealt/taken remains recorded even when defeat is replaced.

## Obligation and nemesis

Memories of Another Life routes to Drax's actual seat. Its optional alter-ego
change invokes native form-change responses before the resolution choice and
does not consume the player's voluntary change. A ready alter-ego may exhaust
to remove the actual obligation. Its other branch gives Stun and adds Surge only
if Drax was already Stunned before that branch. Native encounter resolution
discards the obligation normally after the stun branch.

Cull the Weak starts at two threat per player and grants every enemy +2 ATK
while its text is active. Yotat the Destroyer is unique, has 5 HP, 3 ATK, 1 SCH,
Guard and Retaliate 1. Native keywords supply those abilities.

Challenge Accepted attaches to the enemy with the highest current derived ATK;
the revealing player selects among ties. Native keyword processing supplies
Surge. `draxDamageDealt` receives `{target, attack, sourceIsDrax, damageDealt}`
after a single actual attack deals damage. Four or more damage **dealt** by Drax
discards every active Challenge on that target, even if Tough or prevention
reduced the HP damage taken to zero. Do not pass actual HP damage as damageDealt.
Unprevented Overkill damage from Drax's attack also qualifies on the villain. The serialized
spill carries `damageFromAttack` and `overkillDamage` while keeping `attack` false: RRG 1.8 p. 31
classifies that damage as attack damage without making another attack against
the villain. This allows Challenge and attack-damage prevention while avoiding
an additional Retaliate or attack-response window. An actually saved minion
does not produce a spill; the existing damage-on-the-minion excess calculation
remains the basis for both Overkill and excess-damage abilities.
The specific Overkill rule on p. 31 says, "If excess damage from an attack with
overkill is prevented, that damage is not dealt to the identity or villain."
Consequently a four-point spill prevented by Tough deals zero to the villain;
Vibration reducing that spill by one leaves three dealt. Neither satisfies
Challenge's threshold. This specific exception takes precedence over p. 35's
ordinary-attack prevention rule.
Non-attack damage, another attacker, another target, or three damage does not
qualify. Blanking the attachment suppresses its forced response while preserving
its printed stat icon.

I Will Destroy You surges in alter-ego. In hero form it starts a full Yotat
attack with +1 ATK; if no actual attack occurred, it starts a full villain attack.
The host must track **completed actual attacks** by physical attacker, including
when defense changes the attacked seat. Counting mere attack initiation is
insufficient: missing Yotat, Stun replacement, or an attacker defeated before an
attack occurred must trigger the fallback. `startEnemyAttack` resumes its saved
continuation even when that attack was absent, canceled or aborted.

## Ports, effects and verification

`DraxPorts` extends `AntManPorts` with healable identity targets, current hero
and enemy ATK, final physical card cost, packet prevention and defense ownership,
physical player-card removal, native attack initiation with an after-activation
continuation, and completed-attack counters. The module's ordinary event,
ability, reveal, boost and `resolveDraxEffect` chains must be wired into the host.
Every target, physical card, payment, snapshot and continuation is JSON-serializable.

The staged module's 89 focused tests pass, with 34 native Drax acceptance cases
and 23 additional native damage-accounting regressions. Fixtures hydrate state before each
queued effect, preserving multiplayer ownership and physical card IDs across
Mantis target choices, reaction payments, attack continuations, forced healing
and defeat replacement. Damage checks retain all forty original source instances
and exercise actual physical Schadenfreude and Knife Leap plays, saved dealt /
taken snapshots, actor attribution, Tough, prevention and saved defeats. Browser
verification remains a separate publication check.

The damage adapter follows RRG 1.8 p. 14: a damage prohibition and a replacement
of damage **dealt** resolve before Tough and modifiers to damage **taken**.
Armored Rhino Suit places the original dealt amount on the attachment instead,
so Vibration Resistance does not reduce its placement and Rocket does not credit
damage to Rhino. Tough remains on Rhino. Piercing likewise leaves Tough when the
attack would deal no damage to the attacked character (p. 32), including this
replacement. Ordinary prevention leaves a positive dealt snapshot (pp. 14, 35).
Norman Osborn's replacement instead triggers when he would **take** damage;
it removes infamy instead of reducing his HP and preserves positive damage
dealt. Tough resolves before his would-take interrupt, so Tough prevents that
infamy removal while ordinary positive dealt damage still triggers Schadenfreude.
An unprevented Overkill packet similarly retains dealt damage through this
replacement; replacing damage taken is distinct from preventing the excess.
Kree Combat Armor (`16131`) is present in the catalog but has no native scenario
import yet; its printed reduction remains pending that import instead of silently
expanding the current scripted encounter scope.

Sources:

- [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf):
  Cannot (p. 10), Damage (p. 14), Defense, Interrupts, Overkill (p. 31),
  Piercing (p. 32), Prevent (p. 35),
  Responses, Status Cards and Would. Prevent explicitly preserves damage dealt
  when all attack damage was prevented, while distinguishing attacked and damaged.
- [Official Drax rulings](https://hallofheroeslcg.com/official-ffg-rulings/#drax):
  Payback after an ally defense and the named-identity requirement for Vengeance.
- [Latest official rulings](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/):
  30 March 2026 vengeance maximum applies to the identity ability; 30 April 2026
  basic-power modifiers printed outside a text box remain through text blanking.
- Original card text and physical quantities in `src/data/catalog-cards.json`,
  starter definition in `src/data/catalog-decks.json`, and verified original
  scans `public/cards/catalog/19025.webp` through `19029.webp`.
