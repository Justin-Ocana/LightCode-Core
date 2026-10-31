"""
Staging environment settings.
Similar to production but with more debugging capabilities.
"""
from .production import *

DEBUG = False

# Allow more verbose logging in staging
LOGGING['handlers']['console']['level'] = 'INFO'
LOGGING['loggers']['django']['level'] = 'INFO'

# Sentry environment
if SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(environment='staging')
