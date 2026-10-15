# Master Mold native integration

`src/game/master-mold.ts` authors fourteen Master Mold faces (32109–32120,
including both main-scheme faces) and the required Magneto ally 32172B.
The module does not import or automate the campaign reverse 32172A.
Sentinels is a fixed encounter set; Zero Tolerance is the recommended,
replaceable modular set. Existing standalone modular implementations remain
responsible for their own cards.

## Physical cards and saves

`masterMoldSetup` receives the actual original-source Magneto piece extracted
by native setup. `putMagneto` moves that instance into the first player's
ordinary ally zone, with no player-deck owner. `masterMold.magnetoId` is a
reference, never another physical card zone. `masterMoldFirstPlayerChanged`
transfers the same live ally when his text is active. The native ally limit
uses `masterMoldMagnetoCountsAgainstAllyLimit`; Victory remains native.

The scenario state contains only the Magneto reference and handled native
receipt tokens. Every queued continuation and choice uses JSON values.
Hydration must rebind the active seat before calling the module, as with
other imported scenarios. Tokens are unique to actual activations,
engagements, and attacks. Replaying an already handled token does not repeat
the physical discard, attachment, stun, or optional heal.

## Setup and main schemes

Native main-scheme setup flips 1A to 1B, then calls
`masterMoldMainRevealed(s, "32112b")` once. On advancing from 1B, call the
2A reveal hook before settling on 2B. The 2A program first shuffles the entire
actual encounter discard into the encounter deck, without creating a deck
exhaustion token, then resolves each player's discard-until instruction.

For an `each player` instruction the first player chooses resolution order.
The module offers that choice and resolves one complete player's entry
windows before proceeding to the next player. Eliminated players are not
included. Main-scheme goals are 6N and 8N. Native 2B completion loses the
game. Active text on either B face grants Guard to all Sentinel minions;
blanking a recipient does not remove this grant, while blanking the main
scheme does.

## Master Mold schemes

Run the scheme interrupt after Confuse and other activation replacements,
before assigning any new boost card. Construct
`MasterMoldSchemeReceipt {token, enemyId, enemyCode, playerId, performed}`.
`masterMoldSuppressesBoost` determines whether this actual activation receives
no new boost card; `masterMoldBeforeScheme` supplies its forced interrupt.
No-match exhaustion still suppresses the new boost. The restriction lasts
only for that one scheme activation. Existing already-assigned boost cards
remain subject to their native rules; suppressing a new grant must not
silently delete or discard a previously assigned physical card.

`discardTop` performs the native encounter discard and returns the actual
discarded piece plus `emptied`, even when immediate recycling has already
moved that piece into the new deck. Discard-until ends on the first
exhaustion boundary. A matching final discarded card is still put into play.
`putMinion(s, piece, playerId, after)` removes that same ID from its current
physical zone, performs native PUT entry, and resolves all generated entry
and engagement windows before `after`. PUT does not reveal the card, but
printed Toughness, Quickstrike, uniqueness, and engagement responses remain
native. No selection may fabricate a missing Sentinel or continue through
the newly recycled deck for the same player's instruction.

## Engagement and attachment timing

After every actual engagement, including initial setup PUT and control or
engagement transfers, call `masterMoldMinionEngaged` with
`{token, minionId, playerId}`. The Mark VIII response moves the topmost actual
Sentinel attachment from encounter discard directly onto that minion.
The separate direct attachment bypasses the entire attachment's Attach To
phrase: an existing Stun Beam does not prevent a second Stun Beam from this
effect. No reveal, Tough grant, or Surge ability of the attachment resolves.

Ordinary Unit Upgrade and Stun Beam reveals use
`masterMoldAttachmentTargets`, which checks current Sentinel-minion traits.
Ordinary Stun Beam additionally checks for a physical attached Stun Beam,
even if the existing copy is blank. No legal ordinary target causes Surge.
Unit Upgrade's boost attaches through its own boost ability and never gains
the ordinary reveal's Surge. `attach(..., boost=true)` must retain the same
physical boost card on the activation so cleanup cannot discard or duplicate
the attached piece.

Native printed attachment ATK/SCH numbers are applied once independently of
text blanking. `masterMoldModifiers` adds only Unit Upgrade's text HP and
Retaliate grants, plus main-scheme Guard. Each active Unit Upgrade adds 2HP
and Retaliate1. Retaliate numbers add before native damage resolves, so
Retaliate2 is one damage event. Changing maxHP must preserve actual damage,
then apply native lethal checks when an attachment is blanked or leaves.

## Completed attacks and Magneto

After an attached minion completes its attack, construct
`MasterMoldEnemyAttackReceipt {token, enemyId, enemyCode, performed,
damagedTargets:[{targetId, actualDamage}]}` from native attack damage receipts.
Include all actual attack-damaged characters, including Overkill recipients;
exclude separate boost damage, indirect damage, damage prevented to zero,
and Tough consumption without damage. `masterMoldAfterEnemyAttack` supplies
one forced response per active Stun Beam. Each actual character is stunned
once per attachment response; native status placement retains Stalwart,
Steady, existing-status caps, and leave-play handling.

Construct `MasterMoldAllyAttackReceipt {token, allyId, allyCode, playerId,
performed, defeatedSentinelMinion}` only from an actual completed ally attack
and its earned defeat metadata. The Sentinel trait is evaluated on the
defeated minion at defeat; neither missing targets nor a same-turn unrelated
defeat earns the heal. Offer `masterMoldAllyAttackResponseOptions` as an
optional response **before consequential damage**. An ally with four damage
can heal to three, then receive one consequence and survive at one HP.
Choosing Continue leaves the response unused and ordinary consequence
still applies. The response cannot initiate when there is no damage to heal.

## Treacheries and defeated schemes

Children checks the resolving player's form once to choose attacks or
schemes. It snapshots all currently engaged minions of any trait, allows
their native activation order to be chosen, and resolves native activations
sequentially. If the initial set is empty it activates Master Mold. A minion
that leaves before its turn is skipped; a new minion does not join the
already initiated group. Native activation replacements still apply.

Shields Up grants Tough to each Sentinel minion engaged with that player.
`giveTough` returns whether a status card was actually placed. If every
placement fails, including when all matching minions already have Tough,
the treachery surges. Its boost affects only the villain and has no Surge.

Intruder Alert's defeated hook mills for the actual defeating player.
Virus has fixed base threat 2, native Hinder2N and Victory1; its defeated
hook sends one unlabelled damage batch of 2 to every current Sentinel enemy.
The batch uses native simultaneous placement, prevention, defeat, and
response windows. This is encounter damage, not an attack, and does not
earn Magneto's response or trigger attack Retaliate.

## Sources

Original scans: <https://hallofheroeslcg.com/mutant-genesis/>.
Rules Reference 1.8: <https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf>.
Relevant sections: Attach To p.8; Attack p.10; Boost p.11; Each Player and
Encounter Deck p.16; Keywords p.25; Otherwise p.31; Scheme p.39.
The independent source-contract documentation records the associated
official card clarifications, including direct attachment and Overkill.
