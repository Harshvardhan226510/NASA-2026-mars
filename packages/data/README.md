# 📡 Data Interface & Contracts

This directory defines the **shared schema** between the data engineering pipeline (GeoTIFFs / GIS) and the pathfinding engine / web viewer.

---

## 1. Elevation Grid Contract (`elevation_grid.json`)

When an elevation slice is passed to the pathfinding engine, it adheres to this format:

```json
{
  "region": "valles_marineris",
  "bbox": {
    "min_lon": 283.0,
    "max_lon": 284.0,
    "min_lat": -10.5,
    "max_lat": -9.5
  },
  "rows": 100,
  "cols": 100,
  "resolution_meters": 50.0,
  "elevation_matrix": [
    [ -3200.5, -3198.2, -3190.0, "...100 columns..." ],
    "...100 rows..."
  ]
}
```

* **`resolution_meters`**: Distance in meters represented by 1 cell width/height.
* **`elevation_matrix`**: 2D array of floats representing altitude in meters (relative to Mars MOLA datum).

---

## 2. Science Layers Contract (`minerals.geojson`)

Standard GeoJSON FeatureCollection for Points of Interest (Minerals, Ice, Hazards, Shelters):

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [283.45, -9.82, -3150.0]
      },
      "properties": {
        "id": "MIN-001",
        "name": "Sulfate Hydrate Deposit",
        "category": "mineral",
        "science_value": 85,
        "description": "High concentration of hydrated sulfates indicating ancient aqueous activity."
      }
    }
  ]
}
```

* **`coordinates`**: `[longitude, latitude, elevation_m]`
* **`science_value`**: Integer (0 to 100) indicating scientific priority for the route optimization algorithm.

---

## 3. Path Output Contract (`route_output.json`)

The output produced by the pathfinding algorithm:

```json
{
  "status": "success",
  "summary": {
    "total_distance_km": 12.8,
    "elevation_gain_m": 420.0,
    "elevation_loss_m": 150.0,
    "max_slope_deg": 16.4,
    "minerals_collected": 3,
    "total_science_score": 240
  },
  "waypoints": [
    {
      "lon": 283.1,
      "lat": -10.2,
      "elevation_m": -3200.0,
      "slope_deg": 2.1,
      "mineral_visited": null
    }
  ]
}
```
