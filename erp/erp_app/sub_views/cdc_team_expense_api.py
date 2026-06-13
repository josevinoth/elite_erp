import datetime
import io
import json

from django.contrib.auth.models import User
from django.db.models import Q
from django.http import FileResponse, JsonResponse
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


def _to_import_date(value):
    parsed = _to_date(value)
    if parsed:
        return parsed

    raw = str(value or "").strip()
    if not raw:
        return None

    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%Y/%m/%d"):
        try:
            return datetime.datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _to_int(value, default=0):
    if value in (None, ""):
        return default
    try:
        return max(int(float(value)), 0)
    except (TypeError, ValueError):
        return default


def _excel_text(value):
    if value in (None, ""):
        return ""
    if isinstance(value, datetime.datetime):
        return value.date().isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    return str(value).strip()


def _resolve_fk(model_cls, raw_value, label):
    if raw_value in (None, ""):
        return None
    try:
        return model_cls.objects.get(id=int(raw_value))
    except (model_cls.DoesNotExist, TypeError, ValueError):
        raise ValueError(f"Invalid {label} selected.")


def _split_pk_link(value):
    raw = str(value or "").strip()
    if not raw:
        return None, ""
    if "|" not in raw:
        return None, raw
    left, right = raw.split("|", 1)
    left = left.strip()
    if left.isdigit():
        return int(left), right.strip()
    return None, raw


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


def _cdc_team_users_by_username():
    return {
        str(option["label"]).strip().lower(): User.objects.filter(id=int(option["value"])).first()
        for option in _cdc_team_user_options()
        if option.get("label") and str(option.get("value") or "").isdigit()
    }


def _resolve_cdc_user_from_import(value, users_by_username):
    raw = str(value or "").strip()
    if not raw:
        return None, ""

    pk, label = _split_pk_link(raw)
    if pk:
        user_obj = User.objects.filter(id=pk).first()
        if user_obj and user_obj.username.strip().lower() in users_by_username:
            return user_obj, user_obj.username
        return None, (label or raw)

    return users_by_username.get(raw.lower()), raw


def _resolve_named_option_for_import(model_cls, value, label, *, auto_create=False):
    raw = to_title_case(value)
    if not raw:
        return None

    pk, linked_label = _split_pk_link(raw)
    if pk:
        obj = model_cls.objects.filter(id=pk).first()
        if obj:
            return obj
        raw = to_title_case(linked_label)

    existing = model_cls.objects.filter(name__iexact=raw).first()
    if existing:
        return existing
    if auto_create:
        return model_cls.objects.create(name=raw)
    raise ValueError(f"{label} '{raw}' not found.")


def _cdc_import_duplicate_exists(expense_date, item, paid_by):
    if not expense_date or not item or not normalize_text(paid_by):
        return False
    return CDCTeamExpense.objects.filter(
        expense_date=expense_date,
        item=item,
        paid_by__iexact=normalize_text(paid_by),
    ).exists()


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


def _create_cdc_team_expense_import_template_bytes():
    try:
        import openpyxl
    except ImportError:
        return None

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CDC Expense Import"

    headers = [
        "Expense Date",
        "Item",
        "Session",
        "Qty",
        "Price",
        "Total Cost",
        "Status",
        "Paid By",
        "Settled On",
        "Settled By",
    ]
    for col_idx, label in enumerate(headers, start=1):
        ws.cell(row=1, column=col_idx, value=label)

    sample_row = [
        "30-04-2026",
        "Tea",
        "Evening",
        5,
        25,
        125,
        "Paid",
        "Yogesh",
        "05-02-2026",
        "Jose",
    ]
    for col_idx, value in enumerate(sample_row, start=1):
        ws.cell(row=2, column=col_idx, value=value)

    ws.freeze_panes = "A2"

    item_choices = _build_linked_choices(ExpenseItem.objects.order_by("name"), lambda obj: obj.name)
    session_choices = _build_linked_choices(ExpenseSession.objects.order_by("name"), lambda obj: obj.name)
    status_choices = _build_linked_choices(ExpenseStatusOption.objects.order_by("name"), lambda obj: obj.name)
    cdc_user_choices = _build_linked_choices(
        User.objects.filter(id__in=[int(opt["value"]) for opt in _cdc_team_user_options() if str(opt.get("value") or "").isdigit()]).order_by("username"),
        lambda obj: obj.username,
    )

    lookup_sheet_name = "Lookup"
    lookup = wb.create_sheet(title=lookup_sheet_name)
    lookup["A1"] = "Item"
    lookup["B1"] = "Session"
    lookup["C1"] = "Status"
    lookup["D1"] = "CDC User"

    for row_idx, val in enumerate(item_choices, start=1):
        lookup.cell(row=row_idx, column=1, value=val)
    for row_idx, val in enumerate(session_choices, start=1):
        lookup.cell(row=row_idx, column=2, value=val)
    for row_idx, val in enumerate(status_choices, start=1):
        lookup.cell(row=row_idx, column=3, value=val)
    for row_idx, val in enumerate(cdc_user_choices, start=1):
        lookup.cell(row=row_idx, column=4, value=val)

    max_input_rows = 5000
    _add_dropdown(ws, "B", max_input_rows, lookup_sheet_name, "A", len(item_choices))
    _add_dropdown(ws, "C", max_input_rows, lookup_sheet_name, "B", len(session_choices))
    _add_dropdown(ws, "G", max_input_rows, lookup_sheet_name, "C", len(status_choices))
    _add_dropdown(ws, "H", max_input_rows, lookup_sheet_name, "D", len(cdc_user_choices))
    _add_dropdown(ws, "J", max_input_rows, lookup_sheet_name, "D", len(cdc_user_choices))
    lookup.sheet_state = "hidden"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


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
def import_cdc_team_expenses_excel_api_view(request):
    not_allowed = _ensure_cdc_team_access(request)
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

    users_by_username = _cdc_team_users_by_username()
    created_count = 0
    blank_count = 0
    duplicate_count = 0
    failed_count = 0
    row_reports = []

    for row_number, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        values = list(row)
        if len(values) < 10:
            values.extend([None] * (10 - len(values)))

        expense_date_raw = values[0]
        item_raw = values[1]
        session_raw = values[2]
        qty_raw = values[3]
        price_raw = values[4]
        total_cost_raw = values[5]
        status_raw = values[6]
        paid_by_raw = values[7]
        settled_on_raw = values[8]
        settled_by_raw = values[9]

        report_row_payload = {
            "row": row_number,
            "expense_date_input": _excel_text(expense_date_raw),
            "item_input": _excel_text(item_raw),
            "session_input": _excel_text(session_raw),
            "qty_input": _excel_text(qty_raw),
            "price_input": _excel_text(price_raw),
            "total_cost_input": _excel_text(total_cost_raw),
            "status_input": _excel_text(status_raw),
            "paid_by_input": _excel_text(paid_by_raw),
            "settled_on_input": _excel_text(settled_on_raw),
            "settled_by_input": _excel_text(settled_by_raw),
            "reference": " | ".join(
                part
                for part in [
                    _excel_text(expense_date_raw),
                    _excel_text(item_raw),
                    _excel_text(paid_by_raw),
                ]
                if part
            ) or f"Row {row_number}",
        }

        if not any(values[:10]):
            blank_count += 1
            continue

        try:
            item = _resolve_named_option_for_import(ExpenseItem, item_raw, "Item", auto_create=True)
            session = _resolve_named_option_for_import(ExpenseSession, session_raw, "Session", auto_create=True)
            status = None
            if str(status_raw or "").strip():
                status = _resolve_named_option_for_import(
                    ExpenseStatusOption,
                    status_raw,
                    "Status",
                    auto_create=True,
                )
            else:
                status = ExpenseStatusOption.objects.filter(name__iexact="Unpaid").first()
                if status is None:
                    status = ExpenseStatusOption.objects.create(name="Unpaid")
        except ValueError as exc:
            failed_count += 1
            row_reports.append({**report_row_payload, "status": "failed", "message": str(exc)})
            continue

        if not item:
            failed_count += 1
            row_reports.append({**report_row_payload, "status": "failed", "message": "Item is required."})
            continue
        if not session:
            failed_count += 1
            row_reports.append({**report_row_payload, "status": "failed", "message": "Session is required."})
            continue

        paid_by = normalize_text(paid_by_raw)
        if not paid_by:
            failed_count += 1
            row_reports.append({**report_row_payload, "status": "failed", "message": "Paid By is required."})
            continue
        if paid_by.strip().lower() not in users_by_username:
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": f"Paid By '{paid_by}' must belong to CDC Team.",
                }
            )
            continue

        settled_by, settled_by_label = _resolve_cdc_user_from_import(settled_by_raw, users_by_username)
        if normalize_text(settled_by_raw) and not settled_by:
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": f"Settled By '{settled_by_label or settled_by_raw}' must belong to CDC Team.",
                }
            )
            continue

        expense_date = _to_import_date(expense_date_raw)
        if not normalize_text(expense_date_raw):
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": "Expense Date is required.",
                }
            )
            continue
        if normalize_text(expense_date_raw) and not expense_date:
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": "Expense Date is invalid. Use formats like YYYY-MM-DD or DD-MM-YYYY.",
                }
            )
            continue

        settled_on = _to_import_date(settled_on_raw)
        if normalize_text(settled_on_raw) and not settled_on:
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": "Settled On is invalid. Use formats like YYYY-MM-DD or DD-MM-YYYY.",
                }
            )
            continue

        if settled_by and not settled_on:
            failed_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "failed",
                    "message": "Settled On is required when Settled By is provided.",
                }
            )
            continue

        qty = _to_int(qty_raw)
        price = _to_int(price_raw)

        if _cdc_import_duplicate_exists(expense_date, item, paid_by):
            duplicate_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "duplicate",
                    "message": (
                        "Skipped duplicate (Expense Date + Item + Paid By already exists)."
                    ),
                }
            )
            continue

        try:
            obj = CDCTeamExpense.objects.create(
                expense_date=expense_date,
                item=item,
                session=session,
                qty=qty,
                price=price,
                status=status,
                paid_by=paid_by,
                settled_on=settled_on,
                settled_by=settled_by,
                updated_by=normalize_text(request.user.username),
            )
            created_count += 1
            row_reports.append(
                {
                    **report_row_payload,
                    "status": "created",
                    "message": f"Imported successfully ({obj.item.name} / {obj.session.name}).",
                }
            )
        except Exception as exc:
            failed_count += 1
            row_reports.append({**report_row_payload, "status": "failed", "message": str(exc)})

    return JsonResponse(
        {
            "success": True,
            "message": "CDC team expense import completed.",
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
def download_cdc_team_expense_template_api_view(request):
    not_allowed = _ensure_cdc_team_access(request)
    if not_allowed:
        return not_allowed

    template_bytes = _create_cdc_team_expense_import_template_bytes()
    if template_bytes is None:
        return JsonResponse({"message": "Excel template dependency not installed."}, status=500)

    return FileResponse(template_bytes, as_attachment=True, filename="cdc_team_expense_import_template.xlsx")


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

