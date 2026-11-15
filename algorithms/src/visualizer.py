"""
Visualizer Module for Mars Pathfinding Engine.
Generates publication-quality 2D topographic maps showing terrain, cliff hazards,
mineral deposits, and comparing all 3 Marswalk mission profiles.
"""

import matplotlib.pyplot as plt
import numpy as np
from typing import Dict, Any, List
from .grid import MarsElevationGrid


class MarsVisualizer:
    @staticmethod
    def render_mission_map(
        grid: MarsElevationGrid,
        multi_routes: Dict[str, Any],
        minerals: List[Dict[str, Any]],
        output_filepath: str = "marswalk_mission_map.png"
    ):
        """
        Plot the topographic map, slope hazards, minerals, and the 3 distinct mission routes.
        """
        fig, ax = plt.subplots(figsize=(13, 10.5), dpi=150)
        
        # 1. Plot elevation background
        elev = grid.elevation
        im = ax.imshow(
            elev,
            cmap="copper",
            origin="upper",
            extent=[0, grid.cols, grid.rows, 0]
        )
        cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
        cbar.set_label("Elevation (meters relative to datum)", fontsize=11, color="#333333")

        # 2. Highlight dangerous cliffs (> max_safe_slope) in semi-transparent red
        cliff_mask = np.ma.masked_where(grid.slope_map <= grid.max_safe_slope_deg, grid.slope_map)
        ax.imshow(
            cliff_mask,
            cmap="Reds",
            alpha=0.55,
            origin="upper",
            extent=[0, grid.cols, grid.rows, 0]
        )

        # 3. Plot Mineral Targets with science aura
        for m in minerals:
            coords = m["geometry"]["coordinates"]
            mr, mc = grid.geo_to_grid(coords[0], coords[1])
            name = m["properties"]["name"]
            score = m["properties"]["science_value"]
            
            # Subtle APF sensor radius circle (~12 cells)
            sensor_circle = plt.Circle((mc, mr), 12, color="#FFD700", fill=False, linestyle=":", alpha=0.35, linewidth=1.5)
            ax.add_patch(sensor_circle)

            ax.scatter(mc, mr, color="#FFD700", edgecolors="#000000", s=130, marker="*", zorder=6)
            ax.annotate(
                f"{name}\n(+{score} pts)",
                (mc + 1.5, mr - 1.5),
                fontsize=7.5,
                color="#FFFFEE",
                weight="bold",
                bbox=dict(boxstyle="round,pad=0.2", fc="#222222", alpha=0.85, ec="#FFD700")
            )

        # 4. Plot the 3 Distinct Routes
        route_styles = [
            ("direct_safe", "#10B981", "-", 2.5, "Route 1: Direct Safe (Emergency Evac)"),
            ("apf_survey", "#F59E0B", "--", 3.0, "Route 2: APF Survey Flyby (Remote Sensing)"),
            ("deep_science", "#00FFFF", "-", 3.8, "Route 3: Deep Science (Direct Interception)")
        ]

        endpoints_plotted = False
        for key, color, linestyle, width, label in route_styles:
            route_data = multi_routes.get(key, {})
            if route_data.get("status") == "success":
                grid_path = route_data.get("grid_path", [])
                if grid_path:
                    rows, cols = zip(*grid_path)
                    ax.plot(cols, rows, color=color, linestyle=linestyle, linewidth=width, label=label, zorder=7)

                    if not endpoints_plotted:
                        # Mark Start and Goal
                        ax.scatter(cols[0], rows[0], color="#00FF66", edgecolors="#000000", s=150, marker="o", label="EVA Start Base", zorder=9)
                        ax.scatter(cols[-1], rows[-1], color="#FF3366", edgecolors="#000000", s=150, marker="X", label="Goal Extraction", zorder=9)
                        endpoints_plotted = True

        # 5. Comparative Telemetry Box (Minetti Energy + Distance + O2)
        r1_sum = multi_routes.get("direct_safe", {}).get("summary", {})
        r2_sum = multi_routes.get("apf_survey", {}).get("summary", {})
        r3_sum = multi_routes.get("deep_science", {}).get("summary", {})

        telemetry_text = (
            f"=== MULTI-MISSION TELEMETRY (MINETTI 0.38g) ===\n"
            f"[R1: Direct Safe]   {r1_sum.get('total_distance_km', 0):>4} km | {r1_sum.get('minetti_energy_kj', 0):>6} kJ | {r1_sum.get('est_o2_consumed_liters', 0):>4}L O2 | {r1_sum.get('total_science_score', 0):>3} pts\n"
            f"[R2: APF Survey]    {r2_sum.get('total_distance_km', 0):>4} km | {r2_sum.get('minetti_energy_kj', 0):>6} kJ | {r2_sum.get('est_o2_consumed_liters', 0):>4}L O2 | {r2_sum.get('total_science_score', 0):>3} pts\n"
            f"[R3: Deep Science]  {r3_sum.get('total_distance_km', 0):>4} km | {r3_sum.get('minetti_energy_kj', 0):>6} kJ | {r3_sum.get('est_o2_consumed_liters', 0):>4}L O2 | {r3_sum.get('total_science_score', 0):>3} pts\n"
            f"Max Slope Threshold: {grid.max_safe_slope_deg}° | Astronaut Mass: 125 kg (incl. EVA suit)"
        )

        ax.text(
            0.02, 0.025,
            telemetry_text,
            transform=ax.transAxes,
            fontsize=8.5,
            family="monospace",
            color="#00FFFF",
            bbox=dict(boxstyle="round,pad=0.5", fc="#0B0F17", alpha=0.92, ec="#00FFFF")
        )

        ax.set_title("VALLES MARINERIS - MULTI-PROFILE EVA ROUTE COMPARISON", fontsize=13, weight="bold", pad=12)
        ax.set_xlabel("Grid X (East)", fontsize=10)
        ax.set_ylabel("Grid Y (South)", fontsize=10)
        ax.legend(loc="upper right", facecolor="#161B22", edgecolor="#444444", labelcolor="#FFFFFF", fontsize=8.5)
        
        plt.tight_layout()
        plt.savefig(output_filepath, dpi=200)
        plt.close()
        print(f"[MarsVisualizer] Multi-route mission map saved to: {output_filepath}")
