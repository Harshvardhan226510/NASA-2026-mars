"""Moon HTTP responses dispatched through the shared Python function."""
import json
import logging
from urllib.parse import urlparse, parse_qs
from celestial.moons import moon_request


def serve_moons(request):
    def reply(status, payload):
        body = json.dumps(payload, separators=(',', ':'), allow_nan=False).encode()
        request.send_response(status)
        request.send_header('Content-Type', 'application/json')
        request.send_header('Cache-Control', 'public, max-age=300, s-maxage=21600' if status == 200 else 'no-store')
        request.send_header('Content-Length', str(len(body)))
        if status == 405:
            request.send_header('Allow', 'GET')
        request.end_headers()
        request.wfile.write(body)

    if request.command != 'GET':
        return reply(405, {'error': 'Use GET for moon ephemerides.'})
    query = parse_qs(urlparse(request.path).query, keep_blank_values=True)
    if query.pop('service', None) != ['moons'] or any(k != 'at' for k in query) or len(query.get('at', [])) > 1:
        return reply(400, {'error': 'Only one UTC at parameter is supported.'})
    try:
        reply(200, moon_request(query.get('at', [None])[0]))
    except ValueError as error:
        reply(400, {'error': str(error)})
    except Exception:
        logging.exception('moon_ephemeris_failed')
        reply(503, {'error': 'Moon ephemerides are unavailable. No substitute positions are used.'})
