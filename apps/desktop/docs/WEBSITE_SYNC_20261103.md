# Website source sync — 3 November 2026

Imported the five commits on SamsDevForge/mars-mapping2 main through 571f03b0d38992292e8010ee9616df70416b5287, relative to the original 038af6e baseline. Harshvardhan226510/mars-mapping main remains at that original baseline. No reference repository, deployment, collector, map archive or account configuration was changed.

The 53-file update brings the Horizon workspaces, reticle-based focus, measurement/route terrain display, explicit route isolation and overlap priority, return-route details, exact directed-grid direct/return adapter, science overlay transitions/masks, equipment integration, responsive globe loading, and upstream regression cases into the shared desktop source.

Six app overlaps were resolved manually. Local Cesium, strict network policy, private services, user model handling and the Map Manager draft are retained. Desktop network/manager controls now occupy a header dropdown so they do not overlay Horizon navigation. Progressive-download focus uses the same reticle position as the map. Two source files had inherited trailing whitespace removed.

The original partner engine source remains untouched; the new website direct/return search lives in its adapter. All scientific or navigation claims remain subject to terrain coverage and model limitations.

Checks performed here: JS syntax, Python parsing, literal relative-import existence, merge-marker inspection, local Cesium and desktop-hook inspection, and whitespace. Imported tests are present but have not been run. New website test results are upstream claims, not desktop verification.

No frontend/runtime build, packaging, model inference, Pi update, release or visual acceptance was performed. The user's final test/package gate remains in force; the existing v0.1.1 release is unchanged. The private scientific executable must be rebuilt later to include the new Python adapter.

Detailed source paths and hashes: verification/website-sync-20261103.json.
