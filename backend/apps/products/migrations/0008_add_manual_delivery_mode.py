# Generated migration for adding MANUAL delivery mode

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0007_alter_productcategory_store'),
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='delivery_mode',
            field=models.CharField(
                choices=[
                    ('MANUAL', 'Manual'),
                    ('RCON', 'RCON'),
                    ('PLUGIN', 'Plugin')
                ],
                default='RCON',
                help_text='Modo de entrega: Manual, RCON o Plugin',
                max_length=20
            ),
        ),
    ]
