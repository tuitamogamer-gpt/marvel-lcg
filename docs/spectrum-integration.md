# Spectrum original printing integration

This module covers the sixteen original Spectrum faces: `21001a/b`, `21002`–`21010`, and `21026`–`21030`. It uses canonical hero ID `spectrum`. The retail hero closure has 31 faces; the remainder belongs to the common Mad Titan's Shadow player pool.

The original Leadership source contains 43 physical player cards, comprising the ordinary 40-card deck plus Gamma, Photon and Pulsar. The fifteen ordinary signatures are Blue Marvel ×1, Energy Duplication ×2, and Gamma Blast / Photon Speed / Pulsar Shield / Speed of Light ×3 each. The nemesis set has five physical cards: Radioactive Man ×1, Reactor Meltdown ×1, Sap Power ×2 and Radioactive Blast ×1. The separate obligation is Loss of Control ×1.

## Physical setup and saved state

Call `spectrumSetup` and resolve its setup effect **before the opening hand is drawn**. When the source supplies 43 cards, the module extracts the three existing physical form instances from deck/hand/discard into `player.inPlay`; it never replaces those instances. A source containing only the ordinary forty cards receives exactly three setup instances through `makePiece` during initial creation. An initialized save never recreates a removed/missing form. The physical cards remain outside the deck-size count in all later states.

No new shared `Piece`, `Player` or `GameState` field is required. The per-seat flags are:

| Flag                      | Meaning                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `spectrumSetupComplete`   | Prevents setup duplication or replenishment.                               |
| `spectrumEnergyFormId`    | Actual physical faceup form ID. Absent means all three forms are facedown. |
| `spectrumRetaliatePhase`  | `${round}:${phase}` for Pulsar Shield's lasting effect.                    |
| `spectrumRetaliateAmount` | Sum of its Retaliate 1 grants this phase.                                  |

The host's `newRound` flag whitelist and save migration must retain `spectrumSetupComplete` and `spectrumEnergyFormId`. A normal round boundary does not turn energy upgrades facedown or rerun setup. The retaliation flags expire instead.

Use `spectrumFormFaceup` to render the three cards and suppress every facedown form's printed text in generic continuous-effect/keyword scans. `spectrumEnergyForm` derives the additional form from the saved physical ID. `spectrumStats` contributes +2 ATK/THW/DEF only from the relevant faceup unblanked card while in Hero form. Identity blanking suppresses its Forced Responses; blanking the active upgrade suppresses its +2 and optional response but does not remove the printed resource icon. Energy Duplication therefore still uses that icon if Energy Duplication itself is unblanked. Normal Power Down clears the active ID; there is no card movement or reset of damage/status/exhaustion/ownership.

Energy changes count as changes of form for Moxie and Ready to Rumble. They do not spend the once-per-round voluntary Hero/AE flip or recursively trigger Spectrum's Hero-entry Forced Response. Absolute “cannot change form” restrictions also apply to energy changes. Loss of Control prohibits energy changes only; it permits a normal Hero/AE flip and Power Down's instruction to turn upgrades facedown. A prohibited Hero-entry energy change leaves no active form.

## Host hooks and response timing

- Resolve `spectrumChangedForm` after an actual Hero/AE change. Energy Transformation requires choosing a physical facedown upgrade and offers no decline. Power Down turns all forms facedown.
- Register `spectrumEvent` and `resolveSpectrumEffect`; use native printed Attack/Thwart status replacement **before** executing these programs. Stun cancels all of Gamma Blast, including its energy change. Confuse cancels all of Photon Speed. Energy-form damage/removal themselves are neither attacks nor thwarts.
- Merge `spectrumResourceSources` into payment and commit `spectrumResourceSpent` only when payment commits. Each physical Energy Duplication exhausts separately and supplies Gamma's physical, Photon's mental or Pulsar's energy icon. A facedown/no-form state supplies none.
- Call `spectrumAllyEntersPlay` for the actual Blue Marvel entering play under its controller, including put-into-play effects. Its optional Hero Response requires an available different energy form.
- Open `spectrumDefenseOptions` when Spectrum actually becomes the defender, including defending another seat. Undefended attacks and defending allies do not satisfy “When Spectrum defends.” The options pay and resolve physical Pulsar Shield copies, then resume the saved defense continuation. `refreshDefense` must recompute a declared basic defense after its energy change without replacing the defender. Native ready restrictions remain in effect.
- Use `spectrumRetaliate` in the Hero's keyword total and `spectrumPhaseEnded` at phase boundaries. Already-Pulsar grants Retaliate 1 for each played copy; changing to Pulsar does not grant that extra keyword.

The shared energy response packet is `spectrum:form-response` with `{id, form, used, after}`. The module exports `spectrumFormResponseOptions` for independent integration. `ports.formResponseOptions(s, after)` should map to the common pool's Moxie/Ready to Rumble options. They share one window with Gamma/Photon/Pulsar so the player chooses their order; the form card's physical ID prevents repeating its response. `energyFormChanged` is a notification hook and must not open an early duplicate response window.

Every transition's response window waits for the entire changing ability: Gamma Blast deals 7 first, Photon Speed removes 4 first, Speed of Light draws its actual top card first, and Pulsar Shield readies Spectrum first. The already-in-form condition is evaluated before changing; Gamma's bonus is Overkill, Photon's bonus ignores Crisis only (never Patrol), and Pulsar Shield's bonus is its phase-long Retaliate. A locked transition does not cancel independently resolvable clauses, so Gamma Blast can still deal damage, Speed of Light can still draw, and Pulsar Shield can still ready.

## Obligation and nemesis ports

Loss of Control stays in its owner's play area after reveal. `giveObligation` moves the **actual resolving card** into that player's `inPlay`, tags its seat, and removes it from the resolving zone. It grants no immediate optional Hero/AE flip. Its Alter-Ego Action exhausts Monica and removes that exact encounter card from the game. Only the obligation's owner may trigger or pay it. Register `spectrumObligationOptions`/`spectrumAbility` in the encounter action UI, and include those persistent encounter cards in defeat and conservation cleanup.

`attachIdentity` moves actual Sap Power into `attachments`, attached to `hero:<seat>`. Its action requires that attached identity's owner in AE form and two energy resources; its “your” language prohibits a teammate paying the action. `spectrumTurnEnded` is called at each actual player's own turn end before updating the turn ID. Two copies make two separate 1-damage packets, not one 2-damage packet. Normal damage/Tough/prevention/defeat handling applies.

Call `spectrumEnemyActivated` only after an actual completed Radioactive Man activation, supplying its **current** target player. Status-replaced and aborted activations do not qualify. During an attack, a new defending player becomes the target, including a defending ally's controller. `spectrumBoost` likewise uses the current defending/target player for its “you,” as required by RRG1.8 p16. Both produce one non-attack batch damaging the identity and all allies currently controlled by that seat. Do not include its upgrades/supports or another player's allies.

Call `spectrumSideSchemeDefeated` for Reactor Meltdown's mandatory When Defeated effect before ordinary responses. Its one batch deals 1 to every friendly identity and ally across all surviving seats. `damageBatch` must snapshot recipients, preserve each physical source/actor, and run ordinary Tough/prevention/defeat windows without serially redefining “all friendly.” Radioactive Blast uses the resolving player's form: Hero takes 2; AE places 2 on the main scheme.

Original scans verify printed encounter boost metadata: Loss of Control 2; Radioactive Man **star only, numeric 0**; Reactor Meltdown 3; Sap Power 2 (two copies); Radioactive Blast 1. Radioactive Man's boost ability ignores its non-boost textbox, including a blanking flag on an in-play copy. Host encounter entry, Crisis icons and printed minion stats remain ordinary native rules.

## Sources and verification boundaries

- [Original Mad Titan's Shadow insert, p2, Additional Forms](https://hallofheroeslcg.com/wp-content/uploads/2021/08/mad-titans-shadow-insert.pdf): energy changes are additional forms, do not use the Hero/AE flip budget, and trigger Moxie.
- [Current Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf): p7–8 encounter optional-ability ownership; p16 defense target/boost “you”; p21 additional forms; p32 Permanent; p49 You/Your. Current published rules take precedence over conflicting older answers.
- [Official FFG Spectrum answers archived at Hall of Heroes](https://hallofheroeslcg.com/official-ffg-rulings/#spectrum): Caleb explains one faceup energy form; Alex explicitly places Gamma's 1-damage Hero Response after Gamma Blast's complete first sentence (change and deal7).
- Original scans inspected in `public/cards/catalog/21001a.webp` through `21010.webp`, and `21026.webp` through `21030.webp`; raw catalog retains their source image URLs. Monica's printed REC is 3, HP11, AE hand6; Spectrum is base1/1/1 and Hero hand5.

`tests/spectrum.test.ts` exercises 55 pure-module cases against actual original source card instances, serialized queues/prompts and JSON reloads. `tests/spectrum-engine.test.ts` adds 36 native `newGame`/`dispatch` cases, retaining every original source ID and reloading JSON before each command. These cover extraction before the opening draw, printed stats, Permanent discard protection, paid event/status timing, resource icons, form-response ordering, basic defense, phase expiry, owner-specific encounter actions and multiplayer Radioactive Man/Reactor Meltdown batches. The batch tests hold all friendly HP unchanged through Drax's paid prevention window, then place every prepared packet before ally defeat and Too Stubborn to Die. Independent native review also verifies a simultaneous HP1 identity/ally defeat while the teammate's damage and all source IDs survive.

The host prepares simultaneous batch packets through ordinary interrupt windows and stores each amount under an explicit original actor seat, independent of the packet's recipient seat. Only `spectrumBatchCommit` places HP/damage, with defeat checks deferred until all saved recipients have been processed. Temporary receipts are primitive save fields and are cleared at commit. The frozen repository-wide and browser results are recorded separately in the [combined hero integration contract](mts-heroes-integration.md); remote publication remains a separate check.
