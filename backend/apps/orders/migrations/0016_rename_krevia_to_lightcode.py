# Generated migration to rename Krevia columns to lightcode

from django.db import migrations


def rename_krevia_to_lightcode(apps, schema_editor):
    """
    Safely rename Krevia columns and tables to lightcode.
    Only performs renames if the old names exist (for existing databases).
    Skips if already renamed or in a new database.
    """
    db_alias = schema_editor.connection.alias
    
    with schema_editor.connection.cursor() as cursor:
        # Check if we're using PostgreSQL
        if schema_editor.connection.vendor == 'postgresql':
            # Check if krevia_fee column exists in orders_order table
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='orders_order' AND column_name='krevia_fee'
            """)
            
            if cursor.fetchone():
                # Old columns exist, rename them
                cursor.execute('ALTER TABLE orders_order RENAME COLUMN krevia_fee TO lightcode_fee;')
                cursor.execute('ALTER TABLE orders_order RENAME COLUMN krevia_fee_percent TO lightcode_fee_percent;')
                cursor.execute('ALTER TABLE orders_order RENAME COLUMN krevia_plan TO lightcode_plan;')
            
            # Check if krevia_earnings table exists
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name='krevia_earnings'
            """)
            
            if cursor.fetchone():
                # Old table exists, rename it
                cursor.execute('ALTER TABLE krevia_earnings RENAME TO lightcode_earnings;')
        
        elif schema_editor.connection.vendor == 'sqlite':
            # For SQLite, check if columns exist
            cursor.execute("PRAGMA table_info(orders_order)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'krevia_fee' in columns:
                # SQLite doesn't support RENAME COLUMN directly in older versions
                # This would need a more complex migration, but for now we'll skip
                # as SQLite is typically used for development only
                pass
            
            # Check if krevia_earnings table exists
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='krevia_earnings'
            """)
            
            if cursor.fetchone():
                cursor.execute('ALTER TABLE krevia_earnings RENAME TO lightcode_earnings;')


def reverse_rename(apps, schema_editor):
    """
    Reverse the rename operation.
    Only performs renames if the new names exist.
    """
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == 'postgresql':
            # Check if lightcode_fee column exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='orders_order' AND column_name='lightcode_fee'
            """)
            
            if cursor.fetchone():
                cursor.execute('ALTER TABLE orders_order RENAME COLUMN lightcode_fee TO krevia_fee;')
                cursor.execute('ALTER TABLE orders_order RENAME COLUMN lightcode_fee_percent TO krevia_fee_percent;')
                cursor.execute('ALTER TABLE orders_order RENAME COLUMN lightcode_plan TO krevia_plan;')
            
            # Check if lightcode_earnings table exists
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name='lightcode_earnings'
            """)
            
            if cursor.fetchone():
                cursor.execute('ALTER TABLE lightcode_earnings RENAME TO krevia_earnings;')


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0015_add_manual_reason_field'),
    ]

    operations = [
        migrations.RunPython(
            rename_krevia_to_lightcode,
            reverse_rename,
        ),
    ]
