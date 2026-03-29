import datetime
import json
import os

from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.http import FileResponse, JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import Task, TimeSheet, UserProfile
from ..utils import normalize_text, to_title_case


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return None


def _read_json(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (TypeError, ValueError):
        return {}


def _to_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime.date):
        return value
    try:
        return datetime.date.fromisoformat(str(value).split(" ")[0])
    except (TypeError, ValueError, AttributeError):
        return None


def _to_decimal(value, default="0"):
    if value in (None, ""):
        return default
    return str(value).strip()


def _excel_text(value):
    """Return a readable scalar string for import report exports."""
    if value in (None, ""):
        return ""
    if isinstance(value, datetime.datetime):
        return value.date().isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    return str(value).strip()


def _normalized_key(value):
    return normalize_text(str(value or "")).lower().replace(" ", "")


def _normalized_activity(value):
    return normalize_text(str(value or "")).casefold()


def _serialize(obj):
    return {
        "id": obj.id,
        "task": str(obj.task_id),
        "task_label": f"{obj.task.project_id_name} | {obj.task.activity} | Rev {obj.task.revision}",
        "employee_name": obj.employee_name,
        "billing_date": str(obj.billing_date) if obj.billing_date else "",
        "efforts": str(obj.efforts),
        "remarks": obj.remarks,
    }


def _duplicate_exists(employee_name, task_obj, billing_date, exclude_pk=None):
    qs = TimeSheet.objects.filter(
        employee_name__iexact=employee_name,
        task=task_obj,
        billing_date=billing_date,
    )
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    return qs.exists()


def _task_assigned_to_user(task, username):
    uname = str(username or "").strip().lower()
    if not uname:
        return False

    assignees = [task.drawn_by, task.approved_by, task.project_owner, task.updated_by]
    return any(str(value or "").strip().lower() == uname for value in assignees)


def _is_admin_user(user):
    if user.is_superuser or user.is_staff:
        return True
    group_names = {g.name.strip().lower() for g in user.groups.all()}
    return bool(group_names.intersection({"admin", "super admin", "staff"}))


def _task_options(username, is_admin=False):
    return [
        {
            "value": str(task.id),
            "label": f"{task.project_id_name} | {task.activity} | Rev {task.revision}",
            "project_id_name": task.project_id_name,
        }
        for task in Task.objects.select_related("project").all()
        if (task.project_id_name or task.activity)
        and (is_admin or _task_assigned_to_user(task, username))
    ]


def _build_user_lookup():
    """Return dict of lowercase username → exact username for all non-inactive active users."""
    lookup = {}

    # Get all user profile statuses to filter out inactive users
    inactive_user_ids = set(
        UserProfile.objects.filter(
            status__name__iexact="inactive"
        ).values_list("user_id", flat=True)
    )

    for user in User.objects.filter(is_active=True).exclude(id__in=inactive_user_ids):
        lookup[user.username.lower()] = user.username

    return lookup


def _resolve_employee(raw_name, user_lookup):
    """Match raw name from Excel to a known username (case-insensitive). Returns exact username or None."""
    if not raw_name:
        return None
    key = str(raw_name).strip().lower()
    return user_lookup.get(key)


def _build_task_lookup():
    by_project = {}
    for task in Task.objects.select_related("project").all():
        keys = []
        if task.project and task.project.project_id:
            keys.append(_normalized_key(task.project.project_id))
            if task.project.project_name:
                keys.append(_normalized_key(f"{task.project.project_id}_{task.project.project_name}"))
                keys.append(_normalized_key(f"{task.project.project_id} {task.project.project_name}"))
        if task.project_id_name:
            keys.append(_normalized_key(task.project_id_name))

        for key in keys:
            by_project.setdefault(key, []).append(task)
    return by_project


def _matching_tasks(project_text, activity_text, lookup):
    candidates = lookup.get(_normalized_key(project_text), [])
    if not candidates:
        return []

    activity_key = _normalized_activity(activity_text)
    if not activity_key:
        return []

    return sorted(
        [task for task in candidates if _normalized_activity(task.activity) == activity_key],
        key=lambda t: t.id,
        reverse=True,
    )


def _resolve_task(project_text, activity_text, lookup):
    candidates = _matching_tasks(project_text, activity_text, lookup)
    if not candidates:
        return None

    return candidates[0]


def _import_duplicate_exists(employee_name, project_text, activity_text, billing_date, lookup):
    matching_tasks = _matching_tasks(project_text, activity_text, lookup)
    if not matching_tasks:
        return False

    return TimeSheet.objects.filter(
        employee_name__iexact=employee_name,
        billing_date=billing_date,
        task_id__in=[task.id for task in matching_tasks],
    ).exists()


@require_GET
def list_timesheet_meta_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    # Build active user list (exclude inactive profile status)
    inactive_user_ids = set(
        UserProfile.objects.filter(
            status__name__iexact="inactive"
        ).values_list("user_id", flat=True)
    )
    active_usernames = list(
        User.objects.filter(is_active=True)
        .exclude(id__in=inactive_user_ids)
        .order_by("username")
        .values_list("username", flat=True)
    )

    return JsonResponse(
        {
            "tasks": _task_options(request.user.username, is_admin=_is_admin_user(request.user)),
            "users": active_usernames,
        }
    )


@require_GET
def list_timesheets_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    rows = TimeSheet.objects.select_related("task").all()
    if not _is_admin_user(request.user):
        rows = rows.filter(employee_name__iexact=request.user.username)

    return JsonResponse({"timesheets": [_serialize(row) for row in rows]})


@require_POST
@csrf_protect
def create_timesheet_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)

    task_id = payload.get("task", "")
    billing_date = _to_date(payload.get("billing_date"))
    employee_name = to_title_case(payload.get("employee_name", ""))

    if not task_id:
        return JsonResponse({"message": "Task is required."}, status=400)
    if not billing_date:
        return JsonResponse({"message": "Billing date is required."}, status=400)
    if not employee_name:
        return JsonResponse({"message": "Employee name is required."}, status=400)

    try:
        task = Task.objects.get(id=int(task_id))
    except (Task.DoesNotExist, TypeError, ValueError):
        return JsonResponse({"message": "Invalid task selected."}, status=400)

    if not _task_assigned_to_user(task, request.user.username):
        return JsonResponse({"message": "You can only log timesheet for tasks assigned to you."}, status=403)

    if _duplicate_exists(employee_name, task, billing_date):
        return JsonResponse(
            {
                "message": (
                    "Duplicate entry: Employee Name + Task + Billing Date already exists. "
                    "Please change any one value and try again."
                )
            },
            status=409,
        )

    try:
        row = TimeSheet.objects.create(
            task=task,
            employee_name=employee_name,
            billing_date=billing_date,
            efforts=_to_decimal(payload.get("efforts"), default="0"),
            remarks=normalize_text(payload.get("remarks", "")),
        )
    except IntegrityError:
        return JsonResponse(
            {
                "message": (
                    "Duplicate entry: Employee Name + Task + Billing Date already exists. "
                    "Please change any one value and try again."
                )
            },
            status=409,
        )

    return JsonResponse({"success": True, "timesheet": _serialize(row)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@csrf_protect
def timesheet_detail_api_view(request, pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        row = TimeSheet.objects.select_related("task").get(id=pk)
    except TimeSheet.DoesNotExist:
        return JsonResponse({"message": "Timesheet record not found."}, status=404)

    if request.method == "DELETE":
        row.delete()
        return JsonResponse({"success": True, "message": "Timesheet record deleted."})

    payload = _read_json(request)

    if "task" in payload and payload.get("task", ""):
        try:
            row.task = Task.objects.get(id=int(payload.get("task")))
        except (Task.DoesNotExist, TypeError, ValueError):
            return JsonResponse({"message": "Invalid task selected."}, status=400)
        if not _task_assigned_to_user(row.task, request.user.username):
            return JsonResponse({"message": "You can only log timesheet for tasks assigned to you."}, status=403)

    employee_name = to_title_case(payload.get("employee_name", row.employee_name))
    billing_date = _to_date(payload.get("billing_date", row.billing_date))

    if not employee_name:
        return JsonResponse({"message": "Employee name is required."}, status=400)
    if not billing_date:
        return JsonResponse({"message": "Billing date is required."}, status=400)

    if _duplicate_exists(employee_name, row.task, billing_date, exclude_pk=row.id):
        return JsonResponse(
            {
                "message": (
                    "Duplicate entry: Employee Name + Task + Billing Date already exists. "
                    "Please change any one value and try again."
                )
            },
            status=409,
        )

    row.employee_name = employee_name
    row.billing_date = billing_date
    row.efforts = _to_decimal(payload.get("efforts", row.efforts), default=str(row.efforts or 0))
    row.remarks = normalize_text(payload.get("remarks", row.remarks))

    try:
        row.save()
    except IntegrityError:
        return JsonResponse(
            {
                "message": (
                    "Duplicate entry: Employee Name + Task + Billing Date already exists. "
                    "Please change any one value and try again."
                )
            },
            status=409,
        )

    return JsonResponse({"success": True, "timesheet": _serialize(row)})


@require_POST
@csrf_protect
def import_timesheets_excel_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    excel_file = request.FILES.get("file")
    if not excel_file:
        return JsonResponse({"message": "Excel file is required (form field: file)."}, status=400)

    try:
        import openpyxl
    except ImportError:
        return JsonResponse({"message": "Excel import dependency not installed."}, status=500)

    try:
        wb = openpyxl.load_workbook(excel_file, data_only=True)
        ws = wb.active
    except Exception:
        return JsonResponse({"message": "Invalid or unreadable Excel file."}, status=400)

    task_lookup = _build_task_lookup()
    user_lookup = _build_user_lookup()
    created_count = 0
    blank_count = 0
    duplicate_count = 0
    failed_count = 0
    row_reports = []

    for row_number, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        values = list(row)
        if len(values) < 7:
            values.extend([None] * (7 - len(values)))

        employee_name_raw = values[1]  # Column B
        project_text = values[2]  # Column C
        activity_raw = values[3]  # Column D (unused for timesheet persistence)
        billing_date_raw = values[4]  # Column E
        efforts_raw = values[5]  # Column F
        remarks_raw = values[6]  # Column G

        report_row_payload = {
            "row": row_number,
            "employee_name_input": _excel_text(employee_name_raw),
            "project_input": _excel_text(project_text),
            "activity_input": _excel_text(activity_raw),
            "billing_date_input": _excel_text(billing_date_raw),
            "efforts_input": _excel_text(efforts_raw),
            "remarks_input": _excel_text(remarks_raw),
        }

        if not any([employee_name_raw, project_text, activity_raw, billing_date_raw, efforts_raw, remarks_raw]):
            blank_count += 1
            continue

        # Validate employee name against registered active users
        employee_name = _resolve_employee(employee_name_raw, user_lookup)
        if not employee_name:
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": (
                        f"Employee '{employee_name_raw}' not found in active user list. "
                        "Please register the user first or check the spelling."
                    ),
                }
            )
            continue

        activity_name = normalize_text(activity_raw)
        if not activity_name:
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": "Activity is required.",
                }
            )
            continue

        billing_date = _to_date(billing_date_raw)

        if not employee_name or not billing_date:
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": "Billing Date is required.",
                }
            )
            continue

        task = _resolve_task(project_text, activity_name, task_lookup)
        if not task:
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": "Task not found for Project + Activity.",
                }
            )
            continue

        if _import_duplicate_exists(employee_name, project_text, activity_name, billing_date, task_lookup):
            duplicate_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "duplicate",
                    "message": "Skipped duplicate (Employee + Project + Activity + Billing Date).",
                }
            )
            continue

        try:
            TimeSheet.objects.create(
                task=task,
                employee_name=employee_name,
                billing_date=billing_date,
                efforts=_to_decimal(efforts_raw, default="0"),
                remarks=normalize_text(remarks_raw),
            )
            created_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "created",
                    "message": "Imported successfully.",
                }
            )
        except Exception as exc:
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": str(exc),
                }
            )

    return JsonResponse(
        {
            "success": True,
            "message": "Timesheet import completed.",
            "summary": {
                "created": created_count,
                "blank_rows": blank_count,
                "duplicates": duplicate_count,
                "failed": failed_count,
            },
            "row_reports": row_reports,
        }
    )


@require_GET
def download_timesheet_template_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    template_path = os.path.join(str(settings.BASE_DIR), "erp_app", "media", "time_sheet.xlsx")
    if not os.path.exists(template_path):
        return JsonResponse({"message": "Template file not found."}, status=404)

    return FileResponse(
        open(template_path, "rb"),
        as_attachment=True,
        filename="timesheet_import_template.xlsx",
    )

