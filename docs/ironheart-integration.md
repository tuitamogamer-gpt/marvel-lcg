# Ironheart native identity contract

The original Ironheart hero pack contains three physical, double-sided identity cards. Version 1 begins in play; Versions 2 and 3 start set aside. The forty-card starter has fifteen signature cards. The two reserved identity cards are supplementary cards, not player-deck cards or additional signature copies. This module owns the six identity faces, signatures 29004–29013, obligation 29028, and five physical nemesis cards (29029, 29030, 29031, and two 29032). Zzzax modular cards 29036–29040 are outside this identity contract.

Sources:

- [Original card gallery](https://hallofheroeslcg.com/ironheart-riri-williams/)
- [Original progressing-identity insert](https://hallofheroeslcg.com/wp-content/uploads/2022/04/insert.jpg)
- [Official Ironheart rulings](https://hallofheroeslcg.com/official-ffg-rulings/#ironheart)
- [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf)

## Physical identity state

`player.ironheartIdentity` stores the actual current physical card. Its code is always the version's hero-front code, and its `counters` are the progress counters. `ironheartIdentityCode(state)` selects the corresponding current hero or alter-ego face for images, printed powers, traits, and hand size. `ironheartVersion` derives the version from the physical card, with `flags.ironheartVersion` as the saved numeric version. Each player's own state carries its current identity through seat changes and serialization.

Fresh `ironheartInitialize` allocates the current Version 1 identity, the two actual reserved identities, and exactly five original nemesis cards. It does not put any of these cards into the player draw deck. It is idempotent after its setup flag is stored. Save migrations must retain existing physical IDs and must not call fresh setup to regenerate already released nemesis instances.

Level Up pays six actual counters and swaps the next reserved physical identity into the current holder. The former identity returns to set aside. Surplus progress, the shared hit-point dial, exhaustion, status cards, and attached game elements persist. References attached directly to the former physical identity ID move to the next identity ID; stable native identity targets retain their existing reference. The old reserved card no longer holds duplicate counters or nested cards. Changing version is separate from an ordinary form change and does not consume the voluntary flip allowance or create a form-change response.

All three versions have 10 printed hit points, 2 ATK, and 3 DEF. Their THW values are 1, 2, and 3, and hero hand sizes are 4, 5, and 6. Each alter-ego has REC 3 and hand size 6. Versions 2 and 3 have Aerial. All versions are defeated together when the player is eliminated; native player elimination owns this operation and its attachments.

## Costs, limits, and spend receipts

`ironheartAbilityOptions` and the corresponding initiation handler check the printed form qualifier and actual owned, ready, unblanked source. Child Prodigy requests an atomic native ability payment: Version 1 spends one mental; Version 2 chooses one mental or two resources of any type; Version 3 spends one resource of any type. The host runs `prodigy-commit` only when the actual payment commits, before resource-spend responses, and runs the progress gain after those responses. Canceling the payment uses no limit and places no counter.

Child Prodigy's once-per-round limit is keyed to the actual physical identity ID. Ordinary flips preserve the used limit on that same physical identity; replacing it with another physical version gives the other printed ability its own instance limit. The older official response describing an ordinary flip as resetting a limit is superseded by the current Rules Reference treatment of limits and cards that remain in play. Form qualifiers apply at initiation: a resource response that changes form after the costs are paid does not cancel the remaining ability effects.

Stroke of Genius keeps its ordinary single mental hand resource. It is not an additional resource generator. `ironheartResourceCardSpent` opens its optional response only from an actual committed SPEND receipt containing the physical card, actual owner, and unique spend token. Discarding, searching for, drawing, adding, or revealing the card does not trigger the response. Actual overpayment or a legal spend while paying zero resources still qualifies as SPEND. One accepted response places one progress and draws one card; each distinct physical spend receives its own token. Passing draws nothing and places no counter.

Brawn 29004 is the signature printing with ATK 3, THW 2, and health 3. His mental resource requires him to be exhausted and unblanked. Its once-per-phase limit belongs to that physical ally; readying and exhausting him again in the same phase does not reset it.

## Events and supports

The native host validates Hero Action at PLAY initiation, pays the actual event cost, resolves resource-spend windows, and then runs `ironheartEvent`. It must not recheck the form qualifier after costs. Native Stun and Confuse replace Photon Beam and Fly Over's entire attack or thwart ability, including their progress clauses.

Photon Beam performs a native four-damage attack. Its continuation receives `defeatedEnemy` from this actual attack. Fly Over performs a native three-threat thwart. Its continuation receives `removed` and `lastThreatRemoved` from this actual thwart. These receipts determine whether to place two progress instead of one. Tough, prevention, unrelated later defeats, and later scheme removal cannot fabricate the bonus. A target that ceases to be eligible after paid costs does not throw or undo the payment; remaining independent effects resolve as far as possible.

New and Improved selects the current version number of different printed options, then resolves them in the selected order. Its search adds an actual signature card from the deck to hand and shuffles that same deck. Search can fail without generating a card. Sector Scan's cost reduction equals the current version and its permission to look at the actual top encounter card expires at round end; inspection must not draw, deal, reorder, or reset that deck.

Ronnie Williams exhausts the actual support in alter-ego form to choose two healing or one progress. Tony Stark A.I. exhausts in either form to look at the actual top two original deck cards, adds one to hand, and discards the other. Looking and adding are separate from drawing and must not reset an empty deck; a single remaining card can be added without inventing another discard. The deck ports retain ordinary hidden-information and ownership behavior.

Photon Blasters and Propulsion Jets each add two hit points while their text is unblanked. The native maximum-HP and leave-play code must recalculate the maximum and cap current HP when one leaves play or loses text. Their actions scale with version and are nonattack damage and non-thwart threat removal. Maximum Efficiency similarly pays one progress for two nonattack damage. These abilities preserve Stun/Confuse and bypass attack-only Guard/Patrol restrictions while retaining native damage prevention and the applicable scheme targeting restrictions.

## Obligation and nemeses

A Minor Setback goes to the actual Riri Williams player. With a progress counter, it removes exactly one and discards the original obligation. Without one, it deals that player one facedown encounter card, then shuffles the same obligation into the encounter deck. It creates no replacement obligation ID.

Rule by Force gains a hazard icon while any Lucia von Bardas is in play and an acceleration icon otherwise. Blanking the side scheme removes its gained icons; blanking Lucia does not change her presence. Lucia gets +1 SCH and ATK while tough and unblanked, and her forced response gives her tough after the villain phase ends.

Cyborg Tech attaches to a minion with the most distinct effective traits, with the actual revealer choosing ties. Its unblanked attachment grants three hit points and retaliate 1. The boost deals the original physical boost source as a facedown encounter card and removes it from normal boost discard cleanup.

Political Retribution makes Lucia scheme, then places three threat on Rule by Force if it is in play. Both independent conditions can resolve. Confuse can replace Lucia's scheme while the side-scheme threat clause still resolves. It surges only when neither is in play.

Shadows of the Past releases the original set-aside minion and side scheme and shuffles the original three remaining nemesis instances into the encounter deck. Reserved identity versions remain outside that deck. A later Shadows uses ordinary native surge behavior and does not regenerate physical pieces.

## Validation

`tests/ironheart.test.ts` provides 70 pure controls covering printed version powers, actual physical conservation, surplus counters and transferred attachments, payment cancellation, physical limits, spend receipts, event status replacement and causal bonus receipts, deck additions, nonattack/non-thwart signature actions, and all original obligation/nemesis clauses. Pure ports deliberately receive authoritative native attack/thwart receipts rather than inferring outcomes from the current board. Native engine, browser, and release checks provide separate integration evidence; this document does not certify those checks before they complete.

`tests/ironheart-engine.test.ts` provides 46 separate native controls using actual commands and JSON hydration before each command. It verifies the original forty-card source, three physical identity IDs, original obligation/nemesis IDs, native HP gain and removal, real attack/thwart completion receipts, zero-cost resource spending, dynamic nemesis icons, boost cleanup, and both hotseat and last-seat simultaneous identity defeat. The elimination controls retain one copy of every original physical ID, remove all three identity versions, clear the current identity holder, and release an actual stored source card and identity-linked encounter attachment. The combined pure and native invocation passes all 116 controls; browser and complete release regression evidence remain separate.
