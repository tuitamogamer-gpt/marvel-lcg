# Significant game events

The live game uses `src/MilestoneAnimation.tsx`: Remotion Player seeks the paused timeline in `timeline.js` at 30fps. Hyperframes `index.html` previews the same timing and artwork. `accent.tsrct` is the editable Tesseract 0.3.1 project (four native rectangle layers with opacity keyframes). Its transparent PNG is shared by both players. No exported video or extra audio is required.

Preview with `npm run dev`, validate with `npm run check` (npm cache must be writable). Tesseract: `tsrct preview --project accent.tsrct --time 0.4 --output assets/milestone-ink.png`. Linux needs a Vulkan driver; the verified render used Mesa lavapipe.

See ../../DESIGN.md. The one nested-clip Hyperframes warning is intentional: this single ribbon has no independently editable scene transitions. GSAP 3.14.2 is redistributed under its standard license; Exo 2 uses the SIL Open Font License. Runtime dependencies are pinned in the main lockfile.
