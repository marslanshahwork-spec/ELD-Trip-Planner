"""
URL routing for trips API.
"""
from django.urls import path
from . import views

urlpatterns = [
    path('trips/plan/', views.TripPlanView.as_view(), name='trip-plan'),
    path('trips/history/', views.TripHistoryListView.as_view(), name='trip-history'),
    path('trips/history/<int:pk>/', views.TripHistoryDetailView.as_view(), name='trip-detail'),
]
