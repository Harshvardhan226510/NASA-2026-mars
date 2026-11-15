import json
import logging
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from routing.service import plan_request, json_default


class handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload, default=json_default, allow_nan=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if 'service' in parse_qs(urlparse(self.path).query):
            from celestial.http import serve_moons
            return serve_moons(self)
        self.send_json(200, {'status': 'ready', 'engine': 'Harshvardhan226510/mars-mapping',
                             'profiles': ['direct_safe', 'apf_survey', 'deep_science']})

    def do_POST(self):
        if 'service' in parse_qs(urlparse(self.path).query):
            from celestial.http import serve_moons
            return serve_moons(self)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size <= 0 or size > 4_000_000:
                self.send_json(413, {'error': 'The sampled terrain request exceeds 4 MB. Use coarser cell spacing.'})
                return
            payload = json.loads(self.rfile.read(size))
            self.send_json(200, plan_request(payload))
        except (ValueError, TypeError, KeyError) as error:
            self.send_json(400, {'error': str(error)})
        except Exception:
            logging.exception('route_planning_failed')
            self.send_json(500, {'error': 'The route engine could not finish this request. Try a smaller area.'})
