# Imported upstream source

- Imported 1 November 2026 from https://github.com/SamsDevForge/mars-mapping2/tree/main .
- Pinned upstream commit: 038af6ead12d9c44c7884541f5f3c6bdc7b44095 (31 October 2026, 12:14:36 UTC).
- Partner reference https://github.com/Harshvardhan226510/mars-mapping/tree/main resolved to the same SHA at audit time. Only main branches were consulted for the source import.
- Desktop baseline commit: 97b2da4dbc0e18fde7b4d8f0b23ba58acd2e7aa3.
- All 2,971 imported file paths and Git blob hashes were verified against the complete, untruncated upstream tree. Exact file inventory: upstream-inventory.json. Imported file bytes total 225,591,248.
- Original upstream README is retained in Git at the baseline commit; web/README.md remains available. Root desktop README describes current engineering status.

## Attribution and source integrity

Retain all original authorship and in-file credits. The original partner pathfinding code remains in web/routing/upstream; original behaviour and all three profiles are covered by the preserved regression tests. web/ROUTING.md and web/routing/upstream-source.json are retained. An inherited documentation discrepancy remains: ROUTING.md cites 2d3713a2..., whereas upstream-source.json and routing/service.py cite 814c8a44.... This desktop import did not rewrite source provenance to invent agreement. Reconcile against original history before release.

## Rights

No standalone LICENSE/COPYING file was present in the imported tree. Repository access and online viewing do not establish redistribution permission. Preserve NASA/JPL/MSSS, Caltech Murray Lab, Viking, MOLA, HRSC/HiRISE, NAIF/SPICE, original model/mesh and science-source credits. maps/starter-manifest.json records the genuine starter files, byte sizes, SHA-256 and coverage; original provenance files accompany assets. Public distribution is pending a source/data/runtime rights audit. Electron and Cesium third-party licence notices must accompany distributables. No original GGUF model weights were found or invented.

## Independent destination and manual updates

Only https://github.com/SamsDevForge/Local-Mars-Field-Atlas receives desktop development. No runtime Git submodule, reference checkout or website dev server is required by the production viewer. No website deployment, settings or cloud collection was changed. Future updates are explicit reviewed imports from a newly pinned main commit. Local October 30 fixes in D:/Codex/Mars-Latest are context only until individually compared; see LOCAL_CONTEXT_REVIEW.json. Bulk imagery acquisition/preparation remains in hosted Colab/Drive.

## Selective main update — 3 November 2026

The desktop source now selectively incorporates website main commit 571f03b0d38992292e8010ee9616df70416b5287 (2 November 2026, 18:04:47 UTC), five commits and 53 paths beyond the imported baseline. The initial inventory above remains the original baseline record. Partner main is unchanged. Desktop adaptation decisions and per-file source hashes are recorded in docs/WEBSITE_SYNC_20261103.md and docs/verification/website-sync-20261103.json. Only source checks have run for this draft; previous packaged verification does not cover this update.

## Selective main-branch update — 5 November 2026

Website main aed8493b9e0565920b0edbf55416b9b32c67e1e4 and partner main fdfc259599b579d543a97452b1f20149157f5512 were reviewed and selectively integrated. See docs/WEBSITE_SYNC_20261105.md and docs/verification/website-sync-20261105.json for features, retained desktop adapters and source hashes. This is an editable source draft; no tests, builds or releases were run for the sync.

## Main-branch update — 8 November 2026

Website main `828f335097fc406f769ce070f4fc7406eeadf993` is integrated over the previous `aed8493b9e0565920b0edbf55416b9b32c67e1e4` source. It includes personal site markers, independent landing/base evaluation editors, evaluated-site marking, color enhancement, coordinate search and corrected thermal-inertia display coverage. Desktop adapters, session persistence and terrain-safe markers remain. The additional local position API and operator-selected site coordinates are desktop features; see `docs/LOCATION_SYSTEM_API.md`. Source identities are recorded in `docs/verification/website-sync-20261108.json`. No package or Pi installation was made.

## Pyxis desktop sync — 15 November 2026

Source: local website branch `pyxis-fast-map-eva` at `2e34ef7ef4a5b35430eb92ca720e6a24c93fb51a` in `D:/Codex/Mars-Pyxis-GitHub`. Includes the website main merge at `cf36ff8ec2039d9a316140e7bbd9764da9462a0f`. Merged the website changes against the previously integrated `828f335` snapshot, retaining the desktop offline server, map packages, session persistence, site file attachments and external location fixes. Pyxis opens by default in this draft. Vercel deployment and website development-server configuration are outside this desktop sync.
