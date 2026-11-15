# Local package format — version 1

Create a folder containing manifest.json and the exact files it lists. Import from Map Manager; SHA-256 is computed by streaming each file. Files stay in place, avoiding unnecessary large copies. Unregister removes only the registry entry, never source files. Missing removable storage is shown explicitly.

Required manifest fields: schema = mars-map-package/1; id (lowercase letters/numbers/dots/dashes/underscores, 2–80 characters); version; name; coordinates = east-positive planetocentric degrees; elevationDatum; bounds = [west,south,east,north]; provenance = {source,rights,credit}; files = [{path,bytes,sha256}]. Paths are relative, unique, and must resolve inside the chosen directory. Manifest size is bounded and each listed file must match size/hash.

Verified native packages are integrated into the original renderer through authenticated raster/surface/elevation contracts. Activation/deactivation and missing-storage handling affect available coverage. Generic registered data-only packages do not automatically become imagery layers. Archive extraction, arbitrary raster conversion, private Drive OAuth and general package dependency/version migrations remain pending. The build-generated maps/starter-manifest.json inventories authentic bundled imagery/elevation with preserved provenance; its schema describes the fixed starter separately from user packages.

## Original native COG packages

A manifest may include dataset (one original native catalogue record) and sourceFiles (mapping each original imagery/terrain asset ID to its relative listed file). Bounds must match the package, and source CRS, transforms, dimensions, datum and per-file byte/hash metadata are required. Original COG bytes are never converted. The local provider substitutes only private source IDs, retains originalSourceId for provenance, and supplies bounded original ranges through the existing raster/surface/elevation contracts. Activated local records take priority over the same online dataset ID. Missing removable media is omitted from available coverage. Arbitrary metadata does not create genuine imagery; every referenced file must pass validation.

## Controlled downloads

maps/download-catalog.json lists permissioned entries: approved=true, manifest (the same full package manifest), and sources (one {path,provider,fileId} for google-drive, or {path,provider,url} for https). File sizes and SHA-256 come from the package manifest. Catalogue entries are controlled by the application source; renderer input cannot supply arbitrary URLs. The catalogue intentionally contains no entries until source/redistribution validation is complete.

The downloader requires Online Mode, checks disk space, streams bounded data, retains partial files for retry, validates resume responses, restarts when a source ignores byte ranges, reports progress/speed, allows pause, atomically finalizes complete directories and registers only after checksum validation. Selecting Offline Mode aborts outgoing transfers. Private Drive/OAuth, quota exhaustion and HTML confirmation pages are reported as unavailable; manual import remains available. Package folders are the supported import format in this build; archive extraction is still pending.

## Review-stage quality picker metadata

See [Map Manager and the local map API](docs/DEVELOPER_MAP_API.md) for current download options.

Optional presentation metadata supplies scope (global or regional), qualityLabel, imageryMetersPerPixel, optional terrainMetersPerPixel, optional description, and, for regional packages, placeId and placeName. Values describe actual stored sampling; they must not claim finer imagery or terrain than the native source grids. A regional presentation requires the existing verified native dataset/sourceFiles structure. Packages without presentation remain supported by the installed library and legacy approved-package list.

The quality picker includes the bundled starter, approved catalogue choices, and imported packages with presentation metadata. Grouping is by imagery resolution, with terrain shown separately. placeId identifies the same place across alternative resolutions. Choosing a base removes regional choices with numerically equal or larger metres-per-pixel values.

A draft global display adapter accepts a planetTiles object with imagery and optional terrain. Each kind has template, maximumLevel, and tilePixels. Template contains {z}, {y}, and {x} exactly once, for example imagery/{z}/{y}/{x}.jpg. Files must still be individually listed with byte counts and SHA-256. The pyramid uses the viewer's existing geographic grid: 2^(z+1) columns, 2^z rows, north-origin y, complete levels starting at zero. Global bounds must be [-180,-90,180,90]. Full membership, including the poles, is required. Grayscale/colour photographs retain their supplied pixels; elevation uses the existing 513-by-513 LERC contract. Declared pixel dimensions and decoded contents still require package-preparation acceptance before approval.

The initial bounded manifest supports 20,000 files and a 4 MiB metadata document. Do not publish a large native-resolution global tier through this adapter until an appropriate sharding/indexed-container design has been reviewed. Full-resolution CTX archives are not implicitly supported as a single compact package.

Storage estimates subtract available, matching registered packages and retained staging bytes. Actual separate package files count separately; no cross-package deduplication is claimed. Downloads verify the staging folder before final promotion/registration. The progressive limit reserves whole automatic package sizes, persists across restart/unregister, and stops additional automatic downloads without deleting files. Explicit downloads and imports are independent of that allowance; cleanup/reconciliation of manually deleted progressive files remains a review item.

## Area-selection draft

Saved map choices may include areaSelection with bounds and resolution, or a bounded polygon (up to 256 longitude/latitude vertices) and resolution. The backend derives areaPackageIds from its own known options; it does not trust supplied IDs. It matches complete intersecting packages at the selected imagery resolution, checks footprint-union coverage of the actual polygon, and merges those IDs with named selections for queue/storage accounting. The package manifest itself is unchanged. Actual raster masks and scientific availability remain authoritative; package footprint coverage does not certify valid pixels everywhere.

Area choices may additionally contain circle: {center: [eastLongitude, latitude], radiusMeters}. The backend regenerates a bounded polygon from this circle descriptor before resolving package footprints; it does not trust a renderer-supplied circle polygon. Typed coordinate bounds and rectangular drawings share the bounds form; freehand lasso uses polygon. The initial circle selector excludes pole-enclosing and longitude-seam-crossing circles rather than silently selecting a different area.

## Appearance metadata in the review draft

presentation.imageryAppearance may declare grayscale or color; color packages must additionally declare colorKind as natural, enhanced or colorized. The picker requires an explicit matching appearance. This is a provenance classification, not a permission to synthesize/recolor data. Unknown appearance is not inferred from filenames or from an 8-bit raster type.

The current native regional packet format carries gray/alpha only; regional color manifests are rejected until RGB display packets are implemented. Global JPEG/PNG/WebP pyramids can preserve supplied source color. The bundled selection preview's color imagery is publisher-colorized Viking context with coarse color detail; it is not native high-resolution RGB. Actual package approval must verify appearance, decoded contents and provenance before offering it.
