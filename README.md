# 🔴 Mars Mapping: Interplanetary Survival Guide

> **2026 NASA Space Apps Challenge**  
> An autonomous routing & multi-layered 3D visualization suite for Martian surface exploration.

---

## 📁 Repository Architecture

To allow distributed development without merge conflicts or context collisions, this project is split into isolated domains:

```
mars-mapping/
├── algorithms/       # [Navigation & Pathfinding Engine] (Python)
│   ├── src/          # Custom A* routing, slope penalty calculations, multi-objective solver
│   ├── tests/        # Unit tests & benchmark scenarios
│   └── README.md     # Algorithm docs & I/O contracts
│
├── data/             # [Geospatial Data Contracts & Sample Datasets]
│   ├── schemas/      # JSON / GeoJSON specifications for telemetry, routes, and science layers
│   ├── samples/      # Mock elevation matrices & mineral points for testing
│   └── README.md     # Interface documentation between data pipeline and algorithms
│
├── web/              # [3D Geospatial Viewer & Mission HUD] (CesiumJS / React)
│   └── README.md     # Web architecture and 3D rendering setup
│
└── docs/             # Technical specifications & mission dossiers
```

---

## 👥 Responsibilities & Domain Ownership

* **`algorithms/`**: Pathfinding algorithms, slope hazard models, science reward optimization, elevation traversal logic.
* **`data/`**: Interface contracts, GeoJSON format specifications, shared sample coordinates.
* **`web/`**: CesiumJS 3D viewer, terrain mesh streaming, holographic HUD, layer toggles.

---

## 🚀 Quickstart for Each Module

* To work on the **Pathfinding Engine**: See [`algorithms/README.md`](./algorithms/README.md).
* To understand the **Data Schemas & Coordinate formats**: See [`data/README.md`](./data/README.md).
* To work on the **3D Web Application**: See [`web/README.md`](./web/README.md).
