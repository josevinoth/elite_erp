import datetime
import json

from django.contrib.auth.models import User
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import (
    CDCTeamExpense,
    ExpenseItem,
    ExpenseSession,
    ExpenseStatusOption,
    Team,
    UserProfile,
)
from ..utils import normalize_text, to_title_case


CDC_TEAM_NAME = "CDC Team"
PAID_STATUS = "paid"


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


def _is_cdc_team_user(user):
    if _is_admin_user(user):
        return True
    try:
        profile = UserProfile.objects.select_related("team").get(user=user)
    except UserProfile.DoesNotExist:
        return False
    return bool(profile.team and profile.team.name.strip().lower() == CDC_TEAM_NAME.lower())


def _ensure_cdc_team_access(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    if not _is_cdc_team_user(request.user):
        return JsonResponse({"message": "CDC Team access required."}, status=403)
    return None


def _to_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime.date):
        return value
    try:
        return datetime.date.fromisoformat(str(value).split(" ")[0])
    except (TypeError, ValueError, AttributeError):
        return None


def _to_int(value, default=0):
    if value in (None, ""):
        return default
    try:
        return max(int(float(value)), 0)
    except (TypeError, ValueError):
        return default


def _resolve_fk(model_cls, raw_value, label):
    if raw_value in (None, ""):
        return None
    try:
        return model_cls.objects.get(id=int(raw_value))
    except (model_cls.DoesNotExist, TypeError, ValueError):
        raise ValueError(f"Invalid {label} selected.")


def _cdc_team_user_options():
    try:
        cdc_team = Team.objects.get(name__iexact=CDC_TEAM_NAME)
    except Team.DoesNotExist:
        return []

    profiles = (
        UserProfile.objects.filter(team_id=cdc_team.id, user__is_active=True)
        .select_related("user")
        .order_by("user__username")
    )
    return [{"value": str(p.user_id), "label": p.user.username} for p in profiles if p.user_id]


def _cdc_team_usernames_lower_set():
    return {
        str(option["label"]).strip().lower()
        for option in _cdc_team_user_options()
        if option.get("label")
    }


def _serialize(obj):
    return {
        "id": obj.id,
        "expense_date": str(obj.expense_date) if obj.expense_date else "",
        "item": str(obj.item_id),
        "item_label": obj.item.name if obj.item_id else "",
        "session": str(obj.session_id),
        "session_label": obj.session.name if obj.session_id else "",
        "qty": str(obj.qty),
        "price": str(obj.price),
        "total_cost": str(obj.total_cost),
        "status": str(obj.status_id) if obj.status_id else "",
        "status_label": obj.status.name if obj.status_id else "",
        "paid_by": obj.paid_by,
        "settled_on": str(obj.settled_on) if obj.settled_on else "",
        "settled_by": str(obj.settled_by_id) if obj.settled_by_id else "",
        "settled_by_label": obj.settled_by.username if obj.settled_by_id else "",
        "updated_by": obj.updated_by,
    }


def _is_paid_status(expense):
    return bool(expense.status_id and expense.status and expense.status.name.strip().lower() == PAID_STATUS)


@require_GET
def list_cdc_team_expense_meta_api_view(request):
    not_allowed = _ensure_cdc_team_access(request)
    if not_allowed:
        return not_allowed

    cdc_team_users = _cdc_team_user_options()

    return JsonResponse(
        {
            "items": [
                {"value": str(item.id), "label": item.name}
                for item in ExpenseItem.objects.order_by("name")
            ],
            "statuses": [
                {"value": str(status.id), "label": status.name}
                for status in ExpenseStatusOption.objects.order_by("name")
            ],
            "sessions": [
                {"value": str(session.id), "label": session.name}
                for session in ExpenseSession.objects.order_by("name")
            ],
            "cdc_team_users": cdc_team_users,
            "paid_by_options": [
                {"value": user_option["label"], "label": user_option["label"]}
                for user_option in cdc_team_users
            ],
        }
    )


@require_POST
@csrf_protect
def create_expense_item_option_api_view(request):
    not_allowed = _ensure_cdc_team_access(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    name = to_title_case(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Item is required."}, status=400)

    obj, _ = ExpenseItem.objects.get_or_create(name=name)
    return JsonResponse({"success": True, "id": str(obj.id), "name": obj.name})


@require_POST
@csrf_protect
def create_expense_status_option_api_view(request):
    not_allowed = _ensure_cdc_team_access(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    name = to_title_case(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Status is required."}, status=400)

    obj, _ = ExpenseStatusOption.objects.get_or_create(name=name)
    return JsonResponse({"success": True, "id": str(obj.id), "name": obj.name})


@require_POST
@csrf_protect
def create_expense_session_option_api_view(request):
    not_allowed = _ensure_cdc_team_access(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    name = to_title_case(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Session is required."}, status=400)

    obj, _ = ExpenseSession.objects.get_or_create(name=name)
    return JsonResponse({"success": True, "id": str(obj.id), "name": obj.name})


@require_GET
def list_cdc_team_expenses_api_view(request):
    not_allowed = _ensure_cdc_team_access(request)
    if not_allowed:
        return not_allowed

    queryset = CDCTeamExpense.objects.select_related("item", "session", "status", "settled_by")
    if not _is_admin_user(request.user):
        username = request.user.username
        queryset = queryset.filter(
            Q(paid_by__iexact=username) | Q(settled_by__username__iexact=username)
        )
    return JsonResponse({"expenses": [_serialize(obj) for obj in queryset.order_by("-id")]})


@require_POST
@csrf_protect
def create_cdc_team_expense_api_view(request):
    not_allowed = _ensure_cdc_team_access(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)

    status_value = payload.get("status")
    if status_value in (None, ""):
        unpaid_status = ExpenseStatusOption.objects.filter(name__iexact="Unpaid").first()
        if unpaid_status:
            status_value = str(unpaid_status.id)

    try:
        item = _resolve_fk(ExpenseItem, payload.get("item"), "item")
        session = _resolve_fk(ExpenseSession, payload.get("session"), "session")
        status = _resolve_fk(ExpenseStatusOption, status_value, "status")
        settled_by = _resolve_fk(User, payload.get("settled_by"), "settled by")
    except ValueError as exc:
        return JsonResponse({"message": str(exc)}, status=400)

    if not item:
        return JsonResponse({"message": "Item is required."}, status=400)
    if not session:
        return JsonResponse({"message": "Session is required."}, status=400)
    if not status:
        return JsonResponse({"message": "Status is required."}, status=400)

    if settled_by and not UserProfile.objects.filter(user=settled_by, team__name__iexact=CDC_TEAM_NAME).exists():
        return JsonResponse({"message": "Settled By must belong to CDC Team."}, status=400)

    paid_by = normalize_text(payload.get("paid_by", ""))
    if paid_by and paid_by.strip().lower() not in _cdc_team_usernames_lower_set():
        return JsonResponse({"message": "Paid By must belong to CDC Team."}, status=400)

    obj = CDCTeamExpense.objects.create(
        expense_date=_to_date(payload.get("expense_date")),
        item=item,
        session=session,
        qty=_to_int(payload.get("qty")),
        price=_to_int(payload.get("price")),
        status=status,
        paid_by=paid_by,
        settled_on=_to_date(payload.get("settled_on")),
        settled_by=settled_by,
        updated_by=normalize_text(request.user.username),
    )
    return JsonResponse({"success": True, "expense": _serialize(obj)}, status=201)


@require_POST
@csrf_protect
def cdc_team_expense_bulk_update_api_view(request):
    not_allowed = _ensure_cdc_team_access(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    ids = payload.get("ids", [])
    
    if not ids or not isinstance(ids, list):
        return JsonResponse({"message": "IDs array is required."}, status=400)

    # Resolve FK values
    try:
        status = _resolve_fk(ExpenseStatusOption, payload.get("status"), "status") if payload.get("status") else None
        settled_by = _resolve_fk(User, payload.get("settled_by"), "settled by") if payload.get("settled_by") else None
    except ValueError as exc:
        return JsonResponse({"message": str(exc)}, status=400)

    # Validate settled_by and settled_on relationship
    has_settled_by = settled_by is not None
    has_settled_on = payload.get("settled_on") is not None and payload.get("settled_on") != ""
    if has_settled_by and not has_settled_on:
        return JsonResponse(
            {"message": "Settled On is required when Settled By is selected"},
            status=400
        )

    if settled_by and not UserProfile.objects.filter(user=settled_by, team__name__iexact=CDC_TEAM_NAME).exists():
        return JsonResponse({"message": "Settled By must belong to CDC Team."}, status=400)

    settled_on = _to_date(payload.get("settled_on")) if has_settled_on else None

    # Fetch all records to be updated
    records = CDCTeamExpense.objects.select_related("status").filter(id__in=ids)
    
    # Check permissions: non-admin users cannot update paid records
    updated_records = []
    failed_ids = []
    
    for record in records:
        if not _is_admin_user(request.user) and _is_paid_status(record):
            failed_ids.append(record.id)
            continue
        
        # Update only specified fields
        if status is not None:
            record.status = status
        if settled_by is not None or has_settled_by:  # Allow clearing settled_by
            record.settled_by = settled_by
        if has_settled_on or (settled_on is None and has_settled_by):
            record.settled_on = settled_on
        
        record.updated_by = normalize_text(request.user.username)
        record.save()
        updated_records.append(_serialize(record))

    response = {
        "success": True,
        "message": f"Updated {len(updated_records)} record(s).",
        "updated": updated_records,
    }
    
    if failed_ids:
        response["warning"] = f"Could not update {len(failed_ids)} paid record(s) (non-admin users cannot edit paid expenses)."
        response["failed_ids"] = failed_ids
    
    return JsonResponse(response)


@require_http_methods(["PATCH", "DELETE"])
@csrf_protect
def cdc_team_expense_detail_api_view(request, pk):
    not_allowed = _ensure_cdc_team_access(request)
    if not_allowed:
        return not_allowed

    try:
        obj = CDCTeamExpense.objects.select_related("status").get(id=pk)
    except CDCTeamExpense.DoesNotExist:
        return JsonResponse({"message": "Expense record not found."}, status=404)

    if not _is_admin_user(request.user) and _is_paid_status(obj):
        return JsonResponse(
            {"message": "Paid expense records can only be edited or deleted by admin users."},
            status=403,
        )

    if request.method == "DELETE":
        obj.delete()
        return JsonResponse({"success": True, "message": "Expense record deleted."})

    payload = _read_json(request)
    try:
        item = _resolve_fk(ExpenseItem, payload.get("item", obj.item_id), "item")
        session = _resolve_fk(ExpenseSession, payload.get("session", obj.session_id), "session")
        status = _resolve_fk(ExpenseStatusOption, payload.get("status", obj.status_id), "status")
        settled_by = _resolve_fk(User, payload.get("settled_by", obj.settled_by_id), "settled by")
    except ValueError as exc:
        return JsonResponse({"message": str(exc)}, status=400)

    if settled_by and not UserProfile.objects.filter(user=settled_by, team__name__iexact=CDC_TEAM_NAME).exists():
        return JsonResponse({"message": "Settled By must belong to CDC Team."}, status=400)

    paid_by = normalize_text(payload.get("paid_by", obj.paid_by))
    if paid_by and paid_by.strip().lower() not in _cdc_team_usernames_lower_set():
        return JsonResponse({"message": "Paid By must belong to CDC Team."}, status=400)

    obj.expense_date = _to_date(payload.get("expense_date", obj.expense_date))
    obj.item = item or obj.item
    obj.session = session or obj.session
    obj.qty = _to_int(payload.get("qty", obj.qty), default=obj.qty)
    obj.price = _to_int(payload.get("price", obj.price), default=obj.price)
    obj.status = status
    obj.paid_by = paid_by
    obj.settled_on = _to_date(payload.get("settled_on", obj.settled_on))
    obj.settled_by = settled_by
    obj.updated_by = normalize_text(request.user.username)
    obj.save()
    return JsonResponse({"success": True, "expense": _serialize(obj)})

