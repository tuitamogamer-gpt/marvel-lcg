# Rocket Raccoon native integration

Rocket uses his original Galaxy’s Most Wanted Aggression starter deck of 40 physical cards. His identity and all 15 signature cards retain the original printing codes and quantities. His obligation and five nemesis cards also remain physical encounter cards.

`src/game/rocket.ts` implements the 17 catalog faces in the `rocket` and `rocket_nemesis` sets. The host supplies ordinary payments, status replacements, damage prevention, villain advancement, encounter reveal keywords, Restricted limits and physical card zones. Rocket has no translated aliases or borrowed gameplay implementation.

## Signature rules

- **Tinkering:** choose one actual Tech upgrade controlled by Rocket while in alter-ego form. Discarding it pays the cost before the two draws. Exhausted upgrades and upgrades with no charge counters remain eligible. The limit is once per round, including across a saved selection. Tech traits survive a text-blanking effect. A replacement destination such as the Collector still pays the attempted discard cost.
- **“Murdered You!”:** each enemy that receives actual excess damage creates a separate optional draw. The source must be Rocket’s identity, his event, or an upgrade that extends his identity; allies and supports remain separate sources. This ability requires neither an attack nor a defeated minion. Overkill damage dealt to the villain keeps the identity attribution and can create its own excess-damage response. Damage prevented by Tough, immunity or an absorbing attachment produces no response.
- **I’ve Got a Plan:** an optional Hero Response after an actual basic thwart, including a thwart that removes no threat. A confused attempt is replaced and supplies no response. Each physical event uses normal resource payment and finishes before another copy can be chosen. Its +1 THW stacks, applies only in hero form, and expires at the end of the phase. Readying and the THW bonus are independent effects.
- **Reload:** ready each Tech upgrade Rocket currently controls. It does not ready Tech supports or another player’s cards.
- **Schadenfreude:** until the establishing turn ends, heal 2 for each enemy Rocket actually damages. A simultaneous Rocket Launcher effect can heal for several enemies. A prevented packet does not heal; an actual overkill packet against the villain does. The delayed effect remains after changing form. Copies stack.
- **Salvage:** only actually spending the physical resource card creates its optional response. Resolve this resource-spend response before the paid card’s printed effects. Move one selected physical Tech upgrade from the discard pile to the top of the deck without shuffling. Drawing, discarding or milling Salvage does not trigger it.
- **Battery Pack:** exhaust as its cost, then move one actual charge counter to another controlled Tech upgrade. This is an Action and works in either form. A zero-charge Battery Pack remains in play.
- **Particle Cannon and Rocket’s Pistol:** exhaust and remove one charge counter as costs before Stun replaces the attack. Particle Cannon deals one attack packet of 4 with ranged and overkill; the Pistol deals one attack packet of 2. These are hero attacks and obey Guard and ordinary attack restrictions.
- **Rocket Launcher:** exhaust and spend one charge counter, then choose a player. Deal 2 simultaneously to the villain and every minion currently engaged with that player. This is a nonattack ability: Guard, Stun and Retaliate do not apply. Commit damage to the saved enemy snapshot before resolving any defeat or damage response.
- **Cybernetic Skeleton:** +3 maximum/current hit points in either form, +1 ATK only in hero form. The host adjusts current hit points on entry, removal and text blanking alongside the maximum.
- **Thruster Boots:** +1 THW and Aerial only in hero form. Tech Theft blanks the continuous text of both upgrades.

Rocket’s charged upgrades do **not** have the Uses keyword. Removing their last counter never automatically discards them. Restricted limits are checked by the shared native engine.

## Obligation and nemesis

**Crisis on Halfworld** routes to the actual Rocket seat. Its optional flip does not spend the normal once-per-turn flip. Exhausting a ready alter-ego permanently removes this physical obligation. The other choice discards an upgrade with the highest printed cost, allowing a choice among ties; it gains surge when none is discarded.

**Vendetta** uses the shared Amplify icon and ordinary side-scheme threat. **Blackjack O’Hare** uses the shared Quickstrike and Villainous rules. When Shadows of the Past reveals Blackjack before putting Vendetta into play, that initial Quickstrike receives no Amplify bonus from Vendetta.

**Blackjack’s Bazooka** attaches to Blackjack if present, otherwise to the villain. Its official face has +2 ATK, which is absent from the catalog’s numeric transcription; `rocketEnemyStats` supplies the printed modifier. Any hero can spend three actual mental resources through the native payment window to discard it.

**Planetary Invasion** discards actual encounter cards until a minion is discarded. Reveal that same physical minion and complete its reveal, including Quickstrike, before granting Tough. If the encounter deck empties, recycle it and add acceleration normally, but end this discard-until effect. A found last card is removed from the recycled deck to preserve its physical identity.

## Host contract

`RocketPorts` extends `AntManPorts` with physical card selection, ordinary card cost, actual encounter-top discards and a simultaneous nonattack damage batch. Custom continuations use the `rocket:` prefix and contain only serializable values.

The host calls:

- `rocketEnterPlay` after the charged physical upgrade enters play.
- `rocketAfterBasicThwart` only after an actual basic thwart completes.
- `rocketResourceSpent` for each physical hand resource card actually spent, before the paid card’s effects.
- `rocketDamageResolved` once per actual enemy packet, including overkill, with actual damage and excess after prevention, and the original player/source attribution. Enemy defeats and villain advancement precede the optional draw. For the final damage clause of an event, discard that event before the draw; for separate intermediate clauses such as Melee, offer the draw before the next clause. The official Haymaker example places Rocket’s draw before the surviving villain’s Retaliate.
- `rocketTurnEnded`, `rocketPhaseEnded` and `rocketRoundEnded` at their respective boundaries.

Continuous modifiers are exposed through `rocketStats`, `rocketMaxHpBonus`, `rocketHeroTraits` and `rocketEnemyStats`; they check text blanking against the actual physical pieces. The source helper `rocketIsIdentitySource` excludes ally/support sources and upgrades attached to other friendly characters.

## Sources and validation

The implementation follows the [official Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), particularly costs, excess damage, overkill, effects, source attribution and the Tinkering FAQ. [Archived official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/) supply the Rocket charge-counter clarification, Melee responses, overkill attribution, the Haymaker/villain-stage/Retaliate sequence, and the Shadows of the Past/Vendetta sequence. Official card faces in `public/cards/catalog/16029a.webp` through `16057.webp` resolve omitted printed icons, including the Bazooka’s +2 ATK.

Focused module validation: **44 passing cases** in `tests/rocket.test.ts`. Native engine, complete source deck, multiplayer, browser, saved-decision and regression validation are recorded by the Galaxy’s Most Wanted hero acceptance report after host integration.
