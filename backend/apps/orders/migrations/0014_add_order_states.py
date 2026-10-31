# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0013_add_paypal_webhook_event'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('created', '⚪ Creado'),
                    ('approved', '🟡 Aprobado'),
                    ('requested', '🟠 Solicitado'),
                    ('processing', '🔵 Procesando'),
                    ('delivered', '🟢 Entregado'),
                    ('failed', '🔴 Fallido'),
                    ('cancelled', '⚫ Cancelado'),
                    ('refunded', '🟣 Reembolsado'),
                ],
                db_index=True,
                default='requested',
                max_length=20
            ),
        ),
    ]
