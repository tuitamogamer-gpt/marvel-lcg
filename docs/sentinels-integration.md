# Sentinels modular encounter integration

`src/game/sentinels.ts` implements the four original Sentinels faces, **32105–32108**, as **seven physical cards**: two Sentinel Mark V, two Sentinel Mark VI, two Targeted for Elimination, and one Relentless Robots. The module is usable independently in every supported scenario. Project Wideawake separately requires Zero Tolerance and has one selectable modular slot, whose recommended default is Sentinels; Zero Tolerance is not a second replaceable slot.

Source authority is the [original expansion](https://hallofheroeslcg.com/mutant-genesis/), the original English scans [32105](https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/32105.jpg), [32106](https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/32106.jpg), [32107](https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/32107.jpg), [32108](https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/32108.jpg), and [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf).

The imported Mark VI row incorrectly has `health:6`; its original scan prints **5 hit points**. Keep the imported JSON intact and apply the source correction in the shared runtime metadata overlay. The authored module creates no altered card or printing alias.

| Code | Physical copies | Original printed rules |
| --- | ---: | --- |
| 32105 Sentinel Mark V | 2 | SCH1, ATK3, HP5, Sentinel trait, boost2. When Revealed: if Targeted is attached to the revealing player's identity, this actual minion attacks that player even in alter-ego; otherwise search encounter deck/discard for Targeted and reveal that physical card. |
| 32106 Sentinel Mark VI | 2 | SCH2, ATK2, HP5, Sentinel trait, Quickstrike, numeric boost0 plus boost star. Boost: if Targeted is attached to an identity, deal this same physical boost card facedown to that player. |
| 32107 Targeted for Elimination | 2 | Ordinary attachment instructions, boost2. Attach to the revealing identity unless a copy is already attached there; otherwise gain Surge. While that player is engaged with a Sentinel minion, prohibit hero→alter-ego. Action: exhaust the attached identity to discard this actual card. |
| 32108 Relentless Robots | 1 | Base3 per player, Hazard1, boost3. A player engaged with a Sentinel minion cannot thwart this scheme. |

## Reveal, attachments and actual players

Mark V retains its actual revealing player and minion ID through saved effects. Its explicit activation is an **attack** in either identity form. The host owns Stun and other attack replacements, cooperative defense, current statistics, damage and completed-attack receipts. A source already defeated or removed cannot perform an invented attack. Targeted attached to another identity does not satisfy Mark V's condition. An attached Targeted with blanked text still satisfies the condition because the instruction references the named physical attachment.

Mark V searches only the actual encounter deck and discard pile. The host selects an actual Targeted card, removes its original source zone, reveals that same physical instance through ordinary native encounter windows, and shuffles as required by the Search rules. It must not fabricate a third copy, search a player's deck, or merely put the attachment into play without revealing it. Search absence produces no replacement card or invented Surge.

Targeted has no printed When Revealed header. Its ordinary attachment instructions must resolve directly after the native reveal interrupts, keeping the source resolving until actual attachment or ordinary discard. Routing it through a text-only When Revealed window would skip its instruction. Copy-per-identity eligibility includes a blanked existing Targeted. The two originals may legally attach to two different identities; stable attachment targets are `hero:<playerId>`.

The form restriction applies only from **hero to alter-ego**, and only while an actual Sentinel **minion** is engaged with that identity's player. A Sentinel villain alone does not qualify. Alter-ego→hero, changes between Ant-Man/Wasp hero faces, and Shadowcat mass-form changes remain subject to their ordinary independent rules. Check actual current traits and engagement, including Sentinel minions from another set. Blanking the minion does not erase its traits or this external restriction; blanking Targeted removes Targeted's own restriction.

Targeted's Action can be used in either identity form, including while its form restriction applies. Rules Reference 1.8, Attachment, page8 specifies: “Only the player who controls the card to which that attachment is attached can trigger abilities or pay costs on that attachment.” Consequently, a teammate cannot exhaust their own identity to remove another player's Targeted. The attached identity's actual controller exhausts their actual identity, then the same physical attachment leaves through native cleanup. A saved option revalidates readiness, control and active text before paying any cost.

## Boost movement and thwart restriction

Mark VI's printed Quickstrike remains exclusively in common native entry handling; the module supplies no duplicate entry attack. The ordinary hero-form condition and native source blanking apply there.

Its boost ability transfers the same physical card from the actual resolving boost zone into `encounter.dealt`, tagged with the selected player's ID. It is not revealed or put into play at that moment. The host retains its ID on the activation before movement, preserves its original numeric boost receipt of zero, and prevents ordinary boost cleanup from discarding or duplicating it. With no targeted identity, no transfer occurs and native boost cleanup proceeds normally. The condition references attachment presence even when that attachment's text is blank.

When more than one identity has Targeted attached, **the first player chooses** the recipient. Rules Reference 1.8, First Player, page20 states that when an encounter card targets a specific player/card and multiple targets are eligible, the first player selects among them. The module queues `sentinels:mark-vi-choice` for the actual first player, offers actual player IDs, and resumes the original boost actor for the chosen transfer. Saved choices revalidate attachment presence and exclude eliminated identities.

Relentless Robots supplies an absolute **THW** prohibition for the actual acting player, including that player's allies. It is independent of Guard, Patrol and Crisis and cannot be bypassed by permission to ignore those keywords. Native basic and event/ability thwart paths must check before committing their costs/target prompts and again when resolving a saved selection. Ordinary threat removal that is not a thwart remains legal. Its Hazard icon stays native and its own text blanking removes its prohibition. Minion text blanking retains printed Sentinel traits; current granted traits and engagement transfers affect eligibility immediately.

## Ports and verification

The stable hooks are `sentinelsReveal`, `sentinelsBoost`, `sentinelsCanChangeForm`, `sentinelsCanThwart`, `sentinelsAbilityOptions`, `sentinelsAbility`, `sentinelsTargetedIdentities` and `resolveSentinelsEffect`. `SentinelsPorts` supplies native queue/choice, active text and current traits/engagement, actual identity exhaustion, physical attachment/discard, actual search-and-reveal, forced native attack activation, and exact facedown boost transfer. Authored effects use the `sentinels:` namespace; host callbacks use their own native namespace.

The focused pure suite passes **62 controls**. They verify the original source partition, corrected printed statistics without JSON mutation, copy-per-identity attachment/Surge, source/recipient blanking, native attack delegation in both forms, actor/control preservation, actual search/reveal ordering and absence, first-player boost selection, same-instance retained transfer, saved-choice validation, form-direction restrictions, any-form controlled Action costs, and actual-player THW restrictions. Native engine, browser, full regression and release evidence belong to the integration/release owners and are not inferred from port controls.
