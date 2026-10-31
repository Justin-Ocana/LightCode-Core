"""
Django settings package.
Automatically loads the correct settings module based on DJANGO_SETTINGS_MODULE
environment variable or defaults to development.
"""
import os
from decouple import config

# Determine which settings module to use
ENVIRONMENT = config('DJANGO_ENV', default='development').lower()

# Import the appropriate settings
if ENVIRONMENT == 'production':
    from .production import *
elif ENVIRONMENT == 'staging':
    try:
        from .staging import *
    except ImportError:
        # Fallback to production if staging doesn't exist
        from .production import *
else:
    # Default to development
    from .development import *

# Allow override via DJANGO_SETTINGS_MODULE for testing
# This ensures pytest and other tools can specify exact settings
if 'DJANGO_SETTINGS_MODULE' in os.environ:
    settings_module = os.environ['DJANGO_SETTINGS_MODULE']
    if 'test' in settings_module:
        try:
            from .test import *
        except ImportError:
            pass  # Use current settings if test.py doesn't exist
