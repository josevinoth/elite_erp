import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST

from ..sub_models import Activity, ProjectStatusOption, TaskStatusOption, Project, Team
from ..sub_models import UserProfile
from ..utils import to_title_case


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return None


def _read_json(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (TypeError, ValueError):
        return {}


def _normalize_option_table(model_cls):
    seen = {}
    for obj in model_cls.objects.order_by("id"):
        normalized = to_title_case(obj.name)
        if not normalized:
            obj.delete()
            continue

        key = normalized.lower()
        if key in seen:
            obj.delete()
            continue

        if obj.name != normalized:
            obj.name = normalized
            obj.save(update_fields=["name"])

        seen[key] = obj.id


@require_GET
def list_task_meta_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    task_statuses = list(TaskStatusOption.objects.values_list("name", flat=True))
    project_statuses = list(ProjectStatusOption.objects.values_list("name", flat=True))
    activity_options = list(Activity.objects.order_by("name").values_list("name", flat=True))
    project_options = [
        {"value": str(p.id), "label": f"{p.project_id}_{p.project_name}"}
        for p in Project.objects.all()
        if p.project_id or p.project_name
    ]

    # Filter users who belong to Oman Team (by team ID for robustness)
    try:
        oman_team = Team.objects.get(name__iexact="Oman Team")
        oman_profiles = UserProfile.objects.filter(
            team_id=oman_team.id
        ).select_related("user").order_by("user__username")
        oman_team_users = [p.user.username for p in oman_profiles if p.user.is_active]
    except Team.DoesNotExist:
        oman_team_users = []

    return JsonResponse(
        {
            "task_statuses": task_statuses,
            "project_statuses": project_statuses,
            "activity_options": activity_options,
            "oman_team_users": oman_team_users,
            "project_options": project_options,
        }
    )


@require_POST
@csrf_protect
def create_activity_option_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    name = to_title_case(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Activity name is required."}, status=400)

    obj, _created = Activity.objects.get_or_create(name=name)
    return JsonResponse({"success": True, "name": obj.name})


@require_POST
@csrf_protect
def create_task_status_option_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    name = to_title_case(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Status name is required."}, status=400)

    obj, _created = TaskStatusOption.objects.get_or_create(name=name)
    return JsonResponse({"success": True, "name": obj.name})


@require_POST
@csrf_protect
def create_project_status_option_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    name = to_title_case(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Project status name is required."}, status=400)

    obj, _created = ProjectStatusOption.objects.get_or_create(name=name)
    return JsonResponse({"success": True, "name": obj.name})

