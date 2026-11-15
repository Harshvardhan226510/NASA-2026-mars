This folder contains small primary-source metadata used by the offline catalogue builder.
It contains no bulk orbital imagery and no Drive credentials.

Rebuild with `python scripts/expand-value-catalog.py` from the repository root.
The builder verifies pinned SHA-256 hashes, merges exact duplicate PDS coordinates,
preserves source row/product IDs, parses GeoPackage polygon geometry, retains
interior anchors outside polygon holes, and produces landing-proximity counts.

Sources:

- NASA PDS OMEGA/CRISM HYDROUS_SITES_GEO_MAP, dataset
  MEX-M-OMEGA-5-DDR-GLOBAL-MAPS-V1.0. The CSV and PDS label are retained verbatim.
  https://pds-geosciences.wustl.edu/mex/mex-m-omega-5-ddr-global-maps-v1/mexomg_2000/data/hydrous/
- Luzzi, Erica; Nodjoumi, Giacomo; Heldmann, Jennifer (2024), Geomorphic maps
  of candidate landing sites in northern Amazonis Planitia, version 1,
  DOI 10.5281/zenodo.13647425, CC BY 4.0. The original author ZIP is retained.
  Derived map polygons preserve author numerical coordinates for AP1/AP8;
  AP9 is converted from its declared 3,396,190 m spherical equirectangular CRS.
  https://zenodo.org/records/13647425
- HiRISE published digital terrain model catalogue: a 1,338-record structured
  metadata snapshot retrieved 15 October 2026 IST. Catalogue centres are rounded
  to 0.1 degrees. Captions identify research targets, not independent mineral assays.
  https://www.uahirise.org/hiwish/maps/dtms.jsp
- Andres & Smith (2025), DOI 10.1029/2024JE008830: nine Phlegra study centres
  are transcribed in the builder; mixed/null sites remain science records.
  https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2024JE008830
- Golombek et al. (2021), LPSC abstract 2420: landing-candidate provenance
  and regional AP9/EM16 ice-study context.
  https://www.hou.usra.edu/meetings/lpsc2021/pdf/2420.pdf

The 36-site historical curated catalogue is preserved as an input, including
its original NASA/ESA/USGS/HiRISE references. Named-feature context comes from
the existing USGS/IAU gazetteer; proximity to a name does not identify deposit extent.

Validation is a source/provenance/coordinate consistency audit. It is not an
independent instrument reanalysis, surveyed registration certificate, ore-reserve
estimate, landing-site selection, life detection, or water-extraction guarantee.
AP1/AP9/EM16/PM1 and secondary AP8 originated in a SpaceX Starship study with
NASA/JPL participation; they are not NASA-selected human landing sites.
Source points and mapped features can describe overlapping investigations.
Their counts must not be interpreted as independent deposits or reserves.

Generated public outputs:

- `value-sites.json`: evidence-labelled catalogue and mapped feature polygons.
- `value-site-research.json`: source hashes, record totals and landing-radius audit.
- `value-preparation-plan.json`: prioritized nearby/wider imagery-audit backlog.
  It does not enable automatic downloads or replace the running archive queue.

The source table does not provide species/grade for generic hydrated mineral
occurrences. There are no invented metal, uranium, forest or confirmed-life pins.
Unavailable newer MOCAAS metadata was not imported. Image footprints do not
prove valid pixels or precise registration; high-resolution preparation is separate.
