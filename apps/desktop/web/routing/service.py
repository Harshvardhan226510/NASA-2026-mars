"""Bounded JSON interface to Harshvardhan's original three-profile pathfinder."""
import json
import math
import sys
import time
import numpy as np
from .adapters import AtlasPathfinder, LocalElevationGrid, RADIUS
from .profile import terrain_profile
from .mission import apply_obstacles
from .return_field import return_field

UPSTREAM_COMMIT = '814c8a44d8df4a89fd4674d74265052105f368d4'
PROFILES = ('direct_safe', 'apf_survey', 'deep_science')


def number(value, minimum, maximum, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError(f'{name} must be from {minimum} to {maximum}.')
    return float(value)


def position(point, name):
    if not isinstance(point, list) or len(point) != 2:
        raise ValueError(f'{name} must contain longitude and latitude.')
    return [number(point[0], -180, 180, name + ' longitude'), number(point[1], -90, 90, name + ' latitude')]


def plan_request(payload):
    if not isinstance(payload, dict) or payload.get('schema') != 'mars-route-request/1':
        raise ValueError('Unsupported route request.')
    data, options = payload.get('grid'), payload.get('options', {})
    if not isinstance(data, dict) or not isinstance(options, dict):
        raise ValueError('A terrain grid and model settings are required.')
    rows, cols = data.get('rows'), data.get('cols')
    if type(rows) is not int or type(cols) is not int or not 3 <= rows <= 513 or not 3 <= cols <= 513:
        raise ValueError('Terrain dimensions must be between 3 and 513 cells.')
    matrix = data.get('elevation_matrix')
    if not isinstance(matrix, list) or len(matrix) != rows or any(not isinstance(row, list) or len(row) != cols for row in matrix):
        raise ValueError('Terrain dimensions do not match the elevation matrix.')
    for row in matrix:
        for height in row:
            if height is not None:
                number(height, -15000, 30000, 'Elevation')
    resolution = number(data.get('resolution_meters'), .5, math.pi * RADIUS, 'Grid spacing')
    angle = math.hypot((rows - 1) / 2, (cols - 1) / 2) * resolution / RADIUS
    if angle >= math.pi - 1e-7:
        raise ValueError('This area reaches the grid centre’s antipode. Plan it in separate sections.')
    center = position(data.get('center'), 'Grid centre')
    mass = number(options.get('mass_kg', 125), 40, 250, 'Astronaut and suit mass')
    gravity = number(options.get('gravity_ratio', .38), .1, 1, 'Gravity ratio')
    slope = number(options.get('max_slope_deg', 22), 1, 45, 'Slope limit')
    pull = number(options.get('apf_pull', 1), 0, 2.5, 'APF attraction')
    sensor = number(options.get('sensor_radius_m', 900), 10, 10000, 'Sensor radius')
    allow_traverse = options.get('allow_slope_traverse', False)
    if not isinstance(allow_traverse, bool):
        raise ValueError('Slope-limit fallback must be true or false.')
    grid = LocalElevationGrid(np.array([[np.nan if v is None else v for v in row] for row in matrix], dtype=np.float32), resolution, center, slope)
    start, goal = position(payload.get('start'), 'Start'), position(payload.get('goal'), 'Destination')
    round_trip = payload.get('round_trip', False)
    if not isinstance(round_trip, bool):
        raise ValueError('Round trip must be true or false.')
    return_to = position(payload.get('return_to', start), 'Return habitat') if round_trip else None
    include_return_field = payload.get('return_field', False)
    if not isinstance(include_return_field, bool):
        raise ValueError('Return feasibility must be true or false.')
    field_only = payload.get('return_field_only', False)
    if not isinstance(field_only, bool):
        raise ValueError('Return field only must be true or false.')
    obstacles = apply_obstacles(grid, payload.get('obstacles', []), position, number)
    if field_only:
        if return_to is None or not grid.is_in_bounds(*grid.geo_to_grid(*return_to)):
            raise ValueError('A return point inside the measured terrain window is required.')
        engine = AtlasPathfinder(grid, astronaut_mass_kg=mass, gravity_ratio=gravity, allow_slope_traverse=False)
        return {'schema': 'mars-return-field-result/1', 'status': 'success', 'return_field': return_field(engine, return_to)}
    targets = payload.get('targets', [])
    if not isinstance(targets, list) or len(targets) > 6:
        raise ValueError('Choose up to six science checkpoints for the exact expedition sequence.')
    features, ids = [], set()
    for i, target in enumerate(targets):
        if not isinstance(target, dict):
            raise ValueError('Invalid science target.')
        point = position(target.get('point'), 'Target')
        ident = str(target.get('id', f'target-{i+1}'))[:100]
        if ident in ids:
            raise ValueError('Each target must have a different ID.')
        ids.add(ident)
        features.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': point}, 'properties': {
            'id': ident, 'name': str(target.get('name', f'Target {i+1}'))[:120],
            'science_value': number(target.get('score', 50), 0, 100, 'Target priority')}})
    for point in [start, goal] + ([return_to] if return_to else []) + [f['geometry']['coordinates'] for f in features]:
        if not grid.is_in_bounds(*grid.geo_to_grid(*point)):
            raise ValueError('An endpoint or checkpoint lies outside the supplied mission window.')
    if grid.geo_to_grid(*start) == grid.geo_to_grid(*goal):
        raise ValueError('Start and destination occupy the same terrain cell. Separate them or use finer terrain.')
    minerals_input = payload.get('minerals', [])
    mineral_features = []
    if isinstance(minerals_input, list):
        for i, m in enumerate(minerals_input[:20]):
            if not isinstance(m, dict) or not m.get('point'):
                continue
            try:
                m_point = position(m.get('point'), 'Mineral')
                if not grid.is_in_bounds(*grid.geo_to_grid(*m_point)):
                    continue
                m_id = str(m.get('id', f'mineral-{i+1}'))[:100]
                mineral_features.append({
                    'type': 'Feature',
                    'geometry': {'type': 'Point', 'coordinates': m_point},
                    'properties': {
                        'id': m_id,
                        'name': str(m.get('name', f'Mineral {i+1}'))[:120],
                        'science_value': number(m.get('score', 80), 0, 100, 'Mineral score'),
                        'radius_m': number(m.get('radius_m', 5000), 10, 50000, 'Mineral radius')
                    }
                })
            except (ValueError, TypeError):
                continue

    apf_features = list(features)
    for mf in mineral_features:
        if not any(f['properties']['id'] == mf['properties']['id'] for f in apf_features):
            apf_features.append(mf)

    deep_science_features = list(features)
    if not deep_science_features and mineral_features:
        start_pt = np.array(grid.project(*start))
        goal_pt = np.array(grid.project(*goal))
        direct_dist = max(1.0, float(np.linalg.norm(goal_pt - start_pt)))

        def corridor_penalty(mf):
            m_pt = np.array(grid.project(*mf['geometry']['coordinates']))
            detour = (np.linalg.norm(m_pt - start_pt) + np.linalg.norm(goal_pt - m_pt)) - direct_dist
            score = mf['properties'].get('science_value', 50)
            return detour / max(1.0, score)

        sorted_minerals = sorted(mineral_features, key=corridor_penalty)
        deep_science_features = sorted_minerals[:2]

    engine = AtlasPathfinder(grid, allow_slope_traverse=allow_traverse, astronaut_mass_kg=mass, gravity_ratio=gravity, apf_attraction_pull=pull, apf_sensor_radius_m=sensor)
    started = time.monotonic()
    results = {'direct_safe': engine.plan_direct_safe_route(tuple(start), tuple(goal)),
               'apf_survey': engine.plan_apf_survey_route(tuple(start), tuple(goal), apf_features),
               'deep_science': engine.plan_deep_science_route(tuple(start), tuple(goal), deep_science_features)}
    return_route = engine.plan_direct_safe_route(tuple(goal), tuple(return_to)) if round_trip else None
    if return_route is not None:
        return_route['terrain_profile'] = terrain_profile(return_route, grid, engine)
        return_route['role'] = 'return_to_habitat'
        if return_route.get('grid_path'):
            return_route['endpoint_adjustments_m'] = {
                label: round(math.dist(grid.project(*point), grid.project(*grid.grid_to_geo(*cell)[:2])), 2)
                for label, point, cell in [('start', goal, return_route['grid_path'][0]), ('goal', return_to, return_route['grid_path'][-1])]}
    for name, route in results.items():
        route['requested_profile'] = name
        route['terrain_profile'] = terrain_profile(route, grid, engine)
        if route.get('grid_path'):
            route['endpoint_adjustments_m'] = {
                label: round(math.dist(grid.project(*point), grid.project(*grid.grid_to_geo(*cell)[:2])), 2)
                for label, point, cell in [('start', start, route['grid_path'][0]), ('goal', goal, route['grid_path'][-1])]}
        if name == 'deep_science' and route.get('profile') == 'direct_safe':
            route['notice'] = 'No reachable science checkpoints; the partner engine returned its direct-route fallback.'
    feasibility = return_field(engine, return_to) if round_trip and include_return_field else None
    return {'schema': 'mars-route-result/1', 'status': 'success', 'routes': results,
            **({'return_field': feasibility} if feasibility is not None else {}),
            'return_route': return_route, 'return_to': return_to,
            'metadata': {'engine': 'Harshvardhan226510/mars-mapping', 'upstream_commit': UPSTREAM_COMMIT,
                         'runtime': 'partner science profiles + exact directed-grid direct/return adapter',
                         'elapsed_ms': round((time.monotonic() - started) * 1000),
                         'mass_kg': mass, 'gravity_ratio': gravity, 'max_slope_deg': slope,
                         'apf_pull': pull, 'sensor_radius_m': sensor, 'grid_spacing_m': resolution,
                         'window_width_m': max(rows - 1, cols - 1) * resolution,
                         'projection_max_scale_error': angle / math.sin(angle) - 1,
                         'rows': rows, 'cols': cols, 'unknown_cells': int(np.count_nonzero(~np.isfinite(grid.elevation))),
                         'round_trip': round_trip, 'allow_slope_traverse': allow_traverse, 'mineral_attractors': mineral_features, 'automatic_science_stops': [f['properties']['id'] for f in deep_science_features] if not targets else [], 'applied_obstacles': obstacles,
                         'source': data.get('source', {})}, 'start': start, 'goal': goal, 'targets': targets or [dict(m, origin='catalogue') for m in minerals_input if isinstance(m, dict) and str(m.get('id', '')) in {f['properties']['id'] for f in deep_science_features}]}


def json_default(value):
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    raise TypeError('Unsupported JSON value')


if __name__ == '__main__':
    try:
        print(json.dumps(plan_request(json.loads(sys.stdin.buffer.read().decode('utf-8'))), default=json_default, allow_nan=False))
    except (ValueError, TypeError, KeyError) as error:
        print(json.dumps({'status': 'error', 'error': str(error)}))
