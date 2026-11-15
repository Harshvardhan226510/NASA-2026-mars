import json
import io
import unittest
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import spiceypy as spice
from unittest.mock import patch
from api.route import handler
from celestial.moons import moon_request, window_start, START, END, LOCK


class MoonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packet = moon_request('2026-10-19T12:00:00Z')

    def test_two_geometric_moons_use_mars_center_and_iau_display_frame(self):
        p = self.packet
        self.assertEqual(p['center'], 'Mars center (499)')
        self.assertEqual(p['display_frame'], 'IAU_MARS')
        self.assertEqual(p['aberration'], 'NONE')
        for name, limits in [('phobos', (9e6, 10e6)), ('deimos', (23e6, 24e6))]:
            for sample in p['bodies'][name]['samples']:
                self.assertTrue(limits[0] < np.linalg.norm(sample[:3]) < limits[1])
                self.assertAlmostEqual(np.linalg.norm(sample[6:]), 1, places=12)

    def test_reference_frame_transform_recovers_direct_spice_state(self):
        with LOCK:
            for i in (0, 47, 180):
                et = spice.str2et('2026-10-19T12:00:00') + i*120
                q = self.packet['mars_fixed_rotation_xyzw'][i]
                rotation = spice.q2m([q[3], *q[:3]])
                for name, body in [('phobos', '401'), ('deimos', '402')]:
                    expected, _ = spice.spkpos(body, et, 'IAU_MARS', 'NONE', '499')
                    actual = rotation @ self.packet['bodies'][name]['samples'][i][:3]
                    self.assertLess(np.linalg.norm(actual-expected*1000), .1)

    def test_orbit_path_is_inertial_geometry_instead_of_rotating_ground_track(self):
        with LOCK:
            et = spice.str2et('2026-10-19T12:00:00')
            for name, body in [('phobos', '401'), ('deimos', '402')]:
                b = self.packet['bodies'][name]
                expected, _ = spice.spkpos(body, et+b['orbit_trace_seconds']/2, 'J2000', 'NONE', '499')
                self.assertEqual(len(b['orbit_j2000_m']), 769)
                self.assertLess(np.linalg.norm(expected*1000-b['orbit_j2000_m'][384]), .01)

    def test_time_validation_cannot_extrapolate_or_accept_unspecified_zones(self):
        for at in ('', '2026-10-19', '2026-10-19T12:00:00+05:30', 'badZ', '2024-12-31T23:59:59Z', '2036-01-01T00:00:00Z'):
            with self.assertRaises(ValueError):
                window_start(at)
        self.assertEqual(window_start('2025-01-01T00:00:00Z'), START)
        self.assertEqual(window_start('2035-12-31T23:59:59Z'), END-21600)

    def test_window_is_bounded_cached_and_json_serializable(self):
        self.assertIs(self.packet, moon_request('2026-10-19T17:59:59Z'))
        self.assertEqual(len(self.packet['bodies']['phobos']['samples']), 181)
        self.assertLess(len(json.dumps(self.packet, allow_nan=False)), 250000)


class MoonHttpTests(unittest.TestCase):
    def request(self, query='', command='GET'):
        request = object.__new__(handler)
        request.path = '/api/route'+query
        request.command = command
        request.wfile = io.BytesIO()
        request.headers = {}
        request.response_headers = {}
        request.send_response = lambda status: setattr(request, 'status', status)
        request.send_header = lambda key, value: request.response_headers.update({key: value})
        request.end_headers = lambda: None
        getattr(request, 'do_'+command)()
        return request, json.loads(request.wfile.getvalue())

    def test_moon_get_is_cached_and_route_readiness_stays_separate(self):
        request, payload = self.request('?service=moons&at=2026-10-19T12:00:00Z')
        self.assertEqual(request.status, 200)
        self.assertEqual(payload['schema'], 'mars-moons/1')
        self.assertIn('s-maxage=21600', request.response_headers['Cache-Control'])
        request, payload = self.request()
        self.assertEqual(payload['status'], 'ready')
        self.assertEqual(request.response_headers['Cache-Control'], 'no-store')

    def test_invalid_parameters_and_dates_are_not_cached(self):
        for query in ('?service=moons&at=badZ', '?service=moons&at=a&at=b', '?service=moons&unexpected=1', '?service=other'):
            request, _ = self.request(query)
            self.assertEqual(request.status, 400)
            self.assertEqual(request.response_headers['Cache-Control'], 'no-store')

    def test_moon_post_does_not_enter_the_route_engine(self):
        with patch('api.route.plan_request', side_effect=AssertionError('Unexpected route calculation')):
            request, _ = self.request('?service=moons', 'POST')
        self.assertEqual(request.status, 405)
        self.assertEqual(request.response_headers['Allow'], 'GET')

    def test_kernel_failure_is_explicit_unknown_instead_of_replacement_positions(self):
        with patch('celestial.http.moon_request', side_effect=RuntimeError('Unavailable kernel')), self.assertLogs(level='ERROR'):
            request, payload = self.request('?service=moons')
        self.assertEqual(request.status, 503)
        self.assertNotIn('bodies', payload)
        self.assertEqual(request.response_headers['Cache-Control'], 'no-store')


if __name__ == '__main__':
    unittest.main()
