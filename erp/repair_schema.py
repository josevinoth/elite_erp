import os

import django
from django.apps import apps
from django.db import connection

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "erp.settings")
django.setup()

app_config = apps.get_app_config("erp_app")
existing_tables = set(connection.introspection.table_names())

with connection.schema_editor() as editor:
    for model in app_config.get_models():
        table_name = model._meta.db_table
        if table_name not in existing_tables:
            print(f"[CREATE TABLE] {table_name}")
            editor.create_model(model)
            existing_tables.add(table_name)

    for model in app_config.get_models():
        table_name = model._meta.db_table
        if table_name not in existing_tables:
            continue

        columns = {col.name for col in connection.introspection.get_table_description(connection.cursor(), table_name)}
        for field in model._meta.local_fields:
            if field.name in {"id"}:
                continue
            if field.column not in columns:
                print(f"[ADD COLUMN] {table_name}.{field.column}")
                editor.add_field(model, field)
                columns.add(field.column)

print("Schema repair check complete.")

