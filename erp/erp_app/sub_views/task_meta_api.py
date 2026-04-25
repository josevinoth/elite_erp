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

    task_status_rows = list(TaskStatusOption.objects.order_by("name").values("id", "name"))
    task_statuses = [row["name"] for row in task_status_rows]
    task_statuses_linked = [
        {"value": str(row["id"]), "label": row["name"]}
        for row in task_status_rows
        if row.get("name")
    ]
    project_statuses = list(ProjectStatusOption.objects.order_by("name").values_list("name", flat=True))
    activity_rows = list(Activity.objects.order_by("name").values("id", "name"))
    activity_options = [row["name"] for row in activity_rows]
    activity_options_linked = [
        {"value": str(row["id"]), "label": row["name"]}
        for row in activity_rows
        if row.get("name")
    ]
    project_options = sorted(
        [
        {"value": str(p.id), "label": f"{p.project_id}_{p.project_name}"}
        for p in Project.objects.all()
        if p.project_id or p.project_name
        ],
        key=lambda option: option["label"].casefold(),
    )

    # Filter users who belong to Oman Team (by team ID for robustness)
    try:
        oman_team = Team.objects.get(name__iexact="Oman Team")
        oman_profiles = UserProfile.objects.filter(
            team_id=oman_team.id
        ).select_related("user").order_by("user__username")
        oman_team_users_linked = [
            {"value": str(p.user.id), "label": p.user.username}
            for p in oman_profiles
            if p.user.is_active
        ]
        oman_team_users = [item["label"] for item in oman_team_users_linked]
    except Team.DoesNotExist:
        oman_team_users = []
        oman_team_users_linked = []

    return JsonResponse(
        {
            "task_statuses": task_statuses,
            "task_statuses_linked": task_statuses_linked,
            "project_statuses": project_statuses,
            "activity_options": activity_options,
            "activity_options_linked": activity_options_linked,
            "oman_team_users": oman_team_users,
            "oman_team_users_linked": oman_team_users_linked,
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

