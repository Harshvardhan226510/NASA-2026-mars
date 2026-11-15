"""User-reported exclusions and independently planned return legs.

These are input/output adapters; the partner's search and energy model stay intact.
"""
import math
import numpy as np


def apply_obstacles(grid, values, position, number):
    if not isinstance(values, list) or len(values) > 64:
        raise ValueError('A plan supports up to 64 active reported obstacles.')
    rows, cols = np.ogrid[:grid.rows, :grid.cols]
    x = (cols - (grid.cols - 1) / 2) * grid.resolution
    y = ((grid.rows - 1) / 2 - rows) * grid.resolution
    applied = []
    grid.reported_obstacle_mask = np.zeros((grid.rows, grid.cols), dtype=bool)
    for i, entry in enumerate(values):
        if not isinstance(entry, dict):
            raise ValueError('Invalid reported obstacle.')
        point = position(entry.get('point'), 'Obstacle')
        radius = number(entry.get('radius_m', 25), 0, 10000, 'Obstacle radius')
        px, py = grid.project(*point)
        # Conservatively exclude cells intersecting the reported circle.
        mask = (x - px) ** 2 + (y - py) ** 2 <= (radius + grid.resolution / math.sqrt(2)) ** 2
        count = int(np.count_nonzero(mask & grid.walkable_mask))
        grid.walkable_mask[mask] = False
        grid.reported_obstacle_mask[mask] = True
        applied.append({'id': str(entry.get('id', f'obstacle-{i}'))[:100], 'point': point,
                        'radius_m': radius, 'excluded_walkable_cells': count,
                        'basis': 'user_report', 'at': str(entry.get('at', ''))[:40]})
    return applied
