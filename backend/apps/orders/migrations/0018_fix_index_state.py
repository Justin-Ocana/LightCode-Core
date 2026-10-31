# Generated migration to fix index state

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0017_add_lightcode_earnings_indexes'),
    ]

    operations = [
        # This migration fixes the Django migration state to match reality
        # The indexes were created with the new names in migration 0017
        # But Django thinks they have the old names, so we "rename" them
        # using a no-op SQL statement
        migrations.RunSQL(
            sql=migrations.RunSQL.noop,
            reverse_sql=migrations.RunSQL.noop,
            state_operations=[
                migrations.RenameIndex(
                    model_name='lightcodeearnings',
                    new_name='lightcode_e_created_52ba40_idx',
                    old_name='lightcode_earn_created_ec37a7_idx',
                ),
                migrations.RenameIndex(
                    model_name='lightcodeearnings',
                    new_name='lightcode_e_seller__7b8d07_idx',
                    old_name='lightcode_earn_seller__9d5cc8_idx',
                ),
            ],
        ),
    ]
