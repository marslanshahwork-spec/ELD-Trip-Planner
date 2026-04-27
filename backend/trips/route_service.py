"""
Route service: OSRM routing + Nominatim geocoding.
"""
import requests
import time
import logging

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"

HEADERS = {
    "User-Agent": "ELDTripPlanner/1.0 (educational-project)"
}


def geocode(location_text):
    """
    Geocode a location string to (lat, lon, display_name).
    Uses Nominatim with proper rate limiting.
    """
    params = {
        "q": location_text,
        "format": "json",
        "limit": 1,
        "countrycodes": "us",
    }
    try:
        resp = requests.get(NOMINATIM_URL, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            raise ValueError(f"Could not geocode location: {location_text}")
        result = data[0]
        return {
            "lat": float(result["lat"]),
            "lon": float(result["lon"]),
            "name": result.get("display_name", location_text),
        }
    except requests.RequestException as e:
        logger.error(f"Geocoding error for '{location_text}': {e}")
        raise ValueError(f"Geocoding failed for: {location_text}")


def get_route(waypoints):
    """
    Get driving route from OSRM.
    waypoints: list of {"lat": float, "lon": float} dicts
    Returns route data with geometry, distance, duration, and steps.
    """
    coords = ";".join([f"{wp['lon']},{wp['lat']}" for wp in waypoints])
    url = f"{OSRM_URL}/{coords}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "true",
        "annotations": "true",
    }
    try:
        resp = requests.get(url, params=params, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") != "Ok":
            raise ValueError(f"OSRM routing failed: {data.get('message', 'Unknown error')}")

        route = data["routes"][0]
        legs = route["legs"]

        # Extract step-by-step info for each leg
        leg_details = []
        for leg in legs:
            leg_info = {
                "distance_miles": leg["distance"] * 0.000621371,
                "duration_hours": leg["duration"] / 3600,
                "steps": [],
            }
            for step in leg.get("steps", []):
                leg_info["steps"].append({
                    "instruction": step.get("name", ""),
                    "distance_miles": step["distance"] * 0.000621371,
                    "duration_hours": step["duration"] / 3600,
                    "maneuver": step.get("maneuver", {}),
                })
            leg_details.append(leg_info)

        return {
            "total_distance_miles": route["distance"] * 0.000621371,
            "total_duration_hours": route["duration"] / 3600,
            "geometry": route["geometry"],
            "legs": leg_details,
        }
    except requests.RequestException as e:
        logger.error(f"OSRM routing error: {e}")
        raise ValueError(f"Route calculation failed: {str(e)}")


def get_location_along_route(geometry_coords, fraction):
    """
    Get an approximate location along the route at a given fraction (0.0 to 1.0).
    Uses linear interpolation along the route geometry coordinates.
    """
    if not geometry_coords or len(geometry_coords) < 2:
        return geometry_coords[0] if geometry_coords else [0, 0]

    total_points = len(geometry_coords)
    index = int(fraction * (total_points - 1))
    index = max(0, min(index, total_points - 1))

    return geometry_coords[index]


def reverse_geocode(lat, lon):
    """
    Reverse geocode coordinates to a location name.
    """
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "zoom": 10,
    }
    try:
        time.sleep(1)  # Rate limit
        resp = requests.get(url, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        address = data.get("address", {})
        city = address.get("city", address.get("town", address.get("village", address.get("county", ""))))
        state = address.get("state", "")
        if city and state:
            return f"{city}, {state}"
        return data.get("display_name", f"{lat:.2f}, {lon:.2f}")
    except Exception:
        return f"{lat:.4f}, {lon:.4f}"
