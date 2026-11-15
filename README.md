# 🔴 PYXIS: Autonomous Martian Surface Navigation & Mission Control Stack

> **NASA Space Apps Challenge 2026** — *Interplanetary Survival Guide: Martian Map*  
> **An edge-ready, 100% offline planetary GIS, bioenergetic route optimization engine, and tactical mission cockpit designed for Martian Extravehicular Activities (EVAs) and autonomous rover expeditions.**

[![Automated Tests](https://img.shields.io/badge/Automated%20Tests-520%20Passing-brightgreen?style=for-the-badge&logo=github)](https://github.com/Harshvardhan226510/NASA-2026-mars)
[![Zero Failures](https://img.shields.io/badge/Failures-0%20Failures-brightgreen?style=for-the-badge)](https://github.com/Harshvardhan226510/NASA-2026-mars)
[![Offline Ready](https://img.shields.io/badge/Offline%20Autonomy-100%25%20On--Device-blue?style=for-the-badge)](https://github.com/Harshvardhan226510/NASA-2026-mars)
[![Monorepo](https://img.shields.io/badge/Architecture-Clean%20Monorepo-purple?style=for-the-badge)](https://github.com/Harshvardhan226510/NASA-2026-mars)
[![License](https://img.shields.io/badge/License-MIT-orange?style=for-the-badge)](LICENSE)

---

## 🌌 The Mission Challenge: Why Mars Needs a Local Cockpit

One-way radio communications between Earth and Mars experience an inescapable speed-of-light delay ranging from **4.3 to 21.0 minutes** (up to a 42-minute round trip). When an astronaut is navigating a crumbling scree slope in Valles Marineris or a rover encounters an unexpected obstacle:

* **Earth cannot pilot in real time.**
* **There is no GPS or active positioning satellite network on Mars.**
* **Martian terrain is unforgiving**: Vertical relief exceeds $5\text{ km}$, thermal shadow traps plunge temperatures below $-120^\circ\text{C}$, and high metabolic exertion depletes finite spacesuit oxygen reserves.

**Pyxis** solves this fundamental survival challenge by delivering an **autonomous, 100% offline planetary mission control stack** engineered to run directly on-device at the edge—inside a pressurized rover cockpit, base habitat terminal, or astronaut heads-up display (HUD).

---

## ⚡ Core Innovations & Capabilities

### 1. Multi-Resolution Planetary Terrain Engine
* **Authentic Data Fusion**: Blends sub-meter **HiRISE** (~0.25 m/pixel optical, ~1 m DEM), **CTX** (~5 m/pixel), and **HRSC/MOLA** digital elevation models.
* **Continuous Fallback Architecture**: Global Viking MDIM 2.1 colorized mosaics and source-digested MOLA elevation grids ensure zero missing tiles, cliff artifacts, or visual seams across the entire Martian globe.
* **Dual Cockpit View**: Seamless bidirectional synchronization between a 3D Cesium globe and a 2D Leaflet tactical map with side-by-side comparison mode.

### 2. Bioenergetic Routing & The Minetti Metabolic Model
Unlike Euclidean or 2D grid pathfinders, Pyxis calculates the **mechanical and physiological work** ($W$, in Joules) required for a human or rover to traverse complex Martian topography:

$$W = m_{\text{total}} \cdot g_{\text{Mars}} \cdot d \cdot \varphi(\theta)$$

* **Empirical 5th-Order Slope Cost $\varphi(\theta)$**: Accurately accounts for gravitational assistance on moderate downhills and steep braking fatigue on descents.
* **Traverse Risk Index (TRI: 0–100%)**: Dynamically scores terrain roughness, cliff proximity, and shadow hazards.
* **3 Tactical Routing Profiles**: `Direct/Safe` (lowest TRI & shortest time), `APF Survey` (Artificial Potential Fields maximizing geological contact coverage), and `Deep-Science` (detour knapsack solver maximizing mineral sample returns).
* **Asymmetric Return & NASA 1/3 Reserve**: Enforces the NASA walk-back consumable margin by re-evaluating inverse slopes on the return journey to prevent uphill life-support exhaustion.

### 3. Mars Skyline Visual Place Recognition (Skyline-VPR)
* Solves the "kidnapped astronaut / lost rover" problem in GNSS-denied Martian environments.
* Takes an unconstrained panoramic horizon photo, extracts the skyline profile, and correlates it against synthetic DEM ray-marched horizon signatures.
* Pinpoints the explorer's exact coordinates and heading without needing radio beacons or active satellites.

### 4. Interactive 3D Tactical Equipment Workbench
* Astronauts deploy authentic NASA hardware directly onto the 3D surface across 4 curated sites: **Valles Marineris (Candor Chasma)**, **Gale Crater (Mount Sharp)**, **Jezero Crater (Delta)**, and **Arcadia Planitia (Site AP-1)**.
* **Authentic Procedural 3D glTF Models**: Deployable UltraFlex Solar Arrays, High-Gain Comms Relays, InSight SEIS Seismometers, Weather Booms, Crew Habitat Cores, Greenhouse Domes, Pressurized Rovers, and Sabatier ISRU Plants.
* **Real Physical Telemetry**: Live solar flux ($\text{W/m}^2$), diurnal energy yields ($\text{kWh/sol}$), geometric line-of-sight horizon ($\text{km}$), cradle leveling verification ($15^\circ$), and ECLSS oxygen/water life-support budgeting.

### 5. NASA/JPL SPICE Ephemerides & Mars24 Solar Engine
* **Orbital Mechanics**: High-precision orbits for **Phobos** and **Deimos** computed from NAIF SPICE `MAR099` planetary ephemeris kernels.
* **Active Orbiter Ground Tracks**: Real-time position tracking for Mars Reconnaissance Orbiter (MRO), Mars Express, and Mars Odyssey.
* **NASA GISS Mars24 Solar Engine**: Computes exact Local True Solar Time (LTST), sub-solar coordinates, and real-time 3D raytraced canyon wall shadow occlusions.

### 6. Layered Planetary Geophysics Overlays
* **Langlais 2019 Crustal Magnetism**: 110-degree spherical harmonic model of remnant crustal magnetic anomalies.
* **USGS SIM 3292 Geology**: Complete digitized geological formations and stratigraphic contact boundaries.
* **InSight Seismology**: Active seismic event catalog, epicentral distances, and interior wave velocity profiles.
* **EMARS Wind & Dust**: Surface wind particle flow vectors and atmospheric dust opacity ($\tau$) modeling.

### 7. TARS Edge AI & Offline Voice Assistant
* Offline Small Language Model (SLM) running on-device via quantized GGUF (Qwen 2.5 / Llama 3.2 fine-tuned on authentic NASA PDS datasets).
* Dual-architecture design: natural language conversation paired with a deterministic terrain rule engine to ensure safety-critical recommendations are mathematically guaranteed.
* Hands-free Voice Activity Detection (VAD) and speech synthesis for spacesuit operations.

---

## 🏛️ Monorepo Architecture & Directory Structure

Pyxis is structured as an enterprise monorepo separating client applications, computational packages, developer tooling, and mission documentation:

```
NASA-2026-mars/
├── apps/
│   ├── web/                     # [Pyxis Web Atlas] CesiumJS 3D / Leaflet 2D Mission Cockpit
│   │   └── README.md            # Web application architecture, APIs, and client guide
│   └── desktop/                 # [Pyxis Desktop Companion] Electron native app (Win64 / Linux ARM64)
│       └── README.md            # Desktop packaging, offline maps, and crew input guide
│
├── packages/
│   ├── algorithms/              # [Pathfinding Engine] Python bioenergetic solvers & Minetti model
│   │   └── README.md            # Metabolic equations, TRI calculus, and routing benchmarks
│   └── data/                    # [Geospatial Contracts & PDS Datasets] Schemas & fine-tuning corpora
│       └── README.md            # IAU/IAG Martian datums, GeoJSON schemas, and PDS archives
│
├── tools/                       # [Developer & AI Tooling] Procedural 3D assets & SLM pipelines
│   └── README.md                # 3D glTF generators, PDS data extractors, and Colab notebooks
│
└── docs/                        # [Mission Specifications Portal] Architecture & Whitepapers
    ├── README.md                # Documentation portal index & asset directory
    ├── PROJECT_ARCHITECTURE_AND_TECHNOLOGY_STACK.md # Comprehensive system technical architecture
    ├── SKYLINE_VPR.md           # Mars Skyline Visual Place Recognition whitepaper
    └── ARES_MODEL_SPECIFICATIONS.md # Offline SLM fine-tuning & evaluation benchmarks
```

---

## 🧪 Rigorous Automated Test Suite (520 Tests)

Pyxis is backed by a comprehensive automated test harness covering celestial ephemerides, bioenergetic algorithms, data integrity, and UI state machines:

* **490 Node.js Unit & Integration Tests**: Testing the Cesium rendering pipeline, equipment telemetry, SPICE moon tracking, and TARS safety constraints (`npm --prefix apps/web test`).
* **30 Python Backend Routing Tests**: Testing multi-objective A*, slope hazard limits, and Minetti energy integrals (`python -m unittest discover -s apps/web/tests -p "test_*.py"`).
* **Production Build Verification**: Clean Vite 8 bundle compilation with zero syntax or packaging errors.

```
TAP version 13
1..490
# tests 490 | pass 490 | fail 0 | cancelled 0

Ran 30 tests in 1.776s
OK (All 520 automated tests passing with zero failures)
```

---

## 🚀 Quickstart Guide

### Option 1: Launch the Web Cockpit (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Harshvardhan226510/NASA-2026-mars.git
   cd NASA-2026-mars
   ```

2. **Start the local mission server**:
   ```bash
   npm --prefix apps/web run dev
   ```

3. **Open your browser**:
   Navigate to **`http://localhost:8770`**. The 3D Martian globe and cockpit HUD load immediately.

---

### Option 2: Run Algorithmic Trajectory Solvers in Python

```bash
# Navigate to the algorithms module
cd packages/algorithms

# Install minimal Python dependencies
pip install -r requirements.txt

# Run the multi-profile mission planner
python main.py
```
*Outputs structured waypoints in `packages/data/route_output.json` and a publication-grade contour map in `marswalk_mission_map.png`.*

---

### Option 3: Run the Automated Test Suite

```bash
# Run web & telemetry test suite (490 tests)
npm --prefix apps/web test

# Run Python routing test suite (30 tests)
python -c "import sys, subprocess, os; env = dict(os.environ); env['PYTHONPATH'] = 'apps/web'; sys.exit(subprocess.run(['python', '-m', 'unittest', 'discover', '-s', 'apps/web/tests', '-p', 'test_*.py'], env=env).returncode)"
```

---

## 🛰️ Scientific Datasets & Data Provenance

All planetary algorithms and context layers are byte-pinned to authentic NASA Planetary Data System (PDS) releases:

1. **Topography**: NASA MOLA 128 ppd DEM + ESA Mars Express HRSC 50 m/pixel grids.
2. **Satellite Imagery**: NASA MRO Context Camera (CTX) ~5 m/pixel and High Resolution Imaging Science Experiment (HiRISE) ~0.25 m/pixel.
3. **Solar & Atmosphere**: NASA Goddard Institute for Space Studies (GISS) Mars24 analytical algorithm (Allison & McEwen 2000, 2025 revision).
4. **Ephemerides**: NASA/JPL NAIF SPICE kernel `MAR099` (Planetary Ephemeris 2025–2035).
5. **Geology**: USGS Scientific Investigations Map 3292 (*Geologic Map of Mars*, Tanaka et al., 2014).
6. **Crustal Magnetics**: Langlais et al. (2019) 110-degree crustal field model.
7. **Seismology**: InSight Marsquake Service (MQS) VBB/SP seismic event catalog.

---

## 📄 License

This project is developed for the **2026 NASA Space Apps Challenge** and is released under the **MIT License**.
