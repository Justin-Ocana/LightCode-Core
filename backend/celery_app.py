"""
Celery configuration for asynchronous task processing.
"""
import os
from celery import Celery
from celery.schedules import crontab

# Set default Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings.development')

app = Celery('lightcode')

# Load config from Django settings with CELERY namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all installed apps
app.autodiscover_tasks()


# Periodic tasks configuration
app.conf.beat_schedule = {
    'cleanup-expired-sessions': {
        'task': 'core.tasks.cleanup_expired_sessions',
        'schedule': crontab(hour=2, minute=0),  # Run at 2 AM daily
    },
    'send-daily-analytics': {
        'task': 'apps.analytics.tasks.send_daily_analytics',
        'schedule': crontab(hour=8, minute=0),  # Run at 8 AM daily
    },
    'process-pending-payments': {
        'task': 'apps.payments.tasks.process_pending_payments',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    'process-rcon-jobs': {
        'task': 'apps.orders.tasks.process_rcon_jobs',
        'schedule': 10.0,  # Every 10 seconds (rápido para desarrollo/testing)
    },
    # NUEVAS TAREAS - PAGOS DIRECTOS
    'refresh-paypal-tokens': {
        'task': 'apps.payment_integrations.tasks.refresh_paypal_tokens',
        'schedule': crontab(minute=0, hour='*/6'),  # Every 6 hours
    },
    'cleanup-expired-connections': {
        'task': 'apps.payment_integrations.tasks.cleanup_expired_connections',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery."""
    print(f'Request: {self.request!r}')
