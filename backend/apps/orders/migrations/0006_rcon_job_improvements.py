# Generated migration for RCON Job improvements

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('orders', '0005_pendingpaypalorder'),
    ]

    operations = [
        # Add CANCELLED to status choices
        migrations.AlterField(
            model_name='rconjob',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pendiente'),
                    ('processing', 'Procesando'),
                    ('delivered', 'Entregado'),
                    ('failed', 'Fallido'),
                    ('cancelled', 'Cancelado')
                ],
                db_index=True,
                default='pending',
                max_length=20
            ),
        ),
        # Add new retry counters
        migrations.AddField(
            model_name='rconjob',
            name='auto_retry_count',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='rconjob',
            name='manual_retry_count',
            field=models.IntegerField(default=0),
        ),
        # Add failure reason type
        migrations.AddField(
            model_name='rconjob',
            name='failure_reason_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('network_error', 'Error de Red'),
                    ('auth_error', 'Error de Autenticación'),
                    ('command_error', 'Error de Comando'),
                    ('player_offline_error', 'Jugador Offline'),
                    ('unknown', 'Desconocido')
                ],
                db_index=True,
                max_length=30
            ),
        ),
        # Add last error message
        migrations.AddField(
            model_name='rconjob',
            name='last_error_message',
            field=models.TextField(blank=True),
        ),
        # Add cancellation fields
        migrations.AddField(
            model_name='rconjob',
            name='cancelled_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='cancelled_rcon_jobs',
                to=settings.AUTH_USER_MODEL
            ),
        ),
        migrations.AddField(
            model_name='rconjob',
            name='cancelled_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
