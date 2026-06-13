from django.db import migrations


LEGACY_TIMESHEET_COLUMNS = [
    "employee_name_legacy",
]


def _drop_not_null_on_timesheet_legacy_columns(apps, schema_editor):
    """Allow NULL in legacy timesheet columns when present in older databases."""
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        table_names = connection.introspection.table_names(cursor)
    if "erp_app_timesheet" not in table_names:
        return

    with connection.cursor() as cursor:
        for column in LEGACY_TIMESHEET_COLUMNS:
            if connection.vendor == "postgresql":
                cursor.execute(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'erp_app_timesheet'
                      AND column_name = %s
                    """,
                    [column],
                )
                if cursor.fetchone():
                    cursor.execute(
                        f'ALTER TABLE "erp_app_timesheet" ALTER COLUMN "{column}" DROP NOT NULL'
                    )


def _noop_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0006_update_timesheet_duplicate_constraint"),
    ]

    operations = [
        migrations.RunPython(_drop_not_null_on_timesheet_legacy_columns, _noop_reverse),
    ]


