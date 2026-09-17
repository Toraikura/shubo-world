# KURA / LIFE / REAL — 2026-09-18

## Delivered experience

- Starts in an open-front 3D miniature brewery, with a rope-bound wooden vat, rice/koji trays, cloth banners, lanterns, a paper brewer and a glimpse of the microscopic world.
- Tap the vat or the primary button once to descend through the liquid into LIFE. Drag/pinch or arrow keys and +/− control the exterior camera. E activates the entrance; R restores the overview.
- LIFE uses generated, transparent paper cutouts in 3D: four yeast body/face variants, separate buds/children, paper koji and a face-free reverse. The planes have no inflated body volume; they become edge-on when viewed from the side. The paper draw pass shares the world depth buffer, so branches occlude characters.
- REAL keeps the original biological geometry and scientific cutaway. The top navigation distinguishes all three layers. LIFE from the cutaway returns to the microscopic world; REAL preserves the selected world view.
- The koji trays have a tap response. The brewer remains in the scene without a separate button. Moving water and floating paper microbes give the vat a visible entrance.

## Save and simulation boundary

`shubo.v2` and its backup, validation and run schema remain unchanged. KURA is transient presentation state, not a saved gameplay mode. The microscopic camera, player location, glucose nodes, cultivation counters and collection remain authoritative. Returning to KURA sleeps the active simulation without changing its saved pause flag. Reload still restores an active run paused.

The existing four modes, growth equations, events, success/failure conditions, care history, import/export and encyclopedia remain available. There is no shooting-game code or shared save key with SHUBO DIVE.

## Assets and performance

Original generated artwork follows the supplied AA-3 references. Two transparent atlases were generated outside the Site checkout, then converted to WebP and embedded in the single HTML. Generation prompts and native PNGs are retained at `../output/shubo-kura-assets-20260917/`. WebP payloads: 237,338 bytes (microbes), 194,192 bytes (brewer). No runtime asset downloads or libraries.

The exterior has 462 static instances and 11 paper quads (6 draw calls, approximately 58,102 triangles). Paper characters in the microscopic world are capped at 64 quads. Only the active layer renders. Existing pixel-ratio and scene geometry bounds remain in force; no second WebGL context or second continuously rendered world is used.

Motion defaults ON for new state. OFF/reduced motion freezes ambient movement and avoids the camera descent while preserving direct movement and input. Pause, hidden pages and dialogs suspend animated transitions. WebGL loss pauses playback; restoration rebuilds all GPU resources. The 2D fallback retains the same navigation and cultivation controls with simpler projected geometry.

## Verification

- `node tests/structure.cjs`: inline syntax, valid references, unique IDs, no external runtime dependencies, original geometry bounds.
- `node tests/care.cjs`: original save/growth boundaries plus KURA round-trip preservation, inactive world time, paused/modal transition freeze, motion-OFF manual camera and packed exterior geometry.
- `node tests/ingredients.cjs`: original effect queues, motion controls and gameplay; fixture explicitly enters the microscopic layer. Combined embedded-art budget updated to 2 MB.
- `node tests/world.cjs` and `node tests/simulation.cjs`: existing world state and 71 success/failure/boundary scenarios.
- `node tests/kura-browser.cjs [chromium|webkit]`: 40 checks per engine covering entry, actual ingredient controls/start, LIFE/REAL/cutaway/player views, outside-click panels, save/reload, direct movement with motion OFF, viewport widths 320/402/874/1200, reduced motion and forced 2D fallback. Uses local Playwright as a development-only tool.

These are local browser/emulation results, not physical iPhone 17 tests. Actual phone temperature, battery, audio and sustained frame rate remain unmeasured. The benchmark MP4 could not be decoded in this environment; the supplied still images and written direction were used.

## Entrance simplification — 2026-09-18

The vat hotspot, bottom entrance button and direct vat tap now each enter LIFE with one activation. The intermediate approach stop was removed. The bottom button reads `樽の中へ入る`; the brewer hotspot was removed while retaining the brewer artwork. Pause, reduced motion and save preservation use the existing descent path.

A global pressed-button transform previously overrode the centered hotspot transform, moving the vat button under the pointer on press. The hotspot active/hover rule now has sufficient specificity to keep its hit target fixed; the browser entrance check clicks the hotspot itself.
