import { FiNavigation, FiClock, FiTruck, FiActivity, FiFlag, FiZap } from 'react-icons/fi';
import './TripSummary.css';

export default function TripSummary({ summary }) {
  if (!summary) return null;

  const cards = [
    {
      icon: <FiNavigation />,
      label: 'Total Distance',
      value: `${summary.total_distance_miles?.toLocaleString()} mi`,
      color: 'var(--accent-blue)',
      glow: 'var(--accent-blue-glow)',
    },
    {
      icon: <FiTruck />,
      label: 'Driving Time',
      value: formatDuration(summary.total_driving_hours),
      color: 'var(--accent-emerald)',
      glow: 'var(--accent-emerald-glow)',
    },
    {
      icon: <FiClock />,
      label: 'Total Trip Time',
      value: formatDuration(summary.total_trip_hours),
      color: 'var(--accent-purple)',
      glow: 'var(--accent-purple-glow)',
    },
    {
      icon: <FiFlag />,
      label: 'Stops',
      value: summary.num_stops,
      color: 'var(--accent-amber)',
      glow: 'var(--accent-amber-glow)',
    },
    {
      icon: <FiActivity />,
      label: 'Log Sheets',
      value: summary.num_log_sheets,
      color: 'var(--accent-cyan)',
      glow: 'rgba(6, 182, 212, 0.15)',
    },
    {
      icon: <FiZap />,
      label: 'Cycle Remaining',
      value: `${summary.cycle_hours_remaining}h`,
      color: summary.cycle_hours_remaining < 10 ? 'var(--accent-red)' : 'var(--accent-emerald)',
      glow: summary.cycle_hours_remaining < 10 ? 'var(--accent-red-glow)' : 'var(--accent-emerald-glow)',
    },
  ];

  return (
    <div className="trip-summary animate-fade-in-up" id="trip-summary">
      <h3 className="section-title">
        <span className="icon" style={{ background: 'var(--accent-purple-glow)', color: 'var(--accent-purple)' }}>📊</span>
        Trip Summary
      </h3>
      <div className="summary-grid">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className="summary-card glass-card"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="card-icon" style={{ background: card.glow, color: card.color }}>
              {card.icon}
            </div>
            <div className="card-info">
              <span className="card-value" style={{ color: card.color }}>{card.value}</span>
              <span className="card-label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      {summary.start_time && summary.end_time && (
        <div className="time-range">
          <span>{formatDateTime(summary.start_time)}</span>
          <span className="time-arrow">→</span>
          <span>{formatDateTime(summary.end_time)}</span>
        </div>
      )}
    </div>
  );
}

function formatDuration(hours) {
  if (!hours) return '0h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}
