# 🧮 Mars Pathfinding & Bioenergetic Navigation Engine

> **Autonomous Multi-Objective EVA Traversal Solver Grounded in Martian Physics**  
> NASA Space Apps Challenge 2026 — *Interplanetary Survival Guide: Martian Map*

---

## 📌 Executive Overview

Traversing the Martian surface on foot or by pressurized rover is fundamentally distinct from terrestrial pathfinding. In Mars' reduced gravity ($g_{\text{Mars}} = 3.72076\text{ m/s}^2$), steep scree slopes cause slippage, rugged crater walls trap deep thermal shadows, and high metabolic exertion depletes finite Life Support Systems (ECLSS) oxygen and water reserves.

The **Pyxis Pathfinding Engine** is an autonomous, multi-objective trajectory optimizer that couples authentic digital elevation models (DEMs) with human metabolic work modeling, dynamic hazard avoidance, and science target prioritization.

---

## 🔬 Core Mathematical Formulation

### 1. Minetti Bioenergetic Metabolic Work Model

Rather than simply finding Euclidean or geodesic distance, Pyxis computes the **total mechanical and physiological work** ($W$, in Joules) required for a suited astronaut or rover to traverse each segment of terrain:

$$W = m_{\text{total}} \cdot g_{\text{Mars}} \cdot d \cdot \varphi(\theta)$$

Where:
* $m_{\text{total}}$: Total system mass (Astronaut body mass $80\text{ kg}$ + EVA spacesuit $135\text{ kg} = 215\text{ kg}$).
* $g_{\text{Mars}}$: Martian surface gravitational acceleration ($3.72076\text{ m/s}^2$).
* $d$: Geodesic 3D path distance in meters across the sampled terrain mesh.
* $\theta$: Local terrain slope gradient in degrees ($\arctan\left(\frac{\Delta h}{\Delta x}\right)$).
* $\varphi(\theta)$: Minetti dimensionless metabolic energy cost function based on the empirical 5th-order polynomial (Minetti et al., 2002):

$$\varphi(\theta) = 155.4\theta^5 - 30.4\theta^4 - 43.3\theta^3 + 46.3\theta^2 + 19.5\theta + 3.6$$

* **Level Walking ($\theta = 0^\circ$)**: Baseline cost is $\approx 3.6\text{ J}/(\text{kg}\cdot\text{m})$.
* **Moderate Uphill ($\theta > 0^\circ$)**: Energy expenditure increases exponentially with gradient steepness.
* **Moderate Downhill ($-10^\circ < \theta < 0^\circ$)**: Negative work with gravity assistance reduces metabolic cost down to minimum.
* **Steep Downhill ($\theta < -10^\circ$)**: Braking muscle action and joint stabilization cause energetic expenditure to rise sharply again.

---

### 2. Terrain Slope Constraints & Safety Envelope

| Gradient Range ($\theta$) | Operational Status | Engine Action |
| :--- | :--- | :--- |
| **$0^\circ \le \theta \le 15^\circ$** | **Nominal Traverse** | Nominal walking speed ($v \approx 1.2\text{ m/s}$), standard Minetti cost. |
| **$15^\circ < \theta \le 22^\circ$** | **Throttle / Caution** | EVA velocity throttled down to $0.4\text{ m/s}$; exponential fatigue multiplier applied. |
| **$\theta > 22^\circ$** | **Hard Impassable Barrier** | Cell marked strictly untraversable; infinite cost prevents routing over sheer cliff faces or canyon scarps. |

---

### 3. Traverse Risk Index (TRI: 0–100%)

Every planned path calculates a composite **Traverse Risk Index (TRI)** reflecting real-world planetary hazards:

$$\text{TRI} = w_1 \cdot \left(\frac{\theta_{\text{max}}}{22^\circ}\right) + w_2 \cdot \sigma_{\text{roughness}} + w_3 \cdot D_{\text{cliff}} + w_4 \cdot S_{\text{shadow}}$$

* **Slope Penalty**: Proximity to the $22^\circ$ critical slipping threshold.
* **Surface Roughness ($\sigma$)**: Local elevation variance over a 9-point moving window.
* **Cliff Edge Proximity ($D_{\text{cliff}}$)**: Potential energy drop hazard buffer.
* **Shadow Exposure ($S_{\text{shadow}}$)**: Risk of sustained low-temperature cold traps and zero solar regeneration.

---

### 4. Asymmetric Return & NASA 1/3 Reserve Rule

EVA routes cannot be mirrored in reverse! A gentle downhill slope on the outbound leg transforms into a steep, exhausting uphill climb on the return trip.

Pyxis implements **Asymmetric Return Validation**:
* The return leg re-evaluates all directional gradients: $\theta_{\text{return}} = -\theta_{\text{outbound}}$.
* Enforces the **NASA Walk-Back Consumable Reserve**: A hard 33.3% safety margin must remain unspent upon return to camp. If the projected return work exceeds available oxygen, battery, or thermal reserves, the mission planner flags a **CRITICAL SAFETY VIOLATION** and auto-prunes the exploration radius.

---

## 🧭 The 3 Navigation Profiles

The engine solves paths across three distinct mission profiles simultaneously:

```
[Start Coordinate] ───────────────────────────────────────────────────► [Destination]
        │
        ├──► 1. DIRECT / SAFE  ──────────► Minimize distance & slope hazards (Lowest TRI)
        │
        ├──► 2. APF SURVEY     ──────────► Artificial Potential Field (Max coverage & boundaries)
        │
        └──► 3. DEEP SCIENCE   ──────────► Maximize mineral collection score with detour budget
```

1. **`direct_safe` (Emergency / Transport)**:
   * Uses slope-weighted A* heuristic to determine the most energy-efficient, lowest-risk corridor between points.
   * Ideal for emergency evacuation, injured astronaut transport, or rapid rover relocation.
2. **`apf_survey` (Geological Reconnaissance)**:
   * Employs Artificial Potential Fields (APF) with attractive target fields and repulsive obstacle boundaries.
   * Maximizes perimeter exploration along geological stratum contacts while maintaining standoff distances from canyon drop-offs.
3. **`deep_science` (Scientific Sampling Expeditions)**:
   * Solves a multi-objective traveling-salesperson/knapsack optimization over geological points of interest (hydrated sulfates, hematite, phyllosilicates).
   * Calculates allowable detour deviations within the consumable budget to maximize total mission science score.

---

## 📁 Architecture & File Layout

```
packages/algorithms/
├── src/
│   ├── grid.py                    # Topographic grid matrix, elevation slice loader, and gradient math
│   ├── pathfinder.py              # Multi-objective A*, Minetti work integrals, and APF solver
│   └── visualizer.py              # High-contrast 2D tactical contour map & waypoint renderer
├── tests/                         # Algorithmic benchmark scenarios and slope constraint assertions
├── interactive_visualizer.html     # Standalone client-side 2D interactive canvas for route testing
├── main.py                        # CLI entry point running the end-to-end routing pipeline
├── marswalk_mission_map.png       # Generated publication-quality 2D tactical mission map
├── requirements.txt               # Lightweight Python dependencies (numpy, matplotlib, scipy)
├── algorithm_deep_dive.md         # Extended technical whitepaper on gradient field calculus
└── BEGINNER_GUIDE.md              # Educational guide to planetary pathfinding algorithms
```

---

## 🚀 Execution & Usage

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Main Mission Planner
```bash
python main.py
```
* Generates the multi-profile trajectory comparison.
* Saves structured waypoints and telemetry into `../data/route_output.json`.
* Renders the high-resolution topographic map to `marswalk_mission_map.png`.

### 3. Run Standalone Interactive Visualizer
Open `interactive_visualizer.html` in any modern web browser to interactively click and set start, goal, and mineral targets with real-time slope contour rendering.

### 4. Run Automated Algorithmic Tests
```bash
python -m unittest discover -s ../../apps/web/tests -p "test_routing.py"
```
*(All 30 automated backend routing test cases passing).*
