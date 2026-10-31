# Generated migration for beta access keys

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='access_key_used',
            field=models.CharField(blank=True, help_text='Access key used during registration', max_length=50),
        ),
        migrations.CreateModel(
            name='BetaAccessKey',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('key', models.CharField(db_index=True, max_length=50, unique=True)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('USED', 'Used'), ('REVOKED', 'Revoked')], default='ACTIVE', max_length=10)),
                ('note', models.CharField(blank=True, help_text='Internal note about this key', max_length=255)),
                ('max_uses', models.IntegerField(default=1, help_text='Number of times this key can be used')),
                ('uses_count', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField(blank=True, help_text='Optional expiration date', null=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_keys', to=settings.AUTH_USER_MODEL)),
                ('used_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='used_key', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Beta Access Key',
                'verbose_name_plural': 'Beta Access Keys',
                'db_table': 'beta_access_keys',
                'ordering': ['-created_at'],
            },
        ),
    ]
