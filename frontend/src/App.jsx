import { useState } from 'react';
import { FiTruck } from 'react-icons/fi';
import TripForm from './components/TripForm';
import RouteMap from './components/RouteMap';
import ELDLogSheet from './components/ELDLogSheet';
import StopsList from './components/StopsList';
import TripSummary from './components/TripSummary';
import TripHistory from './components/TripHistory';
import { planTrip } from './api/tripApi';
import './App.css';

function App() {
  const [tripData, setTripData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (formData) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await planTrip(formData);
      setTripData(result);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to plan trip';
      setError(msg);
      console.error('Trip planning error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadTrip = (savedTrip) => {
    setTripData(savedTrip);
    setError(null);
    // Scroll to results
    setTimeout(() => {
      document.getElementById('trip-summary')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">
              <FiTruck />
            </div>
            <div>
              <h1>ELD Trip Planner</h1>
              <p className="header-subtitle">HOS-Compliant Route Planning for Property Carriers</p>
            </div>
          </div>
          <div className="header-badge">
            <span>FMCSA</span> 70hr / 8-day
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="app-main">
        {/* Left Panel: Form + History */}
        <aside className="left-panel">
          <TripForm onSubmit={handleSubmit} isLoading={isLoading} />
          <TripHistory onLoadTrip={handleLoadTrip} />
        </aside>

        {/* Right Panel: Results */}
        <section className="right-panel">
          {/* Error */}
          {error && (
            <div className="error-banner animate-fade-in" id="error-message">
              <span>⚠️</span>
              <p>{error}</p>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="loading-overlay glass-card">
              <div className="spinner"></div>
              <p>Calculating HOS-compliant route...</p>
              <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                Geocoding locations, fetching route, simulating driving schedule
              </p>
            </div>
          )}

          {/* No data placeholder */}
          {!tripData && !isLoading && !error && (
            <div className="empty-state glass-card">
              <div className="empty-icon">🚛</div>
              <h2>Plan Your Next Trip</h2>
              <p>Enter your current location, pickup, and dropoff to generate an HOS-compliant route with ELD log sheets.</p>
              <div className="empty-features">
                <div className="feature-item">
                  <span>🗺️</span> Interactive route map with stops
                </div>
                <div className="feature-item">
                  <span>📋</span> FMCSA-style daily log sheets
                </div>
                <div className="feature-item">
                  <span>⏰</span> 11-hr driving / 14-hr window / 70-hr cycle
                </div>
                <div className="feature-item">
                  <span>⛽</span> Auto fuel stops every 1,000 miles
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {tripData && !isLoading && (
            <div className="results">
              <TripSummary summary={tripData.trip_summary} />
              <div className="results-map-stops">
                <div className="results-map">
                  <RouteMap route={tripData.route} stops={tripData.stops} />
                </div>
                <div className="results-stops">
                  <StopsList stops={tripData.stops} />
                </div>
              </div>
              <ELDLogSheet dailyLogs={tripData.daily_logs} />
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>ELD Trip Planner — Based on FMCSA Hours of Service Regulations (49 CFR Part 395) — April 2022</p>
      </footer>
    </div>
  );
}

export default App;
