# Generated migration for PayPalWebhookEvent model

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0012_add_direct_payment_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='PayPalWebhookEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('event_id', models.CharField(db_index=True, help_text='ID del evento de PayPal', max_length=100, unique=True)),
                ('event_type', models.CharField(choices=[('PAYMENT.CAPTURE.COMPLETED', 'Pago Completado'), ('PAYMENT.CAPTURE.DENIED', 'Pago Denegado'), ('PAYMENT.CAPTURE.PENDING', 'Pago Pendiente'), ('PAYMENT.CAPTURE.REFUNDED', 'Pago Reembolsado'), ('CHECKOUT.ORDER.APPROVED', 'Orden Aprobada'), ('CHECKOUT.ORDER.COMPLETED', 'Orden Completada'), ('OTHER', 'Otro')], db_index=True, default='OTHER', max_length=100)),
                ('event_version', models.CharField(blank=True, max_length=20)),
                ('resource_type', models.CharField(blank=True, max_length=50)),
                ('resource_id', models.CharField(db_index=True, help_text='ID del pago o orden', max_length=100)),
                ('paypal_order_id', models.CharField(blank=True, db_index=True, help_text='PayPal Order ID', max_length=100)),
                ('raw_payload', models.JSONField(help_text='Payload completo del webhook')),
                ('transmission_id', models.CharField(blank=True, max_length=100)),
                ('transmission_time', models.CharField(blank=True, max_length=100)),
                ('transmission_sig', models.CharField(blank=True, max_length=500)),
                ('cert_url', models.URLField(blank=True)),
                ('auth_algo', models.CharField(blank=True, max_length=50)),
                ('signature_verified', models.BooleanField(default=False, help_text='Si la firma del webhook fue verificada')),
                ('signature_verification_error', models.TextField(blank=True)),
                ('processing_status', models.CharField(choices=[('received', 'Recibido'), ('processing', 'Procesando'), ('processed', 'Procesado'), ('failed', 'Fallido'), ('ignored', 'Ignorado')], db_index=True, default='received', max_length=20)),
                ('processing_error', models.TextField(blank=True)),
                ('processing_attempts', models.IntegerField(default=0)),
                ('amount', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('currency', models.CharField(blank=True, max_length=3)),
                ('payer_email', models.EmailField(blank=True, max_length=254)),
                ('payee_email', models.EmailField(blank=True, max_length=254)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('order', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='webhook_events', to='orders.order')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='paypalwebhookevent',
            index=models.Index(fields=['-created_at', 'event_type'], name='orders_payp_created_idx'),
        ),
        migrations.AddIndex(
            model_name='paypalwebhookevent',
            index=models.Index(fields=['processing_status', 'event_type'], name='orders_payp_process_idx'),
        ),
        migrations.AddIndex(
            model_name='paypalwebhookevent',
            index=models.Index(fields=['resource_id'], name='orders_payp_resourc_idx'),
        ),
    ]
