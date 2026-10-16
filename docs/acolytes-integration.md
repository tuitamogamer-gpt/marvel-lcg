# Acolytes modular set

This standalone import adds the seven original Mutant Genesis Acolytes cards (`32159`–`32165`) as an eighteenth selectable modular set. Magneto's scenario and the campaign remain pending. The downloaded catalog and images are unchanged.

## Source contract

Reviewed the seven original English scans at `https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/{code}.jpg`, mirrored locally as `public/cards/catalog/{code}.webp`. The independent source suite pins names, quantities, stats, boost icons, keywords, the hazard icon and the original catalog hash.

The [current Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), page 43, defines Teamwork: after an entrant engages, if another minion with the specified trait is in play, **only the entrant** activates against its engaged player. This updates the old all-minions wording in the [original Mutant Genesis rulebook](https://images-cdn.fantasyflightgames.com/filer_public/2c/52/2c52bcb0-4e21-4bf8-8052-b2ef41266737/mc32_mutant_genesis_rulebook_v5-compressed.pdf), page 3. Native activations select attack or scheme from that player's current form, preserve defense and boost windows, and restore interrupted outer activations.

The [official June 17, 2025 Fabian answer](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/) clarifies that Fabian leaves before the replacement's Teamwork window. His When Defeated runs before the physical Fabian enters discard, so he cannot find himself at an encounter-deck exhaustion boundary. The same original discarded minion is put into play; Zeal's fallback instead reveals the same original discarded minion. Discard-until stops at the first deck-exhaustion boundary.

## Native behavior

- Fabian is Villainous. Amelia is Stalwart. Senyaka's attacks gain Piercing. Delgado has Retaliate 1. Unuscione enters Tough.
- Actual defeating-player identity receives Amelia's confuse or existing-confuse threat penalty, and Senyaka's stun or existing-stun damage penalty. Shared status and damage primitives preserve prevention and status limits.
- Delgado removes all villain stun/confuse cards and gives an actual facedown boost card. Unuscione gives Tough, or heals four if the villain was already Tough.
- Zeal resolves each engaged Acolyte's When Defeated without defeating it. The first player orders simultaneous abilities. An engaged minion with blank text still prevents the no-Acolyte fallback.
- The Acolytes gives Guard to Acolyte minions while its text is active. Its boost shuffles only actual Acolyte minions from encounter discard into the deck.

All continuations use serializable effects and native physical-card movement. The source suite, native regression suite, complete seeded mission matrix, production browser checks and release status are separate evidence gates. The browser harness resumes real saved source states and resolves encounters through visible controls at 1440, 1280, 390 and 320 pixels, checking seven original IDs, behavior, reload, accessibility, layout and immutable assets.
