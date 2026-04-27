import { FiClock, FiMapPin } from 'react-icons/fi';
import './StopsList.css';

const STOP_ICONS = {
  start: '📍',
  pickup: '📦',
  dropoff: '🏁',
  fuel: '⛽',
  rest_break: '☕',
  off_duty: '😴',
  restart: '🔄',
  end: '✅',
};

const STOP_BADGE_CLASS = {
  start: 'badge-stop',
  pickup: 'badge-stop',
  dropoff: 'badge-stop',
  fuel: 'badge-fuel',
  rest_break: 'badge-rest',
  off_duty: 'badge-rest',
  restart: 'badge-rest',
  end: 'badge-driving',
};

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(hours) {
  if (!hours || hours === 0) return '';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function StopsList({ stops }) {
  if (!stops || stops.length === 0) return null;

  return (
    <div className="stops-list glass-card animate-fade-in-up" id="stops-list">
      <h3 className="section-title">
        <span className="icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>🛣️</span>
        Route Stops & Schedule
      </h3>

      <div className="timeline">
        {stops.map((stop, idx) => (
          <div
            key={idx}
            className={`timeline-item ${stop.type}`}
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <div className="timeline-connector">
              <div className="timeline-dot">{STOP_ICONS[stop.type] || '📍'}</div>
              {idx < stops.length - 1 && <div className="timeline-line"></div>}
            </div>

            <div className="timeline-content">
              <div className="timeline-header">
                <span className={`badge ${STOP_BADGE_CLASS[stop.type] || 'badge-stop'}`}>
                  {stop.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                {stop.duration_hours > 0 && (
                  <span className="duration-tag">
                    <FiClock size={11} /> {formatDuration(stop.duration_hours)}
                  </span>
                )}
              </div>

              <p className="timeline-reason">{stop.reason}</p>

              <div className="timeline-meta">
                {stop.location?.name && (
                  <span className="meta-item">
                    <FiMapPin size={11} /> {stop.location.name.length > 60
                      ? stop.location.name.substring(0, 60) + '...'
                      : stop.location.name}
                  </span>
                )}
                <span className="meta-item">
                  <FiClock size={11} /> {formatTime(stop.arrival_time)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
