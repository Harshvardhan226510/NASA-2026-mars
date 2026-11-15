# Mars Field Atlas: expanded research catalogue

The map contains **2,494 research records**:
522 science, 1,912 mineral occurrences / investigation targets, and 60 crew-resource candidates.
This replaces the previous 36-record catalogue. Counts represent source-linked investigations,
including individual mapped landforms; nearby records can refer to overlapping geology.

The first priority is the five existing landing-study surroundings, with selectable
100 km and 300 km radii. They are published Starship study candidates with NASA/JPL
participation, not NASA-selected human landing sites or an official likelihood ranking.

| Study centre | Science within 100 km | Minerals within 100 km | Resources within 100 km |
|---|---:|---:|---:|
| AP1 | 354 | 0 | 26 |
| AP9 | 128 | 0 | 23 |
| AP8 | 313 | 0 | 19 |
| EM16 | 4 | 0 | 1 |
| PM1 | 3 | 0 | 1 |

These circles overlap, so rows must not be summed as unique worldwide locations.
No supported mineral-occurrence point was found in the imported catalogues within those
100 km circles. Empty results do not establish absence of minerals. We have not invented
local metal or nuclear-fuel deposits to fill the gap.

The expansion uses:

- NASA PDS OMEGA/CRISM data: 1,855 source rows become 1,847 coordinate anchors after
  exact duplicate coordinates are merged. Original row numbers and observation IDs survive.
  Species, concentration, ore grade and deposit extent are unspecified in this point product.
  [NASA PDS product definition](https://pds-geosciences.wustl.edu/mex/mex-m-omega-5-ddr-global-maps-v1/mexomg_2000/data/hydrous/hydrous_sites_geo_map.lbl)
- 377 author-mapped AP1/AP8/AP9 geomorphic features, including 24 pingo-like targets.
  Polygons and interior anchors are imported from the published map files. Pingo-like
  morphology is an unconfirmed ice prospect, not a measured water reserve.
  [Luzzi, Nodjoumi & Heldmann maps, CC BY 4.0](https://zenodo.org/records/13647425)
- 223 additional deduplicated HiRISE terrain research targets, selected from a 1,338-product
  catalogue. Image-centre coordinates are approximate; product publication does not mean
  the imagery is prepared for this website.
  [HiRISE terrain catalogue](https://www.uahirise.org/hiwish/maps/dtms.jsp)
- Nine Phlegra radar-study centres: seven resource assessments and two mixed/null science
  records. The main radar-supported LDA is about 28 km from PM1.
  [Andres & Smith, 2025](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2024JE008830)
- Regional AP9 and EM16 ice-study prospects.
  [Golombek et al., LPSC 2021](https://www.hou.usra.edu/meetings/lpsc2021/pdf/2420.pdf)

Use **Explore → Sites of value → Landing-study priority**. Category, radius, evidence and
text filters can be combined. Each pin has its evidence, coordinate basis, source record,
nearby landing-study distances and independent image-availability label. Results are paged;
2D markers cluster by category and viewport. 3D ground perimeters are created only nearby.
Regions keep their separate diamond markers.

Validation checks source hashes, every imported spectral row and observation ID,
coordinate bounds, duplicate rows, polygon rings/holes, interior anchors, AP9 projection,
landing-distance filters, evidence classes and report totals. Numerical source-map/HiRISE
footprint comparisons detect gross frame mistakes; absolute survey registration is not certified.
Instrument findings, mapped morphology, imaging targets and mixed/null results remain distinct.
No confirmed life, ancient forests, mineable ore grade or ready-to-use water is asserted.

This update adds metadata and perimeters. It does **not** make all new windows high resolution.
The existing prepared imagery remains available; new targets are recorded in an imagery-audit /
preparation backlog. [Research audit](value-site-research.json) and
[prioritized preparation backlog](value-preparation-plan.json) are downloadable.
Bulk imagery still belongs in cloud storage, never on the personal SSD.
