"""
Base settings shared across all environments.
"""
from pathlib import Path
from decouple import config, Csv
from datetime import timedelta

# Environment Detection
IS_RENDER = config('RENDER', default=False, cast=bool)

# Build paths
# In Docker: /app/settings/base.py -> /app/settings/ -> /app (correct)
# In local: backend/settings/base.py -> backend/settings/ -> backend/ -> root (correct)
BASE_DIR = Path(__file__).resolve().parent.parent

# Security
SECRET_KEY = config('SECRET_KEY', default='django-insecure-dev-key-for-local-development-only')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = [h.strip(' `"') for h in config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())]

# Application definition
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'cloudinary_storage',
    'django.contrib.staticfiles',
    
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_celery_beat',
    'django_celery_results',
    'guardian',
    'drf_spectacular',
    'cloudinary',
    'django_filters',
    'axes',
    
    # Local apps
    'apps.users',
    'apps.stores',
    'apps.products',
    'apps.orders',
    'apps.finances',  # Nueva app para contabilidad
    'apps.discounts',
    'apps.payments',
    'apps.payment_integrations',
    'apps.subscriptions',
    'apps.support',
    'apps.notifications',
    'apps.analytics',
    'apps.cart',
    'apps.admin_tools',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'core.middleware.CsrfExemptBuyerAuthMiddleware',  # BEFORE CsrfViewMiddleware
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'axes.middleware.AxesMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.AutomaticTokenRefreshMiddleware', # Automatic token refresh
]

ROOT_URLCONF = 'urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'wsgi.application'
ASGI_APPLICATION = 'asgi.application'

import dj_database_url

# Database Configuration
# Use DATABASE_URL if provided, otherwise fallback to SQLite
DATABASE_URL = config('DATABASE_URL', default=None)

if DATABASE_URL:
    # Parse DATABASE_URL for PostgreSQL or other databases
    DATABASES = {
        'default': dj_database_url.parse(DATABASE_URL)
    }
else:
    # SQLite local para desarrollo
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Cache Configuration (Redis)
REDIS_URL = config('REDIS_URL', default=None)
if REDIS_URL:
    REDIS_URL = REDIS_URL.strip(' "')

# Disable Redis on Render if it points to localhost (prevents 502/500 errors)
USE_REDIS = REDIS_URL and not (IS_RENDER and 'localhost' in REDIS_URL)

if USE_REDIS:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'CONNECTION_POOL_KWARGS': {
                    'max_connections': 50,
                    'retry_on_timeout': True,
                },
                'SOCKET_CONNECT_TIMEOUT': 5,
                'SOCKET_TIMEOUT': 5,
            },
            'KEY_PREFIX': 'backend',
            'TIMEOUT': 300,  # 5 minutes default
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
    SESSION_CACHE_ALIAS = 'default'
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'

# Django Channels Configuration
# Redis 5.0+ es requerido para channels_redis (comando BZPOPMIN)
# Si tienes Redis < 5.0, usa InMemoryChannelLayer
REDIS_VERSION_OK = False
if USE_REDIS:
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379)
        info = r.info('server')
        redis_version = info.get('redis_version', '0.0.0')
        major_version = int(redis_version.split('.')[0])
        REDIS_VERSION_OK = major_version >= 5
        if not REDIS_VERSION_OK:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"⚠️ Redis version {redis_version} is too old for Channels (requires 5.0+). Using InMemoryChannelLayer instead.")
    except:
        pass

if USE_REDIS and REDIS_VERSION_OK:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                "hosts": [REDIS_URL],
                "capacity": 1500,
                "expiry": 10,
            },
        },
    }
else:
    # In-memory channel layer for development without Redis or old Redis
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        }
    }

# Celery Configuration
# For local development without Redis, run tasks synchronously
# This allows RCON and other background tasks to work without external dependencies
CELERY_TASK_ALWAYS_EAGER = config('CELERY_TASK_ALWAYS_EAGER', default=True, cast=bool)
CELERY_TASK_EAGER_PROPAGATES = True  # Propagate exceptions

# Use REDIS_URL for broker if available and NOT localhost on Render
DEFAULT_BROKER = REDIS_URL if USE_REDIS else 'redis://localhost:6379/1'
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default=DEFAULT_BROKER).strip(' "')

# If on Render and using localhost, we MUST switch to synchronous or non-redis backend
# This is a safety measure to prevent Gunicorn workers from hanging
if IS_RENDER and 'localhost' in CELERY_BROKER_URL:
    CELERY_TASK_ALWAYS_EAGER = True # Run tasks synchronously if no real broker

CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'default'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Password Hashing (Argon2 is the modern standard)
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
# STATICFILES_DIRS = [BASE_DIR / 'static']  # Commented out - no static files in this directory

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Cloudinary Configuration
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': config('CLOUDINARY_CLOUD_NAME', default=''),
    'API_KEY': config('CLOUDINARY_API_KEY', default=''),
    'API_SECRET': config('CLOUDINARY_API_SECRET', default=''),
    'SECURE': config('CLOUDINARY_SECURE', default=True, cast=bool),
}

# Use Cloudinary for media files if configured
USE_CLOUDINARY = bool(CLOUDINARY_STORAGE['CLOUD_NAME'])
if USE_CLOUDINARY:
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
    
# File Upload Settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB

# Default primary key
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'users.User'

# CORS Configuration
CORS_ALLOWED_ORIGINS = [o.strip(' `"') for o in config('CORS_ALLOWED_ORIGINS', default='', cast=Csv())]
if DEBUG:
    CORS_ALLOWED_ORIGINS += ['http://localhost:5173', 'http://127.0.0.1:5173']
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-buyer-token',
    'x-token-refreshed',
    'x-store-slug',
]
CORS_EXPOSE_HEADERS = [
    'X-Token-Refreshed',
]

# Cookie settings for Authentication
AUTH_COOKIE_HTTP_ONLY = True
AUTH_COOKIE_SECURE = config('AUTH_COOKIE_SECURE', default=not DEBUG, cast=bool)
AUTH_COOKIE_SAMESITE = 'Lax'
AUTH_COOKIE_DOMAIN = config('AUTH_COOKIE_DOMAIN', default=None)

# Session Configuration
SESSION_COOKIE_AGE = 1209600  # 2 weeks (14 days)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = AUTH_COOKIE_SECURE
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_SAVE_EVERY_REQUEST = True  # Refresh session on every request to keep it alive
SESSION_COOKIE_NAME = 'sessionid'

# CSRF Settings
CSRF_COOKIE_HTTP_ONLY = False # Must be False for frontend to read it
CSRF_COOKIE_SECURE = AUTH_COOKIE_SECURE
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_AGE = 31449600  # 1 year
CSRF_USE_SESSIONS = False # We want it in a cookie
CSRF_COOKIE_NAME = 'csrftoken'
CSRF_HEADER_NAME = 'HTTP_X_CSRFTOKEN'
CSRF_TRUSTED_ORIGINS = [o.strip(' `"') for o in config('CORS_ALLOWED_ORIGINS', default='', cast=Csv())]
if DEBUG:
    CSRF_TRUSTED_ORIGINS += ['http://localhost:5173', 'http://127.0.0.1:5173']

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.users.authentication.CookieAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # SPA storefront issues many anonymous reads per session (nav + HMR + React Strict Mode)
        'anon': '800/hour',
        'user': '2000/hour',
        'auth': '5/minute',     # Secure limit for login
        'register': '5/hour',   # Secure limit for registration
        'uploads': '10/hour',   # Limit file uploads
    },
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
}

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=config('JWT_ACCESS_TOKEN_HOURS', default=24, cast=int)),  # 24 horas por defecto
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_TOKEN_DAYS', default=14, cast=int)),  # 14 días por defecto
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,  # Disabled - token_blacklist app not installed
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# API Documentation (drf-spectacular)
SPECTACULAR_SETTINGS = {
    'TITLE': 'E-commerce Platform API',
    'DESCRIPTION': 'Professional e-commerce backend with multi-store support',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
}

# Guardian (Object-level permissions)
AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'django.contrib.auth.backends.ModelBackend',
    'guardian.backends.ObjectPermissionBackend',
]

# Axes Configuration (Brute Force Protection)
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = timedelta(minutes=15)
AXES_LOCKOUT_TEMPLATE = None # Can be a template path
AXES_RESET_ON_SUCCESS = True
AXES_LOCKOUT_PARAMETERS = ['username', 'ip_address']
AXES_ENABLE_ADMIN = True
# AXES_ONLY_USER_FAILURES is deprecated, axes handles this via AXES_LOCKOUT_PARAMETERS

# Email Configuration (Gmail SMTP via App Password)
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_USE_SSL = config('EMAIL_USE_SSL', default=False, cast=bool)
EMAIL_TIMEOUT = config('EMAIL_TIMEOUT', default=30, cast=int)
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='lightcode <noreply@lightcode.com>')
SERVER_EMAIL = config('SERVER_EMAIL', default=EMAIL_HOST_USER)
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')

# PayPal Configuration
PAYPAL_MODE = config('PAYPAL_MODE', default='sandbox')  # 'sandbox' o 'live'
PAYPAL_CLIENT_ID = config('PAYPAL_CLIENT_ID', default='')
PAYPAL_CLIENT_SECRET = config('PAYPAL_CLIENT_SECRET', default='')
PAYPAL_PARTNER_ID = config('PAYPAL_PARTNER_ID', default='')  # Partner Merchant ID for referrals
PAYPAL_WEBHOOK_ID = config('PAYPAL_WEBHOOK_ID', default='')

# Payment Integration Security
PAYMENT_ENCRYPTION_KEY = config('PAYMENT_ENCRYPTION_KEY', default='')

# Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# lightcode Mod Delivery (PlugsEssentials)
# Token secreto para la página de prueba interna. Cámbialo en producción.
# Genera uno con: python -c "import secrets; print(secrets.token_urlsafe(32))"
MC_TEST_PAGE_TOKEN = config('MC_TEST_PAGE_TOKEN', default='lightcode-mc-test-changeme-in-prod')
