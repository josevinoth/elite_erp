from django.db import migrations, models


def move_order_value_from_task_to_project(apps, schema_editor):
    Project = apps.get_model("erp_app", "Project")
    Task = apps.get_model("erp_app", "Task")

    latest_value_by_project = {}

    # Pick latest non-null task order value per project.
    for task in (
        Task.objects.exclude(project_id__isnull=True)
        .exclude(order_value_omr__isnull=True)
        .order_by("project_id", "-updated_at", "-id")
    ):
        if task.project_id not in latest_value_by_project:
            latest_value_by_project[task.project_id] = task.order_value_omr

    for project_id, order_value in latest_value_by_project.items():
        Project.objects.filter(id=project_id).update(order_value_omr=order_value)


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0016_add_project_updated_by"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="order_value_omr",
            field=models.DecimalField(blank=True, decimal_places=3, max_digits=14, null=True),
        ),
        migrations.RunPython(move_order_value_from_task_to_project, reverse_noop),
        migrations.RemoveField(
            model_name="task",
            name="order_value_omr",
        ),
    ]

