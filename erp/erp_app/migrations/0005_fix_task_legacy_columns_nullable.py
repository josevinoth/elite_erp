from django.db import migrations


LEGACY_TASK_COLUMNS = [
    "drawn_by_legacy",
    "approved_by_legacy",
    "project_owner_legacy",
    "updated_by_legacy",
    "task_status_legacy",
    "activity_legacy",
]


def _drop_not_null_on_legacy_columns(apps, schema_editor):
    """Relax legacy task columns to nullable when they exist in older databases."""
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        table_names = connection.introspection.table_names(cursor)
    if "erp_app_task" not in table_names:
        return

    with connection.cursor() as cursor:
        for column in LEGACY_TASK_COLUMNS:
            # PostgreSQL path (production): only alter when the column exists.
            if connection.vendor == "postgresql":
                cursor.execute(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'erp_app_task'
                      AND column_name = %s
                    """,
                    [column],
                )
                if cursor.fetchone():
                    cursor.execute(f'ALTER TABLE "erp_app_task" ALTER COLUMN "{column}" DROP NOT NULL')


def _noop_reverse(apps, schema_editor):
    # Keep reverse migration safe; restoring NOT NULL could fail on existing NULL data.
    return


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(_drop_not_null_on_legacy_columns, _noop_reverse),
    ]


