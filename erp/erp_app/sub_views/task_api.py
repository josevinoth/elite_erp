import datetime
import json
import os
import re

from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.db.models import Q
from django.db.models import Count
from django.db import ProgrammingError, OperationalError
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import Activity, Comment, Task, Project
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


def _serialize(obj, comment_count=0):
    return {
        "id": obj.id,
        "project": str(obj.project_id) if obj.project_id else "",
        "project_id_name": obj.project_id_name,
        "activity": obj.activity,
        "revision": obj.revision,
        "start_date": str(obj.start_date) if obj.start_date else "",
        "end_date": str(obj.end_date) if obj.end_date else "",
        "no_of_days": str(obj.no_of_days),
        "drawn_by": obj.drawn_by,
        "approved_by": obj.approved_by,
        "approved_date": str(obj.approved_date) if obj.approved_date else "",
        "task_status": obj.task_status,
        "project_owner": obj.project_owner,
        "remarks": obj.remarks,
        "drawn_by_month": obj.drawn_by_month,
        "approved_by_month": obj.approved_by_month,
        "updated_by": obj.updated_by,
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
        queryset = queryset.filter(
            Q(drawn_by__iexact=username)
            | Q(approved_by__iexact=username)
            | Q(project_owner__iexact=username)
        )

    tasks = list(queryset)
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


def _check_duplicate(project_instance, activity, revision, exclude_pk=None):
    """Return error message string if Project+Revision+Activity combo already exists, else None."""
    qs = Task.objects.filter(
        project=project_instance,
        activity__iexact=activity,
        revision__iexact=revision,
    )
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

    activity = normalize_text(p.get("activity", ""))
    revision = normalize_text(p.get("revision", "01"))

    dup_msg = _check_duplicate(project_instance, activity, revision)
    if dup_msg:
        return JsonResponse(
            {"message": dup_msg, "suggested_revision": _next_revision(revision)}, status=409
        )

    obj = Task.objects.create(
        project=project_instance,
        activity=activity,
        revision=revision,
        start_date=_to_date(p.get("start_date")),
        end_date=_to_date(p.get("end_date")),
        no_of_days=_to_decimal(p.get("no_of_days"), default="1"),
        drawn_by=to_title_case(p.get("drawn_by", "")),
        approved_by=to_title_case(p.get("approved_by", "")),
        approved_date=_to_date(p.get("approved_date")),
        task_status=to_title_case(p.get("task_status", "")),
        project_owner=to_title_case(p.get("project_owner", "")),
        remarks=normalize_text(p.get("remarks", "")),
        updated_by=to_title_case(p.get("updated_by", "")),
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

        project = _resolve_project(
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

        activity = normalize_text(activity_raw)
        if not activity:
            failed_count += 1
            message = "Activity is required."
            failures.append(f"Row {row_number}: {message}")
            row_reports.append({"row": row_number, "status": "failed", "message": message})
            continue

        # Collect unique title-cased activity for Activity table
        activity_title = to_title_case(activity_raw)
        if activity_title:
            activities_seen.add(activity_title)

        original_revision = normalize_text(revision_raw or "01")
        revision = original_revision
        revision_adjusted = False
        while _check_duplicate(project, activity, revision):
            revision = _next_revision(revision)
            revision_adjusted = True

        try:
            Task.objects.create(
                project=project,
                project_id_name=normalize_text(str(project_id_name or "")),
                activity=activity,
                revision=revision,
                start_date=_to_date(start_date),
                end_date=_to_date(end_date),
                no_of_days=_to_decimal(no_of_days, default="1"),
                drawn_by=to_title_case(drawn_by),
                approved_by=to_title_case(approved_by),
                approved_date=_to_date(approved_date),
                task_status=to_title_case(task_status),
                project_owner=to_title_case(project_owner),
                remarks=normalize_text(remarks),
                drawn_by_month=normalize_text(drawn_by_month),
                approved_by_month=normalize_text(approved_by_month),
                updated_by=to_title_case(request.user.username),
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

    template_path = os.path.join(str(settings.BASE_DIR), "erp_app", "media", "task_details.xlsx")
    if not os.path.exists(template_path):
        return JsonResponse({"message": "Template file not found."}, status=404)

    return FileResponse(
        open(template_path, "rb"),
        as_attachment=True,
        filename="task_import_template.xlsx",
    )


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


    activity = normalize_text(p.get("activity", obj.activity))
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

    dup_msg = _check_duplicate(project_for_check, activity, revision, exclude_pk=pk)
    if dup_msg:
        return JsonResponse(
            {"message": dup_msg, "suggested_revision": _next_revision(revision)}, status=409
        )

    obj.activity = activity
    obj.revision = revision
    obj.start_date = _to_date(p.get("start_date", obj.start_date))
    obj.end_date = _to_date(p.get("end_date", obj.end_date))

    raw_days = _to_decimal(p.get("no_of_days", obj.no_of_days), default=str(obj.no_of_days))
    obj.no_of_days = max(1, float(raw_days or 1))

    obj.drawn_by = to_title_case(p.get("drawn_by", obj.drawn_by))
    obj.approved_by = to_title_case(p.get("approved_by", obj.approved_by))
    obj.approved_date = _to_date(p.get("approved_date", obj.approved_date))
    obj.task_status = to_title_case(p.get("task_status", obj.task_status))
    obj.project_owner = to_title_case(p.get("project_owner", obj.project_owner))
    obj.remarks = normalize_text(p.get("remarks", obj.remarks))
    obj.updated_by = to_title_case(p.get("updated_by", obj.updated_by))
    obj.save()
    return JsonResponse({"success": True, "task": _serialize(obj)})
