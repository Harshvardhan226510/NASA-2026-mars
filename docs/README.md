# 📚 Pyxis Mission Documentation & Technical Specifications

> **NASA Space Apps Challenge 2026** — *Interplanetary Survival Guide: Martian Map*  
> Complete technical reference, algorithmic specifications, scientific datasets, and mission architecture dossiers.

---

## 📑 Documentation Index

| Document | Focus Domain | Key Topics Covered |
| :--- | :--- | :--- |
| **[System Architecture & Tech Stack](./PROJECT_ARCHITECTURE_AND_TECHNOLOGY_STACK.md)** | Full-Stack Architecture | Complete hardware specifications, offline data pipeline, multi-threaded rendering engine, and telemetry integration. |
| **[Skyline Visual Place Recognition (Skyline-VPR)](./SKYLINE_VPR.md)** | Autonomous Navigation | Mathematical formulation of unconstrained horizon-profile extraction, synthetic DEM ray-marching, and celestial heading alignment. |
| **[ARES / TARS Model Specifications](./ARES_MODEL_SPECIFICATIONS.md)** | Edge AI & SLM Architecture | Fine-tuning dataset provenance, LoRA hyperparameters, 4-bit/8-bit GGUF quantization benchmarks, and deterministic safety grounding. |

---

## 📐 Scientific & Mathematical Assets

The `docs/` directory also maintains verified technical graphics and visualization assets used in mission briefings:

* **Minetti Metabolic Cost Formulations**:
  * [`minetti_equation_styled.png`](./minetti_equation_styled.png) — Transparent high-resolution render of the 5th-order metabolic work equation.
  * [`minetti_equation_white.png`](./minetti_equation_white.png) — Clean high-contrast white vector formulation for dark tactical HUD displays.
* **Procedural 3D Base Infrastructure Showcases**:
  * [`real_project_models_showcase.png`](./real_project_models_showcase.png) — Technical specification sheet of all 4 primary base infrastructure `.glb` assets (Habitat Core, Greenhouse Dome, Pressurized Rover, UltraFlex PV Array) with physical power, mass, and ECLSS ratings.
  * [`real_project_base_scene.png`](./real_project_base_scene.png) — Real-time Cesium 3D surface view showing a fully operational deployed tactical research station clamped to the terrain of Melas Chasma.

---

## 🔬 Scientific Data Provenance Summary

All physical algorithms and overlays documented here are strictly grounded in peer-reviewed planetary science and authentic NASA Planetary Data System (PDS) archives:

1. **Elevation Topography**: NASA MOLA (Mars Orbiter Laser Altimeter) 128 ppd aeroid datum combined with ESA HRSC / NASA CTX (~5 m/pixel) digital elevation models.
2. **Atmospheric & Solar Engine**: NASA GISS Mars24 analytical solar ephemeris (Allison & McEwen 2000, 2025 revision) and Martian barometric scale-height formulations ($H \approx 11.1\text{ km}$).
3. **Celestial Mechanics**: NASA/JPL Navigation and Ancillary Information Facility (NAIF) SPICE `MAR099` planetary ephemeris kernel for Phobos, Deimos, and active orbiters (MRO, Mars Express, Mars Odyssey).
4. **Crustal Magnetic Field**: Langlais et al. (2019) 110-degree spherical harmonic model of Martian remnant crustal magnetization.
5. **Geological Context**: USGS Scientific Investigations Map 3292 (*Geologic Map of Mars* by Tanaka et al.).
6. **Seismology & Interior**: NASA InSight SEIS mission seismic event catalog (VBB and SP sensors, Marsquake Service MQS data release 14).
7. **Wind & Atmospheric Dynamics**: Ensemble Mars Atmosphere Reanalysis System (EMARS) reanalysis and XGBoost surface shear stress modeling.
