"""
Mars Surface Navigation & Mission Route Planner (CLI Runner).
Executes the Multi-Objective A* Algorithm with Minetti Bioenergetics and APF Science Fields.
Computes and compares 3 distinct mission profiles:
1. Direct Safe / Emergency Evacuation
2. APF Survey Flyby (Remote Sensing)
3. Deep Science Expedition (Direct Interception)
"""

import json
import os
import sys

# Ensure UTF-8 output on Windows terminals
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from src.grid import MarsElevationGrid
from src.pathfinder import MarsPathfinder
from src.visualizer import MarsVisualizer


def run_mission():
    print("=" * 72)
    print("🔴 MARS SURFACE EXPEDITION PLANNER - 3-PROFILE MISSION ENGINE")
    print("=" * 72)

    # 1. Initialize Elevation Grid (Synthetic Valles Marineris canyon model)
    print("\n[1/4] Generating high-resolution elevation model (120x120 grid)...")
    grid = MarsElevationGrid.generate_synthetic_canyon(
        rows=120,
        cols=120,
        resolution_meters=50.0
    )
    print(f"      Grid size: {grid.rows}x{grid.cols} cells ({grid.resolution}m/pixel)")
    print(f"      Elevation range: {grid.elevation.min():.1f}m to {grid.elevation.max():.1f}m")
    print(f"      Max safe slope limit: {grid.max_safe_slope_deg}°")

    # 2. Load Sample Minerals from Shared Contract
    algo_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(algo_dir)
    sample_minerals_path = os.path.join(project_root, "data", "samples", "sample_minerals.json")
    if os.path.exists(sample_minerals_path):
        print(f"\n[2/4] Loading science targets from {sample_minerals_path}...")
        with open(sample_minerals_path, "r", encoding="utf-8") as f:
            minerals_data = json.load(f)
            minerals = minerals_data.get("features", [])
    else:
        print("\n[2/4] Warning: Sample minerals file not found, using internal fallbacks...")
        minerals = []

    print(f"      Loaded {len(minerals)} priority mineral discovery sites.")

    # 3. Define Mission Start and End Coordinates
    start_geo = (283.08, -9.85)
    end_geo = (283.72, -9.28)
    print(f"\n[3/4] Solving 3 Distinct Mission Profiles:")
    print(f"      Start Base: Lon {start_geo[0]}°, Lat {start_geo[1]}°")
    print(f"      Extraction Goal: Lon {end_geo[0]}°, Lat {end_geo[1]}°")
    print(f"      Bioenergetics: Minetti (2002) model scaled for Mars 0.38g (125 kg astronaut+suit)")

    pathfinder = MarsPathfinder(
        grid=grid,
        astronaut_mass_kg=125.0,
        gravity_ratio=0.38,
        apf_attraction_pull=0.75,
        apf_sensor_radius_m=600.0
    )

    all_routes = pathfinder.plan_all_mission_profiles(
        start_geo=start_geo,
        end_geo=end_geo,
        minerals=minerals
    )

    r1 = all_routes["direct_safe"]["summary"]
    r2 = all_routes["apf_survey"]["summary"]
    r3 = all_routes["deep_science"]["summary"]

    print("\n" + "=" * 72)
    print("📊 COMPARATIVE MISSION TELEMETRY (ASTRONAUT PHYSIOLOGY & SCIENCE)")
    print("=" * 72)
    header = f"{'Metric':<22} | {'R1: Direct Safe':<14} | {'R2: APF Survey':<14} | {'R3: Deep Science':<14}"
    divider = "-" * len(header)
    print(header)
    print(divider)
    print(f"{'Distance (km)':<22} | {r1['total_distance_km']:<14} | {r2['total_distance_km']:<14} | {r3['total_distance_km']:<14}")
    print(f"{'Minetti Energy (kJ)':<22} | {r1['minetti_energy_kj']:<14} | {r2['minetti_energy_kj']:<14} | {r3['minetti_energy_kj']:<14}")
    print(f"{'Est. Calories (kcal)':<22} | {r1['minetti_calories_kcal']:<14} | {r2['minetti_calories_kcal']:<14} | {r3['minetti_calories_kcal']:<14}")
    print(f"{'Est. O2 Burn (Liters)':<22} | {r1['est_o2_consumed_liters']:<14} | {r2['est_o2_consumed_liters']:<14} | {r3['est_o2_consumed_liters']:<14}")
    print(f"{'Peak Slope Angle (°)':<22} | {r1['max_slope_deg']:<14} | {r2['max_slope_deg']:<14} | {r3['max_slope_deg']:<14}")
    print(f"{'Minerals Harvested':<22} | {r1['minerals_visited_count']:<14} | {r2['minerals_visited_count']:<14} | {r3['minerals_visited_count']:<14}")
    print(f"{'Science Score (pts)':<22} | {r1['total_science_score']:<14} | {r2['total_science_score']:<14} | {r3['total_science_score']:<14}")
    print(divider)

    # 4. Save JSON Telemetry for Web / Shared Contract
    output_json_path = os.path.join(project_root, "data", "route_output.json")
    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        export_data = {
            "status": "success",
            "metadata": {
                "mass_kg": 125.0,
                "gravity": 0.38,
                "model": "Minetti (2002) + Khatib APF"
            },
            "routes": {
                "direct_safe": {
                    "summary": r1,
                    "waypoints": all_routes["direct_safe"]["waypoints"]
                },
                "apf_survey": {
                    "summary": r2,
                    "waypoints": all_routes["apf_survey"]["waypoints"]
                },
                "deep_science": {
                    "summary": r3,
                    "waypoints": all_routes["deep_science"]["waypoints"]
                }
            }
        }
        json.dump(export_data, f, indent=2)
    print(f"\n[4/4] Saved all 3 route telemetry profiles to: {output_json_path}")

    # 5. Render 2D Topographic Tactical Map
    output_map_path = os.path.join(algo_dir, "marswalk_mission_map.png")
    MarsVisualizer.render_mission_map(grid, all_routes, minerals, output_filepath=output_map_path)
    print(f"      Mission tactical comparison map saved to: {output_map_path}")
    print("\n🚀 All 3 mission profiles successfully generated!")


if __name__ == "__main__":
    run_mission()
