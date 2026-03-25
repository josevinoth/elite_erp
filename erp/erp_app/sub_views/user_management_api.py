import json

from django.contrib.auth.models import Group, User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import Team, UserProfile, UserStatusOption


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return None


def _resolve_user_role(user):
    first_group = user.groups.order_by("name").first()
    if first_group:
        return first_group.name
    if user.is_superuser:
        return "Super Admin"
    if user.is_staff:
        return "Staff"
    return "User"


def _serialize_user(user):
    profile = UserProfile.objects.filter(user=user).select_related("status", "team").first()
    status = profile.status.name if profile and profile.status else ""
    team = profile.team.name if profile and profile.team else ""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": _resolve_user_role(user),
        "status": status,
        "team": team,
        "date_joined": user.date_joined.strftime("%d %b %Y") if user.date_joined else "",
    }


def _read_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (TypeError, ValueError):
        return {}


@require_GET
def list_users_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    users = User.objects.order_by("username")
    status_options = list(UserStatusOption.objects.order_by("name").values_list("name", flat=True))
    role_options = list(Group.objects.order_by("name").values_list("name", flat=True))
    team_options = list(Team.objects.order_by("name").values_list("name", flat=True))
    new_registration_count = UserProfile.objects.filter(
        status__name__iexact="New Registration"
    ).count()
    return JsonResponse(
        {
            "users": [_serialize_user(user) for user in users],
            "role_options": role_options,
            "status_options": status_options,
            "team_options": team_options,
            "new_registration_count": new_registration_count,
        }
    )


@require_GET
def list_pending_registrations_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    pending = (
        User.objects.filter(profile__status__name__iexact="New Registration")
        .select_related("profile__status")
        .order_by("date_joined")
    )
    return JsonResponse(
        {
            "pending_users": [_serialize_user(u) for u in pending],
            "count": pending.count(),
        }
    )


@require_POST
@csrf_protect
def approve_registration_api_view(request, user_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({"message": "User not found."}, status=404)

    payload = _read_json_body(request)
    action = str(payload.get("action", "approve")).lower()

    if action == "approve":
        status_name = "Active"
        is_active = True
    elif action == "reject":
        status_name = "Inactive"
        is_active = False
    else:
        return JsonResponse({"message": "Invalid action. Use 'approve' or 'reject'."}, status=400)

    status_obj, _ = UserStatusOption.objects.get_or_create(name=status_name)
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.status = status_obj
    profile.save(update_fields=["status"])
    user.is_active = is_active
    user.save(update_fields=["is_active"])

    return JsonResponse(
        {
            "success": True,
            "message": f"User {action}d successfully.",
            "user": _serialize_user(user),
        }
    )


@require_http_methods(["PATCH", "DELETE"])
@csrf_protect
def user_detail_api_view(request, user_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({"message": "User not found."}, status=404)

    if request.method == "DELETE":
        if request.user.id == user.id:
            return JsonResponse({"message": "You cannot delete your own account."}, status=400)
        user.delete()
        return JsonResponse({"success": True, "message": "User deleted successfully."})

    payload = _read_json_body(request)
    role = str(payload.get("role", "")).strip()
    status_name = str(payload.get("status", "")).strip()
    team_name = str(payload.get("team", "")).strip()

    if not role and not status_name and not team_name:
        return JsonResponse({"message": "Role, status, or team is required."}, status=400)

    if role:
        if len(role) > 50:
            return JsonResponse({"message": "Role is too long."}, status=400)
        role_group, _ = Group.objects.get_or_create(name=role)
        user.groups.set([role_group])

    if status_name:
        status_obj, _ = UserStatusOption.objects.get_or_create(name=status_name)
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.status = status_obj
        profile.save(update_fields=["status"])
        user.is_active = status_obj.name.lower() not in ("inactive", "new registration")
        user.save(update_fields=["is_active"])

    if team_name:
        team_obj, _ = Team.objects.get_or_create(name=team_name)
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.team = team_obj
        profile.save(update_fields=["team"])

    return JsonResponse(
        {
            "success": True,
            "message": "User updated successfully.",
            "user": _serialize_user(user),
        }
    )
