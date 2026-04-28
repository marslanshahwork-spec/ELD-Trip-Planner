"""
Vercel Serverless Function — Lightweight API Handler
No Django — uses pure Python + requests for a minimal serverless footprint.
Routes:
  POST /api/trips/plan/     → Plan a trip (HOS-compliant)
  GET  /api/trips/history/  → Get trip history (in-memory, per cold start)
  GET  /api/trips/history/<id>/ → Get single trip
  DELETE /api/trips/history/<id>/ → Delete a trip
"""
import json
import sys
import os
import time
import traceback
from datetime import datetime
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Add backend to Python path for HOS engine and route service
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'))

from trips.hos_engine import calculate_trip
from trips.route_service import geocode, get_route

# In-memory trip store (resets on cold start — Vercel serverless limitation)
_trip_store = []
_next_id = 1


def _json_response(body, status=200):
    """Create a JSON response dict."""
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        'body': json.dumps(body, default=str),
    }


def _parse_body(event):
    """Parse JSON body from Vercel event."""
    body = event.get('body', '')
    if not body:
        return {}
    if isinstance(body, str):
        return json.loads(body)
    return body


def _handle_plan_trip(data):
    """Handle POST /api/trips/plan/ — main trip planning logic."""
    global _next_id

    # Validate required fields
    required = ['current_location', 'pickup_location', 'dropoff_location', 'current_cycle_hours']
    for field in required:
        if field not in data or data[field] == '':
            return _json_response({'error': f'Missing required field: {field}'}, 400)

    current_cycle_hours = float(data['current_cycle_hours'])
    if current_cycle_hours < 0 or current_cycle_hours > 70:
        return _json_response({'error': 'current_cycle_hours must be between 0 and 70'}, 400)

    try:
        # 1. Geocode all locations
        current_loc = geocode(data['current_location'])
        time.sleep(1)  # Nominatim rate limit
        pickup_loc = geocode(data['pickup_location'])
        time.sleep(1)
        dropoff_loc = geocode(data['dropoff_location'])

        # 2. Get route from OSRM
        waypoints = [current_loc, pickup_loc, dropoff_loc]
        route_data = get_route(waypoints)

        # 3. Determine start time
        start_time = data.get('start_time')
        if start_time and isinstance(start_time, str):
            # Parse ISO format datetime
            start_time = start_time.replace('Z', '+00:00')
            try:
                start_time = datetime.fromisoformat(start_time)
            except ValueError:
                start_time = datetime.now()
            # Strip timezone for HOS engine
            if hasattr(start_time, 'tzinfo') and start_time.tzinfo is not None:
                start_time = start_time.replace(tzinfo=None)
        else:
            start_time = datetime.now()

        # 4. Run HOS engine
        sleeper_split = data.get('sleeper_berth_split', '7_3')
        result = calculate_trip(
            current_location=current_loc,
            pickup_location=pickup_loc,
            dropoff_location=dropoff_loc,
            route_data=route_data,
            cycle_hours_used=current_cycle_hours,
            start_time=start_time,
            sleeper_berth_split=sleeper_split,
        )

        # 5. Build response
        response_data = {
            'trip_summary': result['trip_summary'],
            'route': {
                'geometry': route_data['geometry'],
                'current_location': current_loc,
                'pickup_location': pickup_loc,
                'dropoff_location': dropoff_loc,
            },
            'stops': result['stops'],
            'daily_logs': result['daily_logs'],
        }

        # 6. Save to in-memory store
        try:
            trip_record = {
                'id': _next_id,
                'current_location': data['current_location'],
                'pickup_location': data['pickup_location'],
                'dropoff_location': data['dropoff_location'],
                'current_cycle_hours': current_cycle_hours,
                'start_time': start_time.isoformat(),
                'sleeper_berth_split': sleeper_split,
                'trip_summary': result['trip_summary'],
                'stops': result['stops'],
                'daily_logs': result['daily_logs'],
                'route_geometry': route_data['geometry'],
                'current_location_coords': current_loc,
                'pickup_location_coords': pickup_loc,
                'dropoff_location_coords': dropoff_loc,
                'created_at': datetime.now().isoformat(),
            }
            _trip_store.insert(0, trip_record)
            _next_id += 1
        except Exception:
            pass

        return _json_response(response_data, 200)

    except ValueError as e:
        return _json_response({'error': str(e)}, 400)
    except Exception as e:
        traceback.print_exc()
        return _json_response({'error': f'Trip planning failed: {str(e)}'}, 500)


def _handle_history_list():
    """Handle GET /api/trips/history/"""
    return _json_response(_trip_store, 200)


def _handle_history_detail(trip_id):
    """Handle GET /api/trips/history/<id>/"""
    for trip in _trip_store:
        if trip['id'] == trip_id:
            return _json_response(trip, 200)
    return _json_response({'error': 'Trip not found'}, 404)


def _handle_history_delete(trip_id):
    """Handle DELETE /api/trips/history/<id>/"""
    global _trip_store
    original_len = len(_trip_store)
    _trip_store = [t for t in _trip_store if t['id'] != trip_id]
    if len(_trip_store) < original_len:
        return _json_response({'status': 'deleted'}, 204)
    return _json_response({'error': 'Trip not found'}, 404)


class handler(BaseHTTPRequestHandler):
    """Vercel serverless handler using BaseHTTPRequestHandler."""

    def _send_json(self, body, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode('utf-8'))

    def _read_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            raw = self.rfile.read(content_length)
            return json.loads(raw.decode('utf-8'))
        return {}

    def _get_trip_id_from_path(self):
        """Extract trip ID from path like /api/trips/history/123/"""
        parts = self.path.rstrip('/').split('/')
        try:
            return int(parts[-1])
        except (ValueError, IndexError):
            return None

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

    def do_POST(self):
        path = self.path.rstrip('/')
        if path == '/api/trips/plan':
            try:
                data = self._read_body()
                result = _handle_plan_trip(data)
                self._send_json(
                    json.loads(result['body']),
                    result['statusCode']
                )
            except Exception as e:
                self._send_json({'error': str(e)}, 500)
        else:
            self._send_json({'error': 'Not found'}, 404)

    def do_GET(self):
        path = self.path.rstrip('/')
        if path == '/api/trips/history':
            result = _handle_history_list()
            self._send_json(json.loads(result['body']), result['statusCode'])
        elif '/api/trips/history/' in self.path:
            trip_id = self._get_trip_id_from_path()
            if trip_id:
                result = _handle_history_detail(trip_id)
                self._send_json(json.loads(result['body']), result['statusCode'])
            else:
                self._send_json({'error': 'Invalid trip ID'}, 400)
        else:
            self._send_json({'error': 'Not found'}, 404)

    def do_DELETE(self):
        if '/api/trips/history/' in self.path:
            trip_id = self._get_trip_id_from_path()
            if trip_id:
                result = _handle_history_delete(trip_id)
                self._send_json(
                    json.loads(result['body']) if result['body'] else {},
                    result['statusCode']
                )
            else:
                self._send_json({'error': 'Invalid trip ID'}, 400)
        else:
            self._send_json({'error': 'Not found'}, 404)

    def log_message(self, format, *args):
        """Suppress default logging to stderr."""
        pass
