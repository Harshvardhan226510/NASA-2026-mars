import base64
import hashlib
import json
import math
import heapq
import unittest
import zlib
from pathlib import Path
import numpy as np
from routing.adapters import LocalElevationGrid, AtlasPathfinder, corridor_cells
from routing.upstream.pathfinder import MarsPathfinder
from routing.service import plan_request
from routing.profile import terrain_profile

ROOT = Path(__file__).resolve().parents[1]


class RoutingTests(unittest.TestCase):
    def test_profile_samples_relief_between_simplified_waypoints_without_changing_engine(self):
        matrix = np.tile(np.array([0, 10, 20, 10, 0], dtype=np.float32), (5, 1))
        grid = LocalElevationGrid(matrix, 100, (77.4, 18.45), 22)
        route = {'grid_path': [(2, 0), (2, 4)]}
        profile = terrain_profile(route, grid)
        self.assertEqual([p['elevation_m'] for p in profile['samples']], [0, 10, 20, 10, 0])
        self.assertAlmostEqual(profile['samples'][-1]['distance_m'], 400, places=2)
        self.assertEqual(route, {'grid_path': [(2, 0), (2, 4)]})
        self.assertIsNone(terrain_profile({'status': 'failed'}, grid))

    def grid(self, n=41, spacing=50, center=(77.4, 18.45)):
        return LocalElevationGrid(np.zeros((n, n)), spacing, center, 22)

    def request(self):
        grid = self.grid(21)
        return {'schema': 'mars-route-request/1', 'start': list(grid.grid_to_geo(17, 3)[:2]),
                'goal': list(grid.grid_to_geo(3, 17)[:2]), 'targets': [],
                'grid': {'rows': 21, 'cols': 21, 'resolution_meters': 50, 'center': [77.4, 18.45],
                         'elevation_matrix': np.zeros((21, 21)).tolist(), 'source': {'label': 'test'}}}

    def test_return_field_matches_directed_energy_search_and_keeps_exclusions(self):
        request = self.request()
        heights = np.tile(np.arange(21, dtype=float) * 8, (21, 1))
        heights[0, 0] = np.nan
        grid = LocalElevationGrid(heights, 50, (77.4, 18.45), 22)
        request['grid']['elevation_matrix'] = [[float(h) if np.isfinite(h) else None for h in row] for row in heights]
        request.update(round_trip=True, return_to=request['goal'], return_field=True,
                       obstacles=[{'point': list(grid.grid_to_geo(10, 10)[:2]), 'radius_m': 0}])
        result = plan_request(request)
        packet = result['return_field']
        distances = np.frombuffer(zlib.decompress(base64.b64decode(packet['data'])), dtype='<f4').reshape(21, 21, 2)
        self.assertEqual(distances[3, 17].tolist(), [0, 0])
        self.assertEqual(distances[10, 10, 0], -1)
        self.assertEqual(distances[0, 0, 0], -2)
        searched = result['routes']['direct_safe']
        self.assertAlmostEqual(distances[17, 3, 1], searched['search']['energy_joules'] / 1000, places=4)
        self.assertAlmostEqual(searched['terrain_profile']['samples'][-1]['travel_energy_kj'],
                               searched['search']['energy_joules'] / 1000, places=4)
        request['return_to'] = request['start']
        back = plan_request(request)
        values = np.frombuffer(zlib.decompress(base64.b64decode(back['return_field']['data'])), dtype='<f4').reshape(21, 21, 2)
        self.assertAlmostEqual(values[3, 17, 1], back['return_route']['search']['energy_joules'] / 1000, places=4)
        self.assertLess(values[3, 17, 1], distances[17, 3, 1])
        request['return_to'] = request['obstacles'][0]['point']
        self.assertEqual(plan_request(request)['return_field'], {'status': 'blocked'})

    def test_rehearsal_can_recompute_only_the_return_grid_with_a_temporary_blockage(self):
        request = self.request()
        grid = self.grid(21)
        request.update(round_trip=True, return_field_only=True,
                       obstacles=[{'id': 'rehearsal', 'point': list(grid.grid_to_geo(10, 10)[:2]), 'radius_m': 24}])
        result = plan_request(request)
        self.assertEqual(result['schema'], 'mars-return-field-result/1')
        self.assertNotIn('routes', result)
        packet = result['return_field']
        values = np.frombuffer(zlib.decompress(base64.b64decode(packet['data'])), dtype='<f4').reshape(21, 21, 2)
        self.assertEqual(values[10, 10, 0], -1)
        self.assertEqual(values[17, 3, 0], 0)

    def test_upstream_files_are_byte_exact(self):
        manifest = json.loads((ROOT / 'routing/upstream-source.json').read_text())
        for name, expected in manifest['sha256'].items():
            self.assertEqual(hashlib.sha256((ROOT / 'routing/upstream' / name).read_bytes()).hexdigest(), expected)

    def test_original_costs_apf_and_all_profiles_are_preserved_on_valid_terrain(self):
        grid = self.grid()
        options = dict(astronaut_mass_kg=140, gravity_ratio=.38, apf_attraction_pull=1.25, apf_sensor_radius_m=900)
        old, new = MarsPathfinder(grid, **options), AtlasPathfinder(grid, **options)
        for diff in [-20, 0, 20]:
            self.assertEqual(new.step_metabolic_joules(diff, 50, 15), old.step_metabolic_joules(diff, 50, 15))
        targets = [{'geometry': {'coordinates': list(grid.grid_to_geo(r, c)[:2])}, 'properties': {'id': str(i), 'science_value': score}}
                   for i, (r, c, score) in enumerate([(29, 12, 90), (11, 27, 75), (20, 21, 95)])]
        start, goal = grid.grid_to_geo(35, 4)[:2], grid.grid_to_geo(4, 35)[:2]
        a, b = old.plan_all_mission_profiles(start, goal, targets), new.plan_all_mission_profiles(start, goal, targets)
        for profile in ['direct_safe', 'apf_survey', 'deep_science']:
            self.assertEqual(a[profile]['status'], b[profile]['status'])
            self.assertEqual(a[profile]['summary'], b[profile]['summary'])
            if profile != 'direct_safe':
                self.assertEqual(a[profile]['grid_path'], b[profile]['grid_path'])
            else:
                self.assertTrue(b[profile]['search']['optimal_on_strict_grid'])

    def test_smoothing_cannot_shortcut_through_a_cliff(self):
        grid = self.grid(32)
        grid.walkable_mask[:, 15] = False
        grid.walkable_mask[24:29, 15] = True
        old, fixed = MarsPathfinder(grid), AtlasPathfinder(grid)
        a, b = old.find_segment((5, 4), (5, 26)), fixed.find_segment((5, 4), (5, 26))
        self.assertTrue(a and b)
        def blocked(path):
            return any(not grid.is_walkable(*p) for start, end in zip(path, path[1:]) for p in corridor_cells(start, end))
        self.assertTrue(blocked(a), 'fixture must reproduce the upstream smoothing defect')
        self.assertFalse(blocked(b))

    def test_local_projection_round_trips_and_uses_metre_cells_at_high_latitude_and_dateline(self):
        for center in [(77.4, 18.45), (179.999, 80), (-170, -85)]:
            grid = self.grid(center=center)
            for r, c in [(0, 0), (20, 20), (40, 40), (2, 38)]:
                lon, lat, _ = grid.grid_to_geo(r, c)
                self.assertEqual(grid.geo_to_grid(lon, lat), (r, c))
                x, y = grid.project(lon, lat)
                self.assertAlmostEqual(x, (c-20)*50, places=5)
                self.assertAlmostEqual(y, (20-r)*50, places=5)

    def test_request_runs_all_profiles_and_reports_direct_fallback(self):
        result = plan_request(self.request())
        self.assertEqual(result['metadata']['upstream_commit'], '814c8a44d8df4a89fd4674d74265052105f368d4')
        for route in result['routes'].values():
            self.assertEqual(route['status'], 'success')
            self.assertTrue(route['validation']['corridor_checked'])
        self.assertIn('fallback', result['routes']['deep_science']['notice'])

    def test_catalogue_markers_change_science_profiles_and_preserve_the_direct_reference(self):
        request = self.request()
        grid = self.grid(21)
        request.update(start=list(grid.grid_to_geo(10, 2)[:2]), goal=list(grid.grid_to_geo(10, 18)[:2]),
                       options={'apf_pull': 2.5, 'sensor_radius_m': 900})
        baseline = plan_request(request)
        target = {'id': 'site:test-delta', 'siteId': 'test-delta', 'name': 'Test delta research marker',
                  'point': list(grid.grid_to_geo(4, 10)[:2]), 'score': 100, 'origin': 'catalogue',
                  'category': 'science', 'source': {'title': 'Fixture provenance', 'url': 'https://science.nasa.gov/'}}
        request['targets'] = [target]
        result = plan_request(request)
        self.assertEqual(result['targets'], [target])
        self.assertEqual(result['routes']['direct_safe']['grid_path'], baseline['routes']['direct_safe']['grid_path'])
        self.assertNotEqual(result['routes']['apf_survey']['grid_path'], baseline['routes']['apf_survey']['grid_path'])
        def closest(path):
            cells = {tuple(p) for p in path}
            for a, b in zip(path, path[1:]):
                cells.update(corridor_cells(a, b))
            return min(math.hypot(r - 4, c - 10) for r, c in cells)
        self.assertLess(closest(result['routes']['apf_survey']['grid_path']), closest(baseline['routes']['apf_survey']['grid_path']))
        deep = result['routes']['deep_science']
        self.assertEqual(deep['status'], 'success')
        self.assertIn((4, 10), [tuple(p) for p in deep['grid_path']])
        self.assertFalse(deep['unreached_targets'])

    def test_unknown_elevation_is_blocked_and_cannot_report_a_route(self):
        request = self.request()
        request['grid']['elevation_matrix'] = [[None]*21 for _ in range(21)]
        for route in plan_request(request)['routes'].values():
            self.assertEqual(route['status'], 'failed')

    def test_return_is_independently_planned_with_directional_energy_and_declared_home(self):
        request = self.request(); grid = self.grid(21)
        request.update(start=list(grid.grid_to_geo(10, 2)[:2]), goal=list(grid.grid_to_geo(10, 18)[:2]), round_trip=True)
        request['grid']['elevation_matrix'] = np.tile(np.arange(21, dtype=float)*5, (21, 1)).tolist()
        result = plan_request(request)
        self.assertEqual(result['return_route']['status'], 'success')
        self.assertGreater(result['routes']['direct_safe']['summary']['minetti_energy_kj'], result['return_route']['summary']['minetti_energy_kj'])
        self.assertEqual(tuple(result['return_route']['grid_path'][-1]), (10, 2))
        request.update(start=list(grid.grid_to_geo(10, 8)[:2]), return_to=list(grid.grid_to_geo(10, 2)[:2]))
        moved = plan_request(request)
        self.assertEqual(tuple(moved['return_route']['grid_path'][-1]), (10, 2))

    def test_direct_and_return_match_independent_dijkstra_and_retrace_is_valid(self):
        # Nonuniform low relief: downhill costs undercut the old flat heuristic.
        rng = np.random.default_rng(18)
        grid = LocalElevationGrid(rng.normal(0, 2, (13, 13)), 50, (77.4, 18.45), 22)
        engine = AtlasPathfinder(grid, allow_slope_traverse=False)
        def energy(path):
            return sum(engine.step_metabolic_joules(
                grid.get_elevation(*b)-grid.get_elevation(*a),
                math.dist(a,b)*grid.resolution,grid.get_slope(*b))
                for a,b in zip(path,path[1:]))
        def oracle(start, goal):
            queue, best = [(0.,start)], {start:0.}
            while queue:
                cost, a = heapq.heappop(queue)
                if cost != best[a]: continue
                if a == goal: return cost
                for dr,dc,_ in engine.NEIGHBORS:
                    b=(a[0]+dr,a[1]+dc)
                    if not grid.is_walkable(*b): continue
                    if dr and dc and (not grid.is_walkable(a[0]+dr,a[1]) or not grid.is_walkable(a[0],a[1]+dc)): continue
                    value=cost+energy([a,b])
                    if value < best.get(b,math.inf):
                        best[b]=value;heapq.heappush(queue,(value,b))
        a,b=(11,1),(1,11)
        out=engine.plan_direct_safe_route(grid.grid_to_geo(*a)[:2],grid.grid_to_geo(*b)[:2])
        back=engine.plan_direct_safe_route(grid.grid_to_geo(*b)[:2],grid.grid_to_geo(*a)[:2])
        for route,start,goal in [(out,a,b),(back,b,a)]:
            self.assertEqual(route['status'],'success')
            self.assertAlmostEqual(route['search']['energy_joules'],oracle(start,goal),places=6)
            self.assertAlmostEqual(route['summary']['minetti_energy_kj'],energy(route['grid_path'])/1000,delta=.051)
        retrace=list(reversed(out['grid_path']))
        self.assertTrue(all(grid.is_walkable(*p) for p in retrace))
        self.assertLessEqual(energy(back['grid_path']),energy(retrace)+1e-6)

    def test_direct_route_cannot_cut_diagonal_between_excluded_cells(self):
        grid=self.grid(5);grid.walkable_mask[1,2]=False;grid.walkable_mask[2,1]=False
        engine=AtlasPathfinder(grid,allow_slope_traverse=False)
        route=engine.plan_direct_safe_route(grid.grid_to_geo(1,1)[:2],grid.grid_to_geo(2,2)[:2])
        self.assertEqual(route['status'],'success')
        self.assertGreater(len(route['grid_path']),2)
        for a,b in zip(route['grid_path'],route['grid_path'][1:]):
            dr,dc=b[0]-a[0],b[1]-a[1]
            if dr and dc:
                self.assertTrue(grid.is_walkable(a[0]+dr,a[1]))
                self.assertTrue(grid.is_walkable(a[0],a[1]+dc))

    def test_reported_obstacles_replan_both_directions_without_fabricating_missing_elevation(self):
        request = self.request(); grid = self.grid(21)
        request.update(start=list(grid.grid_to_geo(10, 2)[:2]), goal=list(grid.grid_to_geo(10, 18)[:2]), round_trip=True)
        baseline = plan_request(request)
        request['obstacles'] = [{'id': 'field-report', 'point': list(grid.grid_to_geo(10, 10)[:2]), 'radius_m': 100}]
        result = plan_request(request)
        self.assertEqual(result['metadata']['unknown_cells'], 0)
        self.assertGreater(result['metadata']['applied_obstacles'][0]['excluded_walkable_cells'], 0)
        self.assertGreater(result['routes']['direct_safe']['summary']['total_distance_km'], baseline['routes']['direct_safe']['summary']['total_distance_km'])
        for route in [result['routes']['direct_safe'], result['return_route']]:
            self.assertEqual(route['status'], 'success')
            cells = set()
            for a, b in zip(route['grid_path'], route['grid_path'][1:]):
                cells.update(corridor_cells(a, b))
            self.assertNotIn((10, 10), cells)
        request['obstacles'] *= 65
        with self.assertRaisesRegex(ValueError, '64'):
            plan_request(request)

    def test_broad_area_larger_than_150_km_runs_original_profiles(self):
        grid = self.grid(161, spacing=2500, center=(-72, -8))
        request = self.request()
        request.update(start=list(grid.grid_to_geo(140, 20)[:2]), goal=list(grid.grid_to_geo(20, 140)[:2]))
        request['grid'].update(rows=161, cols=161, resolution_meters=2500,
                               center=[-72, -8], elevation_matrix=np.zeros((161, 161)).tolist())
        result = plan_request(request)
        self.assertEqual(result['metadata']['window_width_m'], 400000)
        self.assertGreater(result['metadata']['projection_max_scale_error'], 0)
        for route in result['routes'].values():
            self.assertEqual(route['status'], 'success')
            self.assertGreater(route['summary']['total_distance_km'], 150)
            self.assertTrue(route['validation']['corridor_checked'])

    def test_grid_budget_is_separate_from_distance_and_antipode_geometry(self):
        request = self.request();request['grid']['rows'] = 514
        with self.assertRaisesRegex(ValueError, '513'):
            plan_request(request)
        request = self.request();request['grid']['resolution_meters'] = 1000000
        with self.assertRaisesRegex(ValueError, 'antipode'):
            plan_request(request)

    def test_input_limits_prevent_outside_window_clipping_and_factorial_requests(self):
        request = self.request();request['goal'] = [0, 0]
        with self.assertRaisesRegex(ValueError, 'outside'):
            plan_request(request)
        request = self.request();request['targets'] = [{}] * 7
        with self.assertRaisesRegex(ValueError, 'six'):
            plan_request(request)
        request = self.request();request['grid']['elevation_matrix'][0][0] = float('inf')
        with self.assertRaises(ValueError):
            plan_request(request)
        request = self.request();request['goal'] = request['start']
        with self.assertRaisesRegex(ValueError, 'same terrain cell'):
            plan_request(request)


    def test_cliff_traverse_renders_when_slope_limit_exceeded(self):
        matrix = np.zeros((30, 30))
        matrix[:10, :] = 4000.0
        for r in range(10, 19):
            matrix[r, :] = 4000.0 - (r - 9) * 400.0
        matrix[19:, :] = 0.0
        for r in range(10, 19):
            matrix[r, 22:27] = 4000.0 - (r - 9) * 200.0
        grid = LocalElevationGrid(matrix, 100, (77.4, 18.45), 22)
        start = grid.grid_to_geo(25, 5)[:2]
        goal = grid.grid_to_geo(5, 5)[:2]
        engine = AtlasPathfinder(grid)
        res = engine.plan_all_mission_profiles(start, goal, [])
        self.assertEqual(res['direct_safe']['status'], 'success')
        self.assertTrue(len(res['direct_safe']['waypoints']) > 0)
        self.assertIn('Cliff traverse', res['direct_safe'].get('notice', ''))

    def test_apf_survey_bends_towards_regional_minerals(self):
        matrix = np.zeros((31, 31))
        grid = LocalElevationGrid(matrix, 1000, (77.4, 18.45), 22)
        start = grid.grid_to_geo(25, 5)[:2]
        goal = grid.grid_to_geo(5, 25)[:2]
        mineral_geo = grid.grid_to_geo(15, 5)[:2]
        mineral = [{'geometry': {'coordinates': list(mineral_geo)}, 'properties': {'id': 'm1', 'science_value': 100, 'radius_m': 12000}}]
        engine = AtlasPathfinder(grid, apf_attraction_pull=1.5, apf_sensor_radius_m=12000)
        res = engine.plan_all_mission_profiles(start, goal, mineral)
        direct_pts = res['direct_safe']['grid_path']
        apf_pts = res['apf_survey']['grid_path']
        min_d_direct = min(math.hypot(r - 15, c - 5) for r, c in direct_pts)
        min_d_apf = min(math.hypot(r - 15, c - 5) for r, c in apf_pts)
        self.assertLess(min_d_apf, min_d_direct)


    def test_api_slope_fallback_is_opt_in_and_cannot_cross_reported_obstacles(self):
        matrix = np.tile(np.arange(21, dtype=float) * 100, (21, 1))
        grid = LocalElevationGrid(matrix, 50, (77.4, 18.45), 22)
        request = self.request()
        request['grid']['elevation_matrix'] = matrix.tolist()
        request['start'] = list(grid.grid_to_geo(10, 2)[:2])
        request['goal'] = list(grid.grid_to_geo(10, 18)[:2])
        strict = plan_request(request)
        self.assertEqual(strict['routes']['direct_safe']['status'], 'failed')
        request['options'] = {'allow_slope_traverse': True}
        relaxed = plan_request(request)
        self.assertEqual(relaxed['routes']['direct_safe']['status'], 'success')
        self.assertTrue(relaxed['routes']['direct_safe']['validation']['cliff_traverse'])
        request['obstacles'] = [{'point': list(grid.grid_to_geo(10, 10)[:2]), 'radius_m': 10000}]
        blocked = plan_request(request)
        self.assertEqual(blocked['routes']['direct_safe']['status'], 'failed')
        self.assertIn('obstacle', blocked['routes']['direct_safe']['reason'])
        request['options']['allow_slope_traverse'] = 'yes'
        with self.assertRaisesRegex(ValueError, 'true or false'):
            plan_request(request)

    def test_regional_minerals_in_api_preserve_explicit_checkpoints_and_expose_automatic_stops(self):
        request = self.request()
        grid = self.grid(21)
        mineral = {'id': 'site:regional', 'siteId': 'regional', 'name': 'Published occurrence',
                   'point': list(grid.grid_to_geo(10, 4)[:2]), 'score': 95, 'radius_m': 1000,
                   'source': {'title': 'Research catalogue', 'url': 'https://science.nasa.gov/'}}
        request['minerals'] = [mineral]
        result = plan_request(request)
        self.assertEqual(result['metadata']['automatic_science_stops'], ['site:regional'])
        self.assertEqual(result['targets'][0]['source'], mineral['source'])
        self.assertEqual(result['routes']['deep_science']['status'], 'success')
        explicit = {'id': 'user', 'point': list(grid.grid_to_geo(9, 8)[:2]), 'score': 50}
        request['targets'] = [explicit]
        result = plan_request(request)
        self.assertEqual(result['targets'], [explicit])
        self.assertEqual(result['metadata']['automatic_science_stops'], [])


if __name__ == '__main__':
    unittest.main()
