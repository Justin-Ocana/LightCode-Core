"""
Production-specific settings.
"""
from .base import *

# Security settings
DEBUG = False

# Hosts must be configured via environment variable
# Use default for build time, but should be set in production
ALLOWED_HOSTS = [h.strip(' `"') for h in config('ALLOWED_HOSTS', default='localhost', cast=Csv())]

# Security headers
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'

# CORS - Only allow configured origins
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [o.strip(' `"') for o in config('CORS_ALLOWED_ORIGINS', default='', cast=Csv()) if o.strip()]

# Add localhost for development (temporary)
if not CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS = []

# Always allow localhost for development
CORS_ALLOWED_ORIGINS.extend([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
])

# Remove duplicates
CORS_ALLOWED_ORIGINS = list(set(CORS_ALLOWED_ORIGINS))

# Email backend - Always use SMTP in production
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Validate email configuration
_email_user = config('EMAIL_HOST_USER', default='')
_email_password = config('EMAIL_HOST_PASSWORD', default='')

if not _email_user or not _email_password:
    import warnings
    warnings.warn(
        "EMAIL_HOST_USER and EMAIL_HOST_PASSWORD must be configured in production!",
        RuntimeWarning
    )

# Celery - Use async mode if Redis is available, otherwise fallback to eager mode
# This allows the app to work without Redis (though with reduced functionality)
if USE_REDIS and REDIS_URL and 'localhost' not in REDIS_URL:
    CELERY_TASK_ALWAYS_EAGER = False
    CELERY_TASK_EAGER_PROPAGATES = False
    print("[PRODUCTION] Celery: Async mode enabled (Redis available)")
else:
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
    print("[PRODUCTION] Celery: Eager mode (Redis not available - tasks run synchronously)")
    
    # Force local cache when Redis is not available
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'
    
    import warnings
    warnings.warn(
        "Redis is not configured. Running in synchronous mode with local cache. "
        "For better performance and automatic retries, configure REDIS_URL.",
        RuntimeWarning
    )

# Logging - More structured for production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'WARNING',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'production.log',
            'maxBytes': 1024 * 1024 * 10,  # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console', 'file'],
            'level': 'ERROR',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Create logs directory if it doesn't exist
import os
logs_dir = BASE_DIR / 'logs'
if not os.path.exists(logs_dir):
    os.makedirs(logs_dir)

# Configure throttling based on Redis availability
if USE_REDIS and REDIS_URL and 'localhost' not in REDIS_URL:
    # Redis available - use normal throttling
    REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ]
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
        'anon': '800/hour',
        'user': '2000/hour',
        'auth': '5/minute',
        'register': '5/hour',
        'uploads': '10/hour',
    }
    print("[PRODUCTION] Throttling: Enabled with Redis backend")
else:
    # No Redis - use local memory cache for throttling
    REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ]
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
        'anon': '800/hour',
        'user': '2000/hour',
        'auth': '5/minute',
        'register': '5/hour',
        'uploads': '10/hour',
    }
    print("[PRODUCTION] Throttling: Enabled with local memory cache")

# Session security
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_AGE = 1209600  # 2 weeks

# Admin security
ADMIN_URL = config('ADMIN_URL', default='admin/')

print("[PRODUCTION] Settings loaded successfully")
print(f"[PRODUCTION] Allowed hosts: {ALLOWED_HOSTS}")
print(f"[PRODUCTION] CORS origins: {CORS_ALLOWED_ORIGINS}")
print(f"[PRODUCTION] Redis: {REDIS_URL[:20]}..." if REDIS_URL else "[PRODUCTION] Redis: Not configured")
print(f"[PRODUCTION] Database: {DATABASES['default']['ENGINE']}")
