import json
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import LCECostDetail, LCEEstimate, StockPurchaseItem, StockPurchaseVendorDetail, Vendor
from ..utils import normalize_text


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({'message': 'Authentication required.'}, status=401)
    return None


def _read_json(request):
    try:
        return json.loads(request.body.decode('utf-8') or '{}')
    except (TypeError, ValueError):
        return {}


def _to_decimal(value, fallback="0"):
    if value is None or value == "":
        return Decimal(str(fallback))
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal(str(fallback))


def _serialize_vendor_detail(vendor_detail):
    if not vendor_detail:
        return None
    return {
        "id": vendor_detail.id,
        "vendor_id": vendor_detail.vendor_id,
        "vendor_name": vendor_detail.vendor.name,
        "invoice_number": vendor_detail.invoice_number,
        "invoice_date": str(vendor_detail.invoice_date) if vendor_detail.invoice_date else "",
        "tax": str(vendor_detail.tax),
        "total_value": str(vendor_detail.total_value),
        "purchase_id": vendor_detail.purchase_id,
    }


def _serialize_item(item):
    raw_grn = str(item.grn_number or "").strip()
    if raw_grn and not raw_grn.upper().startswith("GRN"):
        raw_grn = f"GRN{item.id:04d}"

    return {
        "id": item.id,
        "grn_number": raw_grn,
        "item_category": item.item_category,
        "item_name": item.item_name,
        "item_code": item.item_code,
        "quantity": str(item.quantity),
        "unit_price": str(item.unit_price),
        "total_price": str(item.total_price),
        "lce_cost": str(item.lce_cost),
        "lce_estimate_id": item.lce_estimate_id,
    }


def _serialize(obj):
    items_qs = obj.items.all() if hasattr(obj, 'items') else []
    items = list(items_qs) if items_qs else []
    first_item = items[0] if items else None
    vendor_detail = _serialize_vendor_detail(obj)

    return {
        "id": obj.pk,
        "purchase_id": getattr(obj, "purchase_id", obj.pk),
        "invoice_number": obj.invoice_number,
        "invoice_date": str(obj.invoice_date) if obj.invoice_date else "",
        "tax": str(obj.tax),
        "total_value": str(obj.total_value),
        "vendor_id": obj.vendor.pk if obj.vendor else None,
        "vendor_name": obj.vendor.name if obj.vendor else None,
        "items": [_serialize_item(item) for item in items] if items else [],
        "items_count": len(items),
        "lce_linked_count": sum(1 for item in items if getattr(item, 'lce_estimate_id', None)),
        "purchase_total": str(sum((getattr(item, 'total_price', 0) for item in items), Decimal("0"))),
        # legacy keys for UI compatibility
        "item_name": first_item.item_name if first_item else "",
        "category": first_item.item_category if first_item else "",
        "vendor": obj.vendor.name if obj.vendor else "",
        "quantity": str(first_item.quantity) if first_item else "0",
        "unit_price": str(first_item.unit_price) if first_item else "0",
        "total_price": str(first_item.total_price) if first_item else "0",
        "status": None,  # No status field in vendor detail
        "status_id": None,
    }


def _resolve_vendor_detail(payload):
    vendor_detail_id = payload.get("vendor_detail_id")
    if vendor_detail_id:
        vendor_detail = StockPurchaseVendorDetail.objects.filter(id=vendor_detail_id).first()
        if not vendor_detail:
            raise ValueError("Selected vendor detail record was not found.")
        return vendor_detail

    vendor_payload = payload.get("vendor_detail") or {}
    vendor_id = vendor_payload.get("vendor_id")
    if not vendor_id:
        return None

    vendor = Vendor.objects.filter(id=vendor_id).first()
    if not vendor:
        raise ValueError("Selected vendor was not found.")

    return StockPurchaseVendorDetail.objects.create(
        vendor=vendor,
        invoice_number=normalize_text(vendor_payload.get("invoice_number", "")),
        invoice_date=vendor_payload.get("invoice_date") or None,
        tax=_to_decimal(vendor_payload.get("tax"), "0"),
        total_value=_to_decimal(vendor_payload.get("total_value"), "0"),
    )


def _recalculate_lce_estimates(estimate_ids):
    ids = [int(v) for v in (estimate_ids or []) if str(v).isdigit()]
    if not ids:
        return

    for estimate in LCEEstimate.objects.filter(id__in=ids):
        linked_items = list(StockPurchaseItem.objects.filter(lce_estimate=estimate).select_related("lce_estimate"))
        ex_works = sum((item.total_price for item in linked_items), Decimal("0"))

        estimate.ex_works_material_cost = ex_works
        estimate.total_supplier_price = (
            estimate.ex_works_material_cost
            + estimate.packing_charges
            + estimate.documentation
            + estimate.other_charges_1
            + estimate.other_charges_2
            + estimate.other_charges_3
            + estimate.other_charges_4
        )
        estimate.advance_payment_value_omr = estimate.advance_payment_value * estimate.bank_exchange_rate
        estimate.balance_payment_value = estimate.total_supplier_price - estimate.advance_payment_value
        estimate.balance_payment_value_omr = estimate.balance_payment_value * estimate.bank_exchange_rate
        estimate.total_supplier_price_omr = estimate.advance_payment_value_omr + estimate.balance_payment_value_omr
        estimate.total = (
            estimate.bank_muscat_charge_advance_payment
            + estimate.bank_muscat_charge_balance_payment
            + estimate.freight_charge
            + estimate.customs_duty_omr
            + estimate.oman_customs_boe_charge_omr
            + estimate.rop_customs_inspection_charge
            + estimate.unloading_charge_muscat_stores_1
            + estimate.unloading_charge_muscat_stores_2
            + estimate.loading_charge_muscat_stores_delivery
        )
        estimate.save(update_fields=[
            "ex_works_material_cost",
            "total_supplier_price",
            "advance_payment_value_omr",
            "balance_payment_value",
            "balance_payment_value_omr",
            "total_supplier_price_omr",
            "total",
            "updated_at",
        ])

        if linked_items:
            cost_factor = (Decimal(str(estimate.total)) / ex_works) if ex_works else Decimal("0")
            for item in linked_items:
                item.lce_cost = item.total_price * cost_factor
            StockPurchaseItem.objects.bulk_update(linked_items, ["lce_cost"])


def _sync_items(stock_purchase, items_payload):
    existing_items = list(stock_purchase.items.all())
    existing_by_id = {item.id: item for item in existing_items}
    existing_by_grn = {
        normalize_text(item.grn_number).upper(): item
        for item in existing_items
        if normalize_text(item.grn_number)
    }

    retained_existing_ids = set()
    affected_lce_ids = set()

    for row in items_payload:
        item_name = normalize_text(row.get("item_name", ""))
        if not item_name:
            continue

        row_id_raw = row.get("id")
        row_id = int(row_id_raw) if str(row_id_raw).isdigit() else None
        row_grn = normalize_text(row.get("grn_number", "")).upper()

        item = None
        if row_id and row_id in existing_by_id:
            item = existing_by_id[row_id]
        elif row_grn and row_grn in existing_by_grn:
            item = existing_by_grn[row_grn]

        if item:
            retained_existing_ids.add(item.id)
        else:
            item = StockPurchaseItem(stock_purchase=stock_purchase)

        item.item_category = normalize_text(row.get("item_category", ""))
        item.item_name = item_name
        item.item_code = normalize_text(row.get("item_code", ""))
        item.quantity = _to_decimal(row.get("quantity"), "0")
        item.unit_price = _to_decimal(row.get("unit_price"), "0")
        item.total_price = item.quantity * item.unit_price
        item.save()

        if item.lce_estimate_id:
            affected_lce_ids.add(item.lce_estimate_id)

    to_delete = [item for item in existing_items if item.id not in retained_existing_ids]
    blocked = [item for item in to_delete if item.lce_estimate_id]
    if blocked:
        blocked_labels = [item.grn_number or f"Item #{item.id}" for item in blocked]
        raise ValueError(
            "Cannot remove linked purchase item(s): "
            + ", ".join(blocked_labels)
            + ". Delink them from LCE first."
        )

    if to_delete:
        StockPurchaseItem.objects.filter(id__in=[item.id for item in to_delete]).delete()

    return affected_lce_ids


def _first_duplicate_code_in_payload(items_payload):
    seen = set()
    for row in items_payload:
        code = normalize_text(row.get("item_code", "")).upper()
        if not code:
            continue
        if code in seen:
            return code
        seen.add(code)
    return None


def _first_duplicate_name_in_payload(items_payload):
    seen = set()
    for row in items_payload:
        name = normalize_text(row.get("item_name", "")).lower()
        if not name:
            continue
        if name in seen:
            return row.get("item_name", "")
        seen.add(name)
    return None


def _first_duplicate_code_for_invoice(invoice_number, items_payload, exclude_purchase_id=None):
    invoice = normalize_text(invoice_number)
    if not invoice:
        return None

    candidate_codes = {
        normalize_text(row.get("item_code", "")).upper()
        for row in items_payload
        if normalize_text(row.get("item_code", ""))
    }
    if not candidate_codes:
        return None

    for code in candidate_codes:
        qs = StockPurchaseItem.objects.filter(
            stock_purchase__vendor_detail__invoice_number__iexact=invoice,
            item_code__iexact=code,
        )
        if exclude_purchase_id:
            qs = qs.exclude(stock_purchase_id=exclude_purchase_id)
        if qs.exists():
            return code
    return None


@require_GET
def list_stock_purchases_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    rows = StockPurchaseVendorDetail.objects.select_related("vendor").prefetch_related("items").order_by("-id")
    return JsonResponse({"stock_purchases": [_serialize(o) for o in rows]})


@require_POST
@csrf_protect
def create_stock_purchase_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    p = _read_json(request)

    vendor_id = p.get("vendor_id")
    vendor = Vendor.objects.filter(id=vendor_id).first() if vendor_id else None
    if not vendor:
        return JsonResponse({"message": "Vendor is required."}, status=400)

    invoice_number = normalize_text(p.get("invoice_number", ""))
    if StockPurchaseVendorDetail.objects.filter(invoice_number=invoice_number, vendor=vendor).exists():
        return JsonResponse({"message": "Invoice number already exists for this vendor."}, status=400)

    obj = StockPurchaseVendorDetail.objects.create(
        vendor=vendor,
        invoice_number=invoice_number,
        invoice_date=p.get("invoice_date") or None,
        tax=_to_decimal(p.get("tax"), "0"),
        total_value=_to_decimal(p.get("total_value"), "0"),
    )

    items_payload = p.get("items") or []
    for row in items_payload:
        item = StockPurchaseItem(
            vendor_detail=obj,
            item_category=normalize_text(row.get("item_category", "")),
            item_name=normalize_text(row.get("item_name", "")),
            item_code=normalize_text(row.get("item_code", "")),
            quantity=_to_decimal(row.get("quantity"), "0"),
            unit_price=_to_decimal(row.get("unit_price"), "0"),
        )
        item.total_price = item.quantity * item.unit_price
        item.save()

    return JsonResponse({"success": True, "stock_purchase": _serialize(obj)}, status=201)


@require_http_methods(['GET', 'PATCH', 'DELETE'])
@csrf_protect
def stock_purchase_detail_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na
    try:
        obj = StockPurchaseVendorDetail.objects.get(pk=pk)
    except StockPurchaseVendorDetail.DoesNotExist:
        return JsonResponse({'message': 'Record not found.'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'stock_purchase': _serialize(obj)})

    if request.method == 'DELETE':
        obj.delete()
        return JsonResponse({'success': True, 'message': 'Deleted.'})

    p = _read_json(request)

    obj.invoice_number = normalize_text(p.get("invoice_number", obj.invoice_number))
    obj.invoice_date = p.get("invoice_date", obj.invoice_date)
    obj.tax = _to_decimal(p.get("tax", obj.tax))
    obj.total_value = _to_decimal(p.get("total_value", obj.total_value))
    obj.save()

    # Update items if provided
    items_payload = p.get("items")
    if isinstance(items_payload, list):
        # Remove existing items not in payload
        existing_ids = {item.pk for item in obj.items.all()}
        payload_ids = {row.get("id") for row in items_payload if row.get("id")}
        to_delete = existing_ids - payload_ids
        if to_delete:
            StockPurchaseItem.objects.filter(pk__in=list(to_delete)).delete()
        # Update or create items
        for row in items_payload:
            item_id = row.get("id")
            if item_id and StockPurchaseItem.objects.filter(pk=item_id, vendor_detail=obj).exists():
                item = StockPurchaseItem.objects.get(pk=item_id, vendor_detail=obj)
            else:
                item = StockPurchaseItem(vendor_detail=obj)
            item.item_category = normalize_text(row.get("item_category", ""))
            item.item_name = normalize_text(row.get("item_name", ""))
            item.item_code = normalize_text(row.get("item_code", ""))
            item.quantity = _to_decimal(row.get("quantity"), "0")
            item.unit_price = _to_decimal(row.get("unit_price"), "0")
            item.total_price = item.quantity * item.unit_price
            item.save()

    return JsonResponse({'success': True, 'stock_purchase': _serialize(obj)})


@require_GET
def stock_purchase_item_trace_api_view(request, item_id):
    na = _ensure_authenticated(request)
    if na:
        return na

    item = StockPurchaseItem.objects.select_related("vendor_detail", "lce_estimate").filter(pk=item_id).first()
    if not item:
        return JsonResponse({"message": "Purchase item not found."}, status=404)

    modules = []
    lce = item.lce_estimate
    if lce:
        lce_code = f"LCE_{lce.pk:03d}"
        modules.append(
            {
                "module": "LCE",
                "label": lce_code,
                "id": lce.pk,
                "link": f"/projects/costing/record/{lce.pk}",
                "meta": {
                    "updated_at": lce.updated_at.isoformat() if lce.updated_at else "",
                },
            }
        )

        # Project linkage is inferred from LCE costing reference notes when they mention this LCE code.
        project_rows = (
            LCECostDetail.objects.select_related("project")
            .filter(project_id__isnull=False, reference_note__icontains=lce_code)
            .order_by("project__project_id")
        )
        seen_project_ids = set()
        for row in project_rows:
            project = row.project
            if not project or project.pk in seen_project_ids:
                continue
            seen_project_ids.add(project.pk)
            modules.append(
                {
                    "module": "Project",
                    "label": project.project_id or f"Project #{project.pk}",
                    "id": project.pk,
                    "link": f"/projects",
                    "meta": {
                        "project_name": project.project_name or "",
                        "linked_via": row.reference_note or "",
                    },
                }
            )

    return JsonResponse(
        {
            "item_trace": {
                "item": {
                    "id": item.pk,
                    "grn_number": item.grn_number,
                    "item_code": item.item_code,
                    "item_name": item.item_name,
                    "purchase_id": item.vendor_detail.purchase_id if item.vendor_detail else None,
                    "purchase_number": item.vendor_detail.invoice_number if item.vendor_detail else "",
                },
                "modules": modules,
            }
        }
    )

