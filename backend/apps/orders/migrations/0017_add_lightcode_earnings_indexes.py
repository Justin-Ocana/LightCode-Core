# Generated migration to add indexes to lightcode_earnings

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0015_add_manual_reason_field'),
    ]

    operations = [
        # Add indexes directly without trying to rename
        migrations.RunSQL(
            sql=[
                'CREATE INDEX IF NOT EXISTS lightcode_e_created_52ba40_idx ON lightcode_earnings (created_at DESC);',
                'CREATE INDEX IF NOT EXISTS lightcode_e_seller__7b8d07_idx ON lightcode_earnings (seller_id, created_at DESC);',
            ],
            reverse_sql=[
                'DROP INDEX IF EXISTS lightcode_e_created_52ba40_idx;',
                'DROP INDEX IF EXISTS lightcode_e_seller__7b8d07_idx;',
            ],
        ),
    ]
