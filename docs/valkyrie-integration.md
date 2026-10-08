# Valkyrie identity contract

The pure identity module covers the 18 original identity, signature and encounter faces: `25001a`, `25001b`, `25002`–`25012`, and `25028`–`25032`. Its canonical hero, pack and set ID is `valk`. The raw physical source codes remain unchanged.

The original Aggression starter has 41 physical cards: 16 signature, 18 Aggression and 7 Basic. Death-Glow counts toward deck size and is **not Permanent**. Before shuffling, drawing or scenario setup, `valkyrieSetup` moves the actual `25002` into its owner's set-aside area; the source starter then has 40 cards in its ordinary player zones. A legal custom deck constructed with 40 cards would instead have 39 ordinary cards after setting Death-Glow aside. No replacement card is generated. The five actual nemesis cards are separately initialized once and preserve IDs through Shadows of the Past, Enchantress and shuffling.

This document records the identity module and its native host. Player-pool, full regression, production browser and release integration require their own validation before publication.

## Native hooks

- Call setup before opening hands and scenario setup, and initialize the five physical nemesis cards exactly once. Delegate Shadows of the Past to `valkyrieShadowOfPast` so it uses those IDs. Enchantress may attach a set-aside Seduced before the rest of the nemesis cards are shuffled; the later shuffle moves only cards still present.
- Apply `valkyrieStats` to ordinary hero stats. Add `valkyrieAttackBonusForTarget` only to attacks using Valkyrie's ATK against the selected enemy, and `valkyrieDefenseBonusForAttacker` when she defends against that enemy. Have at Thee! is fixed 7 damage, unaffected by Dragonfang's ATK. Apply Aragorn's `valkyrieHPBonus` and `valkyrieTraits` in both forms; remove its current +4 HP through the ordinary maximum-HP leave-play path.
- Offer `valkyrieAbilityOptions` through the ordinary ability UI and dispatch with `valkyrieAbility`. Run `valkyriePlayRestriction` before payment; run `valkyrieCanAttackTarget` for both basic and event attacks; run `valkyrieCannotBasicAttack` for the basic attack action even when Stun would replace the attack. Offer Seduced's `valkyrieAttachmentActions` to its actual identity controller.
- Death Perception's `playSetAside` port must perform a real paid PLAY, including discounts, target legality, ownership, uniqueness, cancellation, entry, Restricted and response windows. Cancellation leaves the same card set aside. Call `valkyrieCardEntered` after entry for its attachment target choice. Do not implement it as a free PUT. Its actual controller retains ownership while Death-Glow is attached to an enemy.
- The set-aside port must perform native leave-play cleanup directly into the owner's set-aside zone, preserving the actual card ID. Clear tokens and attachments as ordinary leave play requires, without putting Death-Glow into discard or generating a discard/defeat window. Brunnhilde's detach action has no printed once-per-round limit or payment.
- Capture `valkyrieDefeatReceipt` **before** enemy or attachment cleanup. Commit `valkyrieEnemyDefeatInterrupt` in the forced interrupt window, before optional defeat responses; apply `valkyrieEnemyDefeated` only after an actual defeat. The physical Death-Glow commit prevents duplicate saved effects from readying twice. A defeat replacement or a discard must not trigger defeat responses. `identityId` must identify the actual damage source as `hero:<playerId>`; allies, supports and other identities do not ready Valkyrie. A blank Death-Glow still satisfies Valhalla/Flight's attached-card condition, but its own forced interrupt does not resolve.
- At enemy attack initiation, collect `valkyrieAttackInitiationOptions` for every eligible Valkyrie seat. Shieldmaiden resolves its actual event payment before declaring the defender, does not require a ready identity, does not exhaust her, and marks her as having defended. The port must use her current DEF, Spear's marked-attacker bonus, the event's +2 DEF and ordinary defense modifiers through native boost, damage, defense-response and Retaliate windows. An exhausted Valkyrie with Spear defending against the Death-Glow enemy has 5 DEF before other modifiers. This is a Defense event under current errata.
- `putMinion` moves the selected **actual** encounter-deck/discard card into play engaged with the correct player. Apply native entry/Quickstrike and replacement windows, without revealing it. Chooser's draw 2 occurs only after its complete minion-entry cost succeeds. Search and shuffles use native RNG/hidden-information bookkeeping. Annabelle exhausts before searching and retrieves only an actual signature card from the searched top five; Visit Valhalla retrieves an actual discarded signature.
- Delegate the five encounter faces to `valkyrieEncounterReveal`/`valkyrieBoost`. Use ordinary Hinder, hazard, threat, printed numeric boosts and attachments. Trouble in Otherworld remains controlled by the Brunnhilde seat; it offers no invented obligation flip/exhaust option. Its energy+mental action removes the actual obligation from the game. Seduced's energy+mental action instead discards the actual attachment.
- Powerful Enchantments' `valkyrieCanDiscardAttachment` blocks **all** discard costs/effects involving attachments on friendly characters, including discard that would otherwise pay a response/action. It does not block removal from the game, setting cards aside or discarding attachments on enemies. Apply the predicate in generic native discard paths, not only Seduced's own action.
- Beguiled retains the actual ally ID, damage, ownership, tokens, attachments and lasting effects while moving it into the minion zone, engaged with its controller. Its text is blank, its type is minion, it has the Enthralled trait and its SCH uses printed THW; it takes no consequential damage. Native combat, Guard/Patrol, status, defeat and ownership paths must recognize an ally face treated as a minion. Do not re-run ally PLAY/entry responses during conversion or restoration. Call `valkyrieAttachmentDiscarded` after removing Beguiled: a surviving physical ally returns to its original controller, while an already defeated ally remains in its owner's ordinary destination. Existing lasting effects such as Nick Fury's end-of-round discard still apply while Beguiled. Native character type checks must use the converted type, and a converted ally leaving play goes to its owner's equivalent out-of-play zone, never the encounter discard/deck.

All queued choice/payment/defeat receipts serialize through ordinary JSON saves. Actor IDs on multiplayer effects preserve the responding source's actual controller and then return to the original actor.

## Sources and validation

- [Rules Reference 1.8, p. 67](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf): Aragorn's YOU wording, Shieldmaiden's Defense trait and defense designation, Beguiled's Condition trait and highest-cost target without Beguiled.
- [Original Valkyrie cards](https://hallofheroeslcg.com/valkyrie/) and unchanged imported source starter composition.
- [Official FFG Valkyrie rulings](https://hallofheroeslcg.com/official-ffg-rulings/#valk): set Death-Glow aside before shuffling, Death-Glow counts toward deck size, its controller remains the player, Shieldmaiden uses actual DEF without exhaustion, and Have at Thee! gains Overkill based on Death-Glow before damage.
- [Official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/): Nick Fury's lasting end-of-round discard survives Beguiled; an ally treated as a minion goes to its owner's equivalent out-of-play zone when removed/shuffled.

Pure regression command: `npx vitest run tests/valkyrie.test.ts`: **55 tests passed on 2026-10-08**. The test fixture uses physical source IDs and reloads serialized effects between decisions. It covers source conservation, setup, paid set-aside PLAY/cancel, selected-target stat increments, Aragorn in both forms, forced and optional defeat timing, blanking, multiplayer actors, two Flight copies, searches, Overkill/Stun, exhausted Shieldmaiden defense, typed condition payment, Powerful Enchantments, native minion PUT and Beguiled conversion/restoration even after the transformed minion changes engagement.

Native identity verification on 2026-10-08 passed **18 engine cases**, together
with the 55 pure cases (**73/73**), recorded in
`output/valkyrie-native-final.log`. The native suite preserves original source41,
the actual set-aside Death-Glow, and all five nemesis IDs. It checks paid PLAY
and cancellation, a Hero Action during another player's turn, direct leave-play
cleanup to set aside, target-specific basic ATK and fixed Have at Thee damage,
forced readiness before minion/villain-stage cleanup, Valhalla and two physical
Flight responses, and Aragorn's wounded dial on removal. It verifies exhausted
p2 Shieldmaiden at actual DEF5, Quickstrike before Chooser's draw2, a saved
Annabelle search, source nemesis movement, Seduced's pre-Stun prohibition,
Powerful Enchantments in the generic discard path, Beguiled's current minion
type and original-controller restoration, owner discard on defeat, and Nick
Fury's lasting end-of-round discard while transformed.

The native effect protocol uses `draw.amount` and ordinary non-action `thwart`
records for Flight's threat removal. Converted pieces retain the printed face
and owner while a serialized `treatedAsMinion` marker supplies their current
type, blank text, Enthralled trait and printed-THW scheme value. Current-type
checks therefore enter ordinary minion combat while leave-play cleanup still
uses the player's printed faction and actual owner destination.
