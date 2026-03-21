"""
Data migration: seed default TaskStatusOption and ProjectStatusOption rows.
These values were previously hard-coded in task_meta_api.py and seeded at
runtime on every request.  Moving them here ensures they are populated once,
idempotently, as part of the normal migration workflow.
"""

from django.db import migrations


TASK_STATUS_DEFAULTS = [
    "Completed",
    "Hold",
    "Waiting For Approval",
    "Yet To Start",
]

PROJECT_STATUS_DEFAULTS = [
    "Awaiting For Mas Approval",
    "Awaiting For Order",
    "Awaiting For Tender",
    "Awaiting For Feedback From Customer",
    "Awaiting For Payment Advance",
    "Awaiting For Tender Opening.",
    "Closed",
    "Delivered",
    "No Update From Customer",
    "Order Lost",
    "Order Won",
    "Project Delivered",
    "Project On Hold",
    "Quote Submitted",
    "Regret",
    "Training",
    "Wip",
    "Waiting For Agreement",
    "Work In Progress",
]


def seed_defaults(apps, schema_editor):
    TaskStatusOption = apps.get_model("erp_app", "TaskStatusOption")
    ProjectStatusOption = apps.get_model("erp_app", "ProjectStatusOption")

    for name in TASK_STATUS_DEFAULTS:
        TaskStatusOption.objects.get_or_create(name=name)

    for name in PROJECT_STATUS_DEFAULTS:
        ProjectStatusOption.objects.get_or_create(name=name)


def unseed_defaults(apps, schema_editor):
    """Reverse: remove only the rows that were added by this migration."""
    TaskStatusOption = apps.get_model("erp_app", "TaskStatusOption")
    ProjectStatusOption = apps.get_model("erp_app", "ProjectStatusOption")

    TaskStatusOption.objects.filter(name__in=TASK_STATUS_DEFAULTS).delete()
    ProjectStatusOption.objects.filter(name__in=PROJECT_STATUS_DEFAULTS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0009_projectlifecyclestatusoption_alter_project_status"),
    ]

    operations = [
        migrations.RunPython(seed_defaults, reverse_code=unseed_defaults),
    ]

