# Sun distance and apparent size

Previously the visual Sun was a fixed 64-pixel icon placed 60,000 km from Mars. The sunlight calculation used Mars24's solar direction and distance, but the displayed object did not share that distance or a physical diameter.

The displayed Sun now uses Mars24's calculated Mars-centred vector and distance in metres, with no compressed orbit distance and no Mars radius added as altitude. Its nominal diameter is 1,391,400 km, using the IAU 2015 B3 nominal solar radius of 695,700 km. The astronomical unit is 149,597,870,700 m. The existing lighting switch, time calculation, solar irradiance and terrain shadow settings are preserved.

The Mars system menu includes **Enlarge Sun** beside the moon-enlargement control. It defaults to on and remembers an explicit off choice. Enlarged mode restores the original 64 x 64 screen-pixel sprite, including its original white core and glow, while retaining the same calculated Sun position. Disabling it restores physical apparent size. This is a display option throughout the atlas, independent of the sunlight visibility switch. It does not rescale the solar irradiance, direction, route calculations or camera distance. The menu and Sunlight panel identify enlargement as a display aid.

In physical mode, the visible disk fills a 256-pixel texture, drawn in world metres through Cesium's `sizeInMeters` and scale. This keeps texture dimensions inside Cesium's compressed attribute limits. Physical mode has no fixed screen-pixel enlargement or oversized glow. The disk is a camera-facing visual representation, not a resolved solar atmosphere or a navigable stellar surface. Its physical angular size follows diameter and observer distance; Mars24 remains an analytical model rather than a JPL Sun ephemeris.

The Sun has a dedicated data source so its astronomical bounding volume and scale do not affect map-pin billboard collections. Only the camera far plane is extended enough to include the actual Sun, with a small margin; the near plane is unchanged. Disabling sunlight restores the prior far plane unless another feature has subsequently changed it. Depth testing stays enabled, allowing Mars and foreground terrain to hide the Sun.

Sunlight controls show physical diameter, the calculated distance in millions of kilometres, and the apparent diameter as seen from Mars. At the manual check's fixed time, 2026-11-03 00:00 UTC, the model gives approximately 238.8 million km and 0.334°. Over Mars's orbit, the expected angular diameter is roughly 0.32–0.39°.

## Verification

- All 426 JavaScript tests and production build passed. Checks cover metre/AU conversion, centre-to-centre distance, direction, seasonal angular size, invalid values, actual renderer configuration, depth testing, safe texture dimensions, far-plane restoration and displayed units. Enlargement checks cover default-on and saved-off preferences, placement in the system menu, the original sprite dimensions and glow, restoration of physical sizing, and unchanged position/light/far plane during toggles.
- Live atlas verification confirmed Enlarge Sun was checked by default in the Mars system menu. Switching it off changed the explanation to physical apparent size; switching it back on restored the enlargement explanation. The test left enlargement enabled. Screenshot: `sun-enlarge-menu.png` in the local project evidence folder.
- Manual GPU verification uses the production `SolarLighting` class and Cesium 1.145: open `/tests/manual/sun-render-check.html` on the development server. At 1280 x 720, the normal 60° view produced a visible disc approximately 6.46 pixels wide. A 1° optical camera produced about 427.31 pixels without altering the Sun's dimensions or location. The Behind Mars view hid the Sun completely. Screenshots captured the rendered result in all three views; no render error appeared.
- The main atlas Sunlight panel was inspected after the change; its UI inspection caught and led to fixing the millions-of-kilometres label conversion. Browser input intermittently timed out; the isolated scene provided direct verification of the actual production Sun renderer without imagery downloads or moving the user's map around further.

## Primary sources

- NASA GISS Mars24 algorithms (distance and solar direction): https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
- IAU 2015 Resolution B3 (nominal solar radius; references the IAU astronomical-unit definition): https://arxiv.org/abs/1510.07674
- Cesium billboard world-size option: https://cesium.com/learn/cesiumjs/ref-doc/BillboardGraphics.html#sizeInMeters
