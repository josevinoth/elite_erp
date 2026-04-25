from django.db import migrations, models


def move_proposal_date_from_task_to_project(apps, schema_editor):
    Project = apps.get_model("erp_app", "Project")
    Task = apps.get_model("erp_app", "Task")

    latest_value_by_project = {}

    # Pick the latest non-null task proposal date per project.
    for task in (
        Task.objects.exclude(project_id__isnull=True)
        .exclude(proposal_date__isnull=True)
        .order_by("project_id", "-updated_at", "-id")
    ):
        if task.project_id not in latest_value_by_project:
            latest_value_by_project[task.project_id] = task.proposal_date

    for project_id, proposal_date in latest_value_by_project.items():
        Project.objects.filter(id=project_id).update(proposal_date=proposal_date)


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0024_remove_timesheet_activity_add_task_unique"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="proposal_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.RunPython(move_proposal_date_from_task_to_project, reverse_noop),
        migrations.RemoveField(
            model_name="task",
            name="proposal_date",
        ),
    ]

