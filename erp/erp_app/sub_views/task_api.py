import datetime
import io
import json
import re

from django.contrib.auth import get_user_model
from django.http import FileResponse, JsonResponse
from django.db.models import Q
from django.db.models import Count
from django.db import ProgrammingError, OperationalError
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import Activity, Comment, Task, Project, TaskStatusOption
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


def _to_decimal(value, default="0"):
    if value in (None, ""):
        return default
    return str(value).strip()


def _to_date(value):
    """Return a datetime.date (or None). Accepts date objects, ISO strings, or datetime strings."""
    if value in (None, ""):
        return None
    if isinstance(value, datetime.date):
        return value
    s = str(value).split(" ")[0]
    try:
        return datetime.date.fromisoformat(s)
    except (ValueError, AttributeError):
        return None


def _validate_task_dates(start_date, end_date, approved_date):
    errors = {}
    if start_date and end_date and end_date < start_date:
        errors["end_date"] = "End Date must be greater than or equal to Start Date."
    if end_date and approved_date and approved_date < end_date:
        errors["approved_date"] = "Approved Date must be greater than or equal to End Date."
    if errors:
        return {
            "message": "Invalid task date sequence.",
            "errors": errors,
        }
    return None


def _next_revision(revision: str) -> str:
    """Auto-increment the trailing number in a revision string.

    '01' → '02', '09' → '10', 'Rev-3' → 'Rev-4'.
    Falls back to appending '-2' if no trailing digits found.
    """
    s = str(revision or "01").strip()
    m = re.search(r"(\d+)$", s)
    if m:
        num_str = m.group(1)
        new_num = str(int(num_str) + 1).zfill(len(num_str))
        return s[: m.start()] + new_num
    return s + "-2"


def _normalized_key(value):
    return normalize_text(str(value or "")).lower().replace(" ", "")


def _split_pk_link(value):
    """Parse values in '<pk>|<label>' format and return (pk_int_or_none, label_text)."""
    raw = str(value or "").strip()
    if not raw:
        return None, ""
    m = re.match(r"^(\d+)\s*\|\s*(.*)$", raw)
    if not m:
        return None, raw
    return int(m.group(1)), m.group(2).strip()


def _resolve_activity_storage(value):
    pk, label = _split_pk_link(value)
    if pk:
        activity_obj = Activity.objects.filter(pk=pk).first()
        if activity_obj:
            return str(activity_obj.id), activity_obj.name

    raw = normalize_text(label or value)
    if not raw:
        return "", ""

    if str(raw).isdigit():
        activity_obj = Activity.objects.filter(pk=int(raw)).first()
        if activity_obj:
            return str(activity_obj.id), activity_obj.name

    activity_obj = Activity.objects.filter(name__iexact=raw).first()
    if activity_obj:
        return str(activity_obj.id), activity_obj.name

    pretty = to_title_case(raw)
    return pretty, pretty


def _resolve_status_storage(value):
    pk, label = _split_pk_link(value)
    if pk:
        status_obj = TaskStatusOption.objects.filter(pk=pk).first()
        if status_obj:
            return str(status_obj.id), status_obj.name

    raw = normalize_text(label or value)
    if not raw:
        return "", ""

    if str(raw).isdigit():
        status_obj = TaskStatusOption.objects.filter(pk=int(raw)).first()
        if status_obj:
            return str(status_obj.id), status_obj.name

    status_obj = TaskStatusOption.objects.filter(name__iexact=raw).first()
    if status_obj:
        return str(status_obj.id), status_obj.name

    pretty = to_title_case(raw)
    return pretty, pretty


def _resolve_user_storage(value):
    user_model = get_user_model()
    pk, label = _split_pk_link(value)
    if pk:
        user_obj = user_model.objects.filter(pk=pk).first()
        if user_obj:
            return str(user_obj.id), user_obj.username

    raw = normalize_text(label or value)
    if not raw:
        return "", ""

    if str(raw).isdigit():
        user_obj = user_model.objects.filter(pk=int(raw)).first()
        if user_obj:
            return str(user_obj.id), user_obj.username

    user_obj = user_model.objects.filter(username__iexact=raw).first()
    if user_obj:
        return str(user_obj.id), user_obj.username

    pretty = to_title_case(raw)
    return pretty, pretty


def _activity_label(value):
    raw = normalize_text(value)
    if not raw:
        return ""
    if str(raw).isdigit():
        obj = Activity.objects.filter(pk=int(raw)).first()
        if obj:
            return obj.name
    return to_title_case(raw)


def _activity_id(value):
    raw = normalize_text(value)
    if not raw:
        return ""
    if str(raw).isdigit() and Activity.objects.filter(pk=int(raw)).exists():
        return str(raw)
    obj = Activity.objects.filter(name__iexact=raw).first()
    return str(obj.id) if obj else ""


def _status_label(value):
    raw = normalize_text(value)
    if not raw:
        return ""
    if str(raw).isdigit():
        obj = TaskStatusOption.objects.filter(pk=int(raw)).first()
        if obj:
            return obj.name
    return to_title_case(raw)


def _status_id(value):
    raw = normalize_text(value)
    if not raw:
        return ""
    if str(raw).isdigit() and TaskStatusOption.objects.filter(pk=int(raw)).exists():
        return str(raw)
    obj = TaskStatusOption.objects.filter(name__iexact=raw).first()
    return str(obj.id) if obj else ""


def _user_label(value):
    raw = normalize_text(value)
    if not raw:
        return ""
    user_model = get_user_model()
    if str(raw).isdigit():
        user_obj = user_model.objects.filter(pk=int(raw)).first()
        if user_obj:
            return user_obj.username
    return to_title_case(raw)


def _user_id(value):
    raw = normalize_text(value)
    if not raw:
        return ""
    user_model = get_user_model()
    if str(raw).isdigit() and user_model.objects.filter(pk=int(raw)).exists():
        return str(raw)
    user_obj = user_model.objects.filter(username__iexact=raw).first()
    return str(user_obj.id) if user_obj else ""


def _project_lookup():
    """Build fast lookup maps for project matching during import."""
    lookup_by_compound = {}
    lookup_by_parts = {}
    for project in Project.objects.all():
        compound = f"{project.project_id}_{project.project_name}"
        lookup_by_compound[_normalized_key(compound)] = project
        lookup_by_compound[_normalized_key(f"{project.project_id} {project.project_name}")] = project
        lookup_by_parts[_normalized_key(project.project_id)] = project
    return lookup_by_compound, lookup_by_parts


def _resolve_project(project_id_name, project_no, project_name, lookup_by_compound, lookup_by_parts):
    direct = lookup_by_compound.get(_normalized_key(project_id_name))
    if direct:
        return direct

    by_no = lookup_by_parts.get(_normalized_key(project_no))
    if by_no and _normalized_key(by_no.project_name) == _normalized_key(project_name):
        return by_no

    return None


def _resolve_project_from_link_or_text(project_id_name, project_no, project_name, lookup_by_compound, lookup_by_parts):
    project_pk, linked_label = _split_pk_link(project_id_name)
    if project_pk:
        by_pk = Project.objects.filter(pk=project_pk).first()
        if by_pk:
            return by_pk

    return _resolve_project(
        project_id_name=linked_label or project_id_name,
        project_no=project_no,
        project_name=project_name,
        lookup_by_compound=lookup_by_compound,
        lookup_by_parts=lookup_by_parts,
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


def _create_task_import_template_bytes():
    try:
        import openpyxl
    except ImportError:
        return None

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Task Import"

    headers = [
        "S",
        "Project No",
        "Project Name",
        "Project ID+ Name",
        "Date of Proposal from customer",
        "Activiy",
        "Revision",
        "Start Date",
        "End Date",
        "No of Days",
        "Drawn By",
        "Approved By",
        "Approved Date",
        "Status",
        "Order Value (OMR)",
        "Project Owner",
        "Project Status",
        "Remarks",
        "Drawn By Month",
        "Approved By Month",
    ]
    for col_idx, label in enumerate(headers, start=1):
        ws.cell(row=1, column=col_idx, value=label)

    ws.freeze_panes = "A2"

    project_choices = _build_linked_choices(
        Project.objects.all().order_by("project_id", "project_name"),
        lambda p: f"{p.project_id}_{p.project_name}".strip("_"),
    )
    activity_choices = _build_linked_choices(
        Activity.objects.all().order_by("name"),
        lambda a: a.name,
    )
    task_status_choices = _build_linked_choices(
        TaskStatusOption.objects.all().order_by("name"),
        lambda s: s.name,
    )

    user_model = get_user_model()
    user_choices = _build_linked_choices(
        user_model.objects.filter(is_active=True).order_by("username"),
        lambda u: u.username,
    )

    lookup_sheet_name = "Lookup"
    lookup = wb.create_sheet(title=lookup_sheet_name)
    lookup["A1"] = "Project"
    lookup["B1"] = "Activity"
    lookup["C1"] = "Task Status"
    lookup["D1"] = "User"

    for row_idx, val in enumerate(project_choices, start=1):
        lookup.cell(row=row_idx, column=1, value=val)
    for row_idx, val in enumerate(activity_choices, start=1):
        lookup.cell(row=row_idx, column=2, value=val)
    for row_idx, val in enumerate(task_status_choices, start=1):
        lookup.cell(row=row_idx, column=3, value=val)
    for row_idx, val in enumerate(user_choices, start=1):
        lookup.cell(row=row_idx, column=4, value=val)

    max_input_rows = 5000
    _add_dropdown(ws, "D", max_input_rows, lookup_sheet_name, "A", len(project_choices))
    _add_dropdown(ws, "F", max_input_rows, lookup_sheet_name, "B", len(activity_choices))
    _add_dropdown(ws, "N", max_input_rows, lookup_sheet_name, "C", len(task_status_choices))
    _add_dropdown(ws, "K", max_input_rows, lookup_sheet_name, "D", len(user_choices))
    _add_dropdown(ws, "L", max_input_rows, lookup_sheet_name, "D", len(user_choices))
    _add_dropdown(ws, "P", max_input_rows, lookup_sheet_name, "D", len(user_choices))

    lookup.sheet_state = "hidden"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def _serialize(obj, comment_count=0):
    activity_id = _activity_id(obj.activity)
    task_status_id = _status_id(obj.task_status)
    drawn_by_id = _user_id(obj.drawn_by)
    approved_by_id = _user_id(obj.approved_by)
    project_owner_id = _user_id(obj.project_owner)
    updated_by_id = _user_id(obj.updated_by)

    return {
        "id": obj.id,
        "project": str(obj.project_id) if obj.project_id else "",
        "project_id_name": obj.project_id_name,
        "activity": _activity_label(obj.activity),
        "activity_id": activity_id,
        "revision": obj.revision,
        "start_date": str(obj.start_date) if obj.start_date else "",
        "end_date": str(obj.end_date) if obj.end_date else "",
        "no_of_days": str(obj.no_of_days),
        "drawn_by": _user_label(obj.drawn_by),
        "drawn_by_id": drawn_by_id,
        "approved_by": _user_label(obj.approved_by),
        "approved_by_id": approved_by_id,
        "approved_date": str(obj.approved_date) if obj.approved_date else "",
        "task_status": _status_label(obj.task_status),
        "task_status_id": task_status_id,
        "project_owner": _user_label(obj.project_owner),
        "project_owner_id": project_owner_id,
        "remarks": obj.remarks,
        "drawn_by_month": obj.drawn_by_month,
        "approved_by_month": obj.approved_by_month,
        "updated_by": _user_label(obj.updated_by),
        "updated_by_id": updated_by_id,
        "comment_count": int(comment_count or 0),
    }


def _is_admin_user(user):
    if user.is_superuser or user.is_staff:
        return True
    group_names = {g.name.strip().lower() for g in user.groups.all()}
    return bool(group_names.intersection({"admin", "super admin", "staff"}))


@require_GET
def list_tasks_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    queryset = Task.objects.all()
    if not _is_admin_user(request.user):
        username = request.user.username
        user_id = str(request.user.id)
        queryset = queryset.filter(
            Q(drawn_by__iexact=username)
            | Q(approved_by__iexact=username)
            | Q(project_owner__iexact=username)
            | Q(drawn_by=user_id)
            | Q(approved_by=user_id)
            | Q(project_owner=user_id)
        )

    tasks = list(queryset.order_by("-id"))
    task_ids = [t.id for t in tasks]

    comment_counts = {}
    if task_ids:
        try:
            rows = (
                Comment.objects.filter(module_name="task", record_id__in=task_ids)
                .values("record_id")
                .annotate(total=Count("id"))
            )
            comment_counts = {int(r["record_id"]): int(r["total"]) for r in rows}
        except (ProgrammingError, OperationalError):
            # Comments table may not exist yet if migration is pending.
            comment_counts = {}

    return JsonResponse(
        {
            "tasks": [
                _serialize(o, comment_count=comment_counts.get(int(o.id), 0))
                for o in tasks
            ]
        }
    )


def _check_duplicate(project_instance, activity, revision, exclude_pk=None, activity_label=""):
    """Return error message string if Project+Revision+Activity combo already exists, else None."""
    activity_filter = Q(activity__iexact=activity)
    if activity_label and _normalized_key(activity_label) != _normalized_key(activity):
        activity_filter |= Q(activity__iexact=activity_label)

    qs = Task.objects.filter(
        project=project_instance,
        revision__iexact=revision,
    ).filter(activity_filter)
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    if qs.exists():
        return (
            f"A task with Project '{project_instance.project_id}', "
            f"Revision '{revision}' and Activity '{activity}' already exists."
        )
    return None


@require_POST
@csrf_protect
def create_task_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    p = _read_json(request)

    project_db_id = p.get("project", "")
    if not project_db_id:
        return JsonResponse({"message": "Project is required."}, status=400)
    try:
        project_instance = Project.objects.get(id=int(project_db_id))
    except (Project.DoesNotExist, ValueError, TypeError):
        return JsonResponse({"message": "Invalid project selected."}, status=400)

    activity, activity_label = _resolve_activity_storage(p.get("activity", ""))
    revision = normalize_text(p.get("revision", "01"))

    dup_msg = _check_duplicate(project_instance, activity, revision, activity_label=activity_label)
    if dup_msg:
        return JsonResponse(
            {"message": dup_msg, "suggested_revision": _next_revision(revision)}, status=409
        )

    start_date = _to_date(p.get("start_date"))
    end_date = _to_date(p.get("end_date"))
    approved_date = _to_date(p.get("approved_date"))
    date_error = _validate_task_dates(start_date, end_date, approved_date)
    if date_error:
        return JsonResponse(date_error, status=400)

    drawn_by, _drawn_by_label = _resolve_user_storage(p.get("drawn_by", ""))
    approved_by, _approved_by_label = _resolve_user_storage(p.get("approved_by", ""))
    task_status, _task_status_label = _resolve_status_storage(p.get("task_status", ""))
    project_owner, _project_owner_label = _resolve_user_storage(p.get("project_owner", ""))

    obj = Task.objects.create(
        project=project_instance,
        activity=activity,
        revision=revision,
        start_date=start_date,
        end_date=end_date,
        no_of_days=_to_decimal(p.get("no_of_days"), default="1"),
        drawn_by=drawn_by,
        approved_by=approved_by,
        approved_date=approved_date,
        task_status=task_status,
        project_owner=project_owner,
        remarks=normalize_text(p.get("remarks", "")),
        updated_by=str(request.user.id),
    )
    return JsonResponse({"success": True, "task": _serialize(obj)}, status=201)


@require_POST
@csrf_protect
def import_tasks_excel_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

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

    lookup_by_compound, lookup_by_parts = _project_lookup()
    created_count = 0
    skipped_count = 0
    failed_count = 0
    revised_count = 0
    failures = []
    row_reports = []
    activities_seen = set()  # track unique activities for Activity table population

    for row_number, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        values = list(row)
        if len(values) < 20:
            values.extend([None] * (20 - len(values)))

        project_id_name = values[3]
        proposal_date = _to_date(values[4])
        activity_raw = values[5]
        revision_raw = values[6]
        start_date = values[7]
        end_date = values[8]
        no_of_days = values[9]
        drawn_by = values[10]
        approved_by = values[11]
        approved_date = values[12]
        task_status = values[13]
        project_owner = values[15]
        remarks = values[17] if len(values) > 17 else ""
        drawn_by_month = values[18] if len(values) > 18 else ""
        approved_by_month = values[19] if len(values) > 19 else ""

        if not any([project_id_name, activity_raw, revision_raw, start_date, end_date]):
            skipped_count += 1
            continue

        project = _resolve_project_from_link_or_text(
            project_id_name=project_id_name,
            project_no=values[1],
            project_name=values[2],
            lookup_by_compound=lookup_by_compound,
            lookup_by_parts=lookup_by_parts,
        )
        if not project:
            failed_count += 1
            message = f"Project not found for '{project_id_name}'."
            failures.append(f"Row {row_number}: {message}")
            row_reports.append({"row": row_number, "status": "failed", "message": message})
            continue

        if proposal_date and not project.proposal_date:
            project.proposal_date = proposal_date
            project.save(update_fields=["proposal_date"])

        activity_pk, activity_label = _split_pk_link(activity_raw)
        if activity_pk:
            activity_obj = Activity.objects.filter(pk=activity_pk).first()
            activity_source = activity_obj.name if activity_obj else activity_label
        else:
            activity_source = activity_label

        activity, activity_label = _resolve_activity_storage(activity_source)
        if not activity:
            failed_count += 1
            message = "Activity is required."
            failures.append(f"Row {row_number}: {message}")
            row_reports.append({"row": row_number, "status": "failed", "message": message})
            continue

        # Collect unique title-cased activity for Activity table
        activity_title = to_title_case(activity_label or activity_source)
        if activity_title:
            activities_seen.add(activity_title)

        drawn_by_value, _drawn_by_label = _resolve_user_storage(drawn_by)
        approved_by_value, _approved_by_label = _resolve_user_storage(approved_by)
        project_owner_value, _project_owner_label = _resolve_user_storage(project_owner)
        task_status_value, task_status_source = _resolve_status_storage(task_status)

        original_revision = normalize_text(revision_raw or "01")
        revision = original_revision
        revision_adjusted = False
        while _check_duplicate(project, activity, revision, activity_label=activity_label):
            revision = _next_revision(revision)
            revision_adjusted = True

        parsed_start_date = _to_date(start_date)
        parsed_end_date = _to_date(end_date)
        parsed_approved_date = _to_date(approved_date)
        row_date_error = _validate_task_dates(parsed_start_date, parsed_end_date, parsed_approved_date)
        if row_date_error:
            failed_count += 1
            message = "; ".join(row_date_error["errors"].values())
            failures.append(f"Row {row_number}: {message}")
            row_reports.append({"row": row_number, "status": "failed", "message": message})
            continue

        try:
            Task.objects.create(
                project=project,
                project_id_name=normalize_text(str(project_id_name or "")),
                activity=activity,
                revision=revision,
                start_date=parsed_start_date,
                end_date=parsed_end_date,
                no_of_days=_to_decimal(no_of_days, default="1"),
                drawn_by=drawn_by_value,
                approved_by=approved_by_value,
                approved_date=parsed_approved_date,
                task_status=task_status_value,
                project_owner=project_owner_value,
                remarks=normalize_text(remarks),
                drawn_by_month=normalize_text(drawn_by_month),
                approved_by_month=normalize_text(approved_by_month),
                updated_by=str(request.user.id),
            )
            created_count += 1
            if revision_adjusted:
                revised_count += 1
                row_reports.append(
                    {
                        "row": row_number,
                        "status": "adjusted",
                        "message": (
                            f"Imported successfully. Revision changed from '{original_revision}' to '{revision}'."
                        ),
                    }
                )
            else:
                row_reports.append(
                    {"row": row_number, "status": "created", "message": "Imported successfully."}
                )
        except Exception as exc:
            failed_count += 1
            message = str(exc)
            failures.append(f"Row {row_number}: {message}")
            row_reports.append({"row": row_number, "status": "failed", "message": message})

    # Populate Activity table with unique title-cased activities from this import
    activities_added = 0
    for activity_name in activities_seen:
        _, created = Activity.objects.get_or_create(
            name__iexact=activity_name,
            defaults={"name": activity_name},
        )
        if created:
            activities_added += 1

    return JsonResponse(
        {
            "success": True,
            "message": "Task import completed.",
            "summary": {
                "created": created_count,
                "blank_rows": skipped_count,
                "skipped": skipped_count,
                "failed": failed_count,
                "revision_adjusted": revised_count,
                "activities_added": activities_added,
            },
            "failures": failures[:30],
            "row_reports": row_reports,
        }
    )


@require_GET
def download_task_template_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    template_bytes = _create_task_import_template_bytes()
    if template_bytes is None:
        return JsonResponse({"message": "Excel template dependency not installed."}, status=500)

    return FileResponse(template_bytes, as_attachment=True, filename="task_import_template.xlsx")


@require_http_methods(['PATCH', 'DELETE'])
@csrf_protect
def task_detail_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na
    try:
        obj = Task.objects.get(id=pk)
    except Task.DoesNotExist:
        return JsonResponse({"message": "Task not found."}, status=404)

    if request.method == "DELETE":
        obj.delete()
        return JsonResponse({"success": True, "message": "Task deleted."})

    p = _read_json(request)


    activity, activity_label = _resolve_activity_storage(p.get("activity", obj.activity))
    revision = normalize_text(p.get("revision", obj.revision))

    # Resolve project for duplicate check
    project_for_check = obj.project
    new_project_id = p.get("project", "")
    if new_project_id != "" and new_project_id:
        try:
            project_for_check = Project.objects.get(id=int(new_project_id))
        except (Project.DoesNotExist, ValueError, TypeError):
            return JsonResponse({"message": "Invalid project selected."}, status=400)
        obj.project = project_for_check

    dup_msg = _check_duplicate(
        project_for_check,
        activity,
        revision,
        exclude_pk=pk,
        activity_label=activity_label,
    )
    if dup_msg:
        return JsonResponse(
            {"message": dup_msg, "suggested_revision": _next_revision(revision)}, status=409
        )

    obj.activity = activity
    obj.revision = revision
    next_start_date = _to_date(p.get("start_date", obj.start_date))
    next_end_date = _to_date(p.get("end_date", obj.end_date))
    next_approved_date = _to_date(p.get("approved_date", obj.approved_date))

    date_error = _validate_task_dates(next_start_date, next_end_date, next_approved_date)
    if date_error:
        return JsonResponse(date_error, status=400)

    obj.start_date = next_start_date
    obj.end_date = next_end_date

    raw_days = _to_decimal(p.get("no_of_days", obj.no_of_days), default=str(obj.no_of_days))
    obj.no_of_days = max(1, float(raw_days or 1))

    obj.drawn_by, _drawn_by_label = _resolve_user_storage(p.get("drawn_by", obj.drawn_by))
    obj.approved_by, _approved_by_label = _resolve_user_storage(p.get("approved_by", obj.approved_by))
    obj.approved_date = next_approved_date
    obj.task_status, _task_status_label = _resolve_status_storage(p.get("task_status", obj.task_status))
    obj.project_owner, _project_owner_label = _resolve_user_storage(p.get("project_owner", obj.project_owner))
    obj.remarks = normalize_text(p.get("remarks", obj.remarks))
    obj.updated_by = str(request.user.id)
    obj.save()
    return JsonResponse({"success": True, "task": _serialize(obj)})
