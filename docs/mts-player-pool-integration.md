# The Mad Titan's Shadow player pool

The shared adapter executes the forty supplementary player faces in Spectrum's and Adam Warlock's original products: twenty-eight dedicated faces and twelve exact Core aliases. Moxie `21017` and Avengers Tower `21020` retain dedicated physical-printing adapters. Boxed villains, modular sets and the campaign are outside this player-pool scope.

Printed faces and the original source lists remain in the immutable catalog. Rules evidence comes from the [original product scans](https://hallofheroeslcg.com/the-mad-titans-shadow/), the [current official Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) and [official FFG rulings collected by Hall of Heroes](https://hallofheroeslcg.com/latest-ffg-rulings/). No third-party implementation code was incorporated.

`mts-player-pack.ts` exposes serializable native programs through the host's `mtsPlayerPackPorts`. All card movements use the actual physical instance. Saved prompts retain its ID, owner and chosen target, additional-cost count or attack/defeat continuation.

## Printed timing and costs

Mass Attack exhausts three ready controlled allies as an additional cost before a Stun replacement. Each selected ally shares at least one current trait with the hero; different allies may share different hero traits. This is an interpretation of the printed eligibility condition; no separate official common-trait FAQ was found. The one hero attack uses current combined ATK. The selected allies never attack, use a basic power or receive consequential damage. The official September 8, 2022 ruling confirms that Mass Attack does not use a basic power.

Magic Attack and Zone of Silence choose their target and pay the top-deck discard cost before Stun or Confuse replaces their ability. RRG 1.8's cost rule requires at least one element for an “up to” cost, so the native choices are 1–5 or 1–4, limited by the original deck. Fixed discard costs stop at that deck's exhaustion even if it recycles immediately. Summoning Spell likewise stops at the first actual ally, including one that cannot enter because of uniqueness. Its ally enters without being played; optional enter-play responses wait until the spell finishes. An ally discarded as the last deck card retains its physical ID through the immediate recycle.

Blade's forced response follows each actual attack or thwart, including uses in alter ego. Its physical resource must come from hand. Power in All of Us can double for this ability on a Basic card, while in-play generators cannot pay it. Marvel Boy's optional attack interrupt pays an ability on his Aggression card, so Power of Aggression can double. The saved native attack receives both piercing and ranged.

Major Victory triggers on an actual defeat. It can ready a friendly Guardian in another seat before that physical ally leaves play. A saved used-source receipt permits remaining defeat interrupts after the ready without offering Major Victory again. The native Major Victory → Regroup control returns the same ally to its owner's hand and preserves actual enemy-attack Overkill damage.

Shield Spell requires a Mystic hero, damage from an attack to that hero and the entire actual top-deck discard cost. It pays the cost before defending and preventing the attack's damage. Full prevention ends subsequent would-take windows. All four printed wild-resource responses use actual spent cards, including voluntary excess resources spent for the normally zero-cost Shield Spell through its ordinary native UI. Audacity and Determination have no attack or thwart label; status cards do not replace those responses.

## Traits, durations and physical ownership

Mighty Avengers checks every controlled character's current Avenger trait and modifies only that controller's allies. Captain America counts Avenger characters, excluding supports and other players' characters. Martinex checks the current identity's Guardian trait. Band Together generates at most three wild resources using only the payer's controlled allies. Avengers Tower's ally-limit condition includes the zero-ally case; its discount is consumed by an actual Avenger ally play and expires at phase end.

Power Man's chi adds two ATK per discarded counter through phase end and requires no exhaustion. Leaving play ends the previous instance's bonus: when the same physical card enters again, including through Make the Call, it receives two fresh chi counters and clears its previous chi modifier from every seat. Moxie stacks through round end. Ready to Rumble discards its actual physical upgrade before readying. Ordinary identity changes and Spectrum's actual energy-form response windows offer Moxie and Ready to Rumble in the player's chosen order; Spectrum's event effects finish before its energy-form response union.

Each Cosmic Entity shuffles the same resolving player event into the encounter deck. Its uncancelable reveal ability benefits the revealing player, then moves that owned physical event to the shared removed area. Living Tribunal remains a player card, so Crisis applies to its main-scheme threat removal. A Cosmic Entity used as a boost has zero icons, no When Revealed ability and goes to the encounter discard under current RRG 1.8, retaining its original player owner.

## Verification

`tests/mts-player-pack.test.ts` contains sixty-three printed-rule and serializable adapter cases. `tests/mts-player-pack-engine.test.ts` contains thirty-seven native cases that save/reload each decision and conserve every original player-card ID, including Spectrum's forty-card deck plus three physical setup forms and Warlock's original forty-card deck. Native cases cover actual cost reductions and payments, additional costs before canceled abilities, deck recycling, enter-play timing and lost card memory, cross-seat actor context, resource responses, full prevention, duration cleanup and player-card ownership in encounter zones. Independent native review and payment-source suites provide additional controls; their publication totals belong to the final frozen release snapshot.
