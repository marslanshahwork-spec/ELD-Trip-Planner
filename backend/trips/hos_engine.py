"""
Hours of Service (HOS) Calculation Engine.

Implements FMCSA HOS rules for property-carrying CMV drivers:
- 11-hour driving limit
- 14-hour driving window
- 30-minute break after 8 hours cumulative driving
- 10-hour off-duty requirement
- 70-hour/8-day cycle limit
- 34-hour restart
- Fuel stop every 1,000 miles
- 1 hour for pickup and drop-off
"""
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import math


# HOS Constants
MAX_DRIVING_HOURS = 11.0
MAX_DUTY_WINDOW_HOURS = 14.0
BREAK_REQUIRED_AFTER_HOURS = 8.0
BREAK_DURATION_HOURS = 0.5  # 30 minutes
OFF_DUTY_REQUIRED_HOURS = 10.0
MAX_CYCLE_HOURS = 70.0
CYCLE_DAYS = 8
RESTART_HOURS = 34.0
FUEL_STOP_MILES = 1000.0
FUEL_STOP_DURATION_HOURS = 0.5  # 30 minutes
PICKUP_DURATION_HOURS = 1.0
DROPOFF_DURATION_HOURS = 1.0
AVERAGE_SPEED_MPH = 55.0  # Fallback if no OSRM data


class DriverState:
    """Tracks the current state of a driver for HOS compliance."""

    def __init__(self, current_time: datetime, cycle_hours_used: float = 0.0,
                 sleeper_berth_split: str = "7_3"):
        self.current_time = current_time
        self.driving_hours_today = 0.0
        self.on_duty_hours_today = 0.0
        self.window_start = current_time
        self.cycle_hours_used = cycle_hours_used
        self.miles_since_fuel = 0.0
        self.cumulative_driving_since_break = 0.0
        self.sleeper_berth_split = sleeper_berth_split  # "7_3", "10_0", or "split"
        self.total_miles_driven = 0.0

    @property
    def driving_hours_remaining(self) -> float:
        return max(0, MAX_DRIVING_HOURS - self.driving_hours_today)

    @property
    def window_hours_remaining(self) -> float:
        elapsed = (self.current_time - self.window_start).total_seconds() / 3600
        return max(0, MAX_DUTY_WINDOW_HOURS - elapsed)

    @property
    def hours_until_break(self) -> float:
        return max(0, BREAK_REQUIRED_AFTER_HOURS - self.cumulative_driving_since_break)

    @property
    def cycle_hours_remaining(self) -> float:
        return max(0, MAX_CYCLE_HOURS - self.cycle_hours_used)

    @property
    def miles_until_fuel(self) -> float:
        return max(0, FUEL_STOP_MILES - self.miles_since_fuel)

    def max_driveable_hours(self) -> float:
        """How many hours can the driver drive before needing any kind of stop?"""
        return min(
            self.driving_hours_remaining,
            self.window_hours_remaining,
            self.hours_until_break,
            self.cycle_hours_remaining,
        )

    def max_driveable_miles(self, speed_mph: float = AVERAGE_SPEED_MPH) -> float:
        """Max miles before any stop is needed."""
        time_limited = self.max_driveable_hours() * speed_mph
        fuel_limited = self.miles_until_fuel
        return min(time_limited, fuel_limited)

    def add_driving(self, hours: float, miles: float):
        self.driving_hours_today += hours
        self.on_duty_hours_today += hours
        self.cumulative_driving_since_break += hours
        self.cycle_hours_used += hours
        self.miles_since_fuel += miles
        self.total_miles_driven += miles
        self.current_time += timedelta(hours=hours)

    def add_on_duty(self, hours: float):
        self.on_duty_hours_today += hours
        self.cycle_hours_used += hours
        self.current_time += timedelta(hours=hours)

    def add_off_duty(self, hours: float):
        self.current_time += timedelta(hours=hours)

    def take_break(self):
        """30-minute rest break — resets driving-since-break counter."""
        self.current_time += timedelta(hours=BREAK_DURATION_HOURS)
        self.cumulative_driving_since_break = 0.0

    def take_full_rest(self, advance_time=True):
        """10-hour off-duty — resets daily driving and window."""
        if advance_time:
            self.current_time += timedelta(hours=OFF_DUTY_REQUIRED_HOURS)
        self.driving_hours_today = 0.0
        self.on_duty_hours_today = 0.0
        self.window_start = self.current_time
        self.cumulative_driving_since_break = 0.0

    def take_restart(self, advance_time=True):
        """34-hour restart — resets cycle."""
        if advance_time:
            self.current_time += timedelta(hours=RESTART_HOURS)
        self.driving_hours_today = 0.0
        self.on_duty_hours_today = 0.0
        self.window_start = self.current_time
        self.cumulative_driving_since_break = 0.0
        self.cycle_hours_used = 0.0


def _get_stop_reason(state: DriverState) -> str:
    """Determine what's forcing a stop."""
    if state.cycle_hours_remaining <= 0:
        return "70-hour cycle limit reached"
    if state.driving_hours_remaining <= 0:
        return "11-hour driving limit reached"
    if state.window_hours_remaining <= 0:
        return "14-hour driving window expired"
    if state.hours_until_break <= 0:
        return "8-hour driving — 30-min break required"
    if state.miles_until_fuel <= 0:
        return "Fuel stop (~1,000 miles)"
    return "Scheduled stop"


def _get_off_duty_entries(sleeper_berth_split: str, off_duty_start_hour: float):
    """
    Generate off-duty/sleeper berth entries based on user preference.
    Returns list of (status, duration_hours) tuples.
    """
    if sleeper_berth_split == "7_3":
        # 7 hours sleeper berth + 3 hours off-duty
        return [
            ("sleeper", 7.0),
            ("off_duty", 3.0),
        ]
    elif sleeper_berth_split == "split":
        # Split sleeper: 7 hours SB + 3 hours OFF (but split differently)
        return [
            ("off_duty", 2.0),
            ("sleeper", 7.0),
            ("off_duty", 1.0),
        ]
    else:  # "10_0" — all off-duty
        return [
            ("off_duty", 10.0),
        ]


def calculate_trip(
    current_location: Dict,
    pickup_location: Dict,
    dropoff_location: Dict,
    route_data: Dict,
    cycle_hours_used: float,
    start_time: datetime,
    sleeper_berth_split: str = "7_3",
) -> Dict:
    """
    Main HOS trip calculation.

    Parameters:
    - current_location: {"lat": float, "lon": float, "name": str}
    - pickup_location: {"lat": float, "lon": float, "name": str}
    - dropoff_location: {"lat": float, "lon": float, "name": str}
    - route_data: OSRM route response
    - cycle_hours_used: hours already used in 70-hour cycle
    - start_time: when the trip begins
    - sleeper_berth_split: "7_3", "10_0", or "split"

    Returns dict with stops, daily_logs, and trip_summary.
    """
    state = DriverState(start_time, cycle_hours_used, sleeper_berth_split)
    stops = []
    activities = []  # (start_time, end_time, status, location, notes)

    geometry_coords = route_data["geometry"]["coordinates"]
    legs = route_data["legs"]

    # Determine speed from OSRM data
    total_distance = route_data["total_distance_miles"]
    total_osrm_duration = route_data["total_duration_hours"]
    avg_speed = total_distance / total_osrm_duration if total_osrm_duration > 0 else AVERAGE_SPEED_MPH
    avg_speed = min(max(avg_speed, 40), 65)  # Clamp between 40-65 mph

    # Calculate per-leg data
    leg_distances = [leg["distance_miles"] for leg in legs]
    leg_durations = [leg["duration_hours"] for leg in legs]

    # ── Trip Start ──
    stops.append({
        "type": "start",
        "location": current_location,
        "arrival_time": state.current_time.isoformat(),
        "departure_time": state.current_time.isoformat(),
        "duration_hours": 0,
        "reason": "Trip start",
    })

    # Track where we are on the route (as fraction 0.0 to 1.0) for stop positions
    total_route_miles = sum(leg_distances)
    miles_covered = 0.0

    # ── Process each leg ──
    trip_phases = []
    if len(legs) >= 2:
        trip_phases = [
            {"type": "drive_to_pickup", "distance": leg_distances[0], "duration": leg_durations[0],
             "from": current_location, "to": pickup_location},
            {"type": "pickup", "location": pickup_location},
            {"type": "drive_to_dropoff", "distance": leg_distances[1], "duration": leg_durations[1],
             "from": pickup_location, "to": dropoff_location},
            {"type": "dropoff", "location": dropoff_location},
        ]
    elif len(legs) == 1:
        # Direct route
        trip_phases = [
            {"type": "drive_to_pickup", "distance": leg_distances[0], "duration": leg_durations[0],
             "from": current_location, "to": pickup_location},
            {"type": "pickup", "location": pickup_location},
            {"type": "dropoff", "location": dropoff_location},
        ]

    for phase in trip_phases:
        if phase["type"] in ("drive_to_pickup", "drive_to_dropoff"):
            # Simulate driving segment
            remaining_miles = phase["distance"]
            remaining_hours = phase["duration"]
            segment_speed = remaining_miles / remaining_hours if remaining_hours > 0 else avg_speed

            phase_label = "Driving to pickup" if phase["type"] == "drive_to_pickup" else "Driving to dropoff"

            while remaining_miles > 0.01:
                # Check if cycle limit requires a restart
                if state.cycle_hours_remaining <= 0:
                    fraction = miles_covered / total_route_miles if total_route_miles > 0 else 0
                    stop_coord = _get_coord_at_fraction(geometry_coords, fraction)
                    stop_location = _make_location(stop_coord, f"Rest area (mile {miles_covered:.0f})")

                    restart_start = state.current_time
                    restart_end = restart_start + timedelta(hours=RESTART_HOURS)
                    activities.append((
                        restart_start,
                        restart_end,
                        "sleeper",
                        stop_location["name"],
                        "34-hour restart (70-hour cycle limit)",
                    ))
                    stops.append({
                        "type": "restart",
                        "location": stop_location,
                        "arrival_time": restart_start.isoformat(),
                        "departure_time": restart_end.isoformat(),
                        "duration_hours": RESTART_HOURS,
                        "reason": "34-hour restart — 70-hour cycle limit reached",
                    })
                    state.current_time = restart_end
                    state.take_restart(advance_time=False)
                    continue

                # How far can we drive before any constraint hits?
                max_drive_hours = state.max_driveable_hours()
                max_drive_miles_time = max_drive_hours * segment_speed
                max_drive_miles_fuel = state.miles_until_fuel
                max_drive_miles = min(max_drive_miles_time, max_drive_miles_fuel, remaining_miles)

                if max_drive_miles <= 0.01:
                    # A constraint immediately triggers
                    fraction = miles_covered / total_route_miles if total_route_miles > 0 else 0
                    stop_coord = _get_coord_at_fraction(geometry_coords, fraction)
                    stop_location = _make_location(stop_coord, f"Rest area (mile {miles_covered:.0f})")

                    reason = _get_stop_reason(state)

                    if state.miles_until_fuel <= 0:
                        # Fuel stop
                        activities.append((
                            state.current_time,
                            state.current_time + timedelta(hours=FUEL_STOP_DURATION_HOURS),
                            "on_duty",
                            stop_location["name"],
                            "Fuel stop",
                        ))
                        stops.append({
                            "type": "fuel",
                            "location": stop_location,
                            "arrival_time": state.current_time.isoformat(),
                            "departure_time": (state.current_time + timedelta(hours=FUEL_STOP_DURATION_HOURS)).isoformat(),
                            "duration_hours": FUEL_STOP_DURATION_HOURS,
                            "reason": "Fuel stop (~1,000 miles)",
                        })
                        state.add_on_duty(FUEL_STOP_DURATION_HOURS)
                        state.miles_since_fuel = 0.0
                    elif state.hours_until_break <= 0:
                        # 30-minute break
                        activities.append((
                            state.current_time,
                            state.current_time + timedelta(hours=BREAK_DURATION_HOURS),
                            "off_duty",
                            stop_location["name"],
                            "30-minute rest break",
                        ))
                        stops.append({
                            "type": "rest_break",
                            "location": stop_location,
                            "arrival_time": state.current_time.isoformat(),
                            "departure_time": (state.current_time + timedelta(hours=BREAK_DURATION_HOURS)).isoformat(),
                            "duration_hours": BREAK_DURATION_HOURS,
                            "reason": "30-minute mandatory break (8 hrs driving)",
                        })
                        state.take_break()
                    else:
                        # 11-hr or 14-hr limit → full off-duty rest
                        off_duty_entries = _get_off_duty_entries(sleeper_berth_split, 0)
                        total_rest = sum(e[1] for e in off_duty_entries)
                        rest_start = state.current_time
                        rest_end = rest_start + timedelta(hours=total_rest)

                        activities_for_rest = _generate_rest_activities(
                            rest_start, off_duty_entries, stop_location["name"], reason
                        )
                        activities.extend(activities_for_rest)

                        stops.append({
                            "type": "off_duty",
                            "location": stop_location,
                            "arrival_time": rest_start.isoformat(),
                            "departure_time": rest_end.isoformat(),
                            "duration_hours": total_rest,
                            "reason": reason,
                        })
                        state.current_time = rest_end
                        state.take_full_rest(advance_time=False)
                    continue

                # Drive the segment
                drive_hours = max_drive_miles / segment_speed
                drive_start = state.current_time
                from_loc = phase["from"]["name"] if miles_covered == 0 else f"Mile {miles_covered:.0f}"

                state.add_driving(drive_hours, max_drive_miles)
                miles_covered += max_drive_miles
                remaining_miles -= max_drive_miles
                remaining_hours -= drive_hours

                activities.append((
                    drive_start,
                    state.current_time,
                    "driving",
                    from_loc,
                    phase_label,
                ))

                # After driving, check if fuel stop needed at this exact point
                if state.miles_since_fuel >= FUEL_STOP_MILES and remaining_miles > 0.01:
                    fraction = miles_covered / total_route_miles if total_route_miles > 0 else 0
                    stop_coord = _get_coord_at_fraction(geometry_coords, fraction)
                    stop_location = _make_location(stop_coord, f"Fuel stop (mile {miles_covered:.0f})")

                    activities.append((
                        state.current_time,
                        state.current_time + timedelta(hours=FUEL_STOP_DURATION_HOURS),
                        "on_duty",
                        stop_location["name"],
                        "Fuel stop",
                    ))
                    stops.append({
                        "type": "fuel",
                        "location": stop_location,
                        "arrival_time": state.current_time.isoformat(),
                        "departure_time": (state.current_time + timedelta(hours=FUEL_STOP_DURATION_HOURS)).isoformat(),
                        "duration_hours": FUEL_STOP_DURATION_HOURS,
                        "reason": "Fuel stop (~1,000 miles)",
                    })
                    state.add_on_duty(FUEL_STOP_DURATION_HOURS)
                    state.miles_since_fuel = 0.0

        elif phase["type"] == "pickup":
            # 1 hour on-duty for pickup
            pickup_start = state.current_time

            # Check if we have enough window
            if state.window_hours_remaining < PICKUP_DURATION_HOURS:
                # Need rest before pickup
                off_duty_entries = _get_off_duty_entries(sleeper_berth_split, 0)
                total_rest = sum(e[1] for e in off_duty_entries)
                rest_start = state.current_time
                rest_end = rest_start + timedelta(hours=total_rest)
                rest_activities = _generate_rest_activities(
                    rest_start, off_duty_entries,
                    phase["location"]["name"], "Rest before pickup"
                )
                activities.extend(rest_activities)
                stops.append({
                    "type": "off_duty",
                    "location": phase["location"],
                    "arrival_time": rest_start.isoformat(),
                    "departure_time": rest_end.isoformat(),
                    "duration_hours": total_rest,
                    "reason": "Rest required before pickup",
                })
                state.current_time = rest_end
                state.take_full_rest(advance_time=False)
                pickup_start = state.current_time

            activities.append((
                pickup_start,
                pickup_start + timedelta(hours=PICKUP_DURATION_HOURS),
                "on_duty",
                phase["location"]["name"],
                "Loading at pickup",
            ))
            stops.append({
                "type": "pickup",
                "location": phase["location"],
                "arrival_time": pickup_start.isoformat(),
                "departure_time": (pickup_start + timedelta(hours=PICKUP_DURATION_HOURS)).isoformat(),
                "duration_hours": PICKUP_DURATION_HOURS,
                "reason": "Pickup — loading (1 hour)",
            })
            state.add_on_duty(PICKUP_DURATION_HOURS)

        elif phase["type"] == "dropoff":
            # 1 hour on-duty for dropoff
            dropoff_start = state.current_time

            # Check if we have enough window
            if state.window_hours_remaining < DROPOFF_DURATION_HOURS:
                off_duty_entries = _get_off_duty_entries(sleeper_berth_split, 0)
                total_rest = sum(e[1] for e in off_duty_entries)
                rest_start = state.current_time
                rest_end = rest_start + timedelta(hours=total_rest)
                rest_activities = _generate_rest_activities(
                    rest_start, off_duty_entries,
                    phase["location"]["name"], "Rest before dropoff"
                )
                activities.extend(rest_activities)
                stops.append({
                    "type": "off_duty",
                    "location": phase["location"],
                    "arrival_time": rest_start.isoformat(),
                    "departure_time": rest_end.isoformat(),
                    "duration_hours": total_rest,
                    "reason": "Rest required before dropoff",
                })
                state.current_time = rest_end
                state.take_full_rest(advance_time=False)
                dropoff_start = state.current_time

            activities.append((
                dropoff_start,
                dropoff_start + timedelta(hours=DROPOFF_DURATION_HOURS),
                "on_duty",
                phase["location"]["name"],
                "Unloading at dropoff",
            ))
            stops.append({
                "type": "dropoff",
                "location": phase["location"],
                "arrival_time": dropoff_start.isoformat(),
                "departure_time": (dropoff_start + timedelta(hours=DROPOFF_DURATION_HOURS)).isoformat(),
                "duration_hours": DROPOFF_DURATION_HOURS,
                "reason": "Dropoff — unloading (1 hour)",
            })
            state.add_on_duty(DROPOFF_DURATION_HOURS)

    # ── End of trip stop ──
    stops.append({
        "type": "end",
        "location": dropoff_location,
        "arrival_time": state.current_time.isoformat(),
        "departure_time": state.current_time.isoformat(),
        "duration_hours": 0,
        "reason": "Trip complete",
    })

    # ── Generate Daily Logs ──
    daily_logs = _generate_daily_logs(activities, start_time, state.current_time, total_route_miles)

    # ── Trip Summary ──
    trip_summary = {
        "total_distance_miles": round(total_route_miles, 1),
        "total_driving_hours": round(state.total_miles_driven / avg_speed if avg_speed > 0 else 0, 1),
        "total_trip_hours": round((state.current_time - start_time).total_seconds() / 3600, 1),
        "num_stops": len([s for s in stops if s["type"] not in ("start", "end")]),
        "num_fuel_stops": len([s for s in stops if s["type"] == "fuel"]),
        "num_rest_stops": len([s for s in stops if s["type"] in ("off_duty", "restart")]),
        "num_log_sheets": len(daily_logs),
        "average_speed_mph": round(avg_speed, 1),
        "cycle_hours_remaining": round(state.cycle_hours_remaining, 1),
        "start_time": start_time.isoformat(),
        "end_time": state.current_time.isoformat(),
    }

    return {
        "trip_summary": trip_summary,
        "stops": stops,
        "daily_logs": daily_logs,
    }


def _generate_rest_activities(start_time, off_duty_entries, location_name, reason):
    """Generate activity entries for rest periods."""
    activities = []
    current = start_time
    for status, duration in off_duty_entries:
        end = current + timedelta(hours=duration)
        activities.append((current, end, status, location_name, reason))
        current = end
    return activities


def _generate_daily_logs(activities, trip_start, trip_end, total_miles):
    """
    Convert the activity timeline into daily log sheets.
    Each log covers a calendar day (midnight to midnight).
    """
    if not activities:
        return []

    # Determine the range of days
    start_date = trip_start.date()
    end_date = trip_end.date()
    num_days = (end_date - start_date).days + 1

    daily_logs = []

    for day_offset in range(num_days):
        current_date = start_date + timedelta(days=day_offset)
        day_start = datetime(current_date.year, current_date.month, current_date.day)
        day_end = day_start + timedelta(days=1)

        entries = []
        day_miles = 0.0

        for act_start, act_end, status, location, notes in activities:
            # Check overlap with this day
            overlap_start = max(act_start, day_start)
            overlap_end = min(act_end, day_end)

            if overlap_start >= overlap_end:
                continue

            start_hour = (overlap_start - day_start).total_seconds() / 3600
            end_hour = (overlap_end - day_start).total_seconds() / 3600

            # Round to nearest 15 minutes (0.25 hours) for log accuracy
            start_hour = round(start_hour * 4) / 4
            end_hour = round(end_hour * 4) / 4

            if start_hour >= end_hour:
                continue

            # Map status names
            status_mapped = status
            if status == "restart":
                status_mapped = "sleeper"  # 34-hour restart shown as sleeper berth

            entries.append({
                "status": status_mapped,
                "start_hour": round(start_hour, 2),
                "end_hour": round(end_hour, 2),
                "location": location,
                "notes": notes,
            })

            # Approximate miles for driving entries
            if status == "driving":
                duration = end_hour - start_hour
                day_miles += duration * AVERAGE_SPEED_MPH

        # Fill gaps with off-duty
        entries = _fill_gaps_with_off_duty(entries, day_start)

        # Calculate totals
        totals = {"off_duty": 0, "sleeper": 0, "driving": 0, "on_duty": 0}
        for entry in entries:
            duration = entry["end_hour"] - entry["start_hour"]
            key = entry["status"]
            if key in totals:
                totals[key] += duration
            else:
                totals["off_duty"] += duration

        # Estimate miles for this day based on driving hours
        driving_hours_today = totals["driving"]
        estimated_miles = round(driving_hours_today * AVERAGE_SPEED_MPH)

        daily_logs.append({
            "date": current_date.isoformat(),
            "day_number": day_offset + 1,
            "entries": entries,
            "total_hours": {k: round(v, 2) for k, v in totals.items()},
            "total_miles": estimated_miles,
        })

    return daily_logs


def _fill_gaps_with_off_duty(entries, day_start):
    """Fill any gaps in the 24-hour day with off-duty status."""
    if not entries:
        return [{
            "status": "off_duty",
            "start_hour": 0.0,
            "end_hour": 24.0,
            "location": "",
            "notes": "Off duty",
        }]

    # Sort by start time
    entries.sort(key=lambda x: x["start_hour"])

    filled = []
    current_hour = 0.0

    for entry in entries:
        if entry["start_hour"] > current_hour + 0.01:
            filled.append({
                "status": "off_duty",
                "start_hour": round(current_hour, 2),
                "end_hour": round(entry["start_hour"], 2),
                "location": "",
                "notes": "Off duty",
            })
        filled.append(entry)
        current_hour = entry["end_hour"]

    if current_hour < 23.99:
        filled.append({
            "status": "off_duty",
            "start_hour": round(current_hour, 2),
            "end_hour": 24.0,
            "location": "",
            "notes": "Off duty",
        })

    return filled


def _get_coord_at_fraction(geometry_coords, fraction):
    """Get coordinate at a fraction along the route geometry."""
    if not geometry_coords:
        return [0, 0]
    fraction = max(0, min(1, fraction))
    index = int(fraction * (len(geometry_coords) - 1))
    return geometry_coords[index]


def _make_location(coord, fallback_name="Unknown"):
    """Create a location dict from a coordinate."""
    return {
        "lat": coord[1],
        "lon": coord[0],
        "name": fallback_name,
    }
