# Map Manager — source review checkpoint

> **0.2.0 verification update (6 November):** automated circle, dateline, lasso and appearance checks passed. The Windows app opened Map Manager during the offline viewer check. The original design checkpoints below describe the earlier review state. No bulk map catalogue or complete progressive-download/device performance campaign is available.


Status: editable draft, 2 November 2026. The user requested a checkpoint before final testing and packaging. This change has not been packaged, installed on the Pi, or accepted as a tested release.

## Review the interface

Run node scripts/create-map-manager-preview.mjs to regenerate artifacts/map-manager-review/index.html, then open that HTML file in a local browser. It contains the actual manager UI code and scoped styles, with a separate in-memory example catalogue. The sample qualities, regional bounds, sizes, and free space are illustrative, not downloadable products or claims about verified coverage. A second preview mode shows the real current situation: the bundled starter and an empty download catalogue.

The preview never reads map files, starts downloads, or writes desktop settings. Browser automation could not open the local file because the in-app browser permits only HTTP/HTTPS URLs. No workaround was used. Visual layout and interaction acceptance remain for the review/testing phase.

## Implemented in the source draft

- Whole-Mars quality dropdown populated from available catalogue and imported package metadata.
- Expandable regional resolution groups; resolutions equal to or coarser than the chosen global quality are hidden.
- One selected resolution per named place; selecting another replaces its previous selection.
- Explicit notice when increasing global quality removes redundant regional selections.
- Separate imagery and elevation resolutions, bounds sketches, sources, credits, and sizes.
- Persistent choices, import/activation/unregister controls, download storage selection, and a serial download queue.
- Storage summary: selected bytes, installed bytes, retained partial downloads, remaining download, free-space allowance, and free space on the selected drive.
- Optional progressive download of selected regional packages when the map centre enters their bounds at a close viewing scale, in Online Mode only.
- Progressive storage cap. Completed and interrupted automatic packages reserve their full package size conservatively. Nothing is silently deleted. Manual imports and explicit downloads are outside this cap.
- Individual pauses do not automatically retry on camera movement. Pause all also turns off progressive downloading.
- Global tile-pyramid package serving through the existing planet endpoint, plus original native COG serving for regional packages.
- Regional catalogue refresh after installation; global quality changes are applied through Reload maps so the current view is not unexpectedly reset.

## Decisions still easy to change

Labels and ordering; resolution-group layout; default expansion; progressive default and allowed limits; close-view threshold; storage-summary wording; how strongly to expose imagery versus terrain; and whether global-quality application should reload or become live.

Progressive currently means whole selected regional packages downloading as you explore, not persistent caching of arbitrary remote tiles. This makes expected size and offline completeness knowable in advance. It can transfer more than the small visible area, so each package's full size is displayed.

The cache cap is a stop-at-limit policy, not an eviction policy. Reservations persist across restarts and unregister operations so keeping files does not reset the allowance. A future reviewed cleanup/reconciliation control is needed to release reservations after manually deleting cached files. Reducing it below reserved usage pauses active automatic downloads and prevents further automatic additions; it does not reclaim disk space. Unregister keeps files, so it also does not reclaim disk space.

## Data and storage limits

The production catalogue remains empty. No new map source files, global mosaics, or regional packages have been downloaded or prepared by this change.

Storage accounts for actual package copies. The same selected package is counted once; independent packages with duplicate source bytes still occupy separate files. Cross-package content-addressed deduplication is not implemented. Already registered packages must match the approved manifest and be available before they reduce the download estimate.

The initial global tile adapter uses the existing bounded package manifest (20,000 files, 4 MiB manifest limit) and requires complete level-zero-to-maximum-level coverage. It is appropriate for compact whole-planet tiers. Very large native-resolution global archives will require reviewed sharding or an indexed container before they can be offered as a whole-Mars quality. The preview is not a promise that every illustrative tier is supported by that initial adapter.

The global pyramid validator checks complete tile membership and declared sampling. Real package preparation must additionally verify image/elevation dimensions, decoded scientific values, masks, polar/gap handling, source provenance, and distribution permissions before a package is approved.

## Deliberately pending the user's final call

- Automated feature/regression tests and download/recovery/offline acceptance.
- Visual review at Windows and Pi display sizes and keyboard navigation.
- Actual package catalogue curation and verification.
- Large-package storage/concurrency/performance and restart recovery checks.
- Windows and Linux builds, installers, CI packaging, and device update.

Only source syntax and diff checks belong to this checkpoint. Existing test reports and 0.1.1 installers describe the preceding build, not this draft.
## GitHub build delivery — user approval, 2 November 2026

After the user gives the final call to finish changes and proceed with tests/packaging, successful builds that pass the required checks may be uploaded to GitHub Releases in SamsDevForge/Local-Mars-Field-Atlas and designated the latest release. Include the Windows installer, Linux ARM64 package, SHA-256 checksums, and concise release notes identifying the tested source commit and actual platform verification/limitations. Keep binaries out of the source tree. This approval does not start testing or packaging now, and an unfinished draft must not be published as the latest build.

## Website sync and model evidence — 3 November 2026

The latest mars-mapping2 main source changes were integrated while retaining this review draft. Desktop controls were adapted to the Horizon header; progressive selection uses the visible map reticle. See WEBSITE_SYNC_20261103.md. User-supplied Q8 weights and training notebook evidence are recorded in ARES_MODEL_PROVENANCE.md. No tests, app builds, model inference, installers or device updates were run; the final-call gate remains unchanged.

## Lasso and coordinate selection — 3 November 2026

The source draft now adds two alternatives to named places: a freehand lasso on the genuine bundled overview, and west/south/east/north coordinate bounds. Zoom to an outline and Whole Mars controls let the user refine a selection. Coordinates use east-positive planetocentric degrees; coordinate rectangles can cross the ±180° boundary.

Lassos close automatically, have a bounded point count, and reject invalid or self-intersecting outlines. Lasso drawing stays within the displayed longitude domain; seam-crossing areas use coordinate bounds. The quality list is computed after selecting the shape, hides qualities that do not improve the global base, and disables qualities with incomplete catalogue footprint coverage. A separate selection can include multiple package footprints from the same named place. Polygon membership and footprint coverage are checked again by the backend rather than trusting renderer package IDs.

Adding an area persists its shape/quality, includes its covering package IDs in storage accounting and the existing download queue, and limits area-driven progressive downloads to visits inside the chosen shape. Named-place choices remain independent; duplicate package IDs are counted once. Remove added area does not delete files.

This installs complete intersecting packages, not a newly cropped raster. Bounds/footprints do not prove that every pixel contains valid imagery or elevation. Storage therefore includes surrounding package data and source gaps are disclosed. No new map files or production catalogue entries were fabricated.

The standalone preview uses the same selector source with embedded genuine starter photographs; additional package examples remain illustrative. Syntax/diff/import checks only; geometry, interaction, keyboard, cancellation, persistence, performance and platform tests still await the user's final call. No packaging/device update was performed.

The inference runtime remains bundled. The user's 1.65 GB Q8 weights remain an optional separate import and are not added to an installer or release by this change.

## Multiple selection tools — 3 November 2026

The area selector now offers Rectangle, Circle, Lasso and Coordinates as separate pressed-state buttons. Named places remain an additional existing method. Drag rectangle corner-to-corner, drag a circle from centre to radius, trace a freehand lasso, or enter west/south/east/north. Circle mode also accepts typed longitude, latitude and radius in kilometres.

Circle distance is calculated on the viewer's Mars reference sphere (radius 3,396,190 m). The displayed/planned outline is a 128-vertex approximation regenerated by the backend from the saved centre and radius; a supplied polygon cannot override circle geometry. This is a download selection, not a scientific survey or surface travel-distance measurement. Circles reaching a pole or crossing the displayed ±180° seam are rejected with guidance to shrink them or use coordinate bounds. Coordinates still support seam-crossing rectangles.

Tool changes alone do not save or download anything. All shapes share the same catalogue quality validation, complete-package storage estimate, save/download queue and progressive controls. Surrounding package data and source gaps remain disclosed.

Only syntax, relative-import and generated-preview source checks have been performed for these additions. Shape maths, interaction, projection edges, keyboard controls, persisted selections, performance and platform acceptance remain in the deferred testing phase. No installers or release assets were changed.

## Download appearance and selection-map appearance — 3 November 2026

Independent controls now select download imageryAppearance and selectionPreviewAppearance, each Color or Grayscale. These are saved with map choices. Switching the preview uses genuine bundled grayscale CTX/Viking or publisher-colorized Viking photographs, with the latter's origin and coarse color resolution disclosed. It leaves download choices and geometry unchanged.

Download appearance filters global qualities, named regional choices and shape-derived package plans. It does not recolor source pixels or assume all packages have both appearances. Changing appearance drops incompatible area/place/base selections with a notice. Sizes come from the actual variant's manifest; shared package IDs are counted once. The bundled starter contains both preview appearances already, so no new starter download is needed.

Optional package presentation metadata now includes imageryAppearance (grayscale/color); color also requires colorKind (natural/enhanced/colorized). Older packages lacking this metadata remain in the installed library and a separate approved-package list, with no claimed Color/Grayscale match.

Important remaining format work: the existing native regional surface packets carry gray/alpha, not RGB. The validator therefore rejects regional color packages until a reviewed RGB packet/renderer path exists. Compact global color pyramids can preserve their original image pixels. No real color/global/regional packages were created or added to the production catalogue. Color regional entries in the layout preview remain illustrative future choices, not currently installable products.

The generated preview embeds both authentic starter image sets for local use. Only syntax/import/diff checks have been performed. Functional display/variant selection, color metadata verification, persistence and platform testing remain deferred with packaging.
