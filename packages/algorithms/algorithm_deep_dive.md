# 🔴 Mars Pathfinding Engine: Mathematical Deep-Dive

> **Quick Tip for Viewing in Antigravity/VS Code:**  
> Press `Ctrl + Shift + V` (or `Ctrl + K` then `V`) to open the **Rich Rendered Preview** of this document!

---

## 1. How Elevation Converts to Slope

We represent Martian terrain as a 2D matrix of elevation heights `z = f(x, y)` in meters. To calculate surface steepness, we compute the finite-difference gradient:

```
  dz/dx ≈ (z[x+1, y] - z[x-1, y]) / (2 * resolution)
  dz/dy ≈ (z[x, y+1] - z[x, y-1]) / (2 * resolution)

  Gradient Magnitude = sqrt( (dz/dx)² + (dz/dy)² )
  Slope Angle (deg)  = arctan( Gradient Magnitude ) * (180 / π)
```

### The Hazard Threshold
* **Walkable Terrain (`<= 22.0°`):** Human astronauts and pressurized rovers can navigate with varying energy expenditure.
* **Impassable Cliff (`> 22.0°`):** Marked as hazardous barrier walls. Cost is set to `Infinity`, forcing the algorithm to route around them.

---

## 2. The Astronaut EVA Cost Function

Standard A* algorithms only minimize Euclidean distance. On Mars, taking a straight line up a mountain causes fatal oxygen and battery depletion.

Our step cost `C(A -> B)` between adjacent cells balances three factors:

```
Step Cost = [ Distance * Slope_Fatigue_Multiplier ] + Uphill_Ascent_Penalty
```

* **Distance:** `50.0m` for cardinal moves, `70.7m` (50 * √2) for diagonal moves.
* **Slope Fatigue Multiplier:**
  ```
  Multiplier = 1.0 + (Slope_Angle / 10.0) ^ 3.5
  ```
  * `0° slope`  -> `1.0x cost` (flat baseline)
  * `10° slope` -> `2.0x cost` (moderate exertion)
  * `15° slope` -> `4.1x cost` (heavy fatigue)
  * `20° slope` -> `8.0x cost` (near-maximum physical limit)
* **Uphill Ascent Penalty:**
  ```
  Penalty = max(0, Elevation_B - Elevation_A) * 2.0
  ```
  Climbing vertically requires lifting the astronaut's EVA suit against Martian gravity (0.38g).

---

## 3. Scientific Target Optimization

Rather than hardcoding waypoints, the algorithm chains safe corridors to priority minerals:

1. Evaluates all mineral deposits in the region by **Science Value Score** (0 to 100).
2. Attempts to chain: `Start Base -> Mineral Checkpoints -> Extraction Base`.
3. Verifies that visiting each mineral maintains a safe exit corridor to the final base without trapping the astronaut in dead-end ravines.

---

## 4. Current Limitations & Upgrade Opportunities

| Limitation in Baseline | Real-World Problem | Recommended Innovation |
| :--- | :--- | :--- |
| **8-Directional Grid** | Causes jagged 45° zig-zags | Add **Catmull-Rom Spline smoothing** for aerodynamic rover tracks |
| **Greedy Mineral Ordering** | Can backtrack between far sites | Implement a **Genetic Algorithm / TSP solver** to find the optimal loop |
| **Single Route Output** | Flight directors need choices | Generate a **Pareto Frontier** (Emergency Sprint vs. Balanced vs. Deep Science) |
| **Polynomial Slope Formula** | Heuristic rather than real physics | Implement **Minetti's Biomechanical Oxygen Model** for aerospace physiology |

---

## 5. Live Interactive Sandbox

To test this visually with real-time sliders and click-to-place waypoints, open:
`packages/algorithms/interactive_visualizer.html` in your browser.
