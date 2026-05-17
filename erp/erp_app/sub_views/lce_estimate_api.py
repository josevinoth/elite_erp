import json
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import CountryCurrency, LCEChargeTypeOption, LCEEstimate
from ..sub_models.stock_purchase import StockPurchase, StockPurchaseItem
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

TEXT_FIELDS = [
    "other_charges_1_type",
    "other_charges_2_type",
    "other_charges_3_type",
    "other_charges_4_type",
]


def _link_items_to_estimate(estimate, item_ids):
    """
    Set lce_estimate FK on the given StockPurchaseItem IDs (replacing any
    previous links for this estimate), then compute lce_cost per item.
    Items previously linked to this LCE that are NOT in item_ids are unlinked.
    """
    lce_total = Decimal(str(estimate.total))

    # Unlink items that were previously linked but are no longer selected.
    StockPurchaseItem.objects.filter(lce_estimate=estimate).exclude(id__in=item_ids).update(
        lce_estimate=None, lce_cost=0
    )

    # Link new items and compute lce_cost.
    items = list(StockPurchaseItem.objects.filter(id__in=item_ids))
    for item in items:
        item.lce_estimate = estimate
        item.lce_cost = item.total_price * lce_total
    if items:
        StockPurchaseItem.objects.bulk_update(items, ["lce_estimate", "lce_cost"])


def _serialize_purchase_item(item):
    raw_grn = str(item.grn_number or "").strip()
    if raw_grn and not raw_grn.upper().startswith("GRN"):
        raw_grn = f"GRN{item.pk:04d}"
    return {
        "id": item.id,
        "grn_number": raw_grn,
        "purchase_number": item.stock_purchase.purchase_number if item.stock_purchase_id else "",
        "invoice_number": (
            item.stock_purchase.vendor_detail.invoice_number
            if item.stock_purchase_id and item.stock_purchase.vendor_detail_id
            else (item.stock_purchase.invoice_number if item.stock_purchase_id else "")
        ),
        "item_category": item.item_category,
        "item_name": item.item_name,
        "item_code": item.item_code,
        "quantity": str(item.quantity),
        "unit_price": str(item.unit_price),
        "total_price": str(item.total_price),
        "lce_cost": str(item.lce_cost),
        "lce_estimate_id": item.lce_estimate_id,
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


def _to_decimal(value, default=Decimal("0")):
    if value in (None, ""):
        return default
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, TypeError, ValueError):
        return default


def _to_currency(value):
    if value in (None, ""):
        return None
    try:
        return CountryCurrency.objects.filter(pk=int(value)).first()
    except (TypeError, ValueError):
        return None


def _serialize_currency(obj):
    if not obj:
        return None
    return {
        "id": obj.id,
        "currency_code": obj.currency_code,
        "currency_name": obj.currency_name,
        "country_name": obj.country_name,
        "label": f"{obj.country_name} - {obj.currency_code}",
    }


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
    linked_items = list(
        StockPurchaseItem.objects.filter(lce_estimate=obj).select_related("stock_purchase", "stock_purchase__vendor_detail")
    )
    return {
        "id": obj.id,
        "lce_id": f"LCE_{obj.id:03d}",
        "linked_item_ids": [i.id for i in linked_items],
        "purchase_items": [_serialize_purchase_item(i) for i in linked_items],
        "ex_works_material_cost": str(obj.ex_works_material_cost),
        "packing_charges": str(obj.packing_charges),
        "documentation": str(obj.documentation),
        "other_charges_1": str(obj.other_charges_1),
        "other_charges_1_type": obj.other_charges_1_type,
        "other_charges_2": str(obj.other_charges_2),
        "other_charges_2_type": obj.other_charges_2_type,
        "other_charges_3": str(obj.other_charges_3),
        "other_charges_3_type": obj.other_charges_3_type,
        "other_charges_4": str(obj.other_charges_4),
        "other_charges_4_type": obj.other_charges_4_type,
        "foreign_currency_id": obj.foreign_currency_id,
        "foreign_currency": _serialize_currency(obj.foreign_currency),
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
def lce_estimate_meta_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    charge_types = [
        {"id": row.id, "name": row.name}
        for row in LCEChargeTypeOption.objects.order_by("name")
    ]
    currencies = [
        _serialize_currency(row)
        for row in CountryCurrency.objects.filter(is_active=True).order_by("sort_order", "country_name")
    ]
    stock_purchases = []
    for sp in StockPurchase.objects.select_related("vendor_detail").prefetch_related("items").order_by("-id"):
        vd = sp.vendor_detail
        invoice = vd.invoice_number if vd else sp.invoice_number
        sp_num = sp.purchase_number or f"SP{sp.pk:04d}"
        label = f"{sp_num} | Invoice: {invoice}" if invoice else sp_num
        stock_purchases.append({"id": sp.id, "label": label, "invoice_number": invoice, "purchase_number": sp_num})
    return JsonResponse({"charge_types": charge_types, "currencies": currencies, "stock_purchases": stock_purchases})


@require_GET
def lce_purchase_items_api_view(request, purchase_id):
    """Return all StockPurchaseItems for a given purchase, with their current LCE linkage."""
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    items = StockPurchaseItem.objects.filter(stock_purchase_id=purchase_id).order_by("id")
    return JsonResponse({"items": [_serialize_purchase_item(i) for i in items]})


@require_POST
@csrf_protect
def create_lce_charge_type_option_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    name = normalize_text(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Charge type name is required."}, status=400)
    if LCEChargeTypeOption.objects.filter(name__iexact=name).exists():
        return JsonResponse({"message": "Charge type already exists."}, status=400)

    obj = LCEChargeTypeOption.objects.create(name=name)
    return JsonResponse({"success": True, "charge_type": {"id": obj.id, "name": obj.name}}, status=201)


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
    text_values = {field: normalize_text(payload.get(field, "")) for field in TEXT_FIELDS}
    foreign_currency = _to_currency(payload.get("foreign_currency_id"))

    estimate = LCEEstimate(
        created_by=normalize_text(payload.get("created_by") or request.user.username),
        foreign_currency=foreign_currency,
    )
    for field in EDITABLE_FIELDS:
        setattr(estimate, field, values[field])
    for field in TEXT_FIELDS:
        setattr(estimate, field, text_values[field])
    estimate.total_supplier_price = values["total_supplier_price"]
    estimate.advance_payment_value_omr = values["advance_payment_value_omr"]
    estimate.balance_payment_value = values["balance_payment_value"]
    estimate.balance_payment_value_omr = values["balance_payment_value_omr"]
    estimate.total_supplier_price_omr = values["total_supplier_price_omr"]
    estimate.total = values["total"]
    estimate.save()

    item_ids = [int(i) for i in (payload.get("item_ids") or []) if str(i).isdigit()]
    if item_ids:
        _link_items_to_estimate(estimate, item_ids)

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
        # Unlink all items before deleting (handled by FK SET_NULL, but clear cost too).
        StockPurchaseItem.objects.filter(lce_estimate=estimate).update(lce_estimate=None, lce_cost=0)
        estimate.delete()
        return JsonResponse({"success": True, "message": "Deleted."})

    payload = _read_json(request)
    values = {field: _to_decimal(payload.get(field, getattr(estimate, field)), Decimal("0")) for field in EDITABLE_FIELDS}
    values = _calculate_totals(values)
    text_values = {field: normalize_text(payload.get(field, getattr(estimate, field, ""))) for field in TEXT_FIELDS}
    if "foreign_currency_id" in payload:
        estimate.foreign_currency = _to_currency(payload.get("foreign_currency_id"))

    for field in EDITABLE_FIELDS:
        setattr(estimate, field, values[field])
    for field in TEXT_FIELDS:
        setattr(estimate, field, text_values[field])
    estimate.total_supplier_price = values["total_supplier_price"]
    estimate.advance_payment_value_omr = values["advance_payment_value_omr"]
    estimate.balance_payment_value = values["balance_payment_value"]
    estimate.balance_payment_value_omr = values["balance_payment_value_omr"]
    estimate.total_supplier_price_omr = values["total_supplier_price_omr"]
    estimate.total = values["total"]
    estimate.created_by = normalize_text(payload.get("created_by") or estimate.created_by or request.user.username)
    estimate.save()

    if "item_ids" in payload:
        item_ids = [int(i) for i in (payload.get("item_ids") or []) if str(i).isdigit()]
        _link_items_to_estimate(estimate, item_ids)

    return JsonResponse({"success": True, "lce_estimate": _serialize(estimate)})


