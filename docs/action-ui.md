# Action flow and component design

24 September 2026

An explicit action click is confirmation. The dispatcher now runs preparation and cleanup until an actual decision, result, or pre-resolution checkpoint. The latest review combines payment receipts, card changes, messages and stable before/after values. When a choice is needed, its optional `context` stores and displays that same information without a separate Proceed dialog. Old saves remain compatible.

Ordinary boosts share the final damage/threat calculation. Star boosts still pause before their abilities; incoming damage and scheme threat still pause before application. No timers advance the mission. Revealed encounters retain their read-before-resolution stop. Hidden boost and encounter cards remain face down until the engine reveals them. Cleanup proceeds automatically after the meaningful review.

The attack workspace uses three columns: participants and narrative, calculation and changes, related cards. The desktop regression asserts no vertical or horizontal scrolling at 1280×720, 1366×768, 1440×900 and 1920×1080. Narrow screens stack and preserve scrolling. Card inspection, focus trapping, cancellation and save/resume remain available.

25 September: action summaries with related cards now fit within 760px; attacks use up to 1040px. Related cards are compact thumbnail rows with their names, resource symbols and movement labels. Hover/focus previews and click inspection retain the full card text. Smaller headers, tighter content spacing and lighter backdrops keep the table visible; review footers remain fixed while long content scrolls. Payment windows use a narrower desktop card grid. No action timing or saved-game behavior changes.

The [official Fantasy Flight Learn to Play](https://images-cdn.fantasyflightgames.com/filer_public/ab/be/abbef836-d5ef-4241-b2bd-1062df73f367/mvc01_learn_to_play_eng-compressed.pdf), page 5, shows small colored status cards beside the physical counters. The local reference was inspected at `output/tabletop-research/learn-to-play-p5.png`. The new UI interprets these as orange Tough, yellow Stunned and purple Confused with vector emblems and short readable reminders. These are interface adaptations, not scans of official status cards. Existing card artwork keeps its existing provenance.

Resources use consistent energy lightning, mental atom, physical fist and wild star symbols. Scientist reuses Peter Parker's existing card artwork and advertises its actual availability and one mental resource without implying a freely banked resource. Attack and Thwart communicate both their numerical value and effect.

Validation is covered by the rules suite, `tests/action-flow.test.ts`, the three-hero browser flow, and the expanded `scripts/flow-check.mjs` no-scroll assertions. The recorded multiplayer flow now uses 28 reviews, down from the previously recorded 68; this is a measured scenario, not a guarantee for every encounter sequence.
