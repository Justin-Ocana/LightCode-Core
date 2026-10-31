# Generated migration for seller onboarding fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='seller',
            name='onboarding_completed',
            field=models.BooleanField(default=False, help_text='Si completó todo el onboarding'),
        ),
        migrations.AddField(
            model_name='seller',
            name='onboarding_step',
            field=models.CharField(default='subscription', help_text='Paso actual del onboarding: subscription, create_store, complete', max_length=50),
        ),
        migrations.AddField(
            model_name='seller',
            name='onboarding_data',
            field=models.JSONField(blank=True, default=dict, help_text='Datos adicionales del onboarding (pasos completados, etc.)'),
        ),
        migrations.AddIndex(
            model_name='seller',
            index=models.Index(fields=['onboarding_completed', 'onboarding_step'], name='sellers_onboarding_idx'),
        ),
    ]
