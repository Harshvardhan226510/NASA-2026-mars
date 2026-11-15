# Ground-mode sky

Ground mode's movement panel includes **Simulate sky**, enabled on first use. The checkbox preference is remembered in this browser. Leaving ground mode, entering 2D or exploring the Mars system restores the previous background.

The sky uses the same `marsSun`/`solarAt` analytical solar geometry and selected **Sunlight** time as the existing lighting controls. Daylight has warm dust tones, twilight has a blue glow near the Sun, and night reveals a deterministic illustrative starfield. This is a visual simulation, not measured weather, atmospheric radiative transfer, or an astronomical navigation chart. It does not change terrain measurements, route costs, resource evidence or dust forecasts.

The six cube faces are generated locally without texture downloads. Smooth color gradients use 128-square samples; stars are drawn separately at 512-square texture resolution. Texture regeneration is limited to minute or half-degree position changes and explicit preference changes. Sky directions are converted to Cesium's TEME frame, with the canvas Y axis matched to Cesium's cube-map upload convention.

Color inspiration: [NASA: sunrise and sunset on Mars](https://science.nasa.gov/solar-system/planets/mars/what-does-a-sunrise-sunset-look-like-on-mars/). Rendering conventions: [Cesium SkyBox](https://cesium.com/learn/cesiumjs/ref-doc/SkyBox.html) and the [official cube-map implementation](https://github.com/CesiumGS/cesium/blob/1.145/packages/engine/Source/Renderer/CubeMap.js).

Validation checks cube-face continuity, bounded colors, daylight/night contrast, star visibility and deterministic unit-vector star positions. Browser checks cover day/night time presets, switching the sky off/on and leaving ground mode.
