# Star-Lord native integration

Star-Lord uses the original 40-card Leadership starter deck. His 15 signature cards, obligation and five nemesis cards retain their original physical printing codes and quantities. The canonical runtime identity is `stld`.

`src/game/star-lord.ts` implements the 15 catalog faces `17001a`, `17001b`, `17002`–`17010`, and `17024`–`17027`. The native host supplies resource payments, card zones, damage prevention, status replacements, attack legality, Restricted limits, encounter keywords and ordinary villain advancement.

## Identity and continuous abilities

- **Setup:** after initial hands and all mulligans, search the actual deck and discard pile for one Element Gun. Choose between physical copies when necessary, move that copy into hand, reveal it and shuffle the deck. A Gun already in hand is not fetched again. The ability creates no new card.
- **Smooth Talker:** in alter-ego form, choose a physical hand card before revealing the top deck card. Swap those exact cards without drawing, discarding, shuffling or transiently emptying a one-card deck. The once-per-round limit persists through a saved selection.
- **“What could go wrong?”:** interrupt the complete process of playing a card from hand, before determining affordability or paying resources. This includes paid reaction events during another card's resolution, such as First Hit or Get Behind Me. Deal one actual facedown encounter card as its cost, then reduce the selected card’s cost by 3, to a minimum of zero. The discount belongs only to that physical hand play. Changing form, changing turns or cancelling the paid play does not restore the once-per-round limit. A card whose adjusted cost is already zero cannot benefit from the reduction. Paying an ability cost does not satisfy the hand-play trigger.
- **Guardian allies:** while Star-Lord is in hero form, every ally he currently controls gains Guardian. This constant applies before Knowhere can respond to playing an ally, including Nova Prime. Allies that only gained Guardian from Star-Lord lose it when he changes to alter-ego form; allies with a printed Guardian trait keep that trait.
- **Leader of the Guardians:** each Guardian character controlled by its player gets +1 THW. A Guardian ally remains eligible in alter-ego form. Star-Lord’s alter-ego side has Outlaw rather than Guardian.
- **Jet Boots:** Star-Lord gains Aerial while in hero form. The shared text-blanking rules remove this continuous ability when the upgrade’s text is blanked.
- **Star-Lord’s Helmet:** in hero form, increase hand size by the number of physical facedown encounter cards dealt to this player, up to +3. Other players’ dealt cards, boost cards and resolving faceup encounters do not count. The host rechecks hand size after each refill draw: running out of the player deck and receiving an encounter card can increase the limit during the refill itself.

## Signature cards

**Nova Prime** offers an optional response only after its controller plays this physical ally from hand. Choose and defeat a non-Elite minion; this is an explicit defeat, so Tough and damage immunity do not prevent it. Putting Nova Prime into play from the discard pile does not satisfy its trigger.

**Daring Escape** deals an actual facedown encounter card as an additional cost before its effect readies the hero and draws one card. The ready and draw are independent, so a readying restriction does not prevent the draw. This additional cost is separate from the identity’s once-per-round cost interrupt.

**Gutsy Move** removes `2 + 2 × facedown encounters` threat from one selected scheme as a single thwart packet. **Sliding Shot** deals `5 + 2 × facedown encounters` damage to one selected enemy as a single attack packet. Sliding Shot requires an Element Gun controlled by its player; an exhausted or text-blanked Gun still satisfies that printed play restriction. Both events count their controller’s encounter cards after costs are paid. Confuse, Stun, Crisis, Patrol and Guard remain native host rules.

**Element Gun** exhausts and spends one actual resource as costs, then makes a 3-damage attack with Piercing. The costs are still spent when Stun replaces the attack. Piercing removes Tough before attack damage, and does not make the attack Ranged or Overkill.

**Jet Boots** offers an optional interrupt when Star-Lord would take a positive amount of damage. Exhaust the physical upgrade, then prevent one damage for each facedown encounter card currently dealt to its player. This applies to direct, indirect, retaliate and attack damage received by the identity. It does not prevent damage to an ally or another player’s identity. Tough has priority, so the optional exhaust is not offered when Tough prevents the packet.

**Bad Boy** offers an optional Hero Interrupt only when the controller’s identity would take damage from the villain’s attack. Discard the physical support as its cost, prevent all damage in that packet, change to alter-ego form and draw two cards. Damage from villain Overkill is still damage from an attack and remains eligible; a boost ability’s separate damage is not attack damage. Damage to a defending ally and a minion’s attack are ineligible. The prevention and draw still resolve if an independent restriction prevents changing form.

## Obligation and nemesis

**Banishment** routes to the actual Peter Quill player. Its optional flip does not spend the normal once-per-turn form change. Exhausting a ready Peter Quill permanently removes that physical obligation. The other choice discards one controlled Element Gun, choosing among actual copies, including exhausted copies. If no Gun is in play, place three threat on the main scheme. A Gun in hand does not pay this cost.

**Budding Crime Syndicate** uses shared Hinder 2 per player, Hazard and its printed fixed base threat. **Mister Knife** uses shared Retaliate 1 and gives the engaged player’s first revealed treachery each villain phase Surge. The host saves this modifier at the actual reveal moment, before cancellation interrupts or When Revealed effects. A cancelled treachery still counts as revealed. A first Shadows of the Past that puts Mister Knife into play gains no retroactive Surge, and later treacheries that phase are not the first one. Surge remains an unnumbered keyword, so printed and gained copies do not stack.

**Spartoi Cunning** independently discards one random physical hand card, deals one damage to the identity, and places one threat on the main scheme. An empty hand does not prevent the damage or threat clauses.

## Host contract and validation

`StarLordPorts` extends `AntManPorts` with ordinary card cost, deck shuffle, an actual encounter-card deal returning its physical piece, packet-specific damage prevention, explicit minion defeat and current trait lookup. All `starlord:` continuations contain serializable data and preserve physical IDs.

The host uses `starLordSetup`, `starLordBeforeEvent`, `starLordHandPlayOptions`, `starLordCanReduceHandCost`, `starLordCardCostReduction`, `starLordHandPlayFinished`, `starLordDamageOptions` and `starLordTreacherySurge` at their respective native windows. Continuous helpers supply Guardian allies, Aerial, THW and dynamic hand size. `starLordRoundEnded` clears limits and stale play-local discounts across all player seats.

Focused module validation: **61 passing cases** in `tests/star-lord.test.ts`. Tests cover physical setup and swaps, saved continuations, cost timing, per-seat counts, source/form restrictions, payment requests, prevention, independent clauses and nemesis timing. `tests/star-lord-response-cost.test.ts` adds **9 passing native regressions** for paid reactions without ordinary resources, declining the cost interrupt, Stun, once-per-round limits, a Core reaction event, the Element Gun's ordinary ability payment and Helmet refill changes caused by player-deck exhaustion. The module, source engine acceptance and these regressions pass together: **101 cases in three files**. Browser and full regression results are recorded after host integration.

The implementation follows the [official Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), including setup order (Appendix II), costs, initiating abilities, Cancel, Swap, referential abilities and Overkill. The Star-Lord FAQ confirms Guardian priority before Knowhere and the Mister Knife/Shadows of the Past ruling. [Archived official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/) clarify the identity’s entire-play cost interrupt, temporary Guardian traits and the Helmet’s dynamic refill limit. Official imported card faces resolve the printed clauses; no third-party gameplay implementation is used.
