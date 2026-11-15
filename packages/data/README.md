# 📡 Geospatial Data Schemas, Contracts & PDS Datasets

> **Standardized Telemetry, Scientific Datasets, and Fine-Tuning Corpora**  
> NASA Space Apps Challenge 2026 — *Interplanetary Survival Guide: Martian Map*

---

## 📌 Executive Overview

`packages/data/` defines the shared schemas, coordinate systems, and authentic NASA Planetary Data System (PDS) datasets that connect the low-level geospatial pipeline, the pathfinding engine, and the offline Edge AI assistant.

---

## 🌐 Coordinate Reference Frames & Datums

All spatial calculations, GeoJSON features, and elevation queries strictly follow international planetary cartography standards:

1. **Reference Ellipsoid**: IAU/IAG 2015 Mars Triaxial Ellipsoid:
   * Semi-major axis ($a$): $3,396.19\text{ km}$
   * Semi-minor axis ($b$): $3,376.20\text{ km}$
   * Mean radius ($R_{\text{mean}}$): $3,389.50\text{ km}$
2. **Horizontal Datum**:
   * Longitude: Degrees East ($-180^\circ$ to $+180^\circ$ or $0^\circ$ to $360^\circ$ East).
   * Latitude: Planetocentric latitude ($-90^\circ$ to $+90^\circ$).
3. **Vertical Datum (Aeroid)**:
   * NASA Mars Orbiter Laser Altimeter (MOLA) gravitational equipotential surface where average atmospheric pressure is $\approx 6.1\text{ mbar}$ (the triple point of water).
   * Elevations ($h$) are signed meters relative to this datum (e.g. Valles Marineris canyon floor is $\approx -4,500\text{ m}$).

---

## 📑 Data Interface Contracts

### 1. Elevation Grid Slice Contract (`elevation_grid.json`)

When an elevation bounding box is requested by the routing engine or terrain analysis pipeline:

```json
{
  "region": "VALLES_MARINERIS",
  "bbox": {
    "min_lon": -72.5,
    "max_lon": -70.5,
    "min_lat": -7.5,
    "max_lat": -6.5
  },
  "rows": 200,
  "cols": 200,
  "resolution_meters": 50.0,
  "datum": "NASA_MOLA_AEROID",
  "elevation_matrix": [
    [-4250.2, -4248.5, -4240.1, "...200 columns..."],
    "...200 rows..."
  ]
}
```

* **`resolution_meters`**: Physical horizontal distance represented by one grid cell.
* **`elevation_matrix`**: Continuous 2D array of IEEE 754 float32 elevations in meters.

---

### 2. Science Points of Interest (POI) Contract (`minerals.geojson`)

Standard RFC 7946 GeoJSON FeatureCollection defining mineral deposits, InSight seismic stations, and EVA exploration targets:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-71.425, -6.892, -4380.0]
      },
      "properties": {
        "id": "MIN-SULFATE-04",
        "name": "Hydrated Sulfate Outcrop",
        "category": "mineral",
        "science_value": 92,
        "mineral_type": "magnesium_sulfate",
        "formation": "Candor Chasma Layered Strata",
        "citation": "CRISM FRT00003E12 Targeted Spectral Cube"
      }
    }
  ]
}
```

---

### 3. Route Output & Telemetry Contract (`route_output.json`)

Standard output exported by both the Python routing engine and the client-side route planner:

```json
{
  "status": "success",
  "profile": "deep_science",
  "summary": {
    "total_distance_km": 14.28,
    "total_metabolic_work_mj": 18.42,
    "total_time_hours": 3.45,
    "elevation_gain_m": 312.0,
    "elevation_loss_m": 298.0,
    "max_slope_deg": 14.8,
    "mean_slope_deg": 5.2,
    "traverse_risk_index_percent": 18.5,
    "science_score_collected": 340,
    "return_margin_percent": 36.8
  },
  "waypoints": [
    {
      "step": 0,
      "coords": [-71.52, -6.95],
      "elevation_m": -4410.0,
      "slope_deg": 2.1,
      "segment_work_kj": 42.1,
      "cumulative_work_mj": 0.042,
      "consumed_o2_kg": 0.03,
      "visited_target": null
    }
  ]
}
```

---

## 🤖 Authentic NASA PDS Training Corpora

`packages/data/` contains structured, authentic fine-tuning and validation datasets used to train the offline **TARS / ARES Small Language Model (SLM)**:

* **`nasa_mars_authentic_train.jsonl`** (~8.5 MB):
  * Thousands of curated, peer-reviewed question-and-answer pairs extracted directly from NASA Planetary Data System (PDS) mission archives, Curiosity/Perseverance science logs, InSight seismic reports, and NASA EVA field manuals.
  * Verified for absolute domain accuracy with zero synthetic hallucinations.
* **`nasa_mars_authentic_val.jsonl`** (~950 KB):
  * Independent validation holdout dataset used to compute Perplexity, Exact Match (EM), and BLEU/ROUGE benchmarks.

---

## 📁 Directory Structure

```
packages/data/
├── samples/
│   └── sample_minerals.json           # Curated geological samples for Valles Marineris and Gale Crater
├── nasa_mars_authentic_train.jsonl    # Authentic NASA PDS training corpus for offline Edge SLM
├── nasa_mars_authentic_val.jsonl      # Independent validation holdout dataset
├── route_output.json                  # Sample exported multi-objective route trajectory
└── README.md                          # This specification document
```
