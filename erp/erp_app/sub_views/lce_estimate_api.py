import json
from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from django.db.models import Q

from ..sub_models import (
    CountryCurrency,
    LabFurnitureItem,
    LCEBalanceSettlement,
    LCEChargeTypeOption,
    LCEEstimate,
    LCEEstimateItem,
    StockPurchaseVendorDetail,
)
from ..sub_models.stock_purchase import StockPurchaseItem
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


def _link_items_to_estimate(estimate, item_ids):
    """
    Set lce_estimate FK on the given StockPurchaseItem IDs (replacing any
    previous links for this estimate), then compute lce_cost per item.
    Items previously linked to this LCE that are NO longer selected are unlinked.
    """
    lce_total = Decimal(str(estimate.total))
    ex_works_total = Decimal(str(estimate.ex_works_material_cost))
    cost_factor = (lce_total / ex_works_total) if ex_works_total else Decimal("0")

    # Unlink items that were previously linked but are no longer selected.
    StockPurchaseItem.objects.filter(lce_estimate=estimate).exclude(id__in=item_ids).update(
        lce_estimate=None, lce_cost=0
    )

    # Link new items and compute lce_cost.
    items = list(StockPurchaseItem.objects.filter(id__in=item_ids))
    for item in items:
        item.lce_estimate = estimate
        item.lce_cost = item.total_price * cost_factor
    if items:
        StockPurchaseItem.objects.bulk_update(items, ["lce_estimate", "lce_cost"])


def _serialize_purchase_item(item):
    raw_grn = str(item.grn_number or "").strip()
    if raw_grn and not raw_grn.upper().startswith("GRN"):
        raw_grn = f"GRN{item.pk:04d}"
    cat_name = getattr(item.item_category, "name", "") if item.item_category else ""
    code_val = getattr(item.item_code, "item_code", "") if item.item_code else (str(item.item_code or ""))
    sp_num = f"SPV{item.vendor_detail_id:04d}" if item.vendor_detail_id else ""
    vendor_name = ""
    if item.vendor_detail and getattr(item.vendor_detail, "vendor", None):
        vendor_name = getattr(item.vendor_detail.vendor, "name", "") or ""
    elif item.vendor_detail:
        vendor_name = str(item.vendor_detail)
    return {
        "id": item.id,
        "grn_number": raw_grn,
        "purchase_number": sp_num,
        "supplier_name": vendor_name,
        "vendor_name": vendor_name,
        "invoice_number": item.vendor_detail.invoice_number if item.vendor_detail else "",
        "item_category": cat_name,
        "item_name": item.item_name,
        "item_code": code_val,
        "quantity": str(item.quantity),
        "unit_price": str(item.unit_price),
        "total_price": str(item.total_price),
        "lce_cost": str(item.lce_cost),
        "lce_estimate_id": item.lce_estimate_id,
    }


def _sum_item_total_price(item_ids):
    if not item_ids:
        return Decimal("0")
    total = Decimal("0")
    for item in StockPurchaseItem.objects.filter(id__in=item_ids).only("total_price"):
        total += item.total_price
    return total


def _calculate_item_purchase_stats(item_master):
    rows = list(
        StockPurchaseItem.objects.filter(
            Q(item_code=item_master) |
            Q(item_code__item_code_ref__item_code__iexact=item_master.item_code)
        ).select_related("item_category", "vendor_detail").order_by("-updated_at", "-id")
    )
    costs = []
    for r in rows:
        if r.unit_price not in (None, "") and Decimal(str(r.unit_price)) > 0:
            costs.append(Decimal(str(r.unit_price)).quantize(Decimal("0.01")))
        elif r.unit_price not in (None, ""):
            costs.append(Decimal(str(r.unit_price)).quantize(Decimal("0.01")))
        elif r.total_price and r.quantity and r.quantity > 0:
            costs.append((Decimal(str(r.total_price)) / Decimal(str(r.quantity))).quantize(Decimal("0.01")))
    positive_costs = [c for c in costs if c > Decimal("0.00")]
    final_costs = positive_costs if positive_costs else costs
    min_cost = min(final_costs) if final_costs else Decimal("0.00")
    max_cost = max(final_costs) if final_costs else Decimal("0.00")
    actual_cost = max_cost
    return {
        "id": item_master.id,
        "item_code_id": item_master.id,
        "item_code": item_master.item_code,
        "item_name": item_master.item_name,
        "item_category": getattr(item_master.item_category, "name", "") if item_master.item_category else "",
        "min_cost": str(min_cost),
        "max_cost": str(max_cost),
        "actual_cost": str(actual_cost),
        "purchases_count": len(costs),
    }


def check_lce_item_wip_usage(item_code_input, item_id=None):
    """
    Check if an item's LCE cost is used in any Project Quotation or Project Costing
    whose status is Work In Progress (WIP).
    Returns a list of matching project dictionaries.
    """
    item = None
    if item_id and str(item_id).isdigit():
        item = LabFurnitureItem.objects.filter(pk=int(item_id)).first()
    code_str = str(getattr(item_code_input, "item_code", item_code_input) or "").strip()
    if not item and code_str:
        if code_str.isdigit():
            item = LabFurnitureItem.objects.filter(pk=int(code_str)).first()
        if not item:
            item = LabFurnitureItem.objects.filter(item_code_ref__item_code__iexact=code_str).first()

    code_val = item.item_code if item else code_str
    if item:
        item_q = Q(item_code=item) | Q(item_code__item_code_ref__item_code__iexact=code_val)
    elif code_val:
        item_q = Q(item_code__item_code_ref__item_code__iexact=code_val)
    else:
        return []

    from ..sub_models.project_quotation_items_mod import ProjectQuotationItemInfo
    from ..sub_models.project_costing_items_mod import ProjectCostingItemInfo

    wip_projects = []
    seen = set()

    quotation_items = (
        ProjectQuotationItemInfo.objects.filter(
            item_q,
            quotation_number__status__status_name__iexact="Work In Progress",
        )
        .select_related("quotation_number__project", "quotation_number__status")
        .order_by("quotation_number__project__project_id")
    )
    for qi in quotation_items:
        q_sum = qi.quotation_number
        if not q_sum:
            continue
        proj = q_sum.project
        key = ("quotation", q_sum.quotation_number or q_sum.id)
        if key not in seen:
            seen.add(key)
            wip_projects.append({
                "stage": "Project Quotation",
                "project_code": getattr(proj, "project_id", "") if proj else "",
                "project_name": getattr(proj, "project_name", "") or getattr(q_sum, "project_name", "") or "—",
                "reference": q_sum.quotation_number or f"Q-{q_sum.id}",
                "status": getattr(q_sum.status, "status_name", "Work In Progress"),
            })

    costing_items = (
        ProjectCostingItemInfo.objects.filter(
            item_q,
            costing_id__status__status_name__iexact="Work In Progress",
        )
        .select_related("costing_id__project", "costing_id__status")
        .order_by("costing_id__project__project_id")
    )
    for ci in costing_items:
        c_sum = ci.costing_id
        if not c_sum:
            continue
        proj = c_sum.project
        key = ("costing", c_sum.costing_id or c_sum.id)
        if key not in seen:
            seen.add(key)
            wip_projects.append({
                "stage": "Project Costing",
                "project_code": getattr(proj, "project_id", "") if proj else "",
                "project_name": getattr(proj, "project_name", "") or getattr(c_sum, "project_name", "") or "—",
                "reference": c_sum.costing_id or f"C-{c_sum.id}",
                "status": getattr(c_sum.status, "status_name", "Work In Progress"),
            })

    return wip_projects


def _save_lce_items(estimate, items_payload):
    if items_payload is None:
        return

    # 1. Guard: Check for duplicate items in payload, and ensure no item is linked to another LCE
    seen_item_ids = set()
    validated_items = []
    for row in items_payload:
        if not isinstance(row, dict):
            continue
        item_id = row.get("item_code_id") or row.get("id") or row.get("item_code")
        master_item = None
        if item_id and str(item_id).isdigit():
            master_item = LabFurnitureItem.objects.filter(pk=int(item_id)).first()
        if not master_item and item_id:
            master_item = LabFurnitureItem.objects.filter(item_code_ref__item_code__iexact=str(item_id).strip()).first()
        if not master_item:
            continue

        item_code_display = getattr(master_item, "item_code", str(item_id))
        if master_item.pk in seen_item_ids:
            raise ValidationError(f"Duplicate item '{item_code_display}' in items list. Each item code can only be linked once.")
        seen_item_ids.add(master_item.pk)

        # Ensure this item is not already linked to another LCE estimate
        other_link = (
            LCEEstimateItem.objects.filter(item_code=master_item)
            .exclude(lce_estimate=estimate)
            .select_related("lce_estimate")
            .first()
        )
        if other_link:
            raise ValidationError(
                f"Item '{item_code_display}' is already linked to LCE #{other_link.lce_estimate_id}. "
                f"An item code can only be linked to one LCE."
            )

        validated_items.append((master_item, row))

    # 2. Guard: if this estimate is already saved in the database,
    # prevent removing any item that is used in WIP project quotations or costings.
    if estimate.pk:
        existing_items = list(
            LCEEstimateItem.objects.filter(lce_estimate=estimate).select_related("item_code__item_code_ref")
        )
        if existing_items:
            payload_codes = set()
            for r in items_payload:
                if isinstance(r, dict):
                    c = str(r.get("item_code") or "").strip().upper()
                    cid = str(r.get("item_code_id") or "").strip()
                    if c:
                        payload_codes.add(c)
                    if cid:
                        payload_codes.add(cid)
            for ex in existing_items:
                ex_code = ex.item_code.item_code.strip().upper() if ex.item_code else ""
                ex_id = str(ex.item_code_id)
                if ex_code not in payload_codes and ex_id not in payload_codes:
                    wip_projs = check_lce_item_wip_usage(ex.item_code)
                    if wip_projs:
                        proj_list = ", ".join(f"{p['project_code']} ({p['stage']})" for p in wip_projs[:3])
                        raise ValidationError(f"Cannot remove item {ex_code}: LCE cost is used in WIP projects ({proj_list}).")

    LCEEstimateItem.objects.filter(lce_estimate=estimate).delete()
    item_rows = []
    first_item = None
    ex_works = Decimal(str(estimate.ex_works_material_cost or 0))
    total_val = Decimal(str(estimate.total or 0))
    cost_factor = (total_val / ex_works) if ex_works else Decimal("0")

    for master_item, row in validated_items:
        stats = _calculate_item_purchase_stats(master_item)
        auto_min = Decimal(stats["min_cost"])
        auto_max = Decimal(stats["max_cost"])
        min_cost = _to_decimal(row.get("min_cost"), auto_min)
        max_cost = _to_decimal(row.get("max_cost"), auto_max)
        user_actual = row.get("actual_cost")
        actual_cost = _to_decimal(user_actual, max_cost or min_cost)
        if actual_cost == Decimal("0") and (max_cost > Decimal("0") or min_cost > Decimal("0")):
            actual_cost = max_cost or min_cost
        calculated_lce_cost = (actual_cost * cost_factor).quantize(Decimal("0.01")) if cost_factor else Decimal("0.00")
        lce_cost = _to_decimal(row.get("lce_cost"), calculated_lce_cost)
        if lce_cost == Decimal("0") and calculated_lce_cost > Decimal("0"):
            lce_cost = calculated_lce_cost

        item_row = LCEEstimateItem(
            lce_estimate=estimate,
            item_code=master_item,
            item_category=getattr(master_item.item_category, "name", "") if master_item.item_category else "",
            item_name=master_item.item_name,
            min_cost=min_cost,
            max_cost=max_cost,
            actual_cost=actual_cost,
            lce_cost=lce_cost,
        )
        item_rows.append(item_row)
        if not first_item:
            first_item = item_row

    if item_rows:
        LCEEstimateItem.objects.bulk_create(item_rows)
        estimate.item_code = first_item.item_code
        estimate.item_category = first_item.item_category
        estimate.item_name = first_item.item_name
        estimate.min_cost = first_item.min_cost
        estimate.max_cost = first_item.max_cost
        estimate.actual_cost = first_item.actual_cost
        estimate.lce_cost = first_item.lce_cost
        estimate.save(update_fields=["item_code", "item_category", "item_name", "min_cost", "max_cost", "actual_cost", "lce_cost"])
    else:
        estimate.item_code = None
        estimate.item_category = ""
        estimate.item_name = ""
        estimate.min_cost = Decimal("0")
        estimate.max_cost = Decimal("0")
        estimate.actual_cost = Decimal("0")
        estimate.lce_cost = Decimal("0")
        estimate.save(update_fields=["item_code", "item_category", "item_name", "min_cost", "max_cost", "actual_cost", "lce_cost"])


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
        "payment_amount": str(obj.amount),  # changed from 'amount' to 'payment_amount'
        "factor": str(obj.factor),
        "value": str(obj.value),
    }


def _replace_balance_settlements(estimate, settlements_payload):
    if not isinstance(settlements_payload, list):
        return

    settlement_rows = []
    for row in settlements_payload:
        if not isinstance(row, dict):
            continue

        settlement_date = _to_date(row.get("settlement_date"))
        if not settlement_date:
            continue

        # Use payment_amount (EUR) from frontend, not amount or OMR
        amount = _to_decimal(row.get("payment_amount"), Decimal("0"))
        factor = _to_decimal(row.get("factor"), Decimal("0"))
        value = amount * factor
        settlement_rows.append(
            LCEBalanceSettlement(
                lce_estimate=estimate,
                settlement_date=settlement_date,
                foreign_currency=_to_currency(row.get("foreign_currency_id")) or estimate.foreign_currency,
                amount=amount,
                factor=factor,
                value=value,
            )
        )

    LCEBalanceSettlement.objects.filter(lce_estimate=estimate).delete()
    if settlement_rows:
        LCEBalanceSettlement.objects.bulk_create(settlement_rows)


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
        StockPurchaseItem.objects.filter(lce_estimate=obj).select_related(
            "vendor_detail", "item_category", "item_code"
        )
    )
    ex_works_total = Decimal(str(obj.ex_works_material_cost or 0))
    total_value = Decimal(str(obj.total or 0))
    cost_factor = (total_value / ex_works_total) if ex_works_total else Decimal("0")
    settlements = list(obj.balance_settlements.select_related("foreign_currency").all())
    settled_total = sum((Decimal(str(row.value or 0)) for row in settlements), Decimal("0"))
    pending_total = ex_works_total - settled_total
    serialized_items = [
        {
            "id": it.id,
            "item_code_id": it.item_code_id,
            "item_code": it.item_code.item_code if it.item_code else "",
            "item_name": it.item_name or (it.item_code.item_name if it.item_code else ""),
            "item_category": it.item_category or (getattr(it.item_code.item_category, "name", "") if it.item_code and it.item_code.item_category else ""),
            "min_cost": str(it.min_cost),
            "max_cost": str(it.max_cost),
            "actual_cost": str(it.actual_cost),
            "lce_cost": str(it.lce_cost or ((it.actual_cost * cost_factor).quantize(Decimal("0.01")) if cost_factor else "0.00")),
        }
        for it in obj.items.select_related("item_code__item_code_ref", "item_code__item_category").all()
    ]
    return {
        "id": obj.id,
        "lce_id": f"LCE_{obj.id:03d}",
        "items": serialized_items,
        "item_code_id": obj.item_code_id,
        "item_code": obj.item_code.item_code if obj.item_code else "",
        "item_name": obj.item_name or (obj.item_code.item_name if obj.item_code else ""),
        "item_category": obj.item_category or (getattr(obj.item_code.item_category, "name", "") if obj.item_code and obj.item_code.item_category else ""),
        "min_cost": str(obj.min_cost),
        "max_cost": str(obj.max_cost),
        "actual_cost": str(obj.actual_cost),
        "lce_cost": str(obj.lce_cost or ((obj.actual_cost * cost_factor).quantize(Decimal("0.01")) if cost_factor and obj.actual_cost else "0.00")),
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


def _clean_user_display(val):
    if not val:
        return ""
    if isinstance(val, dict):
        return val.get("username") or val.get("name") or str(val.get("id") or "")
    val_str = str(val).strip()
    if val_str.startswith("{") and ("'username':" in val_str or '"username":' in val_str):
        import re
        m = re.search(r"['\"]username['\"]\s*:\s*['\"]([^'\"]+)['\"]", val_str)
        if m:
            return m.group(1)
    return val_str


def _serialize_list_row(obj):
    return {
        "id": obj.id,
        "lce_id": f"LCE_{obj.id:03d}",
        "total_supplier_price": str(obj.total_supplier_price),
        "total_supplier_price_omr": str(obj.total_supplier_price_omr),
        "total": str(obj.total),
        "updated_by": _clean_user_display(obj.created_by),
        "updated_by": obj.created_by or "",
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else "",
        "updated_on": obj.updated_at.strftime("%Y-%m-%d %H:%M:%S") if obj.updated_at else "",
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
    linked_lce_items = {}
    for item in LCEEstimateItem.objects.select_related("lce_estimate").all():
        if item.item_code_id:
            linked_lce_items[str(item.item_code_id)] = {
                "lce_id": item.lce_estimate_id,
                "lce_title": f"LCE #{item.lce_estimate_id}",
            }

    item_master_options = [
        {
            "id": row.id,
            "item_code": row.item_code,
            "item_name": row.item_name,
            "item_category": row.item_category.name if row.item_category else "",
            "label": f"{row.item_code} - {row.item_name}",
            "linked_lce_id": linked_lce_items.get(str(row.id), {}).get("lce_id"),
        }
        for row in LabFurnitureItem.objects.select_related("item_code_ref", "item_name_ref", "item_category").order_by("item_code_ref__item_code")
    ]
    stock_purchases = []
    for sp in StockPurchaseVendorDetail.objects.select_related("vendor").prefetch_related("items").order_by("-id"):
        invoice = sp.invoice_number
        sp_num = f"SPV{sp.pk:04d}"
        label = f"{sp_num} | Invoice: {invoice}" if invoice else sp_num
        stock_purchases.append({"id": sp.id, "label": label, "invoice_number": invoice, "purchase_number": sp_num})
    return JsonResponse({
        "charge_types": charge_types,
        "currencies": currencies,
        "item_master_options": item_master_options,
        "linked_lce_items": linked_lce_items,
        "stock_purchases": stock_purchases,
    })


@require_http_methods(["GET", "POST"])
@csrf_protect
def lce_items_api_view(request):
    """
    Accept {item_codes: []} (allow multiple item codes).
    Return item details + min/max cost from StockPurchaseItem.
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request) if request.method == "POST" else {}
    raw_item_codes = payload.get("item_codes")
    if raw_item_codes is None and request.method == "GET":
        raw_code = request.GET.get("item_code")
        raw_item_codes = [raw_code] if raw_code else []
    elif not isinstance(raw_item_codes, list):
        if raw_item_codes is not None:
            raw_item_codes = [raw_item_codes]
        else:
            raw_item_codes = []

    results = []
    seen_ids = set()
    for code_val in raw_item_codes:
        if not code_val:
            continue
        item = None
        if str(code_val).isdigit():
            item = LabFurnitureItem.objects.filter(pk=int(code_val)).first()
        if not item:
            item = LabFurnitureItem.objects.filter(item_code_ref__item_code__iexact=str(code_val).strip()).first()
        if not item:
            continue
        if item.id in seen_ids:
            continue
        seen_ids.add(item.id)
        results.append(_calculate_item_purchase_stats(item))

    return JsonResponse({"items": results})


@require_GET
def lce_purchase_history_api_view(request, item_code):
    """
    Return list of historic purchases for given item_code:
    Item Category, Item Name, Item Code, Cost.
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    item = None
    item_str = str(item_code).strip()
    if item_str.isdigit():
        item = LabFurnitureItem.objects.filter(pk=int(item_str)).first()
    if not item:
        item = LabFurnitureItem.objects.filter(item_code_ref__item_code__iexact=item_str).first()

    if item:
        query = Q(item_code=item) | Q(item_code__item_code_ref__item_code__iexact=item.item_code)
    else:
        query = Q(item_code__item_code_ref__item_code__iexact=item_str) | Q(item_name__iexact=item_str)

    rows = (
        StockPurchaseItem.objects.filter(query)
        .select_related("item_category", "item_code__item_code_ref", "vendor_detail__vendor")
        .order_by("-updated_at", "-id")
    )

    purchases = []
    for r in rows:
        cat_name = getattr(r.item_category, "name", "") if r.item_category else (getattr(item.item_category, "name", "") if item and item.item_category else "")
        item_name = r.item_name or (item.item_name if item else "")
        code_val = (r.item_code.item_code if r.item_code else "") or (item.item_code if item else item_str)
        supplier_name = ""
        if r.vendor_detail and getattr(r.vendor_detail, "vendor", None):
            supplier_name = getattr(r.vendor_detail.vendor, "name", "") or ""
        elif r.vendor_detail:
            supplier_name = str(r.vendor_detail)

        if r.unit_price not in (None, ""):
            cost = Decimal(str(r.unit_price)).quantize(Decimal("0.01"))
        elif r.total_price and r.quantity and r.quantity > 0:
            cost = (Decimal(str(r.total_price)) / Decimal(str(r.quantity))).quantize(Decimal("0.01"))
        else:
            cost = Decimal("0.00")

        sp_num = f"SPV{r.vendor_detail_id:04d}" if r.vendor_detail_id else ""
        raw_grn = str(r.grn_number or "").strip()
        if raw_grn and not raw_grn.upper().startswith("GRN"):
            raw_grn = f"GRN{r.pk:04d}"

        purchases.append({
            "item_category": cat_name,
            "item_name": item_name,
            "item_code": code_val,
            "supplier_name": supplier_name,
            "vendor_name": supplier_name,
            "cost": str(cost),
            "purchase_number": sp_num,
            "invoice_number": r.vendor_detail.invoice_number if r.vendor_detail else "",
            "grn_number": raw_grn,
            "quantity": str(r.quantity),
            "unit_price": str(r.unit_price),
            "lce_cost": str(r.lce_cost),
            "date": r.created_at.date().isoformat() if r.created_at else "",
        })

    return JsonResponse({
        "item_code": item.item_code if item else item_str,
        "item_name": item.item_name if item else "",
        "item_category": getattr(item.item_category, "name", "") if item and item.item_category else "",
        "purchases": purchases,
    })


@require_GET
def lce_purchase_items_api_view(request, purchase_id):
    """Return all StockPurchaseItems for a given purchase, with their current LCE linkage."""
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
    text_values = {field: normalize_text(payload.get(field, "")) for field in TEXT_FIELDS}
    foreign_currency = _to_currency(payload.get("foreign_currency_id"))

    user_val = payload.get("created_by")
    if isinstance(user_val, dict):
        user_val = user_val.get("username") or request.user.username
    estimate = LCEEstimate(
        created_by=normalize_text(user_val or request.user.username),
        foreign_currency=foreign_currency,
    )
    items_payload = payload.get("items")
    item_ids = [int(i) for i in (payload.get("item_ids") or []) if str(i).isdigit()]
    if items_payload is not None:
        if "ex_works_material_cost" in payload and payload.get("ex_works_material_cost") not in (None, ""):
            values["ex_works_material_cost"] = _to_decimal(payload.get("ex_works_material_cost"))
        else:
            values["ex_works_material_cost"] = sum((_to_decimal(r.get("actual_cost"), Decimal("0")) for r in items_payload if isinstance(r, dict)), Decimal("0"))
    elif item_ids:
        values["ex_works_material_cost"] = _sum_item_total_price(item_ids)

    values = _calculate_totals(values)
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

    if items_payload is not None:
        try:
            _save_lce_items(estimate, items_payload)
        except ValidationError as exc:
            return JsonResponse({"message": exc.message if hasattr(exc, "message") else str(exc)}, status=400)
    elif item_ids:
        _link_items_to_estimate(estimate, item_ids)
    _replace_balance_settlements(estimate, payload.get("balance_settlements") or [])

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
    items_payload = payload.get("items")
    if items_payload is not None:
        if "ex_works_material_cost" in payload and payload.get("ex_works_material_cost") not in (None, ""):
            values["ex_works_material_cost"] = _to_decimal(payload.get("ex_works_material_cost"))
        else:
            values["ex_works_material_cost"] = sum((_to_decimal(r.get("actual_cost"), Decimal("0")) for r in items_payload if isinstance(r, dict)), Decimal("0"))
    elif "item_ids" in payload:
        item_ids = [int(i) for i in (payload.get("item_ids") or []) if str(i).isdigit()]
        values["ex_works_material_cost"] = _sum_item_total_price(item_ids)
    else:
        item_ids = list(StockPurchaseItem.objects.filter(lce_estimate=estimate).values_list("id", flat=True))
        if item_ids and ("ex_works_material_cost" not in payload or payload.get("ex_works_material_cost") in (None, "")):
            values["ex_works_material_cost"] = _sum_item_total_price(item_ids)

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
    user_val = payload.get("created_by")
    if isinstance(user_val, dict):
        user_val = user_val.get("username") or estimate.created_by or request.user.username
    estimate.created_by = normalize_text(user_val or estimate.created_by or request.user.username)
    estimate.save()

    if items_payload is not None:
        try:
            _save_lce_items(estimate, items_payload)
        except ValidationError as exc:
            return JsonResponse({"message": exc.message if hasattr(exc, "message") else str(exc)}, status=400)
    elif "item_ids" in payload:
        _link_items_to_estimate(estimate, item_ids)
    if "balance_settlements" in payload:
        _replace_balance_settlements(estimate, payload.get("balance_settlements") or [])

    return JsonResponse({"success": True, "lce_estimate": _serialize(estimate)})


@require_GET
def check_lce_item_usage_api_view(request):
    """
    Check if an item's LCE cost is used in any Project Quotation or Project Costing
    whose status is Work In Progress (WIP).
    GET /api/lce/check-item-usage/?item_code=...&item_id=...
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    item_code = request.GET.get("item_code", "").strip()
    item_id = request.GET.get("item_id", "").strip()
    wip_projects = check_lce_item_wip_usage(item_code, item_id)

    return JsonResponse({
        "status": "success",
        "can_delete": len(wip_projects) == 0,
        "item_code": item_code,
        "wip_projects": wip_projects,
    })


@require_http_methods(["POST", "DELETE"])
@csrf_protect
def delete_lce_item_api_view(request):
    """
    Delete an item from an LCE estimate.
    Disallows deletion if the item's LCE cost is used in any WIP project quotation or costing.
    POST /api/lce/delete-item/
    Payload: { "lce_id": 15, "item_code": "12052", "item_code_id": "..." }
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    item_code = str(payload.get("item_code") or request.GET.get("item_code") or "").strip()
    item_id = str(payload.get("item_code_id") or payload.get("item_id") or request.GET.get("item_id") or "").strip()
    lce_id = payload.get("lce_id") or request.GET.get("lce_id")

    wip_projects = check_lce_item_wip_usage(item_code, item_id)
    if wip_projects:
        return JsonResponse({
            "status": "error",
            "can_delete": False,
            "message": f"Cannot delete item {item_code}: this LCE cost is used in active WIP project(s).",
            "wip_projects": wip_projects,
        }, status=400)

    if lce_id and str(lce_id).isdigit():
        estimate = LCEEstimate.objects.filter(pk=int(lce_id)).first()
        if estimate:
            item = None
            if item_id and item_id.isdigit():
                item = LabFurnitureItem.objects.filter(pk=int(item_id)).first()
            if not item and item_code:
                item = LabFurnitureItem.objects.filter(item_code_ref__item_code__iexact=item_code).first()
            if item:
                LCEEstimateItem.objects.filter(lce_estimate=estimate, item_code=item).delete()
            elif item_code:
                LCEEstimateItem.objects.filter(
                    lce_estimate=estimate,
                    item_code__item_code_ref__item_code__iexact=item_code,
                ).delete()

    return JsonResponse({
        "status": "success",
        "can_delete": True,
        "message": f"Item {item_code} deleted from LCE successfully.",
    })
