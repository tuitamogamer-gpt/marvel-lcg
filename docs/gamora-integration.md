# Gamora integration contract

Gamora (`gam`, `18001a/b`) preserves the original hero pack card definitions.
The native identity module covers sixteen faces: both identities, nine signature
card definitions (`18002–18010`), Unfulfilled Destiny and four nemesis definitions
(`18024–18028`). Signature quantities total fifteen physical cards. The exact
forty-card original starter uses Aggression with three Protection First Hit and
three Justice Impede events through her printed six-event deck customization.

## Identity and played-event timing

Gamora has 10 HP, 2 ATK, 2 THW, 2 DEF and a five-card hero hand. Her alter-ego
has 3 REC and a six-card hand. Guardian and Outlaw are preserved printed traits.

Skilled Tactician is an alter-ego Action (`skilled-tactician`) that looks at the
actual top card. It draws that physical card only when the card is an event with
Attack or Thwart. Looking at another type still consumes the once-per-round use,
stored in `flags.gamoraTacticianRound`, and leaves the card on top. An empty deck
does not provide a card to look at.

Finesse responds after playing an Attack event to remove one threat; Precision
responds after playing a Thwart event to deal one damage. They have independent
once-per-phase limits (`gamoraFinessePhase`, `gamoraPrecisionPhase`). Playing an
event with both traits opens both opportunities after its complete resolution.
The player chooses the response order or declines; only a response that is used
consumes its phase limit. Legal targets refresh after each response resolves.

These responses are neither attacks nor thwarts. Precision ignores Guard and
Stun and does not trigger Retaliate. Finesse ignores Patrol and Confuse, while
Crisis still prevents main-scheme threat removal. Gamora's Sword independently
responds after every Attack event, including a played event whose ability was
replaced by a status card. Its separate non-attack damage source does not exhaust
the sword or consume either identity limit. Responses retain the physical played
card's identity even when Clobber or Impede already returned it to hand.

The engine records Attack and Thwart events when each actual card commences play,
including paid reaction events and cards replaced by statuses. It records them
for the actual player's current turn, before resolving the event. Decisive Blow
uses seven damage when a Thwart event was played that turn, otherwise four;
Forward Momentum removes five threat after an Attack event, otherwise three.
Using a basic power does not establish this history. Changing to the next
player's turn or ending a phase expires it.

## Signature effects and resource costs

Acrobatic Move deals a two-damage attack; Set the Pace removes one threat with
a thwart. Their printed labels retain native status, Guard, Patrol and Crisis
rules. Nebula's optional entry response searches actual deck pieces for an
Attack or Thwart event, preserves duplicates, and shuffles the remaining deck
whether the search finds a card or declines to find one.

Conditioning Room (`conditioning-room`) exhausts its actual support in alter-ego
form, returns the bottommost eligible event in the discard pile and heals one
damage. The native discard representation appends new cards, so the first
eligible entry is bottommost. It can heal toward a modified maximum HP even
when no event is available, and can return an event while Gamora is undamaged.

Each actual Keen Instincts generates one Wild resource for an Attack or Thwart
event cost. It can pay for Crosscounter or other reaction events, in either form
when the target event is otherwise legal. It cannot pay for a basic power, a
non-event triggered ability, an upgrade, or an event lacking either trait.
Native payment validates the physical source and exhausts it once.

Crosscounter is a Hero Interrupt when the identity would take positive damage,
after Tough. It pays its printed event cost, then prevents three of the original
packet, deals one attack damage and removes one threat through a thwart. Its
Defense label makes the actual player the defender of an ongoing enemy attack
without a basic exhaust. Prevention stays attached to the same incoming packet
across saved-game reloads and target choices. After its entire effect and discard,
its Attack and Thwart traits open the ordinary Finesse, Precision and Sword
opportunities.

Current Rules Reference 1.8 **Labels** supersedes the archived Gamora ruling:
when a multi-label ability is canceled, **each matching status card is removed**
and the entire effect is replaced. Crosscounter under Stun and Confuse removes
both; it neither prevents, attacks, thwarts nor defends. Its costs were still
paid and its event was still played, so played-event history and after-play
responses remain valid. Hit and Run uses the same native multi-label rule.

## Obligation and nemesis

Unfulfilled Destiny routes to the actual Gamora player. Its optional change to
alter-ego does not consume the ordinary voluntary change of form. Exhausting
alter-ego removes the exact physical obligation from the game. Its event branch
chooses and discards two distinct actual events, or as many as are available
under the current Choose (Game Element) rule. Resources and other types cannot
be selected. A forced targetless resolution cannot leave an unfinishable prompt.

Sibling Rivalry's printed base threat is four total. Only the actual Gamora
player can remove its threat, regardless of whether the removal is a thwart.
After the villain phase begins it deals a facedown encounter card to Gamora,
even when another player is the active seat.

Nemesis Nebula has 5 HP, 2 ATK, 1 SCH and Retaliate 2. Her forced interrupt
discards any Nebula ally before her entrance and before uniqueness checks.
This applies both to a reveal and to an effect that puts her into play.

In a Bind attaches to Gamora and blanks the printed text on both identity faces,
preserving traits. It suppresses Skilled Tactician, Finesse and Precision;
Keen Instincts, Conditioning Room and the separate Sword still function. Its
Hero Action may be taken by any hero: the acting player discards an actual Attack
event from their own hand and deals one damage to the attached Gamora as a cost,
then discards the attachment. Because the cost **deals** damage,
Tough or another prevention still pays it; this differs from a cost requiring
the identity to **take** damage. Waylay gives Gamora Stun and Confuse and checks
the statuses before resolving: a preexisting matching status adds Surge. None
of these five encounter faces has a boost-star ability.

## Host adapters and verification

`GamoraPorts` extends `AntManPorts` with physical selection, deck shuffle,
event card cost, modified maximum HP, prevention on the original damage packet,
and actual defense ownership. Every effect, target, cost and continuation is
JSON-serializable. The host connects ordinary and reaction plays, final event
resolution, payment sources, threat legality, pre-entrance minion interrupts,
villain phase effects and actual turn/phase boundaries.

The identity module's 67 focused tests pass, covering source quantities, actual
deck and discard pieces, independent response ordering, statuses, Crisis,
out-of-turn ownership, teammate attachment costs, persisted limits, blanking and
all nemesis clauses. Nine separate native adapter cases cover actual Enhanced
resource consumption and depletion, stale payments, and Blaze of Glory damage
before phase transitions, including saved damage prevention choices.
The shared native acceptance, browser and full regression results belong to the
combined Star-Lord/Gamora integration report after host integration finishes.

- [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf):
  Choose (Game Element), Choose (Option), Cost, Damage, Defense, Labels,
  Initiating Abilities, In Play and Out of Play, and Status Cards.
- [Official Gamora rulings archive](https://hallofheroeslcg.com/official-ffg-rulings/#gamora):
  Nebula's forced entrance interrupt and Gamora's deck size clarification. Its
  archived one-status multi-label answer is superseded by the current reference.
- Original card faces and quantities are preserved in `src/data/catalog-cards.json`
  and the original source list in `src/data/catalog-decks.json`.
