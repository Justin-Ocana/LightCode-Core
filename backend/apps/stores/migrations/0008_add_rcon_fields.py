# Generated migration for RCON fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0003_alter_store_description_alter_store_is_verified_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='store',
            name='rcon_enabled',
            field=models.BooleanField(default=False, help_text='Whether RCON is configured and enabled'),
        ),
        migrations.AddField(
            model_name='store',
            name='rcon_host',
            field=models.CharField(blank=True, help_text='RCON host (IP or domain)', max_length=255),
        ),
        migrations.AddField(
            model_name='store',
            name='rcon_port',
            field=models.IntegerField(blank=True, help_text='RCON port (default: 25575)', null=True),
        ),
        migrations.AddField(
            model_name='store',
            name='rcon_password_encrypted',
            field=models.TextField(blank=True, help_text='Encrypted RCON password (Fernet)'),
        ),
        migrations.AddField(
            model_name='store',
            name='rcon_last_test',
            field=models.DateTimeField(blank=True, help_text='Last successful RCON connection test', null=True),
        ),
        migrations.AddField(
            model_name='store',
            name='rcon_last_latency',
            field=models.IntegerField(blank=True, help_text='Last connection latency in ms', null=True),
        ),
    ]
