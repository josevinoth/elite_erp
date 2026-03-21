from django.db import migrations


def _to_title_case(value):
    if value in (None, ""):
        return ""
    return str(value).strip().title()


def forwards(apps, schema_editor):
    task_model = apps.get_model("erp_app", "Task")
    task_status_model = apps.get_model("erp_app", "TaskStatusOption")
    project_status_model = apps.get_model("erp_app", "ProjectStatusOption")

    for option_model in (task_status_model, project_status_model):
        groups = {}
        for option in option_model.objects.order_by("id"):
            normalized = _to_title_case(option.name)
            if not normalized:
                option.delete()
                continue

            groups.setdefault(normalized.lower(), []).append((option, normalized))

        for _key, grouped_items in groups.items():
            keep_obj, keep_value = grouped_items[0]

            for duplicate_obj, _ in grouped_items[1:]:
                duplicate_obj.delete()

            if keep_obj.name != keep_value:
                keep_obj.name = keep_value
                keep_obj.save(update_fields=["name"])

    text_fields = [
        "project_no",
        "project_name",
        "project_id_name",
        "activity",
        "revision",
        "drawn_by",
        "approved_by",
        "task_status",
        "project_owner",
        "project_status",
        "remarks",
        "drawn_by_month",
        "approved_by_month",
        "updated_by",
    ]

    for task in task_model.objects.all():
        changed = []

        for field in text_fields:
            current = getattr(task, field)
            normalized = _to_title_case(current)
            if current != normalized:
                setattr(task, field, normalized)
                changed.append(field)

        if task.project_no and task.project_name:
            rebuilt = f"{task.project_no}_{task.project_name}"
            if task.project_id_name != rebuilt:
                task.project_id_name = rebuilt
                if "project_id_name" not in changed:
                    changed.append("project_id_name")

        if changed:
            task.save(update_fields=changed)


def noop_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):
    dependencies = [
        ("erp_app", "0005_projectstatusoption_taskstatusoption_task_updated_by"),
    ]

    operations = [
        migrations.RunPython(forwards, noop_reverse),
    ]

