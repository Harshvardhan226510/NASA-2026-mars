# Website and partner sync — 5 November 2026

Integrated seven commits from **SamsDevForge/mars-mapping2 main**, from 571f03b0d38992292e8010ee9616df70416b5287 through aed8493b9e0565920b0edbf55416b9b32c67e1e4 (40 changed source/doc/test paths). Also reviewed **Harshvardhan226510/mars-mapping main** at fdfc259599b579d543a97452b1f20149157f5512 and selectively incorporated its newer site-comparison and color-overview fixes. Both references were read from main; no reference repository or deployment was modified.

## Resulting draft behavior

- Landing and base-site evaluation now has separate priorities, expanded surrounding-terrain assessment, nearby landing/base pairing, explicit missing-evidence bounds, candidate footprints and readable/JSON exports. The dedicated panel works through Orbit and Horizon, with a route handoff wired to the desktop's existing route panel.
- Imagery uses a stable refinement tolerance, shared processed imagery, loaded-child/parent reuse, corrected cancellation/late-result handling and explicit render requests after image completion. These are source changes; no desktop FPS, loading-time or Pi improvement has been measured.
- The attributed USGS SIM 3292 geology overlay and named-unit legend are included. The proxy uses the existing bounded desktop cache rather than a cloud-specific dependency, and is allowlisted behind the existing Online Mode gate. Offline geology tile storage is not implemented; the layer reports unavailable when its source cannot be accessed.
- Coordinate-grid controls are promoted beside imagery appearance. The Sun uses the calculated position/distance and physical size, with a default-on display enlargement control and preserved explicit off preference.
- Partner mini-map color-overview loading and grayscale-flash fixes are incorporated while retaining the desktop's suppression of remote fine-color requests in Offline Mode. A rejected overview preload is observed instead of left as an unhandled promise.

The desktop Map Manager, shape/coordinate selections, installed base-map adapters, strict network guards, local Cesium assets, private runtimes, ARES models, offline input draft and optional output-pack installation draft are retained. Three overlapping app blocks were resolved manually; partner panel navigation retains Horizon initialization. No new model weights, map data, speech components or cloud collectors were downloaded or run. Partner duplicate ARES specification documents were not imported as new application requirements.

## Validation and release state

Static checks passed for 32 JavaScript files, 161 literal relative imports, the imported JSON metadata, merge markers, local Cesium/desktop hooks and whitespace. Imported upstream regression files are retained but **have not been run**. Upstream commit messages report their own test/build results; those are not desktop acceptance evidence.

No functional tests, visual acceptance, native-runtime build, app build, packaging, release replacement or Pi update was performed. The user's final testing/packaging gate remains in force. Existing v0.1.1 builds do not contain these changes. Full source identities, imported paths and post-integration hashes are in verification/website-sync-20261105.json; before/base/incoming snapshots remain ignored under artifacts/website-sync-20261105.
