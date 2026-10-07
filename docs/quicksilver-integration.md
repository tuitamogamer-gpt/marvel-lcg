# Quicksilver native integration — 7 October 2026

Quicksilver's retail pack has **33 printed faces**: 17 native identity, signature, obligation and nemesis registrations, 12 native pack registrations and four exact Core reprints. The canonical identity and catalog set are `qsv`. His original 40-card Protection source deck preserves its original `140xx` printing codes, printed quantities and actual physical card instances.

## Identity, readying and durations

Quicksilver has nine hit points, THW 1, ATK 1, DEF 1 and a five-card hero hand. Pietro Maximoff has REC 3 and a six-card alter-ego hand. Accelerated Reflex, Hyper Perception and Reinforced Sinew modify the named hero's corresponding printed basic powers. Native stat calculation includes those upgrades together with the ordinary engine modifiers.

Super Speed is an optional response after an actual basic ATK, THW or DEF use, limited once per phase. Stunned or Confused replacing an attempted basic power does not qualify, as explicitly ruled in the Quicksilver FAQ. Basic DEF completes after the whole enemy attack resolves, including an attack that ends early; selecting a defender alone does not open this response. Declining Super Speed does not spend its limit. Choosing it uses the native identity ready adapter and opens any eligible Friction Resistance response after the actual ready transition.

Friction Resistance generates one physical resource by exhausting the actual upgrade and works in either identity form. Its Hero Response is optional and requires the named Quicksilver hero to transition from exhausted to ready. A ready identity receiving another ready effect does not trigger it. Each responding upgrade belongs to its own controller and that controller must be in hero form.

Maximum Velocity is limited to one play per phase and grants its +2 to ATK, THW and DEF until the end of the round. The bonus survives the player-to-villain phase boundary; a second legal play in another phase adds another +2 through the same round. A new round ends every such bonus. Always Be Running targets the actual faceup Quicksilver identity, preserving ownership in multiplayer, and cannot ready Pietro's alter-ego face or an identity prohibited from readying.

Superpowered Siblings selects exactly two distinct physical hand cards and discards them as its cost before drawing two cards. It draws three if Wanda Maximoff is in play, including the Scarlet Witch ally's subtitle under another player's control. A Scarlet Witch identity counts as Wanda only while its Wanda Maximoff alter-ego face is faceup, following the Rules Reference identity-title rule. The once-per-round use and pending selection survive JSON serialization.

## Signature actions

Double Time resolves two choices sequentially, permitting the same mode twice and checking actual available targets for each choice. Its damage is not an attack and its threat removal is not a thwart, so Stunned, Confused, Guard and Patrol do not cancel or restrict those effects. Crisis still prevents removal from the main scheme by a player card. If the first choice defeats a Crisis side scheme, the second choice can then remove main-scheme threat. Native defeat processing finishes each choice before the next choice begins.

Speed Cyclone chooses a positive X before one atomic native payment. The saved value passes through the event resolution independently of any resource overpayment. It selects distinct actual enemies that can receive a stun status, using native Stalwart and Steady handling. This is not an attack, so Guard and the acting identity's Stunned status do not restrict it.

Serval Industries exhausts as its cost and selects two actual discarded Quicksilver signature cards to shuffle into the normal player deck. When only one matching card is present, it shuffles that card: the shuffle is an effect and resolves as much as possible. Generic retail cards and nemesis cards are not matching Quicksilver signature cards. It cannot initiate with no matching discard card. The actual selected instances move rather than being cloned or replaced.

Scarlet Witch's ally interrupt is optional before her basic ATK or THW. It discards the actual top encounter card and adds only its printed numerical boost icons to that one use. A star icon, a discarded Boost ability and Amplify do not contribute. The native encounter-deck adapter handles hidden information and immediate depletion recycling, including the last discarded card, without continuing the discard into the newly shuffled deck. A basic power replaced by Stunned or Confused does not open the interrupt.

## Retail cards and shared windows

Multiple Man opens an optional response after every actual entry, including a copy put into play by another copy. Hand-only searches preserve the hidden deck; a deck search reveals the search boundary and shuffles even if no copy is found. The selected physical ally enters normally, with ally-limit enforcement. The original search and its printed shuffle finish before the new copy's entry response opens. Every copy keeps its original printing and owner.

Warlock spends an actual mental resource to heal up to two damage without exhausting. Nerves of Steel supplies energy only for a printed Defense event; Sense of Justice supplies mental only for a printed Thwart event. Each upgrade can be played under another player's control, remains limited to one per player and returns to its original owner's discard when removed.

Never Back Down uses the native defense interrupt window and adds two DEF for the attack. Only a basic defense uses the DEF statistic to reduce attack damage. A defense event can also make the hero the defender and open the interrupt; this does not retroactively change the calculated attack damage. Its delayed stun checks damage from the attack itself, separately from damage dealt by a Boost ability, and follows the actual attacker through a same-title villain stage transition. Super Speed follows the completed basic defense.

Side Step prevents up to three positive damage to the hero, including direct enemy damage and ally Overkill. Tough replaces its damage packet before this interrupt opens. Paying with an actual energy resource also deals one nonattack damage to the enemy that caused that packet; self damage, consequential damage and a generic source cannot create an invented enemy target. Native payment retains the resources actually spent, including restricted Nerves of Steel energy and chosen wild-resource types.

Brute Force adds one ATK and Piercing to basic attacks, then discards as a forced response after an actual basic attack. Stunned replacement leaves it in play. Adrenaline Rush and Civic Duty discard their actual upgrade as the cost and stack their ATK/THW bonuses only through the current phase. United We Stand requires the identity's Avenger trait and selects distinct damaged friendly characters, limited by the villain stage and a maximum of three. Beat 'Em Up places simultaneous nonattack damage on the villain and the acting player's engaged minions before native defeats resolve.

Order and Chaos checks its printed team-up and an actual treachery revealed from the encounter deck. It cancels only When Revealed text, preserving independent Incite and Surge, then deals two nonattack damage to the villain. Revealing a card from discard does not open this interrupt. The same physical event and treachery finish their normal resolution once.

## Obligation and nemesis

Need for Speed routes to Pietro's actual player and offers its printed optional change to alter-ego. The first branch exhausts a ready Pietro as the cost and removes the same physical obligation from the game. The second branch exhausts the identity and prohibits every ready effect until that player's next turn ends. Its duration survives round initialization, identity form changes, automatic phase readying and another player's turn end. An already exhausted identity can still choose this branch because its lasting ready prohibition changes the game state.

Extortion of Seismic Proportion and Avalanche keep their printed Crisis and Incite rules. Incite resolves once through the shared reveal-keyword path. The first player chooses the order of Avalanche's Incite and When Revealed text. Avalanche gives every player their own choice between two indirect damage and exhausting a ready identity; native indirect allocation applies to that player's controlled characters and retains Avalanche's actual physical ID as its source.

Vibration Resistance attaches to Avalanche if possible and otherwise the villain. Its reduction applies once to the damage that attached enemy takes from each actual attack, including a multi-packet attack, and does not reduce nonattack damage. Constant reduction precedes Tough: a packet reduced to zero preserves Tough, and a later packet of the same attack can then consume it. Removing the attachment requires exhausting a ready hero as its cost and discards that same attachment.

Earthquake discards two actual hand cards, or the one available card when fewer remain, and exhausts the identity. Its Boost ability offers one committed payment of two physical resources or exhaustion. Already exhausted identities cannot choose an ineffective exhaustion option when payment can resolve. If neither choice can resolve, the ability does as much as possible and leaves no blocking empty prompt. Discarding Earthquake for Scarlet Witch's basic interrupt never resolves its Boost ability.

## Verification

The **154 focused cases pass**: 32 identity/signature/nemesis module cases, 30 retail module cases, 60 native acceptance cases and 32 independent native review cases. Native acceptance uses actual `newGame`/`dispatch` commands and JSON reloads at saved choices and payments. Review covers defense completion, exact identity titles, constant reductions before Tough, multi-packet attacks, source attribution, status replacement, phase/round durations and multiplayer ownership.

Quicksilver's exact source list passes all 90 installed scenario/difficulty/module configurations. The complete source mission matrix contains 990 configurations. Each checks native progression and physical-card conservation; this is not an exhaustive enumeration of possible rules interactions.

The final full Vitest collection passes **2,911 tests across 67 files**, with one intentionally opt-in advisor measurement skipped. TypeScript, the production build, the whole configured Prettier check and `git diff --check` pass. The existing browser flow suite passes all six behavior groups and six accessibility audits with no browser errors.

The development browser matrix passes **77 accessibility audits and 76 layout checks** at 1440, 1280, 390 and 320 pixels. It launches the exact source deck and exercises Super Speed/Friction Resistance, Superpowered Siblings, Double Time, Multiple Man and defense-event sequences through actual controls. Saved choices and committed payments reload with all 40 original physical source cards conserved. Desktop and mobile payment/selection screenshots were visually inspected; no final page/console errors, accessibility violations or overflow failures remain. Development evidence is preserved in `output/quicksilver-dev/`, with the existing flow report in `output/flow/`.

The final production preview passes the four source-launch widths and all five native interaction groups at 1440 pixels: **23 accessibility audits and 22 layout checks**, with no browser errors or accessibility violations. Its separate evidence is in `output/quicksilver/`; these are local build checks and do not establish remote publication.

The regenerated inventory has 834 executable faces, 355 dedicated registrations, 3,717 unsupported faces and 16 registered identities. Quicksilver's retail product has 33/33 installed faces; 53 identities, further boxed scenarios and campaigns remain pending. All 48 inventory source hashes match the final source snapshot. The native Node production API entry returns HTTP 200 with unconfigured storage unavailable (35 runtime modules, six JSON files, Node 24.19.0).

## Rules sources

Identity timing, phase limits, status replacement, effect resolution and exact identity-title references follow [FFG Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), including the explicit Quicksilver Super Speed FAQ and the basic-defense completion rule. The pack's setup and source-list provenance can be checked against its [printed insert scan](https://hallofheroeslcg.com/wp-content/uploads/2020/12/marvellcginsert.jpg), indexed on the [Quicksilver product page](https://hallofheroeslcg.com/quicksilver/). The archived [official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/) also record the designer's Super Speed defense timing. Immutable catalog definitions and original printing provenance remain unchanged.
