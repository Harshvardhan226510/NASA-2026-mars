# USGS geology overlay and coordinate grid placement

The Layers menu now offers **USGS geologic map · SIM 3292** among the recommended overlays. It uses the global map by Tanaka et al. (2014), compiled at 1:20,000,000, rather than assigning invented geology colors to imagery. It participates in the existing one-scientific-color-layer selection, opacity, remembered selection, 3D, 2D and overview controls.

## Provenance and interpretation

- Publication: https://doi.org/10.3133/sim3292
- User-supplied reference: https://www.usgs.gov/media/images/geologic-map-mars
- Official unit attributes: https://astrogeology.usgs.gov/pygeoapi/collections/mars/sim3292_global_geologic_map/units/items?f=json&limit=10000&skipGeometry=true&properties=unit,unitdesc
- Official symbol definitions: https://asc-docs.s3.us-west-2.amazonaws.com/pygeoapi/sld/Global_Geology.sld
- Raster presentation: https://tiles.arcgis.com/tiles/nzS0F0zdNLvs7nc8/arcgis/rest/services/Mars_geology_All_layers_100pct/MapServer

The delivery service is an attributed ArcGIS presentation of the USGS map, not a USGS-operated raster endpoint. The menu and attribution identify both. Its 44 unique unit codes were joined to names from 1,311 official USGS attribute records. The key uses the raster renderer's colors so it matches the displayed cartography. Comparison with the official symbol definitions found only rounding differences of at most one value per 8-bit RGB channel; the legend JSON records those differences and source URLs.

Colors identify categories, not a continuous quantity, abundance, mineral reserves, or local ground strength. The collapsible 44-unit key preserves mixed-age units. Raster delivery reaches roughly 1.3 km per pixel; enlarging it does not improve the geological interpretation or original compilation scale. Contacts and ages remain generalized interpretations. This overlay does not infer the unit at the crosshair from blended image pixels and does not enter the routing or site-suitability calculations.

## Geographic delivery

The service uses GCS Mars 2000 (WKID 104971), origin (-180°, +180°), with a square 360° root grid. The atlas uses geographic tiles with origin (-180°, +90°), two 180° root tiles, and no Web Mercator projection. Treating the service as a normal Earth XYZ source would shift latitude by 90°.

For atlas level z >= 1, source level is z + 1, x is unchanged and source y is y + 2^(z-1). Atlas level zero joins the southern half of source level-one row zero and the northern half of row one. Atlas levels stop at five, matching service level six. Root tiles are prepared before installing the layer. Source and assembled images have bounded shared queues and caches; unloaded views cancel their own consumers. The server accepts only validated tile coordinates against the fixed source URL, validates PNG dimensions and completeness markers, coalesces requests, and does not cache failures.

The existing latitude/longitude checkbox and its help/spacing display now sit immediately below Grayscale and Color. Its identifier and layer binding are preserved. The control is outside the list that the compact interface relocates into the deeper labels disclosure.

## Verification

- All 421 JavaScript tests passed, including eight geology tests covering geographic origins, both hemispheres, longitude wrapping, root stitching, all 44 units, catalogue/restoration, control placement, tile composition/cache reuse and proxy validation/retry.
- Production build passed.
- Local HTTP source tiles returned 200 with valid 256 x 256 PNGs from both source rows needed for the western root.
- Browser inspection confirmed the enabled geology layer with colors, contacts and labels on the 3D globe, full 2D map and matching overview. The 44-unit key expanded with the named units. The relocated coordinate grid was toggled on and its adaptive-spacing description appeared directly under the appearance choices.

Browser automation occasionally timed out while dispatching an action; screenshots and refreshed accessibility state were used to establish whether it actually completed. No claim of a general loading-time benchmark is made.
