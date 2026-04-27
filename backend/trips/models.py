"""
Models for trip history persistence.
"""
from django.db import models
import json


class Trip(models.Model):
    """Stores a completed trip plan for history."""
    current_location = models.CharField(max_length=500)
    pickup_location = models.CharField(max_length=500)
    dropoff_location = models.CharField(max_length=500)
    current_cycle_hours = models.FloatField(default=0)
    start_time = models.DateTimeField()
    sleeper_berth_split = models.CharField(max_length=10, default="7_3")

    # Computed results stored as JSON
    trip_summary = models.JSONField(default=dict)
    stops = models.JSONField(default=list)
    daily_logs = models.JSONField(default=list)
    route_geometry = models.JSONField(default=dict)

    # Location coordinates
    current_location_coords = models.JSONField(default=dict)
    pickup_location_coords = models.JSONField(default=dict)
    dropoff_location_coords = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Trip: {self.current_location} → {self.pickup_location} → {self.dropoff_location}"
