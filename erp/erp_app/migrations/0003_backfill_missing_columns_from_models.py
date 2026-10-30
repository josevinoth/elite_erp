from django.db import migrations


def _existing_columns(schema_editor, table_name):
    with schema_editor.connection.cursor() as cursor:
        description = schema_editor.connection.introspection.get_table_description(cursor, table_name)
    return {col.name for col in description}


def _add_nullable_column(schema_editor, table_name, column_name, db_type):
    qn = schema_editor.quote_name
    sql = f"ALTER TABLE {qn(table_name)} ADD COLUMN {qn(column_name)} {db_type} NULL"
    schema_editor.execute(sql)


def backfill_missing_columns(apps, schema_editor):
    app_config = apps.get_app_config("erp_app")
    for model in app_config.get_models():
        meta = model._meta
        if not meta.managed:
            continue

        table_name = meta.db_table
        existing = _existing_columns(schema_editor, table_name)
        for field in meta.local_concrete_fields:
            if field.primary_key or getattr(field, "auto_created", False):
                continue

            column_name = field.column
            if column_name in existing:
                continue

            db_type = field.db_type(schema_editor.connection)
            if not db_type:
                continue

            _add_nullable_column(schema_editor, table_name, column_name, db_type)
            existing.add(column_name)


class Migration(migrations.Migration):
    dependencies = [
        ("erp_app", "0002_add_missing_project_vendor_columns"),
    ]

    operations = [
        migrations.RunPython(backfill_missing_columns, migrations.RunPython.noop),
    ]
