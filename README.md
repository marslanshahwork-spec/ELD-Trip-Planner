# ELD Trip Planner

A full-stack application for planning HOS-compliant truck routes with interactive maps and FMCSA-style daily log sheets.

## Tech Stack

- **Backend**: Django 4.2 + Django REST Framework
- **Frontend**: React 19 + Vite
- **Map**: Leaflet.js + OpenStreetMap (dark CartoDB tiles)
- **Routing**: OSRM (Open Source Routing Machine)
- **Geocoding**: Nominatim (OpenStreetMap)
- **ELD Logs**: HTML5 Canvas

## Features

- 📍 Enter current location, pickup, and dropoff points
- 🗺️ Interactive route map with stop markers (fuel, rest, breaks)
- 📋 Canvas-drawn FMCSA-style daily log sheets with pagination
- ⏰ Full HOS compliance: 11-hr driving, 14-hr window, 70-hr/8-day cycle
- ⛽ Auto fuel stops every 1,000 miles
- 😴 Configurable sleeper berth split (7+3, 10+0, or split)
- 📊 Trip summary with stats
- 💾 Trip history with save/load/delete
- 🎨 Premium dark theme with glassmorphism design

## HOS Rules Implemented

| Rule | Value |
|------|-------|
| Max driving per shift | 11 hours |
| Max on-duty window | 14 hours |
| Mandatory break | 30 min after 8 hrs cumulative driving |
| Off-duty reset | 10 consecutive hours |
| Weekly cycle limit | 70 hours / 8 days |
| 34-hour restart | Resets cycle to 0 |
| Fuel stop interval | Every 1,000 miles |
| Pickup/Dropoff time | 1 hour each |

## Setup

### Prerequisites
- Python 3.12+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to Django on `http://localhost:8000`.

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/trips/plan/` | Plan a new trip |
| GET | `/api/trips/history/` | List saved trips |
| GET | `/api/trips/history/:id/` | Get trip detail |
| DELETE | `/api/trips/history/:id/` | Delete a trip |

### POST `/api/trips/plan/` Request Body

```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Indianapolis, IN",
  "dropoff_location": "Newark, NJ",
  "current_cycle_hours": 10,
  "start_time": "2024-04-28T06:00:00",
  "sleeper_berth_split": "7_3"
}
```

## Assumptions

- Property-carrying driver
- 70 hours / 8 days cycle
- No adverse driving conditions
- Fueling at least once every 1,000 miles
- 1 hour for pickup and drop-off

## Project Structure

```
├── backend/
│   ├── config/          # Django settings
│   ├── trips/
│   │   ├── hos_engine.py      # HOS calculation engine
│   │   ├── route_service.py   # OSRM + Nominatim
│   │   ├── models.py          # Trip history
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TripForm.jsx
│   │   │   ├── RouteMap.jsx
│   │   │   ├── ELDLogSheet.jsx
│   │   │   ├── StopsList.jsx
│   │   │   ├── TripSummary.jsx
│   │   │   └── TripHistory.jsx
│   │   ├── utils/
│   │   │   └── eldDrawer.js   # Canvas ELD log renderer
│   │   ├── api/
│   │   │   └── tripApi.js
│   │   ├── App.jsx
│   │   └── index.css          # Design system
│   └── vite.config.js
└── README.md
```
