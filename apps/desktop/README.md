# 🖥️ Pyxis Desktop: Native Martian Field Operations Companion

> **Offline Mission Package Manager & Crew Terminal for Windows x64 and Linux ARM64**  
> NASA Space Apps Challenge 2026 — *Interplanetary Survival Guide: Martian Map*

---

## 📌 Executive Overview

`apps/desktop/` packages the Pyxis platform into a hardened, standalone desktop application built with Electron and native C++/Python helpers. It is tailored for field deployment aboard pressurized rovers, habitat core terminals, and ruggedized field tablets (such as Raspberry Pi OS ARM64 and Windows x64 rugged pads).

Download the platform installer and SHA-256 manifest from the repository Releases page (`v0.3.0` / `v0.3.1`). On Windows, run the setup executable. On Linux ARM64, install the downloaded package with `sudo apt install ./Mars-Field-Atlas-0.3.1-arm64.deb`.

---

## 🛠️ Key Capabilities

* **100% Air-Gapped Operation**: Pre-bundles the starter Martian globe, offline terrain elevation tiles, and local SPICE kernels so the application can run in environments with zero internet access.
* **Offline Map Package Manager**: Supports `.mars-mission` archived study windows, offline GeoTIFF imports, and field waypoint packages without requiring cloud synchronization.
* **Dead-Reckoning & Crew Sensor Bridge**: Direct hardware integration with rover wheel odometry, IMU gyroscopes, and external GPS-alternative telemetry via local socket APIs.
* **Native Voice & Audio Engine**: Built-in offline English speech recognition and native neural voice synthesis for hands-free suit communications.
* **Point Inspector & Crew Annotation**: Astronauts can pin observational field notes, attach geological photos, and log sample caching points directly onto the local SQLite / JSON datastore.

---

## 📁 Architecture & File Layout

```
apps/desktop/
├── desktop/               # Electron main process, preload scripts, and window lifecycle
│   ├── main.mjs           # Application entry point, window management, and native bridge
│   ├── preload.cjs        # Secure context bridge exposing IPC APIs to the renderer
│   ├── settings.mjs       # Persistent mission configurations and display preferences
│   └── save-on-close.mjs  # Mission session auto-archival on unexpected power loss
├── services/              # Native background services
│   ├── ares-context.mjs   # Local SLM context manager and telemetry provider
│   ├── dead-reckoning.mjs # Dead-reckoning integration from rover telemetry
│   ├── local-maps.mjs     # Offline terrain tile cache & package loader
│   ├── speech.mjs         # Native offline text-to-speech engine
│   └── network-policy.mjs # Strict offline network firewall enforcement
├── docs/                  # Desktop architectural specifications and crew APIs
│   ├── POINT_INSPECTOR.md # Point Inspector and crew observation guide
│   ├── FIELD_INPUT_API.md # Local telemetry and sensor ingestion API
│   └── DEVELOPER_MAP_API.md # Map Manager and package loader developer guide
└── package.json           # Electron build configurations and native dependencies
```

---

## 🚀 Development & Packaging

### 1. Install Dependencies
```bash
npm install
npm install --prefix web
```

### 2. Launch in Development Mode
```bash
npm start
```

### 3. Build Platform Installers
```bash
# Build Windows x64 setup executable
npm run build:win

# Build Debian / Raspberry Pi OS ARM64 package (.deb)
npm run build:linux
```

See [architecture](ARCHITECTURE.md), [source history](UPSTREAM.md), and [third-party notices](THIRD_PARTY_NOTICES.md).
