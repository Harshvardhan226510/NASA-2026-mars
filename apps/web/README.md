# 🚀 Pyxis Web Atlas & Tactical Mission Cockpit

> **High-Performance 3D Planetary Exploration & EVA Operations Interface**  
> NASA Space Apps Challenge 2026 — *Interplanetary Survival Guide: Martian Map*

---

## 📌 Executive Overview

`apps/web/` is the core visual and interactive command center of **Pyxis**. It provides astronauts, mission planners, and rover operators with an edge-ready, browser-based command suite for navigating the Martian surface, evaluating terrain hazards, planning bioenergetic traverses, deploying base equipment, and conducting geological field surveys.

The application is engineered for **100% offline operation** at the edge (in rover cockpits, habitat base stations, or EVA spacesuit heads-up displays) without requiring internet connectivity to Earth.

---

## 🏗️ Technology Architecture & Core Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PYXIS COCKPIT UI & HUD                         │
│   (Synchronized 3D Globe · 2D Tactical Map · Split Compare Mode)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐
│  3D CesiumJS Engine  ││  Leaflet 2D Engine   ││ TARS Offline Voice   │
│  - Multi-res DEMs    ││  - Graticule grid    ││  - Web Speech / VAD  │
│  - PBR glTF Clamping ││  - Context overlays  ││  - Hybrid RAG Vector │
│  - 3D Solar Raytrace ││  - Waypoint markers  ││  - Local GGUF SLM    │
└──────────┬───────────┘└──────────┬───────────┘└──────────┬───────────┘
           │                       │                       │
           └───────────────────────┼───────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   LOCAL EDGE SERVICE WORKERS & DAEMONS                 │
│  SPICE Ephemeris (MAR099) · Mars24 Solar · Minetti Bioenergetics Solver│
└────────────────────────────────────────────────────────────────────────┘
```

* **Core Rendering**: Modern vanilla ES Modules (zero heavyweight frontend frameworks for instant, stutter-free 60 FPS performance).
* **3D Planetary Globe**: CesiumJS with custom Martian triaxial ellipsoid parameters ($a=3396.19\text{ km}, b=3376.20\text{ km}$), clamped-to-ground primitives, and dynamic horizon culling.
* **2D Tactical Map**: Leaflet engine synchronized bidirectionally with the 3D camera for situational awareness and footprint overviews.
* **Local Backend Service**: Node.js `dev-server.mjs` providing local REST APIs for terrain raster streaming, Python routing bridges, SPICE ephemerides, and offline AI inference.
* **Build Pipeline**: Vite 8 with Rollup asset code-splitting and WebAssembly LERC/ZSTD compression decoders.

---

## 🌟 Key Functional Capabilities

### 1. Multi-Resolution Terrain Engine
* Streams sub-meter **HiRISE** (~0.25 m/px optical, ~1 m DEM), **CTX** (~5 m/px), and **HRSC/MOLA** elevation grids.
* Offline fallback ensures that when fine observation strips end, global Viking MDIM 2.1 colorized mosaics and MOLA topography seamlessly fill the surrounding terrain without rendering gaps or crashes.

### 2. Bioenergetic Route Planner
* Evaluates terrain slopes along candidate paths using the **Minetti Metabolic Cost Model** ($W = m_{\text{total}} \cdot g_{\text{Mars}} \cdot d \cdot \varphi(\theta)$).
* Offers 3 simultaneous navigation strategies: `Direct/Safe`, `APF Survey`, and `Deep-Science Sampling`.
* Computes Traverse Risk Index (TRI: 0–100%), enforces the NASA 1/3 walk-back reserve margin, and provides interactive elevation profile cross-sections.

### 3. Mars Skyline Visual Place Recognition (Skyline-VPR)
* Solves the "kidnapped astronaut / lost rover" problem in GNSS-denied environments.
* Extracts the 360° horizon profile from a camera capture, compares it against synthetic DEM ray-marched horizon signatures, and resolves exact position and celestial heading without active radio beacons.

### 4. Interactive 3D Equipment Workbench (`mission-deployer.js`)
* Astronauts deploy authentic NASA hardware directly onto the 3D surface across 4 curated sites: **Valles Marineris (Candor Chasma)**, **Gale Crater (Mount Sharp)**, **Jezero Crater (Delta)**, and **Arcadia Planitia (Site AP-1)**.
* Hardware includes UltraFlex solar arrays, comms towers, InSight SEIS seismometers, weather stations, habitat cores, greenhouse biodomes, rovers, and Sabatier ISRU plants.
* Generates live validated physical telemetry: instantaneous solar flux ($\text{W/m}^2$), diurnal yield ($\text{kWh/sol}$), LOS comms horizons ($\text{km}$), cradle leveling limits ($15^\circ$), and ECLSS oxygen/water balances.

### 5. NASA/JPL SPICE Ephemerides & Mars24 Solar Lighting
* Calculates high-precision orbital coordinates for **Phobos** and **Deimos** using the NAIF `MAR099` SPICE planetary kernel.
* Implements the **NASA GISS Mars24 analytical solar model** (Allison & McEwen), rendering accurate Local True Solar Time (LTST), sub-solar coordinates, and real-time 3D canyon wall shadow occlusions.

### 6. Layered Planetary Science Overlays
* **Langlais 2019 Crustal Magnetism**: 110-degree spherical harmonic model of Martian remnant crustal magnetic anomalies.
* **USGS SIM 3292 Geology**: Complete digitized geological formations and stratigraphic units across the Martian globe.
* **NASA InSight Seismology**: Active epicenter plotting, epicentral distances, and interior velocity structures.
* **EMARS Wind & Dust**: Surface wind vector stream particles and atmospheric dust optical depth ($\tau$) models.

### 7. TARS Edge AI & Voice Co-Pilot
* Offline natural language interface with Voice Activity Detection (VAD) and speech synthesis.
* Backed by deterministic terrain rule engines and offline SLMs (Qwen/Llama fine-tuned on NASA PDS) to answer questions, plan routes, inspect telemetry, and flag safety hazards without calling external cloud APIs.

---

## 📁 Source Code Organization

```
apps/web/
├── api/                   # Local edge API handlers (catalog, elevation, geology, wind, spacecraft)
├── celestial/             # SPICE NAIF planetary ephemerides and moon orbital mathematics
├── data/                  # Offline cached scientific datasets, SPICE kernels, and sensor baselines
├── docs/                  # Detailed engineering architectural specs and implementation notes
├── public/                # Static assets, glTF 3D models, MOLA topography, and science tiles
│   └── equipment/models/  # Optimized procedural 3D glTF PBR equipment assets
├── routing/               # Python/JS pathfinding adapters and Minetti bioenergetics bridges
├── src/                   # Client-side ES Modules
│   ├── app.js             # Main application orchestrator and view synchronization
│   ├── mission-deployer.js# 3D tactical equipment workbench & telemetry engine
│   ├── skyline-vpr.js     # Skyline Visual Place Recognition UI and matcher
│   ├── eva-assistant.js   # TARS offline voice and mission assistant
│   ├── route-planner.js   # Bioenergetic route planner and waypoint manager
│   ├── solar-geometry.js  # NASA GISS Mars24 solar ephemeris calculator
│   ├── moons.js           # SPICE Phobos/Deimos 3D orbits and celestial markers
│   └── scientific-layer.js# Multi-layer planetary science visualization engine
├── tests/                 # Automated unit and integration test suites (490 test cases)
├── dev-server.mjs         # Zero-dependency local Node.js development and API server
├── index.html             # Application entry point with embedded SVG tactical icons
└── package.json           # Dependencies and test runner configurations
```

---

## 🚀 Running the Web Application

### Prerequisites
* Node.js $\ge 18.0.0$
* Python $\ge 3.10$ (for backend routing service & SPICE calculations)

### 1. Start the Local Server
```bash
npm run dev
```
*(Server launches immediately at `http://localhost:8770`).*

### 2. Build for Production
```bash
npm run build
```
*(Compiles the optimized production client bundle into `dist/`).*

### 3. Run Automated Unit Tests
```bash
npm test
```
*(Executes all 490 Node.js unit tests with TAP test runner — 100% passing).*
