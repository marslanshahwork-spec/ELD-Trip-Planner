"""
API views for trip planning and history.
"""
import time
import logging
from datetime import datetime

from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, RetrieveDestroyAPIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import TripInputSerializer, TripSerializer
from .models import Trip
from . import route_service
from . import hos_engine

logger = logging.getLogger(__name__)


class TripPlanView(APIView):
    """
    POST /api/trips/plan/
    Takes trip details as input, calculates HOS-compliant route with stops,
    and returns map data + daily log sheets.
    """

    def post(self, request):
        serializer = TripInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        try:
            # 1. Geocode all locations
            current_loc = route_service.geocode(data['current_location'])
            time.sleep(1)  # Nominatim rate limit
            pickup_loc = route_service.geocode(data['pickup_location'])
            time.sleep(1)
            dropoff_loc = route_service.geocode(data['dropoff_location'])

            # 2. Get route from OSRM
            waypoints = [current_loc, pickup_loc, dropoff_loc]
            route_data = route_service.get_route(waypoints)

            # 3. Determine start time (always use naive datetimes for HOS engine)
            start_time = data.get('start_time')
            if not start_time:
                now = datetime.now()
                start_time = now
            else:
                # Strip timezone info if present — HOS engine uses naive datetimes
                if hasattr(start_time, 'tzinfo') and start_time.tzinfo is not None:
                    start_time = start_time.replace(tzinfo=None)

            # 4. Run HOS engine
            sleeper_split = data.get('sleeper_berth_split', '7_3')
            result = hos_engine.calculate_trip(
                current_location=current_loc,
                pickup_location=pickup_loc,
                dropoff_location=dropoff_loc,
                route_data=route_data,
                cycle_hours_used=data['current_cycle_hours'],
                start_time=start_time,
                sleeper_berth_split=sleeper_split,
            )

            # 5. Build response
            response_data = {
                "trip_summary": result["trip_summary"],
                "route": {
                    "geometry": route_data["geometry"],
                    "current_location": current_loc,
                    "pickup_location": pickup_loc,
                    "dropoff_location": dropoff_loc,
                },
                "stops": result["stops"],
                "daily_logs": result["daily_logs"],
            }

            # 6. Save to history
            try:
                Trip.objects.create(
                    current_location=data['current_location'],
                    pickup_location=data['pickup_location'],
                    dropoff_location=data['dropoff_location'],
                    current_cycle_hours=data['current_cycle_hours'],
                    start_time=start_time,
                    sleeper_berth_split=sleeper_split,
                    trip_summary=result["trip_summary"],
                    stops=result["stops"],
                    daily_logs=result["daily_logs"],
                    route_geometry=route_data["geometry"],
                    current_location_coords=current_loc,
                    pickup_location_coords=pickup_loc,
                    dropoff_location_coords=dropoff_loc,
                )
            except Exception as e:
                logger.warning(f"Failed to save trip to history: {e}")

            return Response(response_data, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.exception("Trip planning failed")
            return Response(
                {"error": f"Trip planning failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TripHistoryListView(ListAPIView):
    """
    GET /api/trips/history/
    Returns list of saved trips.
    """
    queryset = Trip.objects.all()
    serializer_class = TripSerializer


class TripHistoryDetailView(RetrieveDestroyAPIView):
    """
    GET /api/trips/history/<id>/
    DELETE /api/trips/history/<id>/
    """
    queryset = Trip.objects.all()
    serializer_class = TripSerializer
