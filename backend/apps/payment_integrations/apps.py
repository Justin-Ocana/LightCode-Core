from django.apps import AppConfig


class PaymentIntegrationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.payment_integrations'
    verbose_name = 'Payment Integrations'
    
    def ready(self):
        """Import signals when app is ready."""
        try:
            import apps.payment_integrations.signals  # noqa
        except ImportError:
            pass
