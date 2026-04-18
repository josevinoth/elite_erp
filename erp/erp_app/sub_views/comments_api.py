import datetime
import json
import os
import mimetypes

from django.http import JsonResponse
from django.http import FileResponse
from django.utils import timezone
from django.db import ProgrammingError, OperationalError
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import Comment, CommentAttachment, Task
from ..utils import normalize_text

MODULE_TASK = "task"
MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_ATTACHMENT_EXTENSIONS = {
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg",
    "pdf",
    "doc", "docx", "txt", "rtf",
    "xls", "xlsx", "csv",
    "zip", "rar", "7z",
}
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"}
ALLOWED_TASK_COMMENT_STATUSES = {
    "work in progress",
    "awaiting for approval",
}


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return None


def _read_json(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (TypeError, ValueError):
        return {}


def _is_admin_user(user):
    if user.is_superuser or user.is_staff:
        return True
    group_names = {g.name.strip().lower() for g in user.groups.all()}
    return bool(group_names.intersection({"admin", "super admin", "staff"}))


def _normalize_module(value):
    return normalize_text(value).lower()


def _to_record_id(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_datetime(value):
    if value in (None, ""):
        return timezone.now()
    if isinstance(value, datetime.datetime):
        dt = value
    else:
        s = str(value).strip().replace("Z", "+00:00")
        try:
            dt = datetime.datetime.fromisoformat(s)
        except ValueError:
            return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _can_access_task(user, task_id):
    task = Task.objects.filter(id=task_id).first()
    if not task:
        return None, JsonResponse({"message": "Task not found."}, status=404)

    if _is_admin_user(user):
        return task, None

    username = str(user.username or "").strip().lower()
    allowed = (
        str(task.drawn_by or "").strip().lower() == username
        or str(task.approved_by or "").strip().lower() == username
        or str(task.project_owner or "").strip().lower() == username
    )
    if not allowed:
        return None, JsonResponse({"message": "Access denied for this task."}, status=403)
    return task, None


def _can_add_comment_to_task(task):
    status = str(task.task_status or "").strip().lower()
    return status in ALLOWED_TASK_COMMENT_STATUSES


def _ensure_record_access(request, module_name, record_id):
    if module_name == MODULE_TASK:
        _, denied = _can_access_task(request.user, record_id)
        return denied
    return JsonResponse({"message": "Unsupported module for comments."}, status=400)


def _can_modify_comment(request, comment_obj):
    if _is_admin_user(request.user):
        return True
    return str(comment_obj.updated_by or "").strip().lower() == str(request.user.username or "").strip().lower()


def _serialize(comment_obj, request):
    attachments = [
        {
            "id": a.id,
            "name": a.original_name or a.file.name.split("/")[-1],
            "size": int(getattr(a.file, "size", 0) or 0),
            "ext": (a.original_name or a.file.name).split(".")[-1].lower() if "." in (a.original_name or a.file.name) else "",
            "is_image": ((a.original_name or a.file.name).split(".")[-1].lower() in IMAGE_EXTENSIONS) if "." in (a.original_name or a.file.name) else False,
            "download_url": f"/api/comment-attachments/{a.id}/download/",
            "view_url": f"/api/comment-attachments/{a.id}/view/",
        }
        for a in comment_obj.attachments.all()
    ]
    return {
        "id": comment_obj.id,
        "module_name": comment_obj.module_name,
        "record_id": comment_obj.record_id,
        "comment_datetime": comment_obj.comment_datetime.isoformat() if comment_obj.comment_datetime else "",
        "updated_by": comment_obj.updated_by,
        "comments": comment_obj.comments,
        "reference_link": comment_obj.reference_link,
        "attachments": attachments,
        "can_edit": _can_modify_comment(request, comment_obj),
    }


@require_GET
def list_comments_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    module_name = _normalize_module(request.GET.get("module_name", ""))
    record_id = _to_record_id(request.GET.get("record_id"))

    if not module_name:
        return JsonResponse({"message": "module_name is required."}, status=400)
    if not record_id:
        return JsonResponse({"message": "record_id is required."}, status=400)

    denied = _ensure_record_access(request, module_name, record_id)
    if denied:
        return denied

    try:
        queryset = Comment.objects.filter(module_name=module_name, record_id=record_id).prefetch_related("attachments")
        return JsonResponse({"comments": [_serialize(c, request) for c in queryset]})
    except (ProgrammingError, OperationalError):
        # Comments storage is not ready yet (usually migration not applied).
        return JsonResponse({"comments": [], "storage_ready": False})


@require_POST
@csrf_protect
def create_comment_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    is_form = bool(request.content_type and request.content_type.startswith("multipart/form-data"))
    payload = request.POST if is_form else _read_json(request)
    module_name = _normalize_module(payload.get("module_name", ""))
    record_id = _to_record_id(payload.get("record_id"))
    comments = normalize_text(payload.get("comments", ""))
    reference_link = normalize_text(payload.get("reference_link", ""))
    comment_datetime = _to_datetime(payload.get("comment_datetime"))

    if not module_name:
        return JsonResponse({"message": "module_name is required."}, status=400)
    if not record_id:
        return JsonResponse({"message": "record_id is required."}, status=400)
    if not comments:
        return JsonResponse({"message": "Comments are required."}, status=400)
    if comment_datetime is None:
        return JsonResponse({"message": "Invalid comment date/time."}, status=400)

    denied = _ensure_record_access(request, module_name, record_id)
    if denied:
        return denied

    if module_name == MODULE_TASK:
        task, task_denied = _can_access_task(request.user, record_id)
        if task_denied:
            return task_denied
        if not _can_add_comment_to_task(task):
            return JsonResponse(
                {
                    "message": (
                        "Comments can only be added when task status is "
                        "'Work In Progress' or 'Awaiting For Approval'."
                    )
                },
                status=403,
            )

    try:
        obj = Comment.objects.create(
            module_name=module_name,
            record_id=record_id,
            comment_datetime=comment_datetime,
            updated_by=normalize_text(request.user.username),
            comments=comments,
            reference_link=reference_link,
        )
        if is_form:
            files = request.FILES.getlist("attachments")
            for f in files:
                raw_name = normalize_text(getattr(f, "name", ""))
                _, ext = os.path.splitext(raw_name)
                ext = ext.replace(".", "").lower()

                if not ext or ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
                    return JsonResponse(
                        {
                            "message": (
                                f"Unsupported attachment type for '{raw_name}'. "
                                f"Allowed: {', '.join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))}."
                            )
                        },
                        status=400,
                    )

                size = int(getattr(f, "size", 0) or 0)
                if size > MAX_ATTACHMENT_SIZE_BYTES:
                    return JsonResponse(
                        {
                            "message": (
                                f"Attachment '{raw_name}' exceeds max size 10 MB."
                            )
                        },
                        status=400,
                    )

                CommentAttachment.objects.create(
                    comment=obj,
                    file=f,
                    original_name=raw_name,
                )
    except (ProgrammingError, OperationalError):
        return JsonResponse(
            {
                "message": "Comments storage is not initialized. Please run database migrate command.",
                "storage_ready": False,
            },
            status=503,
        )

    obj = Comment.objects.prefetch_related("attachments").get(id=obj.id)
    return JsonResponse({"success": True, "comment": _serialize(obj, request)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@csrf_protect
def comment_detail_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na

    try:
        obj = Comment.objects.prefetch_related("attachments").get(id=pk)
    except Comment.DoesNotExist:
        return JsonResponse({"message": "Comment not found."}, status=404)
    except (ProgrammingError, OperationalError):
        return JsonResponse(
            {
                "message": "Comments storage is not initialized. Please run database migrate command.",
                "storage_ready": False,
            },
            status=503,
        )

    denied = _ensure_record_access(request, obj.module_name, obj.record_id)
    if denied:
        return denied

    if request.method == "DELETE":
        if not _can_modify_comment(request, obj):
            return JsonResponse({"message": "Only comment owner or admin can delete."}, status=403)
        obj.delete()
        return JsonResponse({"success": True, "message": "Comment deleted."})

    if not _can_modify_comment(request, obj):
        return JsonResponse({"message": "Only comment owner or admin can edit."}, status=403)

    payload = _read_json(request)
    comments = normalize_text(payload.get("comments", obj.comments))
    reference_link = normalize_text(payload.get("reference_link", obj.reference_link))
    comment_datetime = _to_datetime(payload.get("comment_datetime", obj.comment_datetime))

    if not comments:
        return JsonResponse({"message": "Comments are required."}, status=400)
    if comment_datetime is None:
        return JsonResponse({"message": "Invalid comment date/time."}, status=400)

    obj.comments = comments
    obj.reference_link = reference_link
    obj.comment_datetime = comment_datetime
    obj.updated_by = normalize_text(request.user.username)
    obj.save()

    return JsonResponse({"success": True, "comment": _serialize(obj, request)})


@require_GET
def download_comment_attachment_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na

    try:
        attachment = CommentAttachment.objects.select_related("comment").get(id=pk)
    except CommentAttachment.DoesNotExist:
        return JsonResponse({"message": "Attachment not found."}, status=404)
    except (ProgrammingError, OperationalError):
        return JsonResponse(
            {
                "message": "Comments storage is not initialized. Please run database migrate command.",
                "storage_ready": False,
            },
            status=503,
        )

    denied = _ensure_record_access(
        request,
        attachment.comment.module_name,
        attachment.comment.record_id,
    )
    if denied:
        return denied

    if not attachment.file:
        return JsonResponse({"message": "Attachment file is missing."}, status=404)

    filename = attachment.original_name or attachment.file.name.split("/")[-1]
    return FileResponse(attachment.file.open("rb"), as_attachment=True, filename=filename)


@require_GET
def view_comment_attachment_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na

    try:
        attachment = CommentAttachment.objects.select_related("comment").get(id=pk)
    except CommentAttachment.DoesNotExist:
        return JsonResponse({"message": "Attachment not found."}, status=404)
    except (ProgrammingError, OperationalError):
        return JsonResponse(
            {
                "message": "Comments storage is not initialized. Please run database migrate command.",
                "storage_ready": False,
            },
            status=503,
        )

    denied = _ensure_record_access(
        request,
        attachment.comment.module_name,
        attachment.comment.record_id,
    )
    if denied:
        return denied

    if not attachment.file:
        return JsonResponse({"message": "Attachment file is missing."}, status=404)

    filename = attachment.original_name or attachment.file.name.split("/")[-1]
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    # Force download for non-image types; allow inline for images/pdf/text-like files.
    inline_ext = IMAGE_EXTENSIONS.union({"pdf", "txt", "csv"})
    as_attachment = ext not in inline_ext

    return FileResponse(
        attachment.file.open("rb"),
        as_attachment=as_attachment,
        filename=filename,
        content_type=content_type,
    )


@require_http_methods(["DELETE"])
@csrf_protect
def delete_comment_attachment_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na

    try:
        attachment = CommentAttachment.objects.select_related("comment").get(id=pk)
    except CommentAttachment.DoesNotExist:
        return JsonResponse({"message": "Attachment not found."}, status=404)
    except (ProgrammingError, OperationalError):
        return JsonResponse(
            {
                "message": "Comments storage is not initialized. Please run database migrate command.",
                "storage_ready": False,
            },
            status=503,
        )

    denied = _ensure_record_access(
        request,
        attachment.comment.module_name,
        attachment.comment.record_id,
    )
    if denied:
        return denied

    if not _can_modify_comment(request, attachment.comment):
        return JsonResponse({"message": "Only comment owner or admin can delete attachment."}, status=403)

    # Remove storage file first, then DB row.
    if attachment.file:
        attachment.file.delete(save=False)
    attachment.delete()
    return JsonResponse({"success": True, "message": "Attachment deleted."})


