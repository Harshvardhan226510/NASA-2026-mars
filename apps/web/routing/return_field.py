"""Minimum-energy return paths on the same directed graph as strict routing."""
import base64
import heapq
import math
import zlib

import numpy as np


def return_field(engine, habitat):
    grid = engine.grid
    destination = grid.geo_to_grid(*habitat)
    # Ordinary coordinate-to-cell rounding is supported. Never assume the
    # crew can get from a snapped walkable cell into an excluded habitat cell.
    if not grid.is_walkable(*destination):
        return {'status': 'blocked' if np.isfinite(grid.get_slope(*destination)) else 'unknown'}

    costs = np.full((grid.rows, grid.cols), np.inf, dtype=np.float64)
    distance = np.full_like(costs, np.inf)
    costs[destination] = distance[destination] = 0.0
    queue = [(0.0, 0.0, destination)]
    while queue:
        energy, length, cell = heapq.heappop(queue)
        if (energy, length) != (costs[cell], distance[cell]):
            continue
        for previous, step in engine.strict_neighbors(cell):
            # The edge is previous -> cell even though the search expands from
            # the habitat. Reversing the grade gives a different walking cost.
            next_energy = energy + engine.directed_step_energy(previous, cell, step)
            next_length = length + step
            if (next_energy, next_length) < (costs[previous], distance[previous]):
                costs[previous], distance[previous] = next_energy, next_length
                heapq.heappush(queue, (next_energy, next_length, previous))

    reachable = np.isfinite(distance)
    values = np.empty((grid.rows, grid.cols, 2), dtype='<f4')
    known = np.isfinite(grid.elevation) & np.isfinite(grid.slope_map)
    values[..., 0] = np.where(reachable, distance, np.where(known, -1, -2))
    values[..., 1] = np.where(reachable, costs / 1000, 0)
    packet = base64.b64encode(zlib.compress(values.tobytes(), level=3)).decode('ascii')
    return {'status': 'ready', 'format': 'deflate-f32le-distance-kj/1', 'data': packet,
            'rows': grid.rows, 'cols': grid.cols, 'spacing_m': grid.resolution,
            'center': grid.center, 'habitat': habitat}
