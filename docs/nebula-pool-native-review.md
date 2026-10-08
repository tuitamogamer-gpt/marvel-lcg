# Independent Nebula pool native review

The reviewer owns `tests/nebula-pack-native-review.test.ts`; module and shared engine changes remain with their assigned authors. The review uses actual `newGame("nebu")` forty-card source instances, actual PLAY/PAY/ABILITY/CHOOSE commands, a JSON round-trip before every command, and exact source-ID/owner conservation after every completed flow. Teammate decks also retain their original forty instances. Explicit extra fixture cards retain their actual printed codes and owners.

Twenty-two native controls verify:

- Eros's current per-Mental separate choices, including the same Steady minion twice; exact double-Mental, mixed actual allocation, double Wild assigned through the real payment allocation UI, and uncounted overpaid Mental resources. Putting Eros into play has no from-hand paid response.
- Honorary Guardian's current HP increase and matching reduction on a wounded teammate, canonical local hero target and Max 1 character limit, original-owner discard routing, ordinary teammate elimination at zero HP, and ally defeat when lost maximum HP makes its existing damage lethal.
- Venom's consequential reduction after the actual thwart removes the last main-scheme threat, with a remaining-threat control.
- Cosmo's hidden saved teammate physical top ID, one prediction receipt per actual use, correct foreign discard ownership, immediate last-card deck reset and encounter dealing, encounter discard destination and wrong-type control.
- One Way or Another's complete native When Revealed before draw 3; canceled scheme and its complete Spycraft replacement reveal before draw 3; actual title-wide round maximum across players; and spending actual Determination on the zero-cost event, resolving its non-thwart response before the reveal cost.
- Wraith's actual current faceup boost ability across players, with ordinary damage, Tough prevention and source defeat as payment, while the same physical boost's one numeric icon still contributes to the villain's attack. An Alter-Ego controller cannot use the interrupt.

## Rules evidence

[Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), p.22, says that when an identity's “gets +X hit points” ability ceases, its current dial is reduced by X. A wounded identity therefore loses the full modifier, even while below its unmodified maximum. Ordinary defeat/elimination checks apply when this reaches zero.

RRG1.8 p.67 changes Eros to a separate choice “for each Mental resource ... choose a minion and confuse it” and both player Cosmo printings to “a player deck or the encounter deck.” The Steady test uses an actual printed future-pack minion solely as a generic status-keyword metadata fixture; it never reveals or executes that minion's card ability or enables its source pack.

[Official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/) confirm that canceling the revealed side scheme still allows One Way or Another to draw three, that Wraith's controller must be in Hero form, and that an “after you spend this card” response can be used by spending the resource on a zero-cost card. The conditional zero-cost payment path is verified through the actual optional payment UI and committed physical resource response.

No unresolved implementation issue remains in the reviewed pool controls. Focused native suite: **22/22 passing**. TypeScript compilation: passing. Whole-source regression and browser validation remain the release owner's checks.
