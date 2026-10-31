# Generated migration for PayPal email field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0008_add_rcon_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='store',
            name='paypal_email',
            field=models.EmailField(blank=True, null=True, max_length=254, verbose_name='PayPal Email'),
        ),
    ]
