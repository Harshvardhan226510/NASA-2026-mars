# Consistent tool presentation

The shared presentation rules at the end of `src/interface.css` extend the existing Atlas font, mint accent and slate surfaces to the tools that previously used independent styling.

## Visible changes

- Plan Mission, its target cards, equipment catalogue, placement controls, base-operation cards and telemetry labels use the same font stack, heading scale, button shapes and selection treatment as the surrounding interface. General decoration no longer uses the caution color. Numeric values keep tabular alignment without a separate monospace font.
- Dust ML, Seismic Lab and Sunlight share field, button, heading and card styling. Older science drawers adopt the shared desktop placement and mobile bottom sheet. The light-layout Plan Mission drawer aligns with its inspector instead of overlapping navigation.
- Site evaluation and My sites follow the same surface and control tokens when those features are present. The selectors also work on the original main without requiring those newer features.
- Focus rings remain visible. Selected tabs and cards retain their existing state attributes/classes. Status badges keep success/caution/warning distinctions with palette-appropriate contrast. Reduced-motion preferences suppress decorative button/card motion.

Dark and existing light layouts use their own text, surface and accent tokens. No external font download is introduced. Equipment illustrations, map pins, routes, scientific ramps, waveform colors, hazard meanings and progress values retain their existing data-driven styling.

## Scope and validation

Only this document and `src/interface.css` change in the upstream PR. No JavaScript, markup templates, data files, model calculations, event handlers or API code change. Drawer placement is CSS presentation; tool actions and state transitions remain the existing implementation.

Validation: all 366 JavaScript tests pass on the original-main checkout; all 436 pass on the current private version. Production builds pass. Browser review covers Plan Mission target/equipment tabs, Dust ML and Seismic Lab, the existing seismic filter state transition, light-layout drawer placement, selected/unselected target contrast and inherited typography. The same stylesheet is used in the local website and both Git checkouts.
