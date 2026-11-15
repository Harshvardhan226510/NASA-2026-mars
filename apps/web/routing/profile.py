"""Measured profile along the returned route; does not change search or costs."""
import math
from .adapters import RADIUS


def terrain_profile(route, grid, engine=None):
    path = route.get('grid_path') or []
    if len(path) < 2:
        return None
    steps = sum(max(abs(b[0]-a[0]), abs(b[1]-a[1])) for a, b in zip(path, path[1:]))
    stride = max(1, math.ceil(steps / 2048))
    samples, distance, previous, energy = [], 0.0, None, 0.0
    for i, (a, b) in enumerate(zip(path, path[1:])):
        run = math.dist(a, b) * grid.resolution
        step_energy = (engine.directed_step_energy(a, b, run) / 1000
                       if engine and route.get('status') in ('success', 'partial') and run else 0.0)
        count = max(1, math.ceil(max(abs(b[0]-a[0]), abs(b[1]-a[1])) / stride))
        for j in range(0 if i == 0 else 1, count+1):
            t = j / count
            row, col = a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t
            lon, lat = grid.unproject((col-(grid.cols-1)/2)*grid.resolution, ((grid.rows-1)/2-row)*grid.resolution)
            height = float(grid.get_elevation(round(row), round(col)))
            if previous:
                la, lb = math.radians(previous[1]), math.radians(lat)
                dl = math.radians(lon-previous[0])
                hav = math.sin((lb-la)/2)**2+math.cos(la)*math.cos(lb)*math.sin(dl/2)**2
                distance += 2*RADIUS*math.asin(min(1, math.sqrt(max(0, hav))))
            samples.append({'lon': lon, 'lat': lat, 'distance_m': round(distance, 3), 'elevation_m': round(height, 3) if math.isfinite(height) else None})
            if engine:
                samples[-1]['travel_energy_kj'] = round(energy + t * step_energy, 6)
            previous = lon, lat
        energy += step_energy
    return {'samples': samples, 'source_sample_m': grid.resolution,
            'method': 'Returned corridor centreline, nearest measured DEM cell; source heights without visual exaggeration.',
            'resampled': stride > 1}
