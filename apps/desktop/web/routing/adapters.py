"""Georeferencing and corridor validation around the unchanged partner engine."""
import math
import heapq
import numpy as np
from .upstream.grid import MarsElevationGrid
from .upstream.pathfinder import MarsPathfinder

RADIUS = 3396190.0


class LocalElevationGrid(MarsElevationGrid):
    """Square metre cells in a spherical azimuthal-equidistant local projection."""
    def __init__(self, matrix, resolution, center, max_slope):
        self.center = tuple(center)
        self.lon0, self.lat0 = map(math.radians, center)
        self._coordinates = {}
        super().__init__(matrix, resolution_meters=resolution, max_safe_slope_deg=max_slope)

    def project(self, lon, lat):
        lon, lat = map(math.radians, (lon, lat))
        dl = (lon - self.lon0 + math.pi) % (2 * math.pi) - math.pi
        cosine = math.sin(self.lat0) * math.sin(lat) + math.cos(self.lat0) * math.cos(lat) * math.cos(dl)
        angle = math.acos(max(-1.0, min(1.0, cosine)))
        if math.pi - angle < 1e-7:
            raise ValueError('A point is at the grid centre’s antipode. Plan that journey in separate sections.')
        k = angle / math.sin(angle) if angle > 1e-10 else 1.0
        return (RADIUS * k * math.cos(lat) * math.sin(dl),
                RADIUS * k * (math.cos(self.lat0) * math.sin(lat) - math.sin(self.lat0) * math.cos(lat) * math.cos(dl)))

    def unproject(self, x, y):
        distance = math.hypot(x, y)
        if distance < 1e-9:
            return self.center
        a = distance / RADIUS
        lat = math.asin(max(-1.0, min(1.0, math.cos(a) * math.sin(self.lat0) + y * math.sin(a) * math.cos(self.lat0) / distance)))
        lon = self.lon0 + math.atan2(x * math.sin(a), distance * math.cos(self.lat0) * math.cos(a) - y * math.sin(self.lat0) * math.sin(a))
        return ((math.degrees(lon) + 180) % 360 - 180, math.degrees(lat))

    def grid_to_geo(self, r, c):
        lon, lat = self.unproject((c - (self.cols - 1) / 2) * self.resolution,
                                 ((self.rows - 1) / 2 - r) * self.resolution)
        return lon, lat, self.get_elevation(r, c)

    def geo_to_grid(self, lon, lat):
        key = (lon, lat)
        if key not in self._coordinates:
            x, y = self.project(lon, lat)
            r = math.floor((self.rows - 1) / 2 - y / self.resolution + .5)
            c = math.floor((self.cols - 1) / 2 + x / self.resolution + .5)
            # Do not silently clip distant coordinates into a local mission.
            self._coordinates[key] = (r, c)
        return self._coordinates[key]


def corridor_cells(a, b):
    """All Bresenham cells along a segment, including both endpoints."""
    r, c = map(int, a)
    er, ec = map(int, b)
    dr, dc = abs(er - r), abs(ec - c)
    sr, sc = (1 if r < er else -1), (1 if c < ec else -1)
    error = dr - dc
    while True:
        yield r, c
        if (r, c) == (er, ec):
            break
        twice = 2 * error
        if twice > -dc:
            error -= dc
            r += sr
        if twice < dr:
            error += dr
            c += sc


class AtlasPathfinder(MarsPathfinder):
    def __init__(self, *args, allow_slope_traverse=True, **kwargs):
        super().__init__(*args, **kwargs)
        self.allow_slope_traverse = allow_slope_traverse

    def strict_neighbors(self, cell):
        """Walkable neighbours, without diagonals through excluded corners."""
        r, c = cell
        for dr, dc, multiplier in self.NEIGHBORS:
            other = (r + dr, c + dc)
            if not self.grid.is_walkable(*other):
                continue
            if dr and dc and (not self.grid.is_walkable(r + dr, c) or
                              not self.grid.is_walkable(r, c + dc)):
                continue
            yield other, multiplier * self.grid.resolution

    def directed_step_energy(self, start, end, distance):
        return self.step_metabolic_joules(
            self.grid.get_elevation(*end) - self.grid.get_elevation(*start),
            distance, self.grid.get_slope(*end))

    def plan_direct_safe_route(self, start_geo, end_geo):
        """Minimum modeled energy on the strict walking grid, in this direction.

        Preserve searched cells for telemetry: geometric shortcutting can change
        both gradient and energy. The 1.2 cost floor is a lower bound even for
        downhill travel; the upstream flat-ground heuristic is not.
        """
        start = self.grid.find_nearest_walkable(*self.grid.geo_to_grid(*start_geo))
        goal = self.grid.find_nearest_walkable(*self.grid.geo_to_grid(*end_geo))
        if start is not None and goal is not None and self.grid.is_walkable(*start) and self.grid.is_walkable(*goal):
            start, goal = tuple(start), tuple(goal)
            costs, previous = {start: 0.0}, {}
            floor = 1.2 * self.astronaut_mass_kg * (self.gravity_ratio + .15)
            def heuristic(cell):
                return math.dist(cell, goal) * self.grid.resolution * floor
            queue = [(heuristic(start), 0.0, start)]
            while queue:
                _, cost, cell = heapq.heappop(queue)
                if cost > costs[cell]:
                    continue
                if cell == goal:
                    path = [cell]
                    while cell in previous:
                        cell = previous[cell]
                        path.append(cell)
                    result = self._build_route_telemetry(path[::-1], profile_name='direct_safe')
                    result['search'] = {'objective': 'directed_metabolic_energy',
                                        'optimal_on_strict_grid': True,
                                        'energy_joules': cost, 'geometry': 'searched_grid_cells'}
                    return result
                for nxt, distance in self.strict_neighbors(cell):
                    energy = self.directed_step_energy(cell, nxt, distance)
                    candidate = cost + energy
                    if candidate < costs.get(nxt, math.inf):
                        costs[nxt], previous[nxt] = candidate, cell
                        heapq.heappush(queue, (candidate+heuristic(nxt), candidate, nxt))
        if self.allow_slope_traverse:
            result = super().plan_direct_safe_route(start_geo, end_geo)
            result['search'] = {'objective': 'experimental_slope_fallback', 'optimal_on_strict_grid': False}
            return result
        return {'status': 'failed', 'profile': 'direct_safe',
                'reason': 'No route meets the selected slope, terrain and obstacle constraints.'}

    def corridor_valid(self, a, b):
        cells = list(corridor_cells(a, b))
        if not all(self.grid.is_walkable(r, c) for r, c in cells):
            return False
        # Do not shortcut across steep slope cells (> 15 deg); keep fine surface-hugging points
        if any(self.grid.get_slope(r, c) > 15.0 for r, c in cells):
            return False
        # Do not shortcut if linear 3D chord cuts inside the terrain
        if len(cells) > 2:
            z0 = self.grid.get_elevation(*map(int, a))
            z1 = self.grid.get_elevation(*map(int, b))
            n = len(cells) - 1
            for i, (r, c) in enumerate(cells[1:-1], 1):
                z_chord = z0 + (i / n) * (z1 - z0)
                z_actual = self.grid.get_elevation(r, c)
                if (z_actual - z_chord) > max(3.0, self.grid.resolution * 0.05):
                    return False
        return True

    def smooth_path(self, raw_path):
        if not raw_path or len(raw_path) <= 2:
            return raw_path
        output, current = [raw_path[0]], 0
        while current < len(raw_path) - 1:
            furthest = current + 1
            for candidate in range(min(len(raw_path) - 1, current + 16), current, -1):
                if self.corridor_valid(raw_path[current], raw_path[candidate]):
                    furthest = candidate
                    break
            output.append(raw_path[furthest])
            current = furthest
        return output

    def smooth_path_apf(self, raw_path):
        # Retain the partner's two-step curvature filter, but never let a skipped
        # point hide an impassable cell between its retained neighbors.
        if not raw_path or len(raw_path) <= 4:
            return raw_path
        output = [raw_path[0]]
        for i in range(1, len(raw_path) - 1, 2):
            target = raw_path[i]
            if not self.corridor_valid(output[-1], target):
                output.append(raw_path[i - 1])
            output.append(target)
        if not self.corridor_valid(output[-1], raw_path[-1]):
            output.append(raw_path[-2])
        output.append(raw_path[-1])
        return output

    def _build_route_telemetry(self, full_grid_path, all_minerals=None, profile_name="custom"):
        result = super()._build_route_telemetry(full_grid_path, all_minerals, profile_name)
        if result['status'] != 'success':
            return result
        traversed = set(full_grid_path)
        for a, b in zip(full_grid_path, full_grid_path[1:]):
            traversed.update(corridor_cells(a, b))
        max_path_slope = max(self.grid.get_slope(r, c) for r, c in traversed)
        is_traverse = max_path_slope > self.grid.max_safe_slope_deg
        if is_traverse and not self.allow_slope_traverse:
            return {'status': 'failed', 'profile': profile_name, 'reason': 'No route meets the selected slope limit. Experimental slope-limit fallback is disabled.'}
        if not is_traverse:
            if any(not self.grid.is_walkable(r, c) for r, c in traversed):
                return {'status': 'failed', 'profile': profile_name, 'reason': 'The returned corridor crosses unavailable or impassable terrain.'}
        else:
            if any(not self.grid.is_in_bounds(r, c) or not np.isfinite(self.grid.get_elevation(r, c)) for r, c in traversed):
                return {'status': 'failed', 'profile': profile_name, 'reason': 'The returned corridor crosses unavailable elevation terrain.'}
        # Slope fallback may relax steep cells, never a declared field obstacle.
        mask = getattr(self.grid, 'reported_obstacle_mask', None)
        if mask is not None and any(mask[r, c] for r, c in traversed):
            return {'status': 'failed', 'profile': profile_name, 'reason': 'The returned corridor crosses an excluded obstacle.'}
        if any(not self.grid.is_walkable(r, c) and self.grid.get_slope(r, c) <= self.grid.max_safe_slope_deg for r, c in traversed):
            return {'status': 'failed', 'profile': profile_name, 'reason': 'The returned corridor crosses an excluded obstacle.'}
        max_traversed_slope = max(self.grid.get_slope(r, c) for r, c in traversed)
        if is_traverse and 'notice' not in result:
            result['notice'] = f'Cliff traverse: route utilizes lowest-slope ascent/descent (max slope {max_traversed_slope:.1f}° vs {self.grid.max_safe_slope_deg:.0f}° limit).'
        result['validation'] = {'corridor_checked': True, 'sampled_cells': len(traversed),
                                'max_sampled_slope_deg': round(max_traversed_slope, 2),
                                'cliff_traverse': is_traverse}
        if profile_name == 'deep_science':
            missed = []
            for target in all_minerals or []:
                snapped = self.grid.find_nearest_walkable(*self.grid.geo_to_grid(*target['geometry']['coordinates'][:2]))
                if snapped is None or snapped not in traversed:
                    missed.append(target['properties']['id'])
            result['unreached_targets'] = missed
            if missed:
                result['status'] = 'partial'
                result['reason'] = 'Some selected checkpoints could not be reached; inspect the missed-target list.'
        return result
