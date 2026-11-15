# Large measurement previews

Hover snapping projects pins using heights already loaded by the globe. It no longer calls `Scene.sampleHeight` for each pin on pointer movement. That API performs an offscreen pick render and temporarily replaces scene view/depth state; a failed pick can leave the main renderer using the pick view. Hover projection does not need that work because measurement pins clamp to the same globe terrain.

Distance and preview lines are divided into separate visit-to-visit legs. Each leg is sampled on the Mars reference sphere with input edges at most five degrees long before passing to Cesium ground geometry. This avoids ambiguous near-antipodal input and 180-degree joins on return visits. Edges shorter than the existing 0.1 m placement tolerance are omitted from display geometry. Stored coordinates and pin numbering are unchanged.

The 2D path uses the same spherical arc interpolation. Distances use an `atan2` unit-vector calculation, which retains accuracy near both coincident and antipodal positions. Area still rejects ambiguous half-world boundaries and crossing edges.

Regression cases include the reported 6,495.67 km line at its original coordinate precision, date-line and polar paths, exact and near-antipodal points, endpoint snapping, return legs, and a hover projection whose offscreen-pick function throws if invoked. Application checks: 121 JavaScript tests and the production build pass.
