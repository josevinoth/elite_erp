from django.db import migrations


PROJECT_LIFECYCLE_DEFAULTS = [
    "Active",
    "On Hold",
    "Completed",
    "Cancelled",
]

STOCK_MAINTENANCE_TYPE_DEFAULTS = [
    "Adjustment",
    "Damage",
    "Return",
    "Transfer",
    "Audit",
]


def seed_option_tables(apps, schema_editor):
    ProjectLifecycleStatusOption = apps.get_model("erp_app", "ProjectLifecycleStatusOption")
    StockMaintenanceTypeOption = apps.get_model("erp_app", "StockMaintenanceTypeOption")

    for name in PROJECT_LIFECYCLE_DEFAULTS:
        ProjectLifecycleStatusOption.objects.get_or_create(name=name)

    for name in STOCK_MAINTENANCE_TYPE_DEFAULTS:
        StockMaintenanceTypeOption.objects.get_or_create(name=name)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0012_task_remove_project_no_name_add_fk"),
    ]

    operations = [
        migrations.RunPython(seed_option_tables, noop_reverse),
    ]

