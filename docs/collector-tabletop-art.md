# Collector tabletop artwork

Update, 2026-09-24: the three generated playmats remain active. The original-game visual direction now uses CSS blue/orange comic backs and flat icon tokens instead of the generated foil backs and metal atlas below. Those assets and their provenance are retained. See [visual direction](visual-direction.md).

Generated on 2026-09-24 using the built-in `image_gen` tool (not the API/CLI fallback). These are original decorative assets; existing card scans and their attribution remain in `src/data/provenance.json`.

Web-ready assets are in `public/art/tabletop/`. Selected original PNGs are preserved locally in `output/premium/source/` (ignored by Git). WebP exports only resize and encode the generated output. The token atlas keeps its four generated quadrants; CSS selects each face. All game values and labels are rendered separately as accessible text.

Playmat choice uses `champions.playmat.v1`, independent of mission saves. Unknown values fall back to Midnight Manhattan; a blocked preference-storage operation does not prevent customization. Hero draw piles use sapphire backs. Encounter draw piles, dealt cards, and hidden review cards use copper backs. No card identity is passed into decorative backs. Empty piles keep an empty slot.

## Final prompt set

### midnight-city

Asset: `public/art/tabletop/midnight-city.webp`

Use case: stylized-concept. Asset type: premium collectible superhero card game playmat background, landscape 16:9. Create a beautifully illustrated Midnight Manhattan at night, seen from a high rooftop, midnight navy, muted petrol blue, small warm amber windows, subtle crimson cloud accents, atmospheric inked comic-book art meets collector art print. Broad quiet dark navy negative space across central 75 percent for real playing cards and game text to sit above. Detailed architectural silhouettes confined to bottom and side edges, small hazy moon upper corner, a sense of cinematic depth, restrained woven neoprene microtexture. Entire image is edge-to-edge flat printed artwork, perfectly front-on, no perspective of a physical mat. No characters, no cards, no zones, no UI, no text, no logos, no border, no watermarks. Beautiful premium art rather than a dashboard. Final image intended as an actual functioning game background, landscape 16:9.

### hero-back

Asset: `public/art/tabletop/hero-back.webp`

Use case: stylized-concept. Asset type: full-bleed portrait card-back artwork for a premium superhero tabletop card game. Aspect ratio 5:7 portrait. Design one symmetrical ornate midnight-blue and antique-silver collector card back, deep navy enamel, layered engraved metallic frame inset from all edges, subtle fine geometric guilloche and radial starburst detailing, a single prominent sculpted silver eight-point star emblem at the exact center on a sapphire blue circular medallion, warm thin champagne gold highlights. Two-fold rotational symmetry suitable for shuffling. Engraved sci-fi technology details, rich tactile foil finish, restrained reflections, luxurious physical collectible quality. Card art fills the entire rectangular image edge to edge, front-facing orthographic flat art, no perspective tilt, no surrounding background, no mockup, no hands, no text, no letters, no numbers, no watermarks. All corner decoration safely inside 6 percent inset.

### premium-tokens

Asset: `public/art/tabletop/premium-tokens.webp`

Use case: stylized-concept. Asset type: a single square game-token sprite sheet texture atlas for a premium superhero tabletop card game. A 2 by 2 perfectly regular grid of exactly four identical-size circular metal tokens on a uniform solid near-black navy background (#08111b). Each quadrant contains one perfectly centered face-on circular token, identical diameter exactly 80 percent of its square quadrant, generous clear space, tokens never touch. Top-left token: ruby red enamel with a bold embossed silver heart symbol. Top-right: golden amber enamel with a bold embossed dark crosshair target symbol. Bottom-left: ice blue enamel with a bold embossed silver shield symbol. Bottom-right: emerald teal enamel with a bold embossed gold four-point star symbol. Thick chamfered brushed-metal rims, fine milled edge grooves, tiny engraved perimeter ticks, glossy enamel and shallow dimensional depth, physically convincing premium metal gaming accessories. Perfect orthographic top view, consistent soft studio lighting from upper left, no perspective, no stacks, no extra objects, no labels, no text, no letters, no digits, no watermarks. Keep all four tokens precisely aligned to 25%,25%; 75%,25%; 25%,75%;75%,75% centers for CSS sprites. Square canvas.

### helicarrier

Asset: `public/art/tabletop/helicarrier.webp`

Use case: stylized-concept. Asset type: premium superhero card game playmat background, full-bleed landscape 16:9 art. Create a cinematic orthographic overhead illustration of an enormous futuristic airborne carrier command deck: layered brushed blue-black steel panels, elegant pale cyan engineering lines and illuminated seams, amber edge lights, an understated central circular landing insignia with no letters, dark recessed metal and tactile rivet details. Most intricate machinery is near the perimeter. Central 75 percent quiet muted steel-blue negative space to place playing cards and legible UI. Refined realistic graphic-novel illustration with tactile printed neoprene grain, coherent rich materials, subtle light, inviting premium collectible board-game art. Front-on flat printed art with no perspective tilt of the canvas, no visible mat object. No cards, no tokens, no characters, no UI, no text, no letters, no numbers, no logos, no watermarks. All detail is artwork, not a user interface.

### cosmic-rift

Asset: `public/art/tabletop/cosmic-rift.webp`

Use case: stylized-concept. Asset type: premium superhero card game playmat background, landscape 16:9. Full-bleed painterly graphic-novel art of a cosmic rift seen from space: an elegant sweeping indigo nebula, distant violet star clouds, turquoise cosmic dust and a slender warm golden planetary crescent near the far right edge. Rich midnight violet overall, atmospheric cinematic collector art print with restrained neoprene surface grain. The central 75 percent is quiet dark indigo negative space for placing playing cards and UI, the spectacular nebula filaments and planet kept mostly to edges and corners. Beautiful detailed art but no extreme bright white areas. Flat front-on printed illustration with no physical mat mockup, no characters, no cards, no tokens, no zones, no text, no logos, no watermarks. Wide landscape 16:9 composition.

### encounter-back

Asset: `public/art/tabletop/encounter-back.webp`

Use case: stylized-concept. Asset type: full-bleed portrait card-back artwork for a premium superhero tabletop card game, aspect ratio 5:7 portrait. One ornate black obsidian and burnished copper collector card back. Two-fold rotational symmetry: identical upside-down mirrored decorations, an engraved metallic frame inset safely 6 percent from edges, fine orange-copper geometric guilloche and radial detailing in the background. A single prominent abstract golden-orange hazard emblem at the exact center: six aggressive angular spokes radiating symmetrically from a dark hexagonal core, not text or a letter. Danger, an ominous enemy force, restrained fiery amber glow, deep charcoal enamel and tactile copper foil finish with warm champagne metallic highlights. Same premium trading-card family as a navy-blue silver hero back. Flat front-facing orthographic artwork, image filled entirely edge-to-edge with the rectangular card-back design, no perspective tilt, no surrounding background, no mockup, no hands, no text, no letters, no numbers, no watermarks.
