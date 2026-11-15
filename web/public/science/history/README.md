# Historical source display assets

`dust/index.json` describes 2,488 **source array frames**, not necessarily 2,488
distinct observed days. MDAD v1.1 repeats some day labels for empty slots.
The frame ID therefore includes the native array index. Its PNG retains every
native byte at 3,600 × 1,801 nodes: north to south, west to east; longitude
−180° through +179.9°, latitude +90° through −90°, 0.1° spacing.

Zero: no outlined storm in an observed source pixel. Values 1–250: native
member codes (134–250 are split-member codes, not literal member numbers).
255: missing observation. An entirely zero source frame has unverified
observation coverage and is flagged `empty_source_mask`; it is not interpreted
as a clear global observation. Source pixels are not interpolated into new
storm detections. PNG checksums are verified before display.

Source: Battalio, Wang, Richardson, Toigo & Saidel, MDAD v1.1 (2022),
https://doi.org/10.5281/zenodo.7480334, CC BY 4.0. The publisher's five tar
checksums and additional SHA-256 hashes are recorded in the index. The
preparation script verifies publisher checksums, grid coordinates, source
categories and the lossless PNG representation. Verified prior derivatives
may be reused when preparing again.

`rems-uv.json` contains quarter-hour local-mean-solar-time summaries of all
724,717 records in the retrieved NASA PDS `REMS_UVS_3401_3500.TAB` product.
Actual rows cover sols **3401–3423**; the wider filename and XML label date
bounds are retained separately and never presented as observed coverage.
Each band keeps valid counts, mean, observed minimum/maximum and the
range/count of published systematic uncertainties. No √N reduction or
overlapping-band addition is applied. Missing values remain null.

REMS archive instrument definitions specify A:315–370, B:280–320,
C:220–280, ABC:200–370, D:230–290 and E:300–350 nm. These are instrument
bands, not silently substituted standard bands. The three requested A/B/C
views show a **local, historical** environment at Curiosity; no global or
current irradiance map is implied. Original response/label/definition hashes,
source links, aggregation and limitations are included.
