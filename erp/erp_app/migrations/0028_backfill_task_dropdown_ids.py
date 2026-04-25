from django.db import migrations


def _coerce_to_id(value, by_name_map, existing_ids):
    raw = str(value or "").strip()
    if not raw:
        return ""

    if raw.isdigit() and int(raw) in existing_ids:
        return raw

    mapped = by_name_map.get(raw.casefold())
    if mapped is not None:
        return str(mapped)

    return raw


def forward_backfill_task_dropdown_ids(apps, schema_editor):
    Task = apps.get_model("erp_app", "Task")
    Activity = apps.get_model("erp_app", "Activity")
    TaskStatusOption = apps.get_model("erp_app", "TaskStatusOption")
    User = apps.get_model("auth", "User")

    activity_by_name = {str(a.name).strip().casefold(): a.id for a in Activity.objects.all() if a.name}
    status_by_name = {str(s.name).strip().casefold(): s.id for s in TaskStatusOption.objects.all() if s.name}
    user_by_name = {str(u.username).strip().casefold(): u.id for u in User.objects.all() if u.username}

    activity_ids = set(Activity.objects.values_list("id", flat=True))
    status_ids = set(TaskStatusOption.objects.values_list("id", flat=True))
    user_ids = set(User.objects.values_list("id", flat=True))

    for task in Task.objects.all().iterator():
        new_activity = _coerce_to_id(task.activity, activity_by_name, activity_ids)
        new_task_status = _coerce_to_id(task.task_status, status_by_name, status_ids)
        new_drawn_by = _coerce_to_id(task.drawn_by, user_by_name, user_ids)
        new_approved_by = _coerce_to_id(task.approved_by, user_by_name, user_ids)
        new_project_owner = _coerce_to_id(task.project_owner, user_by_name, user_ids)
        new_updated_by = _coerce_to_id(task.updated_by, user_by_name, user_ids)

        changed = []
        if task.activity != new_activity:
            task.activity = new_activity
            changed.append("activity")
        if task.task_status != new_task_status:
            task.task_status = new_task_status
            changed.append("task_status")
        if task.drawn_by != new_drawn_by:
            task.drawn_by = new_drawn_by
            changed.append("drawn_by")
        if task.approved_by != new_approved_by:
            task.approved_by = new_approved_by
            changed.append("approved_by")
        if task.project_owner != new_project_owner:
            task.project_owner = new_project_owner
            changed.append("project_owner")
        if task.updated_by != new_updated_by:
            task.updated_by = new_updated_by
            changed.append("updated_by")

        if changed:
            task.save(update_fields=changed)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0027_add_reusable_comment_model"),
    ]

    operations = [
        migrations.RunPython(forward_backfill_task_dropdown_ids, noop_reverse),
    ]

