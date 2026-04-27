import { useState, useEffect, useRef, useCallback } from 'react';
import { FiMapPin, FiSearch, FiX } from 'react-icons/fi';
import './LocationAutocomplete.css';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const DEBOUNCE_MS = 350;

export default function LocationAutocomplete({
  id,
  label,
  icon,
  placeholder,
  value,
  onChange,
  required = false,
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (searchText) => {
    if (!searchText || searchText.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchText,
        limit: 6,
        lang: 'en',
        osm_tag: '!railway',
      });

      const resp = await fetch(`${PHOTON_URL}?${params}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!resp.ok) throw new Error('Geocoding failed');

      const data = await resp.json();
      const results = (data.features || []).map((f) => {
        const p = f.properties || {};
        const parts = [];
        if (p.name) parts.push(p.name);
        if (p.city && p.city !== p.name) parts.push(p.city);
        if (p.county && !parts.includes(p.county)) parts.push(p.county);
        if (p.state) parts.push(p.state);
        if (p.country) parts.push(p.country);

        return {
          display: parts.join(', '),
          main: p.name || p.city || p.county || '',
          secondary: parts.slice(1).join(', '),
          type: p.osm_value || p.type || '',
          lat: f.geometry?.coordinates?.[1],
          lon: f.geometry?.coordinates?.[0],
        };
      });

      setSuggestions(results);
      setIsOpen(results.length > 0);
      setActiveIndex(-1);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);

    // Debounce the API call
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, DEBOUNCE_MS);
  };

  const handleSelect = (suggestion) => {
    setQuery(suggestion.display);
    onChange(suggestion.display);
    setIsOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSelect(suggestions[activeIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const formatType = (type) => {
    if (!type) return '';
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <label htmlFor={id} className="autocomplete-label">
        {icon} {label}
      </label>
      <div className="autocomplete-input-wrapper">
        <FiSearch className="input-search-icon" />
        <input
          ref={inputRef}
          type="text"
          id={id}
          className="input-field autocomplete-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        />
        {isLoading && <div className="input-spinner"><div className="spinner"></div></div>}
        {query && !isLoading && (
          <button className="input-clear" onClick={handleClear} type="button" aria-label="Clear">
            <FiX size={14} />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          className="autocomplete-dropdown"
          id={`${id}-listbox`}
          role="listbox"
        >
          {suggestions.map((s, idx) => (
            <li
              key={idx}
              id={`${id}-option-${idx}`}
              className={`autocomplete-option ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(idx)}
              role="option"
              aria-selected={idx === activeIndex}
            >
              <div className="option-icon">
                <FiMapPin size={14} />
              </div>
              <div className="option-text">
                <span className="option-main">{s.main}</span>
                {s.secondary && <span className="option-secondary">{s.secondary}</span>}
              </div>
              {s.type && <span className="option-type">{formatType(s.type)}</span>}
            </li>
          ))}
          <li className="autocomplete-footer">
            Powered by OpenStreetMap
          </li>
        </ul>
      )}
    </div>
  );
}
