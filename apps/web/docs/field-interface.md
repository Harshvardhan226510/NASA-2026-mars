# Field tablet interface (experimental branch)

Open `?ui=field&graphics=compatible`. Orbit (`?ui=orbit`) and Horizon retain their existing navigation and styles. The original running site on port 8770 is not modified; this checkout uses port 8772 via `MARS_PORT`.

The five main tools are Explore, Layers, Plan, Routes and Measure. Plan has visible Tasks and Environment & science categories, retaining site evaluation, hardware placement, Marswalk, saved missions, sunlight, Dust ML and Seismic Lab. Mars system stays in the header. An original SVG astronaut button opens the existing ARES assistant, including its conversation, voice controls and command guide.

Field adds location-selection guidance and full-width evaluation buttons. Candidate name/coordinates and picking actions precede expandable footprint/terrain/scoring settings. Existing form inputs and handlers are retained and moved, rather than recreated. Scores, model inputs, validators, map-picking behavior and scientific algorithms are unchanged.

The bottom coordinate/imagery strip expands with Details. Drawers, overview and altitude reserve additional space when it expands. Map & data occupies its own inspection area and closes the active tool drawer. The introduction is removed after pointer, wheel or keyboard interaction on either map. Focus-map controls, visible focus rings, guide, search shortcut, Escape behavior and the Surface/System switch remain available.

Implementation is isolated in `interface-field.js` and scoped `interface-field.css`, called only for the Field query parameter. The only shared UI edit is that conditional initializer; the development server also accepts an optional port. No routing, terrain, collector, evaluation or assistant logic is changed.

Original Orbit snapshot: `archive/orbit-before-field-20261108` at `da55c34`. Experimental branch: `codex/field-tablet-ui-20261108`.
