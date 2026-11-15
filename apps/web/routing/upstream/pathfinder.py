"""
Multi-Objective A* Pathfinding Engine for Martian Surface Extravehicular Activities (EVAs).
Incorporates:
1. Minetti's Biomechanical Metabolic Equation for walking on Martian slopes (0.38g).
2. Artificial Potential Fields (APF) for proximity science survey.
3. Permutation-based TSP sequencing for Deep Science Checkpoint Expeditions.
4. Line-of-sight path smoothing to eliminate 8-directional jagged artifacts.
5. Three Distinct Mission Profiles:
   - Profile 1: Direct Safe / Emergency Evacuation (Lowest Energy & Distance)
   - Profile 2: APF Proximity Survey (Remote-Sensing Flyby of Science Targets)
   - Profile 3: Deep Science Expedition (Direct Checkpoint Interception & Core Sampling)
"""

import heapq
import itertools
import math
import numpy as np
from typing import List, Tuple, Dict, Any, Optional
from .grid import MarsElevationGrid


class MarsPathfinder:
    # 8-directional neighbor movements: (dr, dc, move_cost_multiplier)
    NEIGHBORS = [
        (-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
        (-1, -1, math.sqrt(2)), (-1, 1, math.sqrt(2)),
        (1, -1, math.sqrt(2)), (1, 1, math.sqrt(2))
    ]

    # Energetic constants (NASA Apollo / Planetary EVA Bioenergetics)
    ASTRONAUT_TOTAL_MASS_KG = 125.0  # 90kg astronaut + 35kg pressurized EVA spacesuit
    MARS_GRAVITY_RATIO = 0.38        # g_mars / g_earth
    JOULES_PER_LITER_O2 = 20900.0    # 1 L of O2 burned ~= 20.9 kJ of metabolic work

    def __init__(
        self,
        grid: MarsElevationGrid,
        astronaut_mass_kg: float = 125.0,
        gravity_ratio: float = 0.38,
        apf_attraction_pull: float = 0.80,
        apf_sensor_radius_m: float = 900.0
    ):
        self.grid = grid
        self.astronaut_mass_kg = astronaut_mass_kg
        self.gravity_ratio = gravity_ratio
        self.apf_attraction_pull = apf_attraction_pull
        self.apf_sensor_radius_m = apf_sensor_radius_m

    @staticmethod
    def minetti_cost_of_transport(gradient: float) -> float:
        """
        Calculates metabolic Cost of Transport (Cw) in Joules / (kg * m)
        using Alberto Minetti's formula (Journal of Applied Physiology, 2002):
        Cw(i) = 280.5*i^5 - 58.7*i^4 - 289.8*i^3 + 74.3*i^2 + 19.1*i + 3.2
        where i = rise / run.
        """
        i = gradient
        i_clamped = max(-0.45, min(0.45, i))
        cw = (
            280.5 * (i_clamped ** 5)
            - 58.7 * (i_clamped ** 4)
            - 289.8 * (i_clamped ** 3)
            + 74.3 * (i_clamped ** 2)
            + 19.1 * i_clamped
            + 3.2
        )
        return max(1.2, float(cw))

    def step_metabolic_joules(self, elev_diff: float, distance_m: float, slope_deg: float = 0.0) -> float:
        """
        Calculates the real metabolic energy (in Joules) expended by an astronaut
        stepping over distance_m with elevation change elev_diff in Martian gravity.
        Incorporates cubic mass-load vertical fatigue on uphill climbs.
        """
        gradient = elev_diff / distance_m if distance_m > 0 else 0.0
        cw = self.minetti_cost_of_transport(gradient)
        mars_effort_factor = self.gravity_ratio + 0.15  # gravity + suit stiffness
        
        # Non-linear uphill mass load coupling & steep downhill braking penalty
        mass_ratio = self.astronaut_mass_kg / 80.0
        if elev_diff > 0:
            hill_penalty = 1.0 + (mass_ratio ** 2.5) * ((slope_deg / 12.0) ** 2.5)
        else:
            hill_penalty = 1.0 + (mass_ratio ** 2.0) * ((max(0.0, slope_deg - 8.0) / 10.0) ** 2.2)
        
        energy_joules = cw * self.astronaut_mass_kg * distance_m * mars_effort_factor * hill_penalty
        return energy_joules

    def _apf_potential_well(
        self,
        r: int,
        c: int,
        minerals: Optional[List[Dict[str, Any]]] = None
    ) -> float:
        """
        Computes Khatib Artificial Potential Field (APF) attractive potential well.
        Returns a negative potential (gravitational pull) toward unvisited minerals.
        """
        if not minerals or self.apf_attraction_pull <= 0:
            return 0.0

        total_u = 0.0
        for m in minerals:
            coords = m["geometry"]["coordinates"]
            mr, mc = self.grid.geo_to_grid(coords[0], coords[1])
            dr = (r - mr) * self.grid.resolution
            dc = (c - mc) * self.grid.resolution
            dist_m = math.sqrt(dr * dr + dc * dc)

            if dist_m < self.apf_sensor_radius_m:
                score = m.get("properties", {}).get("science_value", 50)
                u = - (self.apf_attraction_pull * 2200.0 * (score / 100.0)) / (1.0 + (dist_m / 250.0) ** 2)
                total_u += u

        return total_u

    def _heuristic(self, r1: int, c1: int, r2: int, c2: int) -> float:
        """
        Admissible A* heuristic based on flat-ground Minetti metabolic energy.
        Includes a 0.1% tie breaker to avoid jagged diagonal staircasing.
        """
        dr = (r1 - r2) * self.grid.resolution
        dc = (c1 - c2) * self.grid.resolution
        dist_m = math.sqrt(dr * dr + dc * dc)
        flat_energy_per_m = 3.2 * self.astronaut_mass_kg * (self.gravity_ratio + 0.15)
        return dist_m * flat_energy_per_m * 1.001

    def smooth_path_apf(self, raw_path: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
        """
        Curvature-preserving filter for R2 (APF Survey).
        Smooths micro-steps without deleting gravitational detour curves toward minerals.
        """
        if not raw_path or len(raw_path) <= 4:
            return raw_path
        smoothed = [raw_path[0]]
        for i in range(1, len(raw_path) - 1, 2):
            smoothed.append(raw_path[i])
        smoothed.append(raw_path[-1])
        return smoothed

    def smooth_path(self, raw_path: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
        """
        Applies line-of-sight shortcutting / string pulling to eliminate 8-way jagged steps.
        Used for R1 (Direct Safe) and R3 (Deep Science segments).
        """
        if not raw_path or len(raw_path) <= 2:
            return raw_path

        def can_connect(p1: Tuple[int, int], p2: Tuple[int, int]) -> bool:
            r0, c0 = p1
            r1, c1 = p2
            dr = abs(r1 - r0)
            dc = abs(c1 - c0)
            sr = 1 if r0 < r1 else -1
            sc = 1 if c0 < c1 else -1
            err = dr - dc
            cr, cc = r0, c0
            while True:
                if not self.grid.is_walkable(cr, cc):
                    return False
                if cr == r1 and cc == c1:
                    break
                e2 = 2 * err
                if e2 > -dc:
                    err -= dc
                    cr += sr
                if e2 < dr:
                    err += dr
                    cc += sc
                return True

        smoothed = [raw_path[0]]
        curr = 0
        while curr < len(raw_path) - 1:
            furthest = curr + 1
            max_look = min(len(raw_path) - 1, curr + 16)
            for cand in range(max_look, curr, -1):
                if can_connect(raw_path[curr], raw_path[cand]):
                    furthest = cand
                    break
            smoothed.append(raw_path[furthest])
            curr = furthest

        return smoothed

    def find_segment(
        self,
        start: Tuple[int, int],
        goal: Tuple[int, int],
        minerals_apf: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[List[Tuple[int, int]]]:
        """
        Runs A* to find the optimal path between two grid coordinates.
        Uses Minetti's metabolic energy function and APF attractive science incentives.
        If strict walkable path is blocked by massive cliffs, finds the least-slope traverse route.
        """
        start_r, start_c = start
        goal_r, goal_c = goal

        if not self.grid.is_in_bounds(start_r, start_c) or not self.grid.is_in_bounds(goal_r, goal_c):
            return None
        if not np.isfinite(self.grid.get_elevation(start_r, start_c)) or not np.isfinite(self.grid.get_elevation(goal_r, goal_c)):
            return None

        def run_search(allow_slope_traverse: bool = False) -> Optional[List[Tuple[int, int]]]:
            if not allow_slope_traverse:
                if not self.grid.is_walkable(start_r, start_c) or not self.grid.is_walkable(goal_r, goal_c):
                    return None

            frontier = []
            heapq.heappush(frontier, (0.0, start_r, start_c))

            came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
            cost_so_far: Dict[Tuple[int, int], float] = {(start_r, start_c): 0.0}

            closed = set()
            while frontier:
                current_f, cur_r, cur_c = heapq.heappop(frontier)
                if (cur_r, cur_c) in closed:
                    continue
                closed.add((cur_r, cur_c))

                if (cur_r, cur_c) == (goal_r, goal_c):
                    path = []
                    curr = (cur_r, cur_c)
                    while curr in came_from:
                        path.append(curr)
                        curr = came_from[curr]
                    path.append((start_r, start_c))
                    path.reverse()
                    if minerals_apf:
                        return self.smooth_path_apf(path)
                    return self.smooth_path(path)

                for dr, dc, dist_mult in self.NEIGHBORS:
                    next_r, next_c = cur_r + dr, cur_c + dc
                    if not self.grid.is_in_bounds(next_r, next_c):
                        continue
                    elev2 = self.grid.get_elevation(next_r, next_c)
                    if not np.isfinite(elev2):
                        continue

                    if not allow_slope_traverse and not self.grid.is_walkable(next_r, next_c):
                        continue

                    dist_m = dist_mult * self.grid.resolution
                    elev1 = self.grid.get_elevation(cur_r, cur_c)
                    elev_diff = elev2 - elev1
                    slope_deg = self.grid.get_slope(next_r, next_c)

                    # Minetti bioenergetic step cost (Joules)
                    energy_step = self.step_metabolic_joules(
                        elev_diff, dist_m, min(slope_deg, self.grid.max_safe_slope_deg)
                    )

                    # When traversing cliffs, penalize slope exceedance heavily so A* detours around:
                    if allow_slope_traverse and slope_deg > self.grid.max_safe_slope_deg:
                        excess = (slope_deg - self.grid.max_safe_slope_deg) / max(1.0, self.grid.max_safe_slope_deg)
                        slope_hazard_penalty = energy_step * (800.0 * (excess ** 2.5))
                    else:
                        slope_hazard_penalty = 0.0

                    # Khatib APF Science Incentive (Survey Flyby):
                    if minerals_apf and self.apf_attraction_pull > 0:
                        attraction = 0.0
                        start_goal_dist = math.hypot((goal_r - start_r) * self.grid.resolution, (goal_c - start_c) * self.grid.resolution)
                        for m in minerals_apf:
                            coords = m["geometry"]["coordinates"]
                            mr, mc = self.grid.geo_to_grid(coords[0], coords[1])
                            d_curr = math.hypot((cur_r - mr) * self.grid.resolution, (cur_c - mc) * self.grid.resolution)
                            d_next = math.hypot((next_r - mr) * self.grid.resolution, (next_c - mc) * self.grid.resolution)
                            radius_m = m.get("properties", {}).get("radius_m")
                            eff_radius = max(self.apf_sensor_radius_m, float(radius_m) if radius_m else 0.0, start_goal_dist * 0.7, 3.5 * self.grid.resolution)
                            if d_next < eff_radius:
                                score = m.get("properties", {}).get("science_value", 50)
                                norm_d = d_next / eff_radius
                                proximity_pull = (score / 100.0) * (1.0 - norm_d)
                                approach = (d_curr - d_next) / max(1.0, dist_m)
                                approach_bonus = max(0.0, approach) * 2.0 * (score / 100.0) * (1.0 - norm_d * 0.7)
                                attraction += proximity_pull + approach_bonus

                        pull_factor = min(2.5, self.apf_attraction_pull)
                        discount = min(0.96, pull_factor * 0.50 * attraction)
                        nominal_step = energy_step * (1.0 - discount)
                    else:
                        nominal_step = energy_step

                    # Terrain hazard penalties are NEVER discounted by science attraction
                    step_cost = nominal_step + slope_hazard_penalty

                    new_cost = cost_so_far[(cur_r, cur_c)] + step_cost
                    next_pos = (next_r, next_c)

                    if next_pos not in cost_so_far or new_cost < cost_so_far[next_pos]:
                        cost_so_far[next_pos] = new_cost
                        h_scale = 0.35 if (minerals_apf or allow_slope_traverse) else 1.0
                        h = self._heuristic(next_r, next_c, goal_r, goal_c) * h_scale
                        priority = new_cost + h
                        heapq.heappush(frontier, (priority, next_r, next_c))
                        came_from[next_pos] = (cur_r, cur_c)

            return None

        # Phase 1: Try strict walkable path
        path = run_search(allow_slope_traverse=False)
        if path is not None:
            return path

        # Phase 2: If strict path is blocked by massive cliffs, find least-slope traverse
        return run_search(allow_slope_traverse=True)

    def _build_route_telemetry(
        self,
        full_grid_path: List[Tuple[int, int]],
        all_minerals: Optional[List[Dict[str, Any]]] = None,
        profile_name: str = "custom"
    ) -> Dict[str, Any]:
        """Calculates comprehensive telemetry including Minetti energy & O2 burn."""
        if not full_grid_path:
            return {"status": "failed", "profile": profile_name, "reason": "No walkable route found"}

        total_dist_m = 0.0
        elev_gain_m = 0.0
        elev_loss_m = 0.0
        max_slope = 0.0
        total_energy_joules = 0.0
        waypoints_geo = []

        for i in range(len(full_grid_path)):
            r, c = full_grid_path[i]
            lon, lat, elev = self.grid.grid_to_geo(r, c)
            slope = self.grid.get_slope(r, c)
            max_slope = max(max_slope, slope)

            if i > 0:
                pr, pc = full_grid_path[i - 1]
                prev_elev = self.grid.get_elevation(pr, pc)
                dr = (r - pr) * self.grid.resolution
                dc = (c - pc) * self.grid.resolution
                step_dist = math.sqrt(dr * dr + dc * dc)
                total_dist_m += step_dist

                diff = elev - prev_elev
                if diff > 0:
                    elev_gain_m += diff
                else:
                    elev_loss_m += abs(diff)

                step_energy = self.step_metabolic_joules(diff, step_dist, slope)
                total_energy_joules += step_energy

            waypoints_geo.append({
                "lon": round(lon, 5),
                "lat": round(lat, 5),
                "elevation_m": round(elev, 2),
                "slope_deg": round(slope, 1)
            })

        visited_minerals = []
        sensor_range = 9.0 if profile_name == "apf_survey" else 3.0
        if all_minerals:
            for m in all_minerals:
                coords = m["geometry"]["coordinates"]
                mr, mc = self.grid.geo_to_grid(coords[0], coords[1])
                near = any(math.hypot(pt[0] - mr, pt[1] - mc) <= sensor_range for pt in full_grid_path)
                if near:
                    visited_minerals.append(m)

        total_science = sum(m.get("properties", {}).get("science_value", 0) for m in visited_minerals)
        total_kj = total_energy_joules / 1000.0
        est_o2_liters = total_energy_joules / self.JOULES_PER_LITER_O2

        route_result = {
            "status": "success",
            "profile": profile_name,
            "summary": {
                "total_distance_km": round(total_dist_m / 1000.0, 2),
                "elevation_gain_m": round(elev_gain_m, 1),
                "elevation_loss_m": round(elev_loss_m, 1),
                "max_slope_deg": round(max_slope, 1),
                "minetti_energy_kj": round(total_kj, 1),
                "minetti_calories_kcal": round(total_kj * 0.239006, 1),
                "est_o2_consumed_liters": round(est_o2_liters, 2),
                "minerals_visited_count": len(visited_minerals),
                "total_science_score": total_science
            },
            "waypoints": waypoints_geo,
            "grid_path": full_grid_path
        }
        if max_slope > self.grid.max_safe_slope_deg:
            route_result["notice"] = (
                f"Cliff traverse: route utilizes lowest-slope ascent/descent "
                f"(max slope {max_slope:.1f}° vs {self.grid.max_safe_slope_deg:.0f}° limit)."
            )
        return route_result

    # =========================================================================
    # 3 DISTINCT MISSION PROFILES
    # =========================================================================

    def plan_direct_safe_route(
        self,
        start_geo: Tuple[float, float],
        end_geo: Tuple[float, float]
    ) -> Dict[str, Any]:
        """
        Profile 1: Direct Safe / Emergency Evacuation.
        Minimizes distance & Minetti energy while strictly avoiding slopes > limit.
        Ignores all science targets.
        """
        sr, sc = self.grid.geo_to_grid(start_geo[0], start_geo[1])
        er, ec = self.grid.geo_to_grid(end_geo[0], end_geo[1])
        s_snap = self.grid.find_nearest_walkable(sr, sc) or (sr, sc)
        e_snap = self.grid.find_nearest_walkable(er, ec) or (er, ec)

        path = self.find_segment(s_snap, e_snap, minerals_apf=None)
        if not path:
            return {"status": "failed", "profile": "direct_safe", "reason": "No safe route found"}

        return self._build_route_telemetry(path, all_minerals=None, profile_name="direct_safe")

    def plan_apf_survey_route(
        self,
        start_geo: Tuple[float, float],
        end_geo: Tuple[float, float],
        minerals: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Profile 2: APF Proximity Survey Flyby.
        Single-pass A* guided by Artificial Potential Field science gravity wells.
        Curves smoothly into mineral sensor ranges without forcing dead stops.
        """
        sr, sc = self.grid.geo_to_grid(start_geo[0], start_geo[1])
        er, ec = self.grid.geo_to_grid(end_geo[0], end_geo[1])
        s_snap = self.grid.find_nearest_walkable(sr, sc) or (sr, sc)
        e_snap = self.grid.find_nearest_walkable(er, ec) or (er, ec)

        path = self.find_segment(s_snap, e_snap, minerals_apf=minerals)
        if not path:
            return {"status": "failed", "profile": "apf_survey", "reason": "No safe APF route found"}

        return self._build_route_telemetry(path, all_minerals=minerals, profile_name="apf_survey")

    def plan_deep_science_route(
        self,
        start_geo: Tuple[float, float],
        end_geo: Tuple[float, float],
        minerals: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Profile 3: Deep Science Expedition (Direct Checkpoint Interception).
        Solves optimal TSP sequence from Start to Goal to eliminate backtracking loops.
        """
        sr, sc = self.grid.geo_to_grid(start_geo[0], start_geo[1])
        er, ec = self.grid.geo_to_grid(end_geo[0], end_geo[1])
        s_snap = self.grid.find_nearest_walkable(sr, sc) or (sr, sc)
        e_snap = self.grid.find_nearest_walkable(er, ec) or (er, ec)

        # Filter reachable minerals
        walkable_minerals = []
        for m in minerals:
            coords = m["geometry"]["coordinates"]
            mr, mc = self.grid.geo_to_grid(coords[0], coords[1])
            m_snap = self.grid.find_nearest_walkable(mr, mc) or (mr, mc)
            if m_snap:
                walkable_minerals.append((m, m_snap))

        if not walkable_minerals:
            return self.plan_direct_safe_route(start_geo, end_geo)

        # Solve Traveling Salesperson sequence (minimizes total tour distance from Start to Goal)
        best_tour = [wm[1] for wm in walkable_minerals]
        best_dist = float('inf')

        for perm in itertools.permutations(walkable_minerals):
            tour_coords = [wm[1] for wm in perm]
            d = math.hypot(tour_coords[0][0] - s_snap[0], tour_coords[0][1] - s_snap[1])
            for i in range(len(tour_coords) - 1):
                d += math.hypot(tour_coords[i+1][0] - tour_coords[i][0], tour_coords[i+1][1] - tour_coords[i][1])
            d += math.hypot(e_snap[0] - tour_coords[-1][0], e_snap[1] - tour_coords[-1][1])

            if d < best_dist:
                best_dist = d
                best_tour = tour_coords

        # Chain legs sequentially without backtracking
        full_path: List[Tuple[int, int]] = []
        curr = s_snap

        for target in best_tour:
            seg = self.find_segment(curr, target)
            if seg:
                if not full_path:
                    full_path.extend(seg)
                else:
                    full_path.extend(seg[1:])
                curr = target

        # Final leg to goal
        final_seg = self.find_segment(curr, e_snap)
        if not final_seg:
            return {"status": "failed", "profile": "deep_science", "reason": "Unable to reach destination from last mineral"}

        if not full_path:
            full_path.extend(final_seg)
        else:
            full_path.extend(final_seg[1:])

        return self._build_route_telemetry(full_path, all_minerals=minerals, profile_name="deep_science")

    def plan_all_mission_profiles(
        self,
        start_geo: Tuple[float, float],
        end_geo: Tuple[float, float],
        minerals: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculates all 3 mission profiles simultaneously for comparative analysis."""
        direct_safe = self.plan_direct_safe_route(start_geo, end_geo)
        apf_survey = self.plan_apf_survey_route(start_geo, end_geo, minerals)
        deep_science = self.plan_deep_science_route(start_geo, end_geo, minerals)

        return {
            "status": "success",
            "direct_safe": direct_safe,
            "apf_survey": apf_survey,
            "deep_science": deep_science
        }
