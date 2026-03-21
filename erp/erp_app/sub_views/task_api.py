import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import Task, Project
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
    if value in (None, ""):
        return None
    return str(value).split(" ")[0]


def _serialize(obj):
    return {
        "id": obj.id,
        "project": str(obj.project_id) if obj.project_id else "",
        "project_id_name": obj.project_id_name,
        "proposal_date": str(obj.proposal_date) if obj.proposal_date else "",
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
    }


@require_GET
def list_tasks_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    return JsonResponse({"tasks": [_serialize(o) for o in Task.objects.all()]})


@require_POST
@csrf_protect
def create_task_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    p = _read_json(request)

    project_db_id = p.get("project", "")
    project_instance = None
    if project_db_id:
        try:
            project_instance = Project.objects.get(id=int(project_db_id))
        except (Project.DoesNotExist, ValueError, TypeError):
            return JsonResponse({"message": "Invalid project selected."}, status=400)
    else:
        return JsonResponse({"message": "Project is required."}, status=400)

    obj = Task.objects.create(
        project=project_instance,
        proposal_date=_to_date(p.get("proposal_date")),
        activity=normalize_text(p.get("activity", "")),
        revision=normalize_text(p.get("revision", "")),
        start_date=_to_date(p.get("start_date")),
        end_date=_to_date(p.get("end_date")),
        no_of_days=_to_decimal(p.get("no_of_days"), default="0"),
        drawn_by=to_title_case(p.get("drawn_by", "")),
        approved_by=to_title_case(p.get("approved_by", "")),
        approved_date=_to_date(p.get("approved_date")),
        task_status=to_title_case(p.get("task_status", "")),
        project_owner=to_title_case(p.get("project_owner", "")),
        remarks=normalize_text(p.get("remarks", "")),
        updated_by=to_title_case(p.get("updated_by", "")),
    )
    return JsonResponse({"success": True, "task": _serialize(obj)}, status=201)


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

    project_db_id = p.get("project", "")
    if project_db_id != "":
        if project_db_id:
            try:
                obj.project = Project.objects.get(id=int(project_db_id))
            except (Project.DoesNotExist, ValueError, TypeError):
                return JsonResponse({"message": "Invalid project selected."}, status=400)
        else:
            obj.project = None

    obj.proposal_date = _to_date(p.get("proposal_date", obj.proposal_date))
    obj.activity = normalize_text(p.get("activity", obj.activity))
    obj.revision = normalize_text(p.get("revision", obj.revision))
    obj.start_date = _to_date(p.get("start_date", obj.start_date))
    obj.end_date = _to_date(p.get("end_date", obj.end_date))
    obj.no_of_days = _to_decimal(p.get("no_of_days", obj.no_of_days), default=str(obj.no_of_days))
    obj.drawn_by = to_title_case(p.get("drawn_by", obj.drawn_by))
    obj.approved_by = to_title_case(p.get("approved_by", obj.approved_by))
    obj.approved_date = _to_date(p.get("approved_date", obj.approved_date))
    obj.task_status = to_title_case(p.get("task_status", obj.task_status))
    obj.project_owner = to_title_case(p.get("project_owner", obj.project_owner))
    obj.remarks = normalize_text(p.get("remarks", obj.remarks))
    obj.updated_by = to_title_case(p.get("updated_by", obj.updated_by))
    obj.save()
    return JsonResponse({"success": True, "task": _serialize(obj)})
