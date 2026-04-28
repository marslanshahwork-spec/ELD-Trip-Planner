"""
Vercel Serverless Function — Django WSGI Handler
Routes all /api/* requests through Django.
"""
import sys
import os

# Add backend to Python path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Force Django setup before anything else
import django
django.setup()

# Run migrations on cold start (Vercel uses in-memory SQLite)
from django.core.management import call_command
try:
    call_command('migrate', '--run-syncdb', verbosity=0, interactive=False)
except Exception:
    pass

from django.core.wsgi import get_wsgi_application
app = get_wsgi_application()
