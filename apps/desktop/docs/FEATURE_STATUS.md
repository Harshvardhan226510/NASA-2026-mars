# Feature and source classification

| Feature | Desktop source/behavior | Verified scope / remaining work |
| --- | --- | --- |
| Global 2D / 3D / Compare | Bundled original CTX/Viking imagery, MOLA and local Cesium/Leaflet | Windows viewer smoke; coarse coverage labels retained |
| Native regional imagery/terrain | Verified local COG package or original online providers | Genuine Arcadia overview fixture, byte ranges, photographic variation, elevation/missing values, activation |
| Science/mineral/geology/magnetic/reference overlays | Original bundled catalogues and reference grids | Existing regression tests; source windows remain research regions, not deposit boundaries |
| Solar geometry | Original in-browser Mars24 analytical equations | Preserved original tests; modeled geometry, not observed weather |
| Route planning | Original three-profile Python implementation, sampled installed terrain | All original scientific tests and compiled-service summary comparison; coarse grids cannot clear obstacles |
| Mission planning/equipment/measurements | Original frontend workflows and local browser storage | Modules retained; full manual workflow/export/upgrade campaign remains pending |
| Surface spacecraft | Dated bundled bootstrap offline; source API online | Historical label and dates retained; no automatic offline odometer fetch |
| Phobos/Deimos | Private SPICE MAR099 engine and bundled kernels | Exact original packet comparison, 2025–2035 coverage; packaged-service smoke |
| Orbiting spacecraft | Original dated source API contracts | Online source availability required by production dispatch; offline series adapter pending |
| Wind/environment/space weather | Original source APIs and reference release data | Offline unavailable responses; no fabricated current data or forecast |
| ARES deterministic commands | Original frontend commands plus validated directives | Existing assistant tests; coordinates and route profiles validated |
| ARES neural | Private offline llama.cpp + explicitly installed GGUF | Real official-base and supplied Q8 inference through the app; training provenance partly unverified |
| Voice | Bundled private English STT; optional separate native Piper output pack | Native WAV/recognition checks on both targets and controlled Windows microphone test passed; physical audio acceptance pending |
| More maps | Folder import; controlled HTTPS/public Drive download | Real Drive resume and checksum tests; curated catalogue, archive/OAuth flows incomplete |
| Packaging | Windows NSIS; native Bookworm ARM64 CI | Consult TEST_REPORT.md for actual artifacts; 0.1.1 Pi first rendering passed; new-version physical acceptance and clean-VM campaign pending |

## Current 0.2.0 verification

Map Manager geometry/appearance, dead-reckoning behaviors and voice boundaries have automated coverage. Windows source interaction passed for the new site panel, map controls, manual anchor/10 m motion/Pause, optional voice setup, controlled microphone transcription and supplied Q8 response. Native package acceptance is tracked in [TEST_REPORT.md](../TEST_REPORT.md); retained historical 0.1.1 results do not imply new-version physical-device validation.

Both dead-reckoning input contracts are present: app-side calibrated motion/encoders/steps, or gear-computed Mars positions. Live device transport and raw accelerometer/gyro fusion await the prototype and calibration contract. See [DEAD_RECKONING.md](DEAD_RECKONING.md).
