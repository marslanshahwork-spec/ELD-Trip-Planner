"""config URL Configuration"""
from django.urls import path, include

urlpatterns = [
    path('api/', include('trips.urls')),
]
