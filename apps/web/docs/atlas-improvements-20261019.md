# Delivery, color context, route profiles and missions

This release implements the five improvements approved on 19 October 2026.

## Display delivery

Eighteen version-matched display packets cover overviews and centre-neighbour
detail in the seven published HiRISE observations. They retain the canonical
129 × 129 source-height grid and 512 × 512 grayscale/alpha photograph. They are
precompressed, content-addressed static assets on the website CDN. An updated
catalogue version bypasses old packets. Absent or damaged prepared packets use
the existing bounded Drive renderer. This is a small display working set,
not a new full-resolution planetary mosaic.

`tools/prepare-display.mjs <map-origin>` refreshes that set. The manifest records
encoded hashes, sizes and image/terrain sampling. Visible requests share the
existing queue; after a stable close view, at most two nearby packets can be
prefetched, and abandoned prefetches are cancelled.

A service worker retains public planet/surface/elevation tiles in a bounded
96 MiB / 512-entry browser cache for up to 30 days, keyed by their full versioned
URL. It does not cache authentication, raw Drive reads, catalogues, weather or
other changing feeds. Browser eviction and unavailable storage fall back to
normal delivery. This does not claim the complete application works offline.

If an uncached fine HiRISE transfer fails, the imagery provider now resolves to
the finest containing image already loaded from that observation, or its
prepared overview. Geographic crop, source alpha and actual sampling are retained.
A successful measured fallback does not raise a map-error banner or claim the
requested finer resolution. Missing all measured alternatives still reports an
error. A controlled outage test exercises this path through the imagery provider.

## Seam checks

Global elevation tiles already undergo an independent measured-MOLA audit.
The audit now also checks all four edges: a nearly unanimous edge residual
over 3 km rejects a narrow corrupt border even when the whole-tile median is
normal. Isolated peaks/craters remain valid. Rejected tiles retain measured
parents or the labelled coarse MOLA reference; heights are never shifted to
hide a seam. Regression checks retain the real Sacra/Olympus damaged source
fixtures, masks, genuine dark shadows, parent crops and shared gap-tone fields.
Publisher illumination changes and source registration differences can remain.

## Color appearance

Layers now offers Grayscale and Color. The initial color view uses the NASA
Ames/USGS colorized Viking MDIM 2.1 mosaic distributed by NASA Trek. Its
photographic base is approximately 232 m; its chromatic detail is coarser.
It is explicitly described as colorized context, not native high-resolution RGB.
The fixed overview preserves the publisher RGB from 128 checked geographic
tiles, without a synthetic recoloring operation. Zoom-dependent refinement is
uniform across the view. Scientific overlays remain above it.

Source: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
Product: `Mars_Viking_MDIM21_ClrMosaic_global_232m`.
`public/color-context-provenance.json` retains source URLs, hashes, coordinate
conventions and the two overview hashes. Photography and terrain resolution
remain separate. Grayscale HiRISE photographs are hidden in Color mode; their
prepared DEM can still supply local terrain.

**Collected Account 2/3 HiRISE enhanced-color originals are not yet published.**
They still need verified publisher band mapping, Mars georeferencing, valid
masks, prepared range-readable assets and account-aware delivery credentials,
as specified in `pipelines/color-archive/catalogue-contract.md`. No raw archive
is presented as ready RGB, no collector is interrupted, and no extra Drive
permissions are granted by this release.

## Route profiles

The original partner A*, APF and checkpoint-order algorithms remain unchanged.
After planning, the adapter samples the returned corridor centreline using its
measured DEM cells. Each successful profile has an elevation chart, signed
along-route slope chart, climb/descent, steeper-sample count, source sampling,
profile interval and known-height percentage. Hover or arrow-key selection
highlights that sample in 3D, 2D and the inset. No additional DEM download is
needed to inspect the charts. Data exports retain the sampled profile.

Heights exclude visual relief exaggeration. Profile climb can differ from the
partner's simplified-waypoint telemetry because intermediate relief is now
sampled. The card shows the profile climb; original engine telemetry remains
in its exported result. Very long profiles use bounded sample spacing, which
is disclosed. Older saved results without dense samples use saved waypoints
and are labelled accordingly. These graphs do not certify terrain safety.

## Missions

Missions saves measurements (including repeated pin visits), route endpoints,
priorities, mission settings, calculated profiles, layer selection/tints,
appearance, viewpoint, 2D scale, view mode and selected place/spacecraft.
The current session is saved automatically. Reloading the same region or
spacecraft restores it; following a different place link honours that link.
Drawing and calculation never restart automatically.

Named browser saves, JSON file download/import and compressed mission links
are supported. Imports are bounded to 2 MB and validate coordinates, heights,
camera values and geometry counts before touching the map. Decompressed links
have the same bound. A link over 60,000 encoded characters requests a complete
mission-file export instead. A link includes mission data in its fragment;
anyone holding it can read that data. No user account or external mission
database is required. Browser storage can be cleared or fill up, so a downloaded
file is the portable backup. Saved results retain their original sources and
must be explicitly recalculated to use newly available terrain.

## Verification

Tests cover original-engine fidelity, profile relief between simplified
waypoints, source masks/digests, corrupt narrow borders, a network outage in the
public tile cache, version separation, mission round-trips and malformed input.
Browser checks additionally exercise three real Jezero routes, keyboard-linked
profile inspection, color appearance, named saves, reload and shared links.
