import datetime
import io
import json
import re

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.http import FileResponse, JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import Task, TimeSheet, UserProfile
from ..utils import normalize_text


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


def _to_decimal_value(value, default="0"):
    from decimal import Decimal, InvalidOperation

    try:
        return Decimal(_to_decimal(value, default=default))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(str(default))


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


def _task_activity_name(task):
    return task.activity.name if getattr(task, "activity_id", None) else ""


def _split_pk_link(value):
    raw = str(value or "").strip()
    if not raw:
        return None, ""
    m = re.match(r"^(\d+)\s*\|\s*(.*)$", raw)
    if not m:
        return None, raw
    return int(m.group(1)), m.group(2).strip()


def _resolve_employee_storage(value):
    user_model = get_user_model()

    if isinstance(value, user_model):
        return value, value.username

    pk, label = _split_pk_link(value)
    if pk:
        user_obj = user_model.objects.filter(pk=pk).first()
        if user_obj:
            return user_obj, user_obj.username

    raw = normalize_text(label or value)
    if not raw:
        return None, ""

    if str(raw).isdigit():
        user_obj = user_model.objects.filter(pk=int(raw)).first()
        if user_obj:
            return user_obj, user_obj.username

    user_obj = user_model.objects.filter(username__iexact=raw).first()
    if user_obj:
        return user_obj, user_obj.username

    return None, raw


def _employee_label(value):
    user_model = get_user_model()
    if isinstance(value, user_model):
        return value.username

    raw = normalize_text(value)
    if not raw:
        return ""
    if str(raw).isdigit():
        user_obj = user_model.objects.filter(pk=int(raw)).first()
        if user_obj:
            return user_obj.username
    return raw


def _employee_id(value):
    user_model = get_user_model()
    if isinstance(value, user_model):
        return str(value.id)

    raw = normalize_text(value)
    if not raw:
        return ""
    if str(raw).isdigit() and user_model.objects.filter(pk=int(raw)).exists():
        return str(raw)
    user_obj = user_model.objects.filter(username__iexact=raw).first()
    return str(user_obj.id) if user_obj else ""


def _employee_filter(qs, employee_value):
    employee_user, _ = _resolve_employee_storage(employee_value)
    if employee_user:
        return qs.filter(employee_name_id=employee_user.id)

    raw = normalize_text(employee_value)
    if not raw:
        return qs.none()

    if str(raw).isdigit():
        return qs.filter(employee_name_id=int(raw))

    user_model = get_user_model()
    employee_user = user_model.objects.filter(username__iexact=raw).first()
    if not employee_user:
        return qs.none()
    return qs.filter(employee_name_id=employee_user.id)


def _serialize(obj):
    task_activity = _task_activity_name(obj.task)
    return {
        "id": obj.id,
        "task": str(obj.task_id),
        "task_label": f"{obj.task.project_id_name} | {task_activity} | Rev {obj.task.revision}",
        "employee_name": obj.employee_name.username if obj.employee_name_id else "",
        "employee_id": str(obj.employee_name_id or ""),
        "billing_date": str(obj.billing_date) if obj.billing_date else "",
        "efforts": str(obj.efforts),
        "remarks": obj.remarks,
    }


def _duplicate_exists(employee_user, task_obj, billing_date, efforts, exclude_pk=None):
    qs = TimeSheet.objects.filter(task=task_obj, billing_date=billing_date, efforts=efforts)
    qs = _employee_filter(qs, employee_user)
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    return qs.exists()


def _task_assigned_to_user(task, user):
    user_id = str(getattr(user, "id", "") or "").strip()
    if not user_id:
        return False

    assignee_ids = {
        str(task.drawn_by_id or ""),
        str(task.approved_by_id or ""),
        str(task.project_owner_id or ""),
        str(task.updated_by_id or ""),
    }
    return user_id in assignee_ids


def _is_admin_user(user):
    if user.is_superuser or user.is_staff:
        return True
    group_names = {g.name.strip().lower() for g in user.groups.all()}
    return bool(group_names.intersection({"admin", "super admin", "staff"}))


def _task_options(user, is_admin=False):
    options = [
        {
            "value": str(task.id),
            "label": f"{task.project_id_name} | {_task_activity_name(task)} | Rev {task.revision}",
            "project_id_name": task.project_id_name,
        }
        for task in Task.objects.select_related("project", "activity").all()
        if (task.project_id_name or task.activity_id)
        and (is_admin or _task_assigned_to_user(task, user))
    ]
    return sorted(options, key=lambda option: option["label"].casefold())


def _build_user_lookup():
    """Return dict of lowercase username -> user payload for all non-inactive active users."""
    lookup = {}

    # Get all user profile statuses to filter out inactive users
    inactive_user_ids = set(
        UserProfile.objects.filter(
            status__name__iexact="inactive"
        ).values_list("user_id", flat=True)
    )

    user_model = get_user_model()
    for user in user_model.objects.filter(is_active=True).exclude(id__in=inactive_user_ids):
        lookup[user.username.lower()] = {"id": str(user.id), "username": user.username, "obj": user}

    return lookup


def _resolve_employee(raw_name, user_lookup):
    """Match raw name from Excel to a known user. Returns (user_obj, username) or (None, None)."""
    if not raw_name:
        return None, None
    key = str(raw_name).strip().lower()
    user_payload = user_lookup.get(key)
    if not user_payload:
        return None, None
    return user_payload.get("obj"), user_payload.get("username")


def _build_task_lookup():
    by_project = {}
    for task in Task.objects.select_related("project", "activity").all():
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
        [task for task in candidates if _normalized_activity(_task_activity_name(task)) == activity_key],
        key=lambda t: t.id,
        reverse=True,
    )


def _build_linked_choices(queryset, label_getter):
    return [f"{obj.id}|{label_getter(obj)}" for obj in queryset]


def _add_dropdown(ws, column_letter, max_row, lookup_sheet_name, lookup_column, list_length):
    if list_length <= 0:
        return
    from openpyxl.worksheet.datavalidation import DataValidation

    formula = f"='{lookup_sheet_name}'!${lookup_column}$1:${lookup_column}${list_length}"
    dv = DataValidation(type="list", formula1=formula, allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f"{column_letter}2:{column_letter}{max_row}")


def _create_timesheet_import_template_bytes():
    try:
        import openpyxl
    except ImportError:
        return None

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Timesheet Import"

    headers = [
        "S",
        "Employee Name",
        "Project",
        "Activity",
        "Billing Date",
        "Efforts",
        "Remarks",
    ]
    for col_idx, label in enumerate(headers, start=1):
        ws.cell(row=1, column=col_idx, value=label)

    ws.freeze_panes = "A2"

    user_model = get_user_model()
    user_choices = _build_linked_choices(
        user_model.objects.filter(is_active=True).order_by("username"),
        lambda u: u.username,
    )
    task_choices = _build_linked_choices(
        Task.objects.select_related("project", "activity").all().order_by("project_id_name", "id"),
        lambda t: t.project_id_name,
    )
    activity_names = sorted(
        {
            _task_activity_name(task)
            for task in Task.objects.select_related("activity").filter(activity__isnull=False)
            if _task_activity_name(task)
        },
        key=str.casefold,
    )
    activity_choices = [f"{idx}|{name}" for idx, name in enumerate(activity_names, start=1)]

    lookup_sheet_name = "Lookup"
    lookup = wb.create_sheet(title=lookup_sheet_name)
    lookup["A1"] = "Employee"
    lookup["B1"] = "Project"
    lookup["C1"] = "Activity"

    for row_idx, val in enumerate(user_choices, start=1):
        lookup.cell(row=row_idx, column=1, value=val)
    for row_idx, val in enumerate(task_choices, start=1):
        lookup.cell(row=row_idx, column=2, value=val)
    for row_idx, val in enumerate(activity_choices, start=1):
        lookup.cell(row=row_idx, column=3, value=val)

    max_input_rows = 5000
    _add_dropdown(ws, "B", max_input_rows, lookup_sheet_name, "A", len(user_choices))
    _add_dropdown(ws, "C", max_input_rows, lookup_sheet_name, "B", len(task_choices))
    _add_dropdown(ws, "D", max_input_rows, lookup_sheet_name, "C", len(activity_choices))

    lookup.sheet_state = "hidden"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def _resolve_task(project_text, activity_text, lookup):
    candidates = _matching_tasks(project_text, activity_text, lookup)
    if not candidates:
        return None

    return candidates[0]


def _import_duplicate_exists(employee_name, project_text, activity_text, billing_date, efforts, lookup):
    matching_tasks = _matching_tasks(project_text, activity_text, lookup)
    if not matching_tasks:
        return False

    qs = TimeSheet.objects.filter(
        billing_date=billing_date,
        efforts=efforts,
        task_id__in=[task.id for task in matching_tasks],
    )
    return _employee_filter(qs, employee_name).exists()


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
    user_model = get_user_model()
    active_users = list(
        user_model.objects.filter(is_active=True)
        .exclude(id__in=inactive_user_ids)
        .order_by("username")
        .values("id", "username")
    )
    active_usernames = [str(u.get("username", "")) for u in active_users if u.get("username")]
    active_users_linked = [
        {"value": str(u["id"]), "label": str(u["username"])}
        for u in active_users
        if u.get("id") and u.get("username")
    ]

    return JsonResponse(
        {
            "tasks": _task_options(request.user, is_admin=_is_admin_user(request.user)),
            "users": active_usernames,
            "users_linked": active_users_linked,
        }
    )


@require_GET
def list_timesheets_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    rows = TimeSheet.objects.select_related("task", "employee_name")
    if not _is_admin_user(request.user):
        rows = rows.filter(employee_name_id=request.user.id)

    return JsonResponse({"timesheets": [_serialize(row) for row in rows.order_by("-id")]})


@require_POST
@csrf_protect
def create_timesheet_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)

    task_id = payload.get("task", "")
    billing_date = _to_date(payload.get("billing_date"))
    employee_user, _employee_label_value = _resolve_employee_storage(payload.get("employee_name", ""))

    if not task_id:
        return JsonResponse({"message": "Task is required."}, status=400)
    if not billing_date:
        return JsonResponse({"message": "Billing date is required."}, status=400)
    if not employee_user:
        return JsonResponse({"message": "Employee name is required."}, status=400)

    from decimal import Decimal, InvalidOperation
    try:
        efforts_val = Decimal(str(payload.get("efforts") or "0").strip())
    except InvalidOperation:
        efforts_val = Decimal("0")
    if efforts_val <= 0:
        return JsonResponse({"message": "Efforts must be greater than 0."}, status=400)

    try:
        task = Task.objects.get(id=int(task_id))
    except (Task.DoesNotExist, TypeError, ValueError):
        return JsonResponse({"message": "Invalid task selected."}, status=400)

    if not _task_assigned_to_user(task, request.user):
        return JsonResponse({"message": "You can only log timesheet for tasks assigned to you."}, status=403)

    if _duplicate_exists(employee_user, task, billing_date, efforts_val):
        return JsonResponse(
            {
                "message": (
                    "Duplicate entry: Employee Name + Task + Billing Date + Efforts already exists. "
                    "Please change any one value and try again."
                )
            },
            status=409,
        )

    try:
        row = TimeSheet.objects.create(
            task=task,
            employee_name=employee_user,
            billing_date=billing_date,
            efforts=efforts_val,
            remarks=normalize_text(payload.get("remarks", "")),
        )
    except IntegrityError:
        return JsonResponse(
            {
                "message": (
                    "Duplicate entry: Employee Name + Task + Billing Date + Efforts already exists. "
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
        if not _task_assigned_to_user(row.task, request.user):
            return JsonResponse({"message": "You can only log timesheet for tasks assigned to you."}, status=403)

    employee_user, _employee_label_value = _resolve_employee_storage(
        payload.get("employee_name", row.employee_name)
    )
    billing_date = _to_date(payload.get("billing_date", row.billing_date))

    if not employee_user:
        return JsonResponse({"message": "Employee name is required."}, status=400)
    if not billing_date:
        return JsonResponse({"message": "Billing date is required."}, status=400)

    next_efforts = row.efforts
    if "efforts" in payload:
        from decimal import Decimal, InvalidOperation
        try:
            next_efforts = Decimal(str(payload.get("efforts") or "0").strip())
        except InvalidOperation:
            next_efforts = Decimal("0")
        if next_efforts <= 0:
            return JsonResponse({"message": "Efforts must be greater than 0."}, status=400)

    if _duplicate_exists(employee_user, row.task, billing_date, next_efforts, exclude_pk=row.id):
        return JsonResponse(
            {
                "message": (
                    "Duplicate entry: Employee Name + Task + Billing Date + Efforts already exists. "
                    "Please change any one value and try again."
                )
            },
            status=409,
        )

    row.employee_name = employee_user
    row.billing_date = billing_date
    row.efforts = next_efforts
    row.remarks = normalize_text(payload.get("remarks", row.remarks))

    try:
        row.save()
    except IntegrityError:
        return JsonResponse(
            {
                "message": (
                    "Duplicate entry: Employee Name + Task + Billing Date + Efforts already exists. "
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
        efforts_value = _to_decimal_value(efforts_raw, default="0")
        _project_pk, project_label = _split_pk_link(project_text)
        project_ref = normalize_text(project_label or project_text)
        if not project_ref:
            project_ref = "(project not provided)"

        report_row_payload = {
            "row": row_number,
            "employee_name_input": _excel_text(employee_name_raw),
            "project_input": _excel_text(project_text),
            "project_id_name": project_ref,
            "activity_input": _excel_text(activity_raw),
            "billing_date_input": _excel_text(billing_date_raw),
            "efforts_input": _excel_text(efforts_raw),
            "remarks_input": _excel_text(remarks_raw),
        }

        if not any([employee_name_raw, project_text, activity_raw, billing_date_raw, efforts_raw, remarks_raw]):
            blank_count += 1
            continue

        # Validate employee name against registered active users
        employee_user, employee_label = _resolve_employee(employee_name_raw, user_lookup)
        if not employee_user:
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

        if not employee_user or not billing_date:
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
                    "message": (
                        f"Task not found for Project + Activity ({project_ref} | "
                        f"{_excel_text(activity_raw)})."
                    ),
                }
            )
            continue

        if _import_duplicate_exists(
            employee_user,
            project_text,
            activity_name,
            billing_date,
            efforts_value,
            task_lookup,
        ):
            duplicate_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "duplicate",
                    "message": "Skipped duplicate (Employee + Project + Activity + Billing Date + Efforts).",
                }
            )
            continue

        try:
            TimeSheet.objects.create(
                task=task,
                employee_name=employee_user,
                billing_date=billing_date,
                efforts=efforts_value,
                remarks=normalize_text(remarks_raw),
            )
            created_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "created",
                    "message": f"Imported successfully for {employee_label}.",
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

    template_bytes = _create_timesheet_import_template_bytes()
    if template_bytes is None:
        return JsonResponse({"message": "Excel template dependency not installed."}, status=500)

    return FileResponse(template_bytes, as_attachment=True, filename="timesheet_import_template.xlsx")

