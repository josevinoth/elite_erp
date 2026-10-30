from django.db import migrations


def _column_names(schema_editor, table_name):
    with schema_editor.connection.cursor() as cursor:
        description = schema_editor.connection.introspection.get_table_description(cursor, table_name)
    return {col.name for col in description}


def add_missing_columns(apps, schema_editor):
    vendor = schema_editor.connection.vendor

    project_columns = _column_names(schema_editor, "erp_app_project")
    if "project_location" not in project_columns:
        if vendor == "postgresql":
            schema_editor.execute(
                "ALTER TABLE erp_app_project "
                "ADD COLUMN project_location varchar(200) NOT NULL DEFAULT '';"
            )
        else:
            schema_editor.execute(
                "ALTER TABLE erp_app_project "
                "ADD COLUMN project_location varchar(200) NOT NULL DEFAULT '';"
            )

    vendor_columns = _column_names(schema_editor, "erp_app_vendor")
    if "vendor_code" not in vendor_columns:
        if vendor == "postgresql":
            schema_editor.execute(
                "ALTER TABLE erp_app_vendor "
                "ADD COLUMN vendor_code varchar(20) NULL;"
            )
        else:
            schema_editor.execute(
                "ALTER TABLE erp_app_vendor "
                "ADD COLUMN vendor_code varchar(20) NULL;"
            )


class Migration(migrations.Migration):
    dependencies = [
        ("erp_app", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(add_missing_columns, migrations.RunPython.noop),
    ]
