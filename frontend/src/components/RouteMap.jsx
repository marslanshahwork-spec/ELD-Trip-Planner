import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './RouteMap.css';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
function createIcon(emoji, bgColor) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-pin" style="background:${bgColor}">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

const ICONS = {
  start: createIcon('📍', '#3b82f6'),
  pickup: createIcon('📦', '#10b981'),
  dropoff: createIcon('🏁', '#ef4444'),
  fuel: createIcon('⛽', '#f59e0b'),
  rest_break: createIcon('☕', '#f97316'),
  off_duty: createIcon('😴', '#8b5cf6'),
  restart: createIcon('🔄', '#ec4899'),
  end: createIcon('✅', '#10b981'),
};

function FitBounds({ routeCoords }) {
  const map = useMap();
  useEffect(() => {
    if (routeCoords && routeCoords.length > 0) {
      const bounds = L.latLngBounds(routeCoords.map(c => [c[1], c[0]]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routeCoords, map]);
  return null;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
  });
}

export default function RouteMap({ route, stops }) {
  if (!route || !route.geometry) return null;

  const coords = route.geometry.coordinates;
  const routePositions = coords.map(c => [c[1], c[0]]);

  return (
    <div className="route-map-container glass-card animate-fade-in-up" id="route-map">
      <div className="map-header">
        <h3 className="section-title">
          <span className="icon" style={{ background: 'var(--accent-blue-glow)', color: 'var(--accent-blue)' }}>🗺️</span>
          Route Map
        </h3>
        <div className="map-legend">
          <span className="legend-item"><span className="legend-dot" style={{background: '#3b82f6'}}></span>Start</span>
          <span className="legend-item"><span className="legend-dot" style={{background: '#10b981'}}></span>Pickup</span>
          <span className="legend-item"><span className="legend-dot" style={{background: '#ef4444'}}></span>Dropoff</span>
          <span className="legend-item"><span className="legend-dot" style={{background: '#f59e0b'}}></span>Fuel</span>
          <span className="legend-item"><span className="legend-dot" style={{background: '#8b5cf6'}}></span>Rest</span>
        </div>
      </div>
      <MapContainer
        center={[39.8, -98.5]}
        zoom={4}
        className="leaflet-map"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds routeCoords={coords} />

        {/* Route polyline */}
        <Polyline
          positions={routePositions}
          pathOptions={{
            color: '#3b82f6',
            weight: 4,
            opacity: 0.8,
          }}
        />

        {/* Stop markers */}
        {stops && stops.map((stop, idx) => {
          if (!stop.location || !stop.location.lat) return null;
          const icon = ICONS[stop.type] || ICONS.start;
          return (
            <Marker
              key={idx}
              position={[stop.location.lat, stop.location.lon]}
              icon={icon}
            >
              <Popup>
                <div className="popup-content">
                  <strong>{stop.reason}</strong>
                  <br />
                  <span style={{fontSize: '12px', opacity: 0.8}}>
                    {stop.location.name}
                  </span>
                  {stop.duration_hours > 0 && (
                    <>
                      <br />
                      <span style={{fontSize: '12px'}}>
                        Duration: {stop.duration_hours}h
                      </span>
                    </>
                  )}
                  <br />
                  <span style={{fontSize: '11px', opacity: 0.6}}>
                    {formatTime(stop.arrival_time)}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
