from django.db import migrations, models
import django.db.models.deletion


def map_project_status_to_fk(apps, schema_editor):
    Project = apps.get_model("erp_app", "Project")
    ProjectStatusOption = apps.get_model("erp_app", "ProjectStatusOption")

    for project in Project.objects.all():
        raw_status = (project.status or "").strip()
        if not raw_status:
            continue

        normalized = " ".join(raw_status.split()).title()
        option, _ = ProjectStatusOption.objects.get_or_create(name=normalized)
        project.status_option_id = option.id
        project.save(update_fields=["status_option"])


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0014_remove_task_project_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="status_option",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="projects",
                to="erp_app.projectstatusoption",
            ),
        ),
        migrations.RunPython(map_project_status_to_fk, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="project",
            name="status",
        ),
        migrations.RenameField(
            model_name="project",
            old_name="status_option",
            new_name="status",
        ),
    ]

