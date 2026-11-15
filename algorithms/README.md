# 🧮 Mars Pathfinding & Navigation Engine

Autonomous multi-objective route optimization engine designed for Martian Extravehicular Activities (EVAs).

---

## 🎯 What this Engine Does

1. **Slope-Aware Routing:** Calculates the surface slope angle $\theta$ for every cell.
   * If $\theta > \text{max\_safe\_slope}$ (default $22^\circ$), the cell is marked **strictly impassable** (cliffs, ravines).
   * For walkable inclines, applies an exponential fatigue and oxygen consumption penalty.
2. **Uphill vs. Downhill Workload:** Extra gravity penalty for uphill climbing vs. gradual descent.
3. **Science Target Maximization:** Intelligently visits priority mineral deposit locations (e.g., hydrated sulfates, hematite, clays) to maximize total mission science score.
4. **Outputs:** Produces both an exported JSON telemetry trajectory in `../data/route_output.json` and a publication-ready 2D tactical map in `marswalk_mission_map.png`.

---

## 🚀 How to Run

From this directory:

```bash
# Run the mission planner and generate tactical map
python main.py
```

---

## 📁 File Structure

* **`src/grid.py`**: Elevation grid matrix, slope computation ($\nabla h$), coordinate converters (`grid <-> geo`).
* **`src/pathfinder.py`**: Custom Multi-Objective A* algorithm implementation.
* **`src/visualizer.py`**: Topographic contour and hazard map renderer using Matplotlib.
* **`main.py`**: CLI entry point executing the full pipeline.
