# Taskmaster and campaign save restoration

This continuation includes all work through the saved-campaign and Absorbing Man checkpoint `72984ce490cd1e6fb4da9f831d7ddef4b0f9073f`. It adds the next Rise of Red Skull scenario and restores exported campaign saves. The user explicitly requested that the complete accumulated work be pushed to `main` after verification.

## Taskmaster

The seventeen original faces `04093`–`04108` include both sides of Hunting Down Heroes and the four Captive allies. They represent 23 physical cards, of which 22 are selected with two villain stages. Hydra Patrol is a fixed encounter set; Weapon Master is the recommended replaceable modular set. The fixed Hydra Patrol cannot also occupy the replaceable slot.

Setup sets aside the four actual captive allies and puts the original Hydra Patrol side scheme into play. Captured by Hydra stores a random original captive beneath its physical side-scheme card. Defeating it transfers that ally to the defeating player's hand and removes the defeated scheme from the game. Rescued allies use their printed optional, paid responses only when played from hand. They are playable within this scenario; this does not implement official campaign reward carry-over.

Native rules cover Taskmaster's damage after changing to hero form, the main scheme's per-player threat/damage choice, extra encounter cards for stages II and III, Hydra Hunter's keywords and boost, Sword and Shield removal payments, Photographic Reflexes, Mimicry, Hunted by Hydra and Training Camp's minion-entry response. Original catalog data, deck lists, card scans and audio remain unchanged.

Photographic Reflexes follows [FFG's 21 September 2023 ruling, answer 90](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/): its replacement persists across damage from an attack's interrupt and the attack itself, while only one copy is discarded for that attack. Serialized execution scope ends with the attack; replaying the same physical event cannot inherit the old replacement. Tests cover Gambit's interrupt and basic attack together, two attached copies and replay of the same physical event.

## Campaign restoration

The campaign library accepts its exported JSON backups through a file picker. Imports are validated before modifying the library; duplicate IDs and replacement are handled explicitly. Corrupt stored data can be exported before recovery. A campaign's own saved table is authoritative over an older guest-table mirror, so reopening the application cannot rewind a later campaign checkpoint. The Rise of Red Skull preset now contains the three implemented missions: Crossbones, Absorbing Man and Taskmaster.

Campaigns remain local sequences of standalone scenarios with fixed teams and decks. Product-specific rewards, persistent damage and other official campaign rules remain unsupported. Zola and Red Skull are still pending.

## Regression and coverage

The previous CI run exposed `wolverine/absorbing_man/standard/arcade`, seed `44123`: Arcade's Funhouse offered the Permanent Wolverine's Claws as a discard choice. Its choices now exclude Permanent cards using the same native predicate as actual discard resolution. The regression covers both another eligible card and no eligible cards; the originally failing source mission passes.

The configured source matrix contains 40,040 cases in eight disjoint shards of 5,005. Taskmaster contributes 3,016 cases across 52 expansion identities, both difficulties and 29 legal modular sets. Manifest hashes preserve all 37,024 previous names and seeds. Registration totals are 2,337 executable faces, 1,898 dedicated faces, thirteen scenarios and thirty modular sets; 2,214 imported faces remain unsupported. Rise of Red Skull has 125 of 181 executable faces. The inventory pins 131 source files. Configured counts are distinct from measured execution results.

## Measured validation — 2026-10-28

- Final full regular regression: 10,223 passed across 284 files, with one intentional skip, in 1,093.08 seconds.
- All 34 focused Taskmaster tests and 27 campaign domain tests pass. Retained Absorbing Man and Crossbones coverage also passes.
- All 3,120 selected source configurations pass across eight filtered global shards: every 3,016 Taskmaster combination and all 104 Absorbing Man/Arcade combinations. Each shard also passes the global manifest assertion. These results do not claim a local execution of the other 36,920 configured cases.
- The final Photographic Reflexes correction excludes native enemy attacks caused by Moondragon or Headpool. All 116 Drax/Deadpool Taskmaster source configurations were rerun after this correction and passed.
- Production build, formatting and native API entry pass. The local API reports HTTP 200 with storage unavailable because no account backend is configured, loading 115 runtime modules and six JSON dependencies on Node 24.19.0.
- The final campaign browser suite passes ten flows, nine accessibility audits and nine layout checks with zero browser errors. Retained experience coverage passes seven flows, ten accessibility audits and nine layout checks.

Logs and reports are retained locally in `output/taskmaster-release/`. Superseded and deliberately interrupted test snapshots are kept in its `superseded/` directory and are not counted as successful release checks. Remote CI and automatic deployment status are separate from these local results.
