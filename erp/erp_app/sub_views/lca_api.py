import json
from datetime import date
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from rest_framework import serializers

from ..sub_models import (
    CountryCurrency,
    LandingCostActuals,
    LCABalanceSettlement,
    LCAChargeTypeOption,
    StockPurchaseVendorDetail,
)
from ..sub_models.stock_purchase import StockPurchaseItem
from ..utils import normalize_text


class LCAAddSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingCostActuals
        fields = "__all__"


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
    "bank_exchange_rate_balance",
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


def _link_items_to_actuals(actuals, item_ids):
    """
    Set lca_actuals FK on the given StockPurchaseItem IDs (replacing any
    previous links for this LCA), then compute lca_cost per item.
    Items previously linked to this LCA that are NO longer selected are unlinked.
    """
    lca_total = Decimal(str(actuals.total))
    ex_works_total = Decimal(str(actuals.ex_works_material_cost))
    cost_factor = (lca_total / ex_works_total) if ex_works_total else Decimal("0")

    # Unlink items that were previously linked but are no longer selected.
    StockPurchaseItem.objects.filter(lca_actuals=actuals).exclude(id__in=item_ids).update(
        lca_actuals=None, lca_cost=0
    )

    # Link new items and compute lca_cost.
    items = list(StockPurchaseItem.objects.filter(id__in=item_ids))
    for item in items:
        item.lca_actuals = actuals
        item.lca_cost = item.total_price * cost_factor
    if items:
        StockPurchaseItem.objects.bulk_update(items, ["lca_actuals", "lca_cost"])


def _serialize_purchase_item(item):
    raw_grn = str(item.grn_number or "").strip()
    if raw_grn and not raw_grn.upper().startswith("GRN"):
        raw_grn = f"GRN{item.pk:04d}"
    cat_name = getattr(item.item_category, "name", "") if item.item_category else ""
    code_val = getattr(item.item_code, "item_code", "") if item.item_code else (str(item.item_code or ""))
    sp_num = f"SPV{item.vendor_detail_id:04d}" if item.vendor_detail_id else ""

    qty = Decimal(str(item.quantity or 0))
    unit_price = Decimal(str(item.unit_price or 0))
    tax_val = Decimal(str(getattr(item, "tax", 0) or 0))
    total_price = Decimal(str(item.total_price or 0))

    total_after_tax = getattr(item, "total_after_tax", None)
    if total_after_tax is None or Decimal(str(total_after_tax or 0)) == 0:
        total_after_tax = total_price + (total_price * (tax_val / Decimal("100")))
    else:
        total_after_tax = Decimal(str(total_after_tax))

    price_after_tax_per_unit = (total_after_tax / qty) if qty > 0 else (unit_price * (Decimal("1") + tax_val / Decimal("100")))

    return {
        "id": item.id,
        "grn_number": raw_grn,
        "purchase_number": sp_num,
        "invoice_number": item.vendor_detail.invoice_number if item.vendor_detail else "",
        "item_category": cat_name,
        "item_name": item.item_name,
        "item_code": code_val,
        "quantity": str(item.quantity),
        "unit_price": str(item.unit_price),
        "total_price": str(item.total_price),
        "tax": str(tax_val),
        "total_after_tax": str(round(total_after_tax, 2)),
        "price_after_tax_per_unit": str(round(price_after_tax_per_unit, 2)),
        "lca_cost": str(getattr(item, "lca_cost", 0)),
        "lca_actuals_id": getattr(item, "lca_actuals_id", None),
    }


def _sum_item_total_price(item_ids):
    if not item_ids:
        return Decimal("0")
    total = Decimal("0")
    for item in StockPurchaseItem.objects.filter(id__in=item_ids).only("total_price"):
        total += item.total_price
    return total


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


def _to_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
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


def _serialize_balance_settlement(obj):
    return {
        "id": obj.id,
        "settlement_date": obj.settlement_date.isoformat() if obj.settlement_date else "",
        "foreign_currency_id": obj.foreign_currency_id,
        "foreign_currency": _serialize_currency(obj.foreign_currency),
        "payment_amount": str(obj.amount),
        "factor": str(obj.factor),
        "value": str(obj.value),
    }


def _replace_balance_settlements(actuals, settlements_payload):
    if not isinstance(settlements_payload, list):
        return

    settlement_rows = []
    for row in settlements_payload:
        if not isinstance(row, dict):
            continue

        settlement_date = _to_date(row.get("settlement_date"))
        if not settlement_date:
            continue

        amount = _to_decimal(row.get("payment_amount"), Decimal("0"))
        factor = _to_decimal(row.get("factor"), Decimal("0"))
        value = amount * factor
        settlement_rows.append(
            LCABalanceSettlement(
                lca_actuals=actuals,
                settlement_date=settlement_date,
                foreign_currency=_to_currency(row.get("foreign_currency_id")) or actuals.foreign_currency,
                amount=amount,
                factor=factor,
                value=value,
            )
        )

    LCABalanceSettlement.objects.filter(lca_actuals=actuals).delete()
    if settlement_rows:
        LCABalanceSettlement.objects.bulk_create(settlement_rows)


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
    values["balance_payment_value_omr"] = values["balance_payment_value"] * values.get("bank_exchange_rate_balance", Decimal("0"))
    values["total_supplier_price_omr"] = values["advance_payment_value_omr"] + values["balance_payment_value_omr"]

    values["total"] = (
        values["total_supplier_price_omr"]
        + values["bank_muscat_charge_advance_payment"]
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
        StockPurchaseItem.objects.filter(lca_actuals=obj).select_related(
            "vendor_detail", "item_category", "item_code"
        )
    )
    ex_works_total = Decimal(str(obj.ex_works_material_cost or 0))
    total_value = Decimal(str(obj.total or 0))
    cost_factor = (total_value / ex_works_total) if ex_works_total else Decimal("0")
    settlements = list(obj.balance_settlements.select_related("foreign_currency").all())
    settled_total = sum((Decimal(str(row.value or 0)) for row in settlements), Decimal("0"))
    pending_total = ex_works_total - settled_total
    return {
        "id": obj.id,
        "lca_id": f"LCA_{obj.id:03d}",
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
        "bank_exchange_rate_balance": str(getattr(obj, "bank_exchange_rate_balance", 0)),
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
        "cost_factor": str(cost_factor),
        "balance_settlements": [_serialize_balance_settlement(row) for row in settlements],
        "balance_settled_total": str(settled_total),
        "balance_pending": str(pending_total),
        "created_by": obj.created_by,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else "",
    }


def _serialize_list_row(obj):
    return {
        "id": obj.id,
        "lca_id": f"LCA_{obj.id:03d}",
        "date": obj.updated_at.date().isoformat() if obj.updated_at else "",
        "total_supplier_price": str(obj.total_supplier_price),
        "total_supplier_price_omr": str(obj.total_supplier_price_omr),
        "total": str(obj.total),
    }


@require_GET
def lca_actuals_meta_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    charge_types = [
        {"id": row.id, "name": row.name}
        for row in LCAChargeTypeOption.objects.order_by("name")
    ]
    currencies = [
        _serialize_currency(row)
        for row in CountryCurrency.objects.filter(is_active=True).order_by("sort_order", "country_name")
    ]
    stock_purchases = []
    for sp in StockPurchaseVendorDetail.objects.select_related("vendor").prefetch_related("items").order_by("-id"):
        invoice = sp.invoice_number
        sp_num = f"SPV{sp.pk:04d}"
        label = f"{sp_num} | Invoice: {invoice}" if invoice else sp_num
        stock_purchases.append({"id": sp.id, "label": label, "invoice_number": invoice, "purchase_number": sp_num})
    return JsonResponse({"charge_types": charge_types, "currencies": currencies, "stock_purchases": stock_purchases})


@require_GET
def lca_purchase_items_api_view(request, purchase_id):
    """Return all StockPurchaseItems for a given purchase, with their current LCA linkage."""
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    items = (
        StockPurchaseItem.objects.filter(vendor_detail_id=purchase_id)
        .select_related("vendor_detail", "item_category", "item_code")
        .order_by("id")
    )
    return JsonResponse({"items": [_serialize_purchase_item(i) for i in items]})


@require_POST
@csrf_protect
def create_lca_charge_type_option_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    name = normalize_text(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Charge type name is required."}, status=400)
    if LCAChargeTypeOption.objects.filter(name__iexact=name).exists():
        return JsonResponse({"message": "Charge type already exists."}, status=400)

    obj = LCAChargeTypeOption.objects.create(name=name)
    return JsonResponse({"success": True, "charge_type": {"id": obj.id, "name": obj.name}}, status=201)


@require_GET
def list_lca_actuals_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    rows = LandingCostActuals.objects.order_by("-updated_at", "-id")
    return JsonResponse({"lca_actuals": [_serialize_list_row(row) for row in rows]})


@require_POST
@csrf_protect
def create_lca_actuals_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    values = {field: _to_decimal(payload.get(field), Decimal("0")) for field in EDITABLE_FIELDS}
    text_values = {field: normalize_text(payload.get(field, "")) for field in TEXT_FIELDS}
    foreign_currency = _to_currency(payload.get("foreign_currency_id"))

    actuals = LandingCostActuals(
        created_by=normalize_text(payload.get("created_by") or request.user.username),
        foreign_currency=foreign_currency,
    )
    item_ids = [int(i) for i in (payload.get("item_ids") or []) if str(i).isdigit()]
    values["ex_works_material_cost"] = _sum_item_total_price(item_ids)
    values = _calculate_totals(values)
    for field in EDITABLE_FIELDS:
        setattr(actuals, field, values[field])
    for field in TEXT_FIELDS:
        setattr(actuals, field, text_values[field])
    actuals.total_supplier_price = values["total_supplier_price"]
    actuals.advance_payment_value_omr = values["advance_payment_value_omr"]
    actuals.balance_payment_value = values["balance_payment_value"]
    actuals.balance_payment_value_omr = values["balance_payment_value_omr"]
    actuals.total_supplier_price_omr = values["total_supplier_price_omr"]
    actuals.total = values["total"]
    actuals.save()

    if item_ids:
        _link_items_to_actuals(actuals, item_ids)
    _replace_balance_settlements(actuals, payload.get("balance_settlements") or [])

    return JsonResponse({"success": True, "lca_actuals": _serialize(actuals)}, status=201)


@require_http_methods(["GET", "PATCH", "DELETE"])
@csrf_protect
def lca_actuals_record_api_view(request, lca_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    actuals = LandingCostActuals.objects.filter(pk=lca_id).first()
    if not actuals:
        return JsonResponse({"message": "LCA record not found."}, status=404)

    if request.method == "GET":
        return JsonResponse({"lca_actuals": _serialize(actuals)})

    if request.method == "DELETE":
        StockPurchaseItem.objects.filter(lca_actuals=actuals).update(lca_actuals=None, lca_cost=0)
        actuals.delete()
        return JsonResponse({"success": True, "message": "Deleted."})

    payload = _read_json(request)
    values = {field: _to_decimal(payload.get(field, getattr(actuals, field)), Decimal("0")) for field in EDITABLE_FIELDS}
    if "item_ids" in payload:
        item_ids = [int(i) for i in (payload.get("item_ids") or []) if str(i).isdigit()]
    else:
        item_ids = list(StockPurchaseItem.objects.filter(lca_actuals=actuals).values_list("id", flat=True))
    values["ex_works_material_cost"] = _sum_item_total_price(item_ids)
    values = _calculate_totals(values)
    text_values = {field: normalize_text(payload.get(field, getattr(actuals, field, ""))) for field in TEXT_FIELDS}
    if "foreign_currency_id" in payload:
        actuals.foreign_currency = _to_currency(payload.get("foreign_currency_id"))

    for field in EDITABLE_FIELDS:
        setattr(actuals, field, values[field])
    for field in TEXT_FIELDS:
        setattr(actuals, field, text_values[field])
    actuals.total_supplier_price = values["total_supplier_price"]
    actuals.advance_payment_value_omr = values["advance_payment_value_omr"]
    actuals.balance_payment_value = values["balance_payment_value"]
    actuals.balance_payment_value_omr = values["balance_payment_value_omr"]
    actuals.total_supplier_price_omr = values["total_supplier_price_omr"]
    actuals.total = values["total"]
    actuals.created_by = normalize_text(payload.get("created_by") or actuals.created_by or request.user.username)
    actuals.save()

    if "item_ids" in payload:
        _link_items_to_actuals(actuals, item_ids)
    if "balance_settlements" in payload:
        _replace_balance_settlements(actuals, payload.get("balance_settlements") or [])

    return JsonResponse({"success": True, "lca_actuals": _serialize(actuals)})
