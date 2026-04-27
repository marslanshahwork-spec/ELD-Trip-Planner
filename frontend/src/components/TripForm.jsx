import { useState } from 'react';
import { FiMapPin, FiPackage, FiFlag, FiClock, FiTruck, FiPlay } from 'react-icons/fi';
import LocationAutocomplete from './LocationAutocomplete';
import './TripForm.css';

export default function TripForm({ onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
    current_cycle_hours: 0,
    start_time: '',
    sleeper_berth_split: '7_3',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'current_cycle_hours' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleLocationChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = { ...formData };
    if (!submitData.start_time) {
      delete submitData.start_time;
    }
    onSubmit(submitData);
  };

  return (
    <form className="trip-form glass-card" onSubmit={handleSubmit} id="trip-form">
      <div className="form-header">
        <div className="form-icon">
          <FiTruck />
        </div>
        <div>
          <h2>Plan Your Trip</h2>
          <p>Enter trip details for HOS-compliant route planning</p>
        </div>
      </div>

      <div className="form-grid">
        <LocationAutocomplete
          id="current_location"
          label="Current Location"
          icon={<FiMapPin className="label-icon" />}
          placeholder="e.g., Chicago, IL"
          value={formData.current_location}
          onChange={(val) => handleLocationChange('current_location', val)}
          required
        />

        <LocationAutocomplete
          id="pickup_location"
          label="Pickup Location"
          icon={<FiPackage className="label-icon" />}
          placeholder="e.g., Indianapolis, IN"
          value={formData.pickup_location}
          onChange={(val) => handleLocationChange('pickup_location', val)}
          required
        />

        <LocationAutocomplete
          id="dropoff_location"
          label="Dropoff Location"
          icon={<FiFlag className="label-icon" />}
          placeholder="e.g., Newark, NJ"
          value={formData.dropoff_location}
          onChange={(val) => handleLocationChange('dropoff_location', val)}
          required
        />

        <div className="input-group">
          <label htmlFor="current_cycle_hours">
            <FiClock className="label-icon" /> Current Cycle Used (Hrs)
          </label>
          <div className="cycle-input-wrapper">
            <input
              type="range"
              id="cycle_slider"
              name="current_cycle_hours"
              min="0"
              max="70"
              step="0.5"
              value={formData.current_cycle_hours}
              onChange={handleChange}
              className="cycle-slider"
            />
            <div className="cycle-value-wrapper">
              <input
                type="number"
                id="current_cycle_hours"
                name="current_cycle_hours"
                className="input-field cycle-number"
                min="0"
                max="70"
                step="0.5"
                value={formData.current_cycle_hours}
                onChange={handleChange}
              />
              <span className="cycle-unit">/ 70 hrs</span>
            </div>
          </div>
          <div className="cycle-bar-track">
            <div
              className="cycle-bar-fill"
              style={{ width: `${(formData.current_cycle_hours / 70) * 100}%` }}
            />
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="start_time">
            <FiClock className="label-icon" /> Start Time (Optional)
          </label>
          <input
            type="datetime-local"
            id="start_time"
            name="start_time"
            className="input-field"
            value={formData.start_time}
            onChange={handleChange}
          />
        </div>

        <div className="input-group">
          <label htmlFor="sleeper_berth_split">
            Sleeper Berth Split
          </label>
          <select
            id="sleeper_berth_split"
            name="sleeper_berth_split"
            className="input-field"
            value={formData.sleeper_berth_split}
            onChange={handleChange}
          >
            <option value="7_3">7hr Sleeper + 3hr Off Duty</option>
            <option value="10_0">10hr Off Duty</option>
            <option value="split">Split (2hr OFF + 7hr SB + 1hr OFF)</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary submit-btn"
        disabled={isLoading || !formData.current_location || !formData.pickup_location || !formData.dropoff_location}
        id="submit-trip"
      >
        {isLoading ? (
          <>
            <span className="spinner" />
            Calculating Route...
          </>
        ) : (
          <>
            <FiPlay />
            Plan Trip
          </>
        )}
      </button>
    </form>
  );
}
