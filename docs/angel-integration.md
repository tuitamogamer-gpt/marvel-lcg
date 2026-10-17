# Angel Hero Pack native integration

The retained `catalog-cards.json` Angel source contains 34 printed faces and
59 physical cards. All faces are registered through native handlers or existing
printed-card adapters; source JSON and image files are unchanged. Angel's
original Protection starter has 40 cards. Harpoon's five physical nemesis cards
start in the owner's reserve. This pack contains no modular encounter set.

Warren Worthington III, Angel and Archangel use the original 42001b, 42001a and
42001c faces. A saved `player.angelForm` distinguishes the two hero forms while
retaining the existing hero/alter-ego model. Form changes preserve the normal
once-per-round voluntary change, with Metamorphosis providing its printed extra
change. Printed stats, traits, hand sizes and Archangel's acceleration icon follow
the active face. Angel of Life and Angel of Death have separate per-phase limits.

The native module implements all signature events, printed resource reactions,
allies, upgrades, supports, obligation and nemesis cards, together with the four
additional aspect cards. Important host integration points include paid defense
and damage interrupts, actual attack receipts, ally responses before consequential
damage, basic-power interrupts, simultaneous damage, player-card ownership,
minion-reveal cancellation and indirect-damage allocation. All pending choices
are ordinary serializable effects and preserve physical card IDs on reload.

Two shared batch integrations are deliberate dependencies:

- Render Medical Aid (42017) uses the generic player-side-scheme framework owned
  by the batch integration. Its `angelPlayerSideSchemeDefeated` callback allocates
  five healing separately for each surviving player, among that player's controlled
  characters, before the physical scheme leaves play for Victory 0. The framework
  supplies play, limits, per-player starting threat, and defeat timing.
- Soaring Hearts (42021) shares the Psylocke printing's (41020) Team-Up handler.
  The combined batch supplies a single implementation for both original codes.

`tests/angel-engine.test.ts` exercises the original starter and all four aspects,
the third identity face and reload, real play/payment windows, printed source
cards, responses, additional costs, defense and damage, the nemesis set, and the
side-scheme benefit callback. Shared framework and cross-printing tests run on
the integrated branch. Rules timing follows the current Rules Reference, including
ally responses before consequential damage and forced interrupts before a
defeated player side scheme leaves play.
