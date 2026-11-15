# Third-party notices and rights review

This desktop copy retains the original routing authorship, NASA/JPL/MSSS, Caltech Murray Lab, Viking, MOLA, NAIF/SPICE, mesh and scientific data credits. See UPSTREAM.md, web/ROUTING.md, web/routing/upstream-source.json, source provenance files and maps/starter-manifest.json. No standalone upstream source licence was present; this notice does not grant redistribution rights. Public release remains pending rights clearance.

Electron's LICENSE and LICENSES.chromium.html accompany the executable. Locally copied Cesium assets include LICENSE.md, ThirdParty.json and ThirdParty.extra.json in vendor/cesium. The private llama.cpp runtime includes the pinned MIT LLAMA_LICENSE.txt and BUILD_MANIFEST.json. Private scientific dependencies retain their distribution metadata/licences; build-python.mjs also copies Python, NumPy, SpiceyPy and PyInstaller notices into runtime/mars-science/NOTICES where supplied by the installed distributions. The original SPICE kernel provenance accompanies scientific data; check NAIF terms independently before release.

Other retained frontend/service dependencies include Leaflet, OpenLayers, GeoTIFF.js, proj4, lerc and their transitive dependencies. Package lockfiles identify versions; preserve their upstream licences and complete the release bill of materials. This file is an engineering inventory, not a completed legal audit.

The optional official Qwen base weights are not shipped in the installer. Their approved source catalogue records the publisher's Apache 2.0 licence, pinned revision, size and checksum. User-imported model/map rights are not inferred from successful hash validation. The supplied Mars Q8 has a recorded checksum and passed local runtime checks; its training and redistribution provenance remains partly unverified. The Q8 is not attached to the release.

## Bundled offline speech input in 0.2.0

whisper.cpp v1.9.5 (MIT) and tiny.en converted Whisper model (publisher MIT) are pinned in runtime/speech-config.json. The explicit preparation recipe retains engine/model licences and the model card. The 0.2.0 app bundles both; the historical v0.1.1 app did not. See [ARES setup](ARES_LOCAL_SETUP.md).

## Optional offline spoken replies in 0.2.0

Piper 1.8.0 (GPL-3.0), its private dependencies and the English LJ Speech medium voice are a separate optional component. They are not added to the base app installer. The build recipe retains source distributions, wrapper source, dependency/Python notices and the voice model card. Pinned identities and the tested native pack procedure are documented in docs/ARES_OPTIONAL_VOICE.md.
