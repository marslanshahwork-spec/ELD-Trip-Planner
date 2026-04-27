"""
Serializers for trip API.
"""
from rest_framework import serializers
from .models import Trip


class TripInputSerializer(serializers.Serializer):
    """Validates trip planning input."""
    current_location = serializers.CharField(max_length=500, help_text="Current driver location")
    pickup_location = serializers.CharField(max_length=500, help_text="Pickup/loading location")
    dropoff_location = serializers.CharField(max_length=500, help_text="Dropoff/unloading location")
    current_cycle_hours = serializers.FloatField(
        min_value=0, max_value=70,
        help_text="Hours already used in 70-hour/8-day cycle"
    )
    start_time = serializers.DateTimeField(
        required=False,
        help_text="Trip start time (defaults to now)"
    )
    sleeper_berth_split = serializers.ChoiceField(
        choices=[
            ("7_3", "7hr Sleeper Berth + 3hr Off Duty"),
            ("10_0", "10hr Off Duty"),
            ("split", "Split Sleeper (2hr OFF + 7hr SB + 1hr OFF)"),
        ],
        default="7_3",
        required=False,
        help_text="How to split the 10-hour off-duty period"
    )


class TripSerializer(serializers.ModelSerializer):
    """Serializes saved trips for history."""
    class Meta:
        model = Trip
        fields = '__all__'
        read_only_fields = ['created_at']
