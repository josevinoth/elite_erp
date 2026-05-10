import json
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import LCEEstimate
from ..utils import normalize_text


EDITABLE_FIELDS = [
    "ex_works_material_cost",
    "packing_charges",
    "documentation",
    "other_charges_1",
    "other_charges_2",
    "other_charges_3",
    "other_charges_4",
    "advance_payment_value",
    "bank_exchange_rate",
    "bank_muscat_charge_advance_payment",
    "bank_muscat_charge_balance_payment",
    "freight_charge",
    "customs_duty_omr",
    "oman_customs_boe_charge_omr",
    "rop_customs_inspection_charge",
    "unloading_charge_muscat_stores_1",
    "unloading_charge_muscat_stores_2",
    "loading_charge_muscat_stores_delivery",
]


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return None


def _read_json(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (TypeError, ValueError):
        return {}


def _to_decimal(value, default=Decimal("0")):
    if value in (None, ""):
        return default
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, TypeError, ValueError):
        return default


def _calculate_totals(values):
    values["total_supplier_price"] = (
        values["ex_works_material_cost"]
        + values["packing_charges"]
        + values["documentation"]
        + values["other_charges_1"]
        + values["other_charges_2"]
        + values["other_charges_3"]
        + values["other_charges_4"]
    )

    values["advance_payment_value_omr"] = values["advance_payment_value"] * values["bank_exchange_rate"]
    values["balance_payment_value"] = values["total_supplier_price"] - values["advance_payment_value"]
    values["balance_payment_value_omr"] = values["balance_payment_value"] * values["bank_exchange_rate"]
    values["total_supplier_price_omr"] = values["advance_payment_value_omr"] + values["balance_payment_value_omr"]

    values["total"] = (
        values["bank_muscat_charge_advance_payment"]
        + values["bank_muscat_charge_balance_payment"]
        + values["freight_charge"]
        + values["customs_duty_omr"]
        + values["oman_customs_boe_charge_omr"]
        + values["rop_customs_inspection_charge"]
        + values["unloading_charge_muscat_stores_1"]
        + values["unloading_charge_muscat_stores_2"]
        + values["loading_charge_muscat_stores_delivery"]
    )
    return values


def _serialize(obj):
    return {
        "id": obj.id,
        "stock_purchase": {
            "id": obj.stock_purchase_id,
            "item_name": obj.stock_purchase.item_name if obj.stock_purchase_id else "",
            "invoice_number": obj.stock_purchase.invoice_number if obj.stock_purchase_id else "",
            "vendor": obj.stock_purchase.vendor if obj.stock_purchase_id else "",
            "purchase_date": str(obj.stock_purchase.purchase_date) if obj.stock_purchase_id and obj.stock_purchase.purchase_date else "",
        },
        "ex_works_material_cost": str(obj.ex_works_material_cost),
        "packing_charges": str(obj.packing_charges),
        "documentation": str(obj.documentation),
        "other_charges_1": str(obj.other_charges_1),
        "other_charges_2": str(obj.other_charges_2),
        "other_charges_3": str(obj.other_charges_3),
        "other_charges_4": str(obj.other_charges_4),
        "total_supplier_price": str(obj.total_supplier_price),
        "advance_payment_value": str(obj.advance_payment_value),
        "bank_exchange_rate": str(obj.bank_exchange_rate),
        "advance_payment_value_omr": str(obj.advance_payment_value_omr),
        "balance_payment_value": str(obj.balance_payment_value),
        "balance_payment_value_omr": str(obj.balance_payment_value_omr),
        "total_supplier_price_omr": str(obj.total_supplier_price_omr),
        "bank_muscat_charge_advance_payment": str(obj.bank_muscat_charge_advance_payment),
        "bank_muscat_charge_balance_payment": str(obj.bank_muscat_charge_balance_payment),
        "freight_charge": str(obj.freight_charge),
        "customs_duty_omr": str(obj.customs_duty_omr),
        "oman_customs_boe_charge_omr": str(obj.oman_customs_boe_charge_omr),
        "rop_customs_inspection_charge": str(obj.rop_customs_inspection_charge),
        "unloading_charge_muscat_stores_1": str(obj.unloading_charge_muscat_stores_1),
        "unloading_charge_muscat_stores_2": str(obj.unloading_charge_muscat_stores_2),
        "loading_charge_muscat_stores_delivery": str(obj.loading_charge_muscat_stores_delivery),
        "total": str(obj.total),
        "created_by": obj.created_by,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else "",
    }


def _serialize_list_row(obj):
    return {
        "id": obj.id,
        "lce_id": f"LCE_{obj.id:03d}",
        "date": obj.updated_at.date().isoformat() if obj.updated_at else "",
        "total_supplier_price": str(obj.total_supplier_price),
        "total_supplier_price_omr": str(obj.total_supplier_price_omr),
        "total": str(obj.total),
    }


@require_GET
def list_lce_estimates_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    rows = LCEEstimate.objects.order_by("-updated_at", "-id")
    return JsonResponse({"lce_estimates": [_serialize_list_row(row) for row in rows]})


@require_POST
@csrf_protect
def create_lce_estimate_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    values = {field: _to_decimal(payload.get(field), Decimal("0")) for field in EDITABLE_FIELDS}
    values = _calculate_totals(values)

    estimate = LCEEstimate.objects.create(
        stock_purchase=None,
        created_by=normalize_text(payload.get("created_by") or request.user.username),
    )
    for field in EDITABLE_FIELDS:
        setattr(estimate, field, values[field])
    estimate.total_supplier_price = values["total_supplier_price"]
    estimate.advance_payment_value_omr = values["advance_payment_value_omr"]
    estimate.balance_payment_value = values["balance_payment_value"]
    estimate.balance_payment_value_omr = values["balance_payment_value_omr"]
    estimate.total_supplier_price_omr = values["total_supplier_price_omr"]
    estimate.total = values["total"]
    estimate.save()

    return JsonResponse({"success": True, "lce_estimate": _serialize(estimate)}, status=201)


@require_http_methods(["GET", "PATCH", "DELETE"])
@csrf_protect
def lce_estimate_record_api_view(request, lce_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    estimate = LCEEstimate.objects.filter(pk=lce_id).first()
    if not estimate:
        return JsonResponse({"message": "LCE record not found."}, status=404)

    if request.method == "GET":
        return JsonResponse({"lce_estimate": _serialize(estimate)})

    if request.method == "DELETE":
        estimate.delete()
        return JsonResponse({"success": True, "message": "Deleted."})

    payload = _read_json(request)
    values = {field: _to_decimal(payload.get(field, getattr(estimate, field)), Decimal("0")) for field in EDITABLE_FIELDS}
    values = _calculate_totals(values)
    for field in EDITABLE_FIELDS:
        setattr(estimate, field, values[field])
    estimate.total_supplier_price = values["total_supplier_price"]
    estimate.advance_payment_value_omr = values["advance_payment_value_omr"]
    estimate.balance_payment_value = values["balance_payment_value"]
    estimate.balance_payment_value_omr = values["balance_payment_value_omr"]
    estimate.total_supplier_price_omr = values["total_supplier_price_omr"]
    estimate.total = values["total"]
    estimate.created_by = normalize_text(payload.get("created_by") or estimate.created_by or request.user.username)
    estimate.save()
    return JsonResponse({"success": True, "lce_estimate": _serialize(estimate)})


