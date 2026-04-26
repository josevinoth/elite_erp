import json

from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST

from ..sub_models import (
    Comment,
    CommentNotificationRead,
    Task,
    TaskNotificationRead,
)

MODULE_TASK = "task"
MAX_ALERT_ITEMS = 20


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return None


def _is_admin_user(user):
    if user.is_superuser or user.is_staff:
        return True
    group_names = {g.name.strip().lower() for g in user.groups.all()}
    return bool(group_names.intersection({"admin", "super admin", "staff"}))


def _read_json(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (TypeError, ValueError):
        return {}


def _task_label(task):
    activity = task.activity.name if task.activity_id else ""
    return f"{task.project_id_name} | {activity} | Rev {task.revision}"


def _visible_tasks_qs(user):
    queryset = Task.objects.select_related("activity")
    if not _is_admin_user(user):
        queryset = queryset.filter(
            Q(drawn_by_id=user.id)
            | Q(approved_by_id=user.id)
            | Q(project_owner_id=user.id)
        )
    return queryset


def _ensure_task_alert_baseline(user, visible_qs):
    # First notification load sets a baseline so only future tasks count as new.
    if TaskNotificationRead.objects.filter(user=user).exists():
        return

    visible_task_ids = list(visible_qs.values_list("id", flat=True))
    if not visible_task_ids:
        return

    TaskNotificationRead.objects.bulk_create(
        [TaskNotificationRead(user=user, task_id=task_id) for task_id in visible_task_ids],
        ignore_conflicts=True,
    )


def _ensure_message_alert_baseline(user, visible_task_ids):
    # First message notification load sets baseline so only future comments count as new.
    if CommentNotificationRead.objects.filter(user=user).exists():
        return

    if not visible_task_ids:
        return

    # Only mark existing comments as read
    existing_comment_ids = list(
        Comment.objects.filter(module_name=MODULE_TASK, record_id__in=visible_task_ids)
        .exclude(updated_by__iexact=user.username)
        .values_list("id", flat=True)
    )
    if not existing_comment_ids:
        return

    CommentNotificationRead.objects.bulk_create(
        [CommentNotificationRead(user=user, comment_id=comment_id) for comment_id in existing_comment_ids],
        ignore_conflicts=True,
    )


def _unread_tasks_qs(user):
    visible_qs = _visible_tasks_qs(user)
    _ensure_task_alert_baseline(user, visible_qs)
    seen_task_ids = TaskNotificationRead.objects.filter(user=user).values_list("task_id", flat=True)
    return visible_qs.exclude(id__in=seen_task_ids)


def _unread_comments_qs(user, visible_task_ids=None):
    if visible_task_ids is None:
        visible_task_ids = list(_visible_tasks_qs(user).values_list("id", flat=True))

    _ensure_message_alert_baseline(user, visible_task_ids)

    queryset = Comment.objects.filter(module_name=MODULE_TASK, record_id__in=visible_task_ids)
    queryset = queryset.exclude(updated_by__iexact=user.username)

    seen_comment_ids = CommentNotificationRead.objects.filter(user=user).values_list("comment_id", flat=True)
    return queryset.exclude(id__in=seen_comment_ids)


def _serialize_task_item(task):
    return {
        "task_id": task.id,
        "title": _task_label(task),
        "created_at": task.created_at.isoformat() if task.created_at else "",
    }


def _serialize_comment_item(comment, task_obj):
    return {
        "comment_id": comment.id,
        "task_id": int(comment.record_id),
        "task_title": _task_label(task_obj),
        "message": (comment.comments or "")[:160],
        "updated_by": comment.updated_by,
        "created_at": comment.created_at.isoformat() if comment.created_at else "",
    }


@require_GET
def list_header_notifications_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    unread_tasks_qs = _unread_tasks_qs(request.user)
    task_items = [
        _serialize_task_item(task)
        for task in unread_tasks_qs.order_by("-created_at", "-id")[:MAX_ALERT_ITEMS]
    ]

    visible_task_ids = list(_visible_tasks_qs(request.user).values_list("id", flat=True))
    visible_task_map = {
        task.id: task
        for task in Task.objects.filter(id__in=visible_task_ids).select_related("activity")
    }

    unread_comments_qs = _unread_comments_qs(request.user, visible_task_ids=visible_task_ids)
    comment_items = []
    for comment in unread_comments_qs.order_by("-created_at", "-id")[:MAX_ALERT_ITEMS]:
        task_obj = visible_task_map.get(comment.record_id)
        if not task_obj:
            continue
        comment_items.append(_serialize_comment_item(comment, task_obj))

    return JsonResponse(
        {
            "task_alerts": {
                "count": int(unread_tasks_qs.count()),
                "items": task_items,
            },
            "message_alerts": {
                "count": int(unread_comments_qs.count()),
                "items": comment_items,
            },
        }
    )


@require_GET
def list_unread_task_notifications_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    unread_tasks = list(_unread_tasks_qs(request.user).order_by("-created_at", "-id"))
    return JsonResponse(
        {
            "count": len(unread_tasks),
            "tasks": [_serialize_task_item(task) for task in unread_tasks],
        }
    )


@require_GET
def list_unread_message_notifications_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    visible_task_ids = list(_visible_tasks_qs(request.user).values_list("id", flat=True))
    task_map = {
        task.id: task
        for task in Task.objects.filter(id__in=visible_task_ids).select_related("activity")
    }
    unread_comments = list(_unread_comments_qs(request.user, visible_task_ids=visible_task_ids).order_by("-created_at", "-id"))

    items = []
    for comment in unread_comments:
        task_obj = task_map.get(comment.record_id)
        if not task_obj:
            continue
        items.append(_serialize_comment_item(comment, task_obj))

    return JsonResponse(
        {
            "count": len(items),
            "messages": items,
        }
    )


@require_POST
@csrf_protect
def mark_task_notifications_read_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    task_ids = payload.get("task_ids") or []
    if payload.get("task_id") not in (None, ""):
        task_ids = list(task_ids) + [payload.get("task_id")]

    normalized_ids = []
    for value in task_ids:
        try:
            normalized_ids.append(int(value))
        except (TypeError, ValueError):
            continue

    visible_task_ids = set(_visible_tasks_qs(request.user).values_list("id", flat=True))
    if normalized_ids:
        allowed_ids = [task_id for task_id in normalized_ids if task_id in visible_task_ids]
    else:
        # Empty payload means "mark all visible unread tasks as read".
        allowed_ids = list(_unread_tasks_qs(request.user).values_list("id", flat=True))

    if allowed_ids:
        TaskNotificationRead.objects.bulk_create(
            [TaskNotificationRead(user=request.user, task_id=task_id) for task_id in set(allowed_ids)],
            ignore_conflicts=True,
        )

    return JsonResponse({"success": True, "marked": len(set(allowed_ids))})


@require_POST
@csrf_protect
def mark_message_notifications_read_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    comment_ids = payload.get("comment_ids") or []

    task_id_value = payload.get("task_id")
    if task_id_value not in (None, ""):
        try:
            task_id = int(task_id_value)
        except (TypeError, ValueError):
            task_id = None
        if task_id is not None:
            comment_ids.extend(
                Comment.objects.filter(module_name=MODULE_TASK, record_id=task_id)
                .exclude(updated_by__iexact=request.user.username)
                .values_list("id", flat=True)
            )

    normalized_comment_ids = []
    for value in comment_ids:
        try:
            normalized_comment_ids.append(int(value))
        except (TypeError, ValueError):
            continue

    visible_task_ids = set(_visible_tasks_qs(request.user).values_list("id", flat=True))
    if normalized_comment_ids:
        allowed_comment_ids = list(
            Comment.objects.filter(id__in=set(normalized_comment_ids), module_name=MODULE_TASK, record_id__in=visible_task_ids)
            .exclude(updated_by__iexact=request.user.username)
            .values_list("id", flat=True)
        )
    else:
        # Empty payload means "mark all visible unread task messages as read".
        allowed_comment_ids = list(
            _unread_comments_qs(request.user, visible_task_ids=list(visible_task_ids)).values_list("id", flat=True)
        )

    if allowed_comment_ids:
        CommentNotificationRead.objects.bulk_create(
            [CommentNotificationRead(user=request.user, comment_id=comment_id) for comment_id in allowed_comment_ids],
            ignore_conflicts=True,
        )

    return JsonResponse({"success": True, "marked": len(allowed_comment_ids)})
