import { useState, useEffect } from 'react';
import { FiClock, FiTrash2, FiRefreshCw, FiChevronRight } from 'react-icons/fi';
import { getTripHistory, deleteTrip } from '../api/tripApi';
import './TripHistory.css';

export default function TripHistory({ onLoadTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getTripHistory();
      setTrips(data);
    } catch (err) {
      console.error('Failed to load trip history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this trip from history?')) return;
    try {
      await deleteTrip(id);
      setTrips(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete trip:', err);
    }
  };

  const handleLoad = (trip) => {
    if (onLoadTrip) {
      onLoadTrip({
        trip_summary: trip.trip_summary,
        stops: trip.stops,
        daily_logs: trip.daily_logs,
        route: {
          geometry: trip.route_geometry,
          current_location: trip.current_location_coords,
          pickup_location: trip.pickup_location_coords,
          dropoff_location: trip.dropoff_location_coords,
        },
      });
    }
  };

  if (trips.length === 0 && !loading) return null;

  return (
    <div className="trip-history glass-card" id="trip-history">
      <div className="history-header">
        <h3 className="section-title">
          <span className="icon" style={{ background: 'var(--accent-blue-glow)', color: 'var(--accent-blue)' }}>
            <FiClock />
          </span>
          Trip History
        </h3>
        <button className="btn btn-secondary btn-sm" onClick={fetchHistory} disabled={loading}>
          <FiRefreshCw className={loading ? 'spin-icon' : ''} size={13} />
        </button>
      </div>

      <div className="history-list">
        {trips.map((trip) => (
          <div
            key={trip.id}
            className="history-item"
            onClick={() => handleLoad(trip)}
            role="button"
            tabIndex={0}
          >
            <div className="history-route">
              <span className="route-point">{_shorten(trip.current_location)}</span>
              <span className="route-arrow">→</span>
              <span className="route-point">{_shorten(trip.pickup_location)}</span>
              <span className="route-arrow">→</span>
              <span className="route-point">{_shorten(trip.dropoff_location)}</span>
            </div>
            <div className="history-meta">
              <span className="history-date">{_formatDate(trip.created_at)}</span>
              <span className="history-miles">
                {trip.trip_summary?.total_distance_miles?.toLocaleString()} mi
              </span>
            </div>
            <div className="history-actions">
              <FiChevronRight className="load-icon" />
              <button
                className="delete-btn"
                onClick={(e) => handleDelete(trip.id, e)}
                title="Delete trip"
              >
                <FiTrash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function _shorten(str) {
  if (!str) return '';
  // Return first meaningful part (city name)
  const parts = str.split(',');
  return parts[0].trim().substring(0, 20);
}

function _formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
