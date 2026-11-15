# Earlier imagery detail and shared map tiles — 2026-11-03

The 3D map's terrain screen-space error also drives Cesium's photography selection. Fixed tolerance changes from 1.2 to 0.6, requesting detail earlier without the old movement-dependent coarsening. This can select more terrain tiles; no universal FPS or cold-network speedup is claimed. Actual 512-pixel CTX dimensions remain truthful; no fictitious tile-width or private Cesium patch is used.

The native terrain provider previously multiplied its geometric error by four abruptly at level 9. Child error could increase relative to its parent, and Cesium uses this value for imagery selection too. The native multiplier now ramps monotonically between levels 7 and 11, keeping the same final 4× native refinement multiplier. Physical heights, data resolution, route calculations and scientific derivatives are unchanged.

## Shared source and display work

- Cesium, full Leaflet and overview use one source/style-addressed cache of canonical north-up processed canvases. Shared work includes transfer, decode, mask processing and optical gap balancing. Style keys distinguish grayscale/color, polar treatment, masks, optical source and bootstrap policy. A cancelled view cannot abort a tile still required by another view.
- CTX/detail queue: six active tasks, 64 cached images. Baseline/local-root queue: two active tasks, 16 images, preventing slow baseline transfers from occupying all CTX slots. This is a browser-session display cache, not another archive or bulk data copy.
- A complete quartet of already cached finer child tiles can reconstruct a 1024-pixel parent image with actual finer pixels and original source masks. No child downloads are initiated for this reuse. At most eight composites are kept in that cache, plus normal renderer ownership. Partial child quartets do not invent complete coverage. Sampling metadata accounts for cropping and actual source sampling.
- On Leaflet zoom/pan, an available shared parent paints the new canvas immediately while the genuine finer tile is pending. Completion updates the same canvas; a late error does not clear the preview. Sharper shared images retain their full raster dimensions rather than being reduced to 512 pixels.
- Coarse CTX levels 0–4 use geographically cropped bundled CTX/Viking overview photographs. Remote coarse imagery therefore cannot serialize startup before fine CTX is requested. Bootstrap sampling is explicitly labelled overview (about 5.2 km where not downsampled), never high-resolution CTX. Level 5 onward still loads the real CTX source. Polar/gap context and strict upstream byte validation remain.

## Verification

413 JavaScript tests and production build passed. New tests cover source/style separation, coalesced transfer/decode, independent cancellation, finer child reuse with NoData, Cesium scheduling/cache reuse, monotone native errors, crop sampling, baseline queue isolation, and honest bundled coarse bootstrap. Earlier imagery/redraw, cancellation, routing, scientific data and mission tests remain passing.

In the existing Codex browser, Tractus Fossae around 23.56°N, 99.58°W loaded about 5.09 m CTX at 16.4 km. Zooming out with the wheel to about 29.1 km kept detailed photography visible, with a detailed overview as well. Screenshot: `D:/Codex/Mars-Latest/imagery-detail-wider.png` (not committed). Browser semantic inspection/input had intermittent connection timeouts; the successful wheel interaction and screenshots are the visual evidence. Network source truncations and terrain-service timeouts still occur, so cold-load duration is not guaranteed. Metadata reports finest known loaded source sampling, not a measurement of each currently rendered GPU pixel. No collector changes or manual deployment.

Pinned engine reference for the imagery/terrain relationship: https://github.com/CesiumGS/cesium/blob/1.145/packages/engine/Source/Scene/ImageryLayer.js .
