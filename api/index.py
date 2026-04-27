"""
Vercel Serverless Function — Django WSGI Handler
Routes all /api/* requests through Django.
"""
import sys
import os

# Add backend to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Force Django setup before anything else
import django
django.setup()

# Run migrations on cold start (Vercel uses in-memory SQLite)
from django.core.management import call_command
try:
    call_command('migrate', '--run-syncdb', verbosity=0)
except Exception:
    pass

from django.core.wsgi import get_wsgi_application
app = get_wsgi_application()
