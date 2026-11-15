# Coherent globe rendering

The globe previously showed individual imagery and elevation tiles replacing their parents independently. At whole-planet scales this exposed rectangular changes while loading. Optical gap brightness balancing also used regional references that could change with tile level.

The globe now starts with one fixed, complete CTX/Viking photographic overview. Both hemispheres load together. One camera-height policy fades the whole view into detailed imagery from 3,200 km to 1,200 km; 2D uses the same principle between zoom levels 3 and 5. Prepared HiRISE observations continue to load at close range.

Elevation colors use a complete measured MOLA overview at planet scale and transition into the existing HRSC/MOLA detail. Both use the same fixed height palette. Overlay opacity remains constant during the transition. The legend identifies the coarser overview grid rather than implying native detail at every scale.

Optical gap brightness uses one bounded, longitude-periodic global reference shared by all tile levels and both viewers. Only source-alpha gaps receive Viking photographic context; dark terrain and shadows are not classified as missing. Genuine photographic boundaries and differences in source resolution can remain; this change does not synthesize terrain or claim to eliminate every seam in the source mosaic.

## Display assets and reproducibility

- Two grayscale overview images: 4096 × 2048 combined, approximately 5.2 km equatorial sampling, 3.34 MB total.
- Global optical tone reference: approximately 151 kB, corrections limited to ±64 display levels.
- `public/globe-overview-provenance.json` records 64 source display tiles and SHA-256 digests. Acquisition originals and scientific elevation arrays are unchanged.

To regenerate with Node, Python, NumPy and Pillow installed, choose a temporary input directory outside the published app:

```sh
node tools/fetch-globe-overview.mjs /path/to/temporary-inputs
python tools/build-globe-overview.py /path/to/temporary-inputs
npm test
npm run build
```

The overview is a small presentation asset, not a compiled replacement for the distributed archive. Regional sources still stream on demand.
