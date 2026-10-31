"""
Development-specific settings.
"""
from .base import *

DEBUG = True

# Allow all hosts in development
ALLOWED_HOSTS = ['*']

# Development-specific apps (comentado django_extensions porque no está instalado)
# INSTALLED_APPS += [
#     'django_extensions',  # Useful dev tools
# ]

# Disable some security features for easier development
CORS_ALLOW_ALL_ORIGINS = True

# Email backend for development — use SMTP if EMAIL_HOST_USER is configured
from decouple import config as _config
_email_user = _config('EMAIL_HOST_USER', default='')
_email_password = _config('EMAIL_HOST_PASSWORD', default='')

# Use SMTP if both user and password are configured, otherwise use console
if _email_user and _email_password and _email_user not in ('', 'tu@gmail.com'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Celery configuration for development
# Set to False to use async mode with Worker + Beat (for automatic retries)
# Set to True for synchronous mode (no Worker needed, but no automatic retries)
# IMPORTANT: Requires Redis to be running when False
CELERY_TASK_ALWAYS_EAGER = True  # Using synchronous mode for easier local development
CELERY_TASK_EAGER_PROPAGATES = True

# Suppress the AlwaysEagerIgnored warning (it's expected with Beat + async mode)
import warnings
from celery.exceptions import AlwaysEagerIgnored
warnings.filterwarnings('ignore', category=AlwaysEagerIgnored)

# Disable HTTPS redirect in development
SECURE_SSL_REDIRECT = False

# More verbose logging in development
LOGGING['loggers']['django']['level'] = 'DEBUG'
LOGGING['loggers']['celery']['level'] = 'DEBUG'

# Disable API throttling locally (avoids 429 while navigating / hot reload / Strict Mode)
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []

# Django Debug Toolbar (optional, uncomment if needed)
# INSTALLED_APPS += ['debug_toolbar']
# MIDDLEWARE += ['debug_toolbar.middleware.DebugToolbarMiddleware']
# INTERNAL_IPS = ['127.0.0.1']
