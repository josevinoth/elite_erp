import json
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count, Q, Sum
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import ItemCategory, ItemType_info, LabFurnitureItem, LCECostDetail, LCEEstimate, ProjectCostingItemAllocation, ProjectCostingItemInfo, RetrievalStatusInfo, StockPurchaseItem, StockPurchaseVendorDetail, Vendor
from ..utils import normalize_text


def _safe_related(instance, attr_name):
    try:
        return getattr(instance, attr_name)
    except ObjectDoesNotExist:
        return None


def _vendor_name_from_purchase_item(item):
    vendor_detail = _safe_related(item, "vendor_detail")
    vendor = _safe_related(vendor_detail, "vendor") if vendor_detail else None
    return vendor.name if vendor else ""


def _purchase_date_from_purchase_item(item):
    vendor_detail = _safe_related(item, "vendor_detail")
    purchase_date = getattr(vendor_detail, "invoice_date", None) if vendor_detail else None
    return str(purchase_date) if purchase_date else ""


def _purchased_qty(item):
    purchase_qty = getattr(item, "purchase_qty", None)
    if purchase_qty not in (None, "") and Decimal(str(purchase_qty)) > 0:
        return Decimal(str(purchase_qty))
    return Decimal(str(getattr(item, "quantity", 0) or 0))


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


def _resolve_item_category(value):
    if value in (None, ""):
        return None
    if isinstance(value, int) or (isinstance(value, str) and str(value).isdigit()):
        return ItemCategory.objects.filter(pk=int(value)).first()
    raw = normalize_text(value)
    if not raw:
        return None
    return ItemCategory.objects.filter(name__iexact=raw).first()


def _resolve_item_master(value):
    if value in (None, ""):
        return None
    if isinstance(value, LabFurnitureItem):
        return value
    if isinstance(value, int) or (isinstance(value, str) and str(value).isdigit()):
        return LabFurnitureItem.objects.select_related("item_category", "uom", "item_type").filter(pk=int(value)).first()
    raw = normalize_text(value).upper()
    if not raw:
        return None
    return LabFurnitureItem.objects.select_related("item_category", "uom", "item_type").filter(item_code_ref__item_code__iexact=raw).first()


def _resolve_item_master_from_category_and_name(item_category, item_name):
    if not item_category:
        return None
    normalized_name = normalize_text(item_name)
    if not normalized_name:
        return None

    qs = LabFurnitureItem.objects.select_related("item_category", "uom", "item_type").filter(
        item_category=item_category,
        item_name_ref__item_name__iexact=normalized_name,
    ).order_by("id")

    # Keep backward compatibility by auto-resolving only deterministic mappings.
    if qs.count() == 1:
        return qs.first()
    return None


def _resolve_item_row_references(row):
    raw_category_id = row.get("item_category_id", row.get("item_category", ""))
    raw_item_name = row.get("item_name", "")
    raw_item_id = row.get("item_code_id", row.get("item_master_id", row.get("item_code", "")))
    item_category = _resolve_item_category(raw_category_id)
    item_master = _resolve_item_master(raw_item_id)

    if not item_master:
        item_master = _resolve_item_master_from_category_and_name(item_category, raw_item_name)

    if raw_category_id not in (None, "") and not item_category:
        raise ValueError("Selected item category was not found.")
    if raw_item_name not in (None, "") and not item_master:
        raise ValueError("Selected item name was not found for the chosen category.")
    if raw_item_id not in (None, "") and not item_master:
        raise ValueError("Selected item code was not found.")

    if item_master and item_category and item_master.item_category_id != item_category.pk:
        raise ValueError("Selected item name/code does not belong to the chosen category.")

    return item_category, item_master


def _resolve_item_type(value):
    if isinstance(value, ItemType_info):
        return value
    if value in (None, ""):
        return ItemType_info.objects.filter(pk=1).first()
    if isinstance(value, int) or (isinstance(value, str) and str(value).isdigit()):
        return ItemType_info.objects.filter(pk=int(value)).first() or ItemType_info.objects.filter(pk=1).first()
    raw = normalize_text(value)
    if not raw:
        return ItemType_info.objects.filter(pk=1).first()
    return ItemType_info.objects.filter(it_name__iexact=raw).first() or ItemType_info.objects.filter(pk=1).first()


def _serialize_vendor_detail(vendor_detail):
    if not vendor_detail:
        return None
    vendor = _safe_related(vendor_detail, "vendor")
    po = _safe_related(vendor_detail, "purchase_order")
    return {
        "id": vendor_detail.id,
        "vendor_id": vendor_detail.vendor_id,
        "vendor_name": vendor.name if vendor else "",
        "invoice_number": vendor_detail.invoice_number,
        "invoice_date": str(vendor_detail.invoice_date) if vendor_detail.invoice_date else "",
        "tax": str(vendor_detail.tax),
        "total_value": str(vendor_detail.total_value),
        "total_after_tax": str(getattr(vendor_detail, "total_after_tax", 0)),
        "purchase_id": vendor_detail.purchase_id,
        "purchase_order_id": po.id if po else None,
        "purchase_order_code": po.order_code if po else "",
    }


def _serialize_item(item, item_master_by_code=None):
    raw_grn = str(item.grn_number or "").strip()
    if raw_grn and not raw_grn.upper().startswith("GRN"):
        raw_grn = f"GRN{item.id:04d}"

    item_master = _safe_related(item, "item_code")
    if not item_master:
        item_master = _resolve_item_master_from_category_and_name(
            _safe_related(item, "item_category"),
            item.item_name,
        )
    item_category = _safe_related(item, "item_category") or _safe_related(item_master, "item_category")
    resolved_item_master_id = getattr(item, "item_code_id", None) or getattr(item_master, "id", None)

    # Pull item_name from Item Master if available, otherwise use item's item_name
    resolved_item_name = getattr(item_master, "item_name", None) if item_master else None
    if not resolved_item_name:
        resolved_item_name = item.item_name

    # Pull uom and item_type from Item Master
    resolved_uom = _safe_related(item_master, "uom") or _safe_related(item, "uom")
    resolved_item_type = _safe_related(item_master, "item_type") or _safe_related(item, "item_type")
    item_type_name = getattr(resolved_item_type, "it_name", None) or "BUY"
    item_type_id = getattr(resolved_item_type, "pk", None)
    purchase_qty = _purchased_qty(item)

    return {
        "id": item.id,
        "grn_number": raw_grn,
        "item_category": item_category.name if item_category else "",
        "item_category_id": getattr(item, "item_category_id", None) or getattr(item_master, "item_category_id", None),
        "item_name": resolved_item_name,
        "item_code": getattr(item_master, "item_code", "") if item_master else "",
        "item_code_id": resolved_item_master_id,
        "item_master_id": resolved_item_master_id,
        "item_type": item_type_name,
        "item_type_id": item_type_id,
        "quantity": str(item.quantity),
        "purchase_qty": str(purchase_qty),
        "unit_price": str(item.unit_price),
        "total_price": str(item.total_price),
        "tax": str(getattr(item, "tax", 0)),
        "total_after_tax": str(getattr(item, "total_after_tax", 0)),
        "lce_cost": str(item.lce_cost),
        "lce_estimate_id": item.lce_estimate_id,
        "uom_id": getattr(resolved_uom, "pk", None),
        "uom_name": getattr(resolved_uom, "name", None),
        "uom_symbol": getattr(resolved_uom, "symbol", None),
        "po_item_id": getattr(item, "po_item_id", None),
        "po_order_qty": str(item.po_item.order_qty) if getattr(item, "po_item", None) else "",
        "combined_label": getattr(item.po_item, "combined_label", "") if getattr(item, "po_item", None) else "",
    }


def _serialize(obj):
    items_qs = obj.items.all() if hasattr(obj, 'items') else []
    items = list(items_qs) if items_qs else []
    first_item = items[0] if items else None
    vendor_detail = _serialize_vendor_detail(obj)

    vendor = _safe_related(obj, "vendor")
    first_item_category = _safe_related(first_item, "item_category") if first_item else None

    po = _safe_related(obj, "purchase_order")
    return {
        "id": obj.pk,
        "purchase_number": obj.purchase_id,
        "vendor_detail": vendor_detail,
        "notes": obj.notes or "",
        "status_id": obj.status_id,
        "purchase_order_id": po.id if po else None,
        "purchase_order_code": po.order_code if po else "",
        "items": [_serialize_item(item) for item in items] if items else [],
        # Legacy/compatibility fields for lists view
        "purchase_id": getattr(obj, "purchase_id", obj.pk),
        "invoice_number": obj.invoice_number,
        "invoice_date": str(obj.invoice_date) if obj.invoice_date else "",
        "tax": str(obj.tax),
        "total_value": str(obj.total_value),
        "total_after_tax": str(getattr(obj, "total_after_tax", 0)),
        "vendor_id": vendor.pk if vendor else None,
        "vendor_name": vendor.name if vendor else None,
        "items_count": len(items),
        "lce_linked_count": sum(1 for item in items if getattr(item, 'lce_estimate_id', None)),
        "purchase_total": str(sum((getattr(item, 'total_price', 0) for item in items), Decimal("0"))),
        # legacy keys for UI compatibility in list view
        "item_name": first_item.item_name if first_item else "",
        "category": (first_item_category.name if first_item_category else ""),
        "vendor": vendor.name if vendor else "",
        "quantity": str(first_item.quantity) if first_item else "0",
        "unit_price": str(first_item.unit_price) if first_item else "0",
        "total_price": str(first_item.total_price) if first_item else "0",
        "status": None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else "",
        "updated_on": obj.updated_at.strftime("%Y-%m-%d %H:%M:%S") if obj.updated_at else "",
        "updated_by": getattr(obj, "updated_by", "") or "",
    }


def _resolve_item_master_by_code_or_id(item_code):
    normalized = normalize_text(item_code)
    if not normalized:
        return None
    if normalized.isdigit():
        return LabFurnitureItem.objects.filter(pk=int(normalized)).first()
    return LabFurnitureItem.objects.filter(item_code_ref__item_code__iexact=normalized).first()


def _purchase_items_for_item_master(item_master):
    code_value = normalize_text(getattr(item_master, "item_code", ""))
    qs = StockPurchaseItem.objects.select_related(
        "vendor_detail__vendor",
        "item_code",
        "po_item__order",
    )
    if code_value:
        return list(
            qs.filter(
                Q(item_code=item_master) | Q(item_code__item_code_ref__item_code__iexact=code_value)
            )
            .order_by("vendor_detail__invoice_date", "id")
            .distinct()
        )
    return list(qs.filter(item_code=item_master).order_by("vendor_detail__invoice_date", "id"))


def _allocation_totals_for_purchase_items(purchase_item_ids):
    purchase_item_ids = list(purchase_item_ids)
    if not purchase_item_ids:
        return {}

    consumed_rows = ProjectCostingItemAllocation.objects.filter(
        purchase_item_id__in=purchase_item_ids,
        retrieval_status__status_name__in=[
            RetrievalStatusInfo.STATUS_ITEM_SUPPLIED,
            RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
            RetrievalStatusInfo.STATUS_ITEM_RETURN,
            RetrievalStatusInfo.STATUS_ITEM_RETURN_ACCEPTED,
        ],
    ).values("purchase_item_id").annotate(
        allocated_total=Sum("allocated_qty"),
        returned_total=Sum("returned_qty"),
    )

    consumed_by_id = {}
    for row in consumed_rows:
        pid = row["purchase_item_id"]
        net_qty = Decimal(str(row["allocated_total"] or 0)) - Decimal(str(row["returned_total"] or 0))
        if net_qty < 0:
            net_qty = Decimal("0")
        consumed_by_id[pid] = net_qty
    for pid in purchase_item_ids:
        consumed_by_id.setdefault(pid, Decimal("0"))

    legacy_rows = ProjectCostingItemInfo.objects.filter(
        purchase_item_id__in=purchase_item_ids,
        grn_allocations__isnull=True,
        retrieval_status__status_name__in=[
            RetrievalStatusInfo.STATUS_ITEM_SUPPLIED,
            RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
            RetrievalStatusInfo.STATUS_ITEM_RETURN,
            RetrievalStatusInfo.STATUS_ITEM_RETURN_ACCEPTED,
        ],
    ).values(
        "purchase_item_id",
        "retrieval_status__status_name",
        "requested_qty",
        "accepted_qty",
    )
    for row in legacy_rows:
        status_name = row["retrieval_status__status_name"]
        qty = row["requested_qty"] if status_name == RetrievalStatusInfo.STATUS_ITEM_SUPPLIED else row["accepted_qty"]
        consumed_by_id[row["purchase_item_id"]] += Decimal(str(qty or 0))
    return consumed_by_id


def sync_purchase_item_consumed_quantities(purchase_item_ids, *, refresh_master=True):
    ids = {int(value) for value in purchase_item_ids if value is not None}
    if not ids:
        return {}
    consumed_by_id = _allocation_totals_for_purchase_items(ids)
    purchase_items = {
        row.pk: row
        for row in StockPurchaseItem.objects.filter(pk__in=ids).only(
            "id", "quantity", "purchase_qty", "item_code_id"
        )
    }
    changed_master_ids = set()
    for purchase_item_id, consumed_qty in consumed_by_id.items():
        purchase_item = purchase_items.get(purchase_item_id)
        if not purchase_item:
            continue
        updates = {}
        if purchase_item.purchase_qty <= 0 and purchase_item.quantity > 0:
            updates["purchase_qty"] = purchase_item.quantity
        if purchase_item.quantity != consumed_qty:
            updates["quantity"] = consumed_qty
        if updates:
            StockPurchaseItem.objects.filter(pk=purchase_item_id).update(**updates)
        if purchase_item.item_code_id:
            changed_master_ids.add(purchase_item.item_code_id)
    if refresh_master and changed_master_ids:
        _update_master_stock_quantities(changed_master_ids)
    return consumed_by_id


def _downstream_reasons_for_purchase_items(purchase_item_ids):
    ids = [int(v) for v in (purchase_item_ids or []) if str(v).isdigit()]
    reasons_by_id = {pid: [] for pid in ids}
    if not ids:
        return reasons_by_id

    for row in StockPurchaseItem.objects.filter(id__in=ids).values("id", "lce_estimate_id"):
        if row.get("lce_estimate_id"):
            reasons_by_id[row["id"]].append("linked to an LCE estimate")

    allocation_counts = (
        ProjectCostingItemAllocation.objects.filter(purchase_item_id__in=ids)
        .values("purchase_item_id")
        .annotate(total=Count("id"))
    )
    for row in allocation_counts:
        total = int(row.get("total") or 0)
        if total > 0:
            label = "allocation" if total == 1 else "allocations"
            reasons_by_id[row["purchase_item_id"]].append(f"used in {total} project costing {label}")

    return reasons_by_id


def _blocked_delete_message(items):
    if not items:
        return ""

    reasons_by_id = _downstream_reasons_for_purchase_items([item.id for item in items])
    blocked_lines = []
    for item in items:
        reasons = reasons_by_id.get(item.id) or []
        if not reasons:
            continue
        grn = normalize_text(getattr(item, "grn_number", "")) or f"Item #{item.id}"
        blocked_lines.append(f"{grn} ({'; '.join(reasons)})")

    if not blocked_lines:
        return ""

    return "Cannot delete downstream-linked GRN row(s): " + ", ".join(blocked_lines) + "."


@require_GET
def purchase_item_grns_api_view(request, item_code):
    na = _ensure_authenticated(request)
    if na:
        return na

    item_master = _resolve_item_master_by_code_or_id(item_code)
    if not item_master:
        return JsonResponse({"message": "Item code not found."}, status=404)

    purchase_items = _purchase_items_for_item_master(item_master)
    consumed_by_id = _allocation_totals_for_purchase_items([row.id for row in purchase_items])

    payload = []
    for row in purchase_items:
        purchased_qty = _purchased_qty(row)
        consumed_qty = consumed_by_id.get(row.id, Decimal("0"))
        balance_qty = purchased_qty - consumed_qty
        if balance_qty < 0:
            balance_qty = Decimal("0")
        payload.append(
            {
                "id": row.id,
                "grn_number": row.grn_number,
                "vendor": _vendor_name_from_purchase_item(row),
                "purchase_date": _purchase_date_from_purchase_item(row),
                "purchase_qty": str(purchased_qty),
                "cost": str(row.unit_price),
                "total_price": str(row.total_price),
                "invoice_number": row.vendor_detail.invoice_number if row.vendor_detail else "",
                "purchase_id": row.vendor_detail.purchase_id if row.vendor_detail else "",
                "po_number": row.po_item.order.order_code if row.po_item_id and row.po_item.order_id else "",
                "consumed_qty": str(consumed_qty),
                "balance_qty": str(balance_qty),
            }
        )

    return JsonResponse(
        {
            "item_code": item_master.item_code,
            "item_code_id": item_master.pk,
            "grns": payload,
        }
    )


@require_GET
def stock_item_summary_api_view(request, item_code):
    na = _ensure_authenticated(request)
    if na:
        return na

    item_master = _resolve_item_master_by_code_or_id(item_code)
    if not item_master:
        return JsonResponse({"message": "Item code not found."}, status=404)

    purchase_items = _purchase_items_for_item_master(item_master)
    consumed_by_id = _allocation_totals_for_purchase_items([row.id for row in purchase_items])

    summary_rows = []
    for row in purchase_items:
        purchased_qty = _purchased_qty(row)
        consumed_qty = consumed_by_id.get(row.id, Decimal("0"))
        balance_qty = purchased_qty - consumed_qty
        if balance_qty < 0:
            balance_qty = Decimal("0")
        summary_rows.append(
            {
                "purchase_item_id": row.id,
                "grn_number": row.grn_number,
                "vendor": _vendor_name_from_purchase_item(row),
                "purchase_date": _purchase_date_from_purchase_item(row),
                "purchased_qty": str(purchased_qty),
                "consumed_qty": str(consumed_qty),
                "balance_qty": str(balance_qty),
                "unit_price": str(row.unit_price),
            }
        )

    return JsonResponse(
        {
            "item_code": item_master.item_code,
            "item_code_id": item_master.pk,
            "summary": summary_rows,
        }
    )


@require_GET
def stock_purchase_item_consumed_projects_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na

    purchase_item = (
        StockPurchaseItem.objects.select_related(
            "item_code__item_code_ref",
            "item_category",
        )
        .filter(pk=pk)
        .first()
    )
    if not purchase_item:
        return JsonResponse({"message": "Stock purchase item not found."}, status=404)

    consumed_statuses = [
        RetrievalStatusInfo.STATUS_ITEM_SUPPLIED,
        RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
        RetrievalStatusInfo.STATUS_ITEM_RETURN,
        RetrievalStatusInfo.STATUS_ITEM_RETURN_ACCEPTED,
    ]
    allocation_status_filter = Q(retrieval_status__status_name__in=consumed_statuses) | Q(
        retrieval_status__isnull=True,
        costing_item__retrieval_status__status_name__in=consumed_statuses,
    )
    allocation_rows = (
        ProjectCostingItemAllocation.objects.filter(purchase_item_id=purchase_item.pk)
        .filter(allocation_status_filter)
        .values(
            "costing_item__costing_id__project_id",
            "costing_item__costing_id__project__project_id",
            "costing_item__costing_id__project__project_name",
        )
        .annotate(
            allocated_total=Sum("allocated_qty"),
            returned_total=Sum("returned_qty"),
        )
    )

    projects_by_id = {}
    for row in allocation_rows:
        project_id = row["costing_item__costing_id__project_id"]
        consumed_qty = (row["allocated_total"] or Decimal("0")) - (row["returned_total"] or Decimal("0"))
        if project_id is None or consumed_qty <= 0:
            continue
        project = projects_by_id.setdefault(project_id, {
            "project_id": row["costing_item__costing_id__project__project_id"] or "",
            "project_name": row["costing_item__costing_id__project__project_name"] or "",
            "consumed_qty": Decimal("0"),
        })
        project["consumed_qty"] += consumed_qty

    legacy_rows = ProjectCostingItemInfo.objects.filter(
        purchase_item_id=purchase_item.pk,
        grn_allocations__isnull=True,
        retrieval_status__status_name__in=consumed_statuses,
    ).values(
        "costing_id__project_id",
        "costing_id__project__project_id",
        "costing_id__project__project_name",
        "retrieval_status__status_name",
        "requested_qty",
        "accepted_qty",
    )
    for row in legacy_rows:
        project_id = row["costing_id__project_id"]
        qty = (
            row["requested_qty"]
            if row["retrieval_status__status_name"] == RetrievalStatusInfo.STATUS_ITEM_SUPPLIED
            else row["accepted_qty"]
        )
        consumed_qty = Decimal(str(qty or 0))
        if project_id is None or consumed_qty <= 0:
            continue
        project = projects_by_id.setdefault(project_id, {
            "project_id": row["costing_id__project__project_id"] or "",
            "project_name": row["costing_id__project__project_name"] or "",
            "consumed_qty": Decimal("0"),
        })
        project["consumed_qty"] += consumed_qty

    projects = []
    for project in projects_by_id.values():
        project["consumed_qty"] = str(project["consumed_qty"])
        projects.append(project)
    projects.sort(key=lambda project: (project["project_id"] or "").lower())
    total_consumed_qty = sum(
        (Decimal(str(project["consumed_qty"])) for project in projects),
        Decimal("0"),
    )
    item_master = purchase_item.item_code
    item_code = (
        item_master.item_code_ref.item_code
        if item_master and item_master.item_code_ref
        else ""
    )

    return JsonResponse({
        "success": True,
        "purchase_item_id": purchase_item.pk,
        "grn_number": purchase_item.grn_number,
        "item_code": item_code,
        "item_name": purchase_item.item_name,
        "item_category": purchase_item.item_category.name if purchase_item.item_category else "",
        "purchase_qty": str(_purchased_qty(purchase_item)),
        "total_consumed_qty": str(total_consumed_qty),
        "projects": projects,
    })


@require_GET
def stock_purchase_item_delete_check_api_view(request, item_id):
    na = _ensure_authenticated(request)
    if na:
        return na

    item = StockPurchaseItem.objects.filter(pk=item_id).first()
    if not item:
        return JsonResponse({"message": "Purchase item not found."}, status=404)

    message = _blocked_delete_message([item])
    can_delete = not bool(message)
    return JsonResponse(
        {
            "can_delete": can_delete,
            "message": message or "This purchase item row can be deleted.",
            "grn_number": item.grn_number,
            "item_id": item.id,
        }
    )


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
        total_after_tax=_to_decimal(vendor_payload.get("total_after_tax"), "0"),
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
        bal_rate = getattr(estimate, "bank_exchange_rate_balance", None) or Decimal("0")
        estimate.balance_payment_value_omr = estimate.balance_payment_value * bal_rate
        estimate.total_supplier_price_omr = estimate.advance_payment_value_omr + estimate.balance_payment_value_omr
        estimate.total = (
            estimate.total_supplier_price_omr
            + estimate.bank_muscat_charge_advance_payment
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
            item = StockPurchaseItem(vendor_detail=stock_purchase)

        item_category, item_master = _resolve_item_row_references(row)
        item.item_code = item_master
        item.item_category = item_category or (item_master.item_category if item_master else None)
        item.item_name = item_master.item_name if item_master else item_name
        item.item_type = _resolve_item_type(row.get("item_type", getattr(item, "item_type_id", None)))
        purchased_qty = _to_decimal(row.get("purchase_qty", row.get("quantity")), "0")
        consumed_qty = (
            _allocation_totals_for_purchase_items([item.pk]).get(item.pk, Decimal("0"))
            if item.pk else Decimal("0")
        )
        if purchased_qty < consumed_qty:
            raise ValueError(
                f"Purchased Qty for {item.grn_number or 'this GRN'} cannot be less than "
                f"its consumed quantity ({consumed_qty})."
            )
        item.purchase_qty = purchased_qty
        item.quantity = consumed_qty
        item.unit_price = _to_decimal(row.get("unit_price"), "0")
        item.tax = _to_decimal(row.get("tax"), "0")
        item.total_price = item.purchase_qty * item.unit_price
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
        code = str(row.get("item_code_id") or row.get("item_master_id") or row.get("item_code") or "").strip().upper()
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
        int(row.get("item_code_id") or row.get("item_master_id"))
        for row in items_payload
        if str(row.get("item_code_id") or row.get("item_master_id") or "").isdigit()
    }
    if not candidate_codes:
        return None

    for code in candidate_codes:
        qs = StockPurchaseItem.objects.filter(
            vendor_detail__invoice_number__iexact=invoice,
            item_code_id=code,
        )
        if exclude_purchase_id:
            qs = qs.exclude(vendor_detail_id=exclude_purchase_id)
        if qs.exists():
            return str(code)
    return None


def sync_all_master_item_physical_qty():
    """
    Recalculates available physical stock from received and consumed GRN quantities,
    then updates the related order recommendation totals.
    """
    purchase_item_ids = list(
        StockPurchaseItem.objects.filter(item_code__isnull=False).values_list("id", flat=True)
    )
    sync_purchase_item_consumed_quantities(purchase_item_ids, refresh_master=False)
    _update_master_stock_quantities()


def _update_master_stock_quantities(item_master_ids=None):
    purchase_items = StockPurchaseItem.objects.filter(item_code__isnull=False)
    if item_master_ids is not None:
        purchase_items = purchase_items.filter(item_code_id__in=item_master_ids)

    purchased_by_item = dict(
        purchase_items.values("item_code_id")
        .annotate(tot=Sum("purchase_qty"))
        .values_list("item_code_id", "tot")
    )
    consumed_by_item = dict(
        purchase_items.values("item_code_id")
        .annotate(tot=Sum("quantity"))
        .values_list("item_code_id", "tot")
    )
    purchased_by_code = dict(
        purchase_items.filter(item_code__item_code_ref__isnull=False)
        .values("item_code__item_code_ref__item_code")
        .annotate(tot=Sum("purchase_qty"))
        .values_list("item_code__item_code_ref__item_code", "tot")
    )
    consumed_by_code = dict(
        purchase_items.filter(item_code__item_code_ref__isnull=False)
        .values("item_code__item_code_ref__item_code")
        .annotate(tot=Sum("quantity"))
        .values_list("item_code__item_code_ref__item_code", "tot")
    )

    all_masters = LabFurnitureItem.objects.select_related("item_code_ref")
    if item_master_ids is not None:
        all_masters = all_masters.filter(pk__in=item_master_ids)
    for m in all_masters:
        code = m.item_code_ref.item_code.strip().upper() if m.item_code_ref else ""
        purchased_qty = purchased_by_item.get(m.id) or (
            purchased_by_code.get(code) if code else None
        ) or Decimal("0")
        consumed_qty = consumed_by_item.get(m.id) or (
            consumed_by_code.get(code) if code else None
        ) or Decimal("0")
        new_phys = max(purchased_qty - consumed_qty, Decimal("0"))

        ord_qty = Decimal(str(m.ordered_qty or 0))
        tot_req = Decimal(str(m.total_reqd or 0))
        rec_free = Decimal(str(m.recommended_free_stock_qty or 0))

        phys_plus_ord = new_phys + ord_qty
        to_ord = tot_req - phys_plus_ord
        to_ord_inc = tot_req + rec_free - phys_plus_ord

        if (m.physical_qty != new_phys or
            m.physical_plus_ordered_qty != phys_plus_ord or
            m.to_order_qty != to_ord or
            m.to_order_qty_including_free_stock != to_ord_inc):
            m.physical_qty = new_phys
            m.physical_plus_ordered_qty = phys_plus_ord
            m.to_order_qty = to_ord
            m.to_order_qty_including_free_stock = to_ord_inc
            m.save(update_fields=[
                "physical_qty",
                "physical_plus_ordered_qty",
                "to_order_qty",
                "to_order_qty_including_free_stock",
            ])


@require_GET
def list_stock_purchases_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    rows = StockPurchaseVendorDetail.objects.select_related("vendor").prefetch_related(
        "items__item_category",
        "items__item_code",
        "items__item_code__item_category",
        "items__item_code__uom",
        "items__item_code__item_type",
    ).order_by("-id")
    purchases = [_serialize(row) for row in rows]
    purchase_item_ids = [
        item["id"]
        for purchase in purchases
        for item in purchase["items"]
    ]
    consumed_by_id = sync_purchase_item_consumed_quantities(purchase_item_ids)

    for purchase in purchases:
        for item in purchase["items"]:
            purchased_qty = Decimal(str(item.get("purchase_qty") or item.get("quantity") or 0))
            consumed_qty = consumed_by_id.get(item["id"], Decimal("0"))
            item["quantity"] = str(consumed_qty)
            item["consumed_qty"] = str(consumed_qty)
            item["balance_qty"] = str(max(purchased_qty - consumed_qty, Decimal("0")))

    return JsonResponse({"stock_purchases": purchases})


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

    po_id = p.get("purchase_order_id")
    po = None
    if po_id:
        from ..sub_models.place_stock_order_mod import PlaceStockOrderInfo
        po = PlaceStockOrderInfo.objects.filter(pk=po_id).first()

    obj = StockPurchaseVendorDetail.objects.create(
        vendor=vendor,
        purchase_order=po,
        invoice_number=invoice_number,
        invoice_date=p.get("invoice_date") or None,
        tax=_to_decimal(p.get("tax"), "0"),
        total_value=_to_decimal(p.get("total_value"), "0"),
        total_after_tax=_to_decimal(p.get("total_after_tax"), "0"),
        notes=p.get("notes", ""),
        status_id=p.get("status_id"),
    )

    items_payload = p.get("items") or []
    try:
        for row in items_payload:
            item_category, item_master = _resolve_item_row_references(row)
            po_item_id = row.get("po_item_id")
            po_item = None
            if po_item_id:
                from ..sub_models.place_stock_order_mod import PlaceStockOrderItem
                po_item = PlaceStockOrderItem.objects.filter(pk=po_item_id).first()
            elif po and item_master:
                po_item = po.items.filter(item_code_ref=item_master).first()

            item = StockPurchaseItem(
                vendor_detail=obj,
                po_item=po_item,
                item_category=item_category or (item_master.item_category if item_master else None),
                item_name=item_master.item_name if item_master else normalize_text(row.get("item_name", "")),
                item_code=item_master,
                quantity=Decimal("0"),
                purchase_qty=_to_decimal(row.get("purchase_qty", row.get("quantity")), "0"),
                unit_price=_to_decimal(row.get("unit_price"), "0"),
                tax=_to_decimal(row.get("tax"), "0"),
            )
            item.total_price = item.purchase_qty * item.unit_price
            item.save()

        # Sync vendor detail totals from saved items
        saved_items = list(obj.items.all())
        obj.total_value = sum((i.total_price for i in saved_items), Decimal("0"))
        obj.total_after_tax = sum((i.total_after_tax for i in saved_items), Decimal("0"))
        obj.save(update_fields=["total_value", "total_after_tax", "updated_at"])

        if po:
            from .place_stock_order_api import update_po_status_from_grn
            update_po_status_from_grn(po)
        sync_all_master_item_physical_qty()
    except ValueError as exc:
        obj.delete()
        return JsonResponse({"message": str(exc)}, status=400)

    return JsonResponse({"success": True, "stock_purchase": _serialize(obj)}, status=201)


@require_http_methods(['GET', 'PATCH', 'DELETE'])
@csrf_protect
def stock_purchase_detail_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na
    try:
        obj = StockPurchaseVendorDetail.objects.prefetch_related(
            "items__item_category",
            "items__item_code",
            "items__item_code__item_category",
            "items__item_code__uom",
            "items__item_code__item_type",
        ).get(pk=pk)
    except StockPurchaseVendorDetail.DoesNotExist:
        return JsonResponse({'message': 'Record not found.'}, status=404)

    if request.method == 'GET':
        items = list(obj.items.all())
        consumed_by_id = sync_purchase_item_consumed_quantities(item.pk for item in items)
        for item in items:
            item.quantity = consumed_by_id.get(item.pk, Decimal("0"))
        return JsonResponse({'stock_purchase': _serialize(obj)})

    if request.method == 'DELETE':
        po = obj.purchase_order
        obj.delete()
        if po:
            from .place_stock_order_api import update_po_status_from_grn
            update_po_status_from_grn(po)
        sync_all_master_item_physical_qty()
        return JsonResponse({'success': True, 'message': 'Deleted.'})

    p = _read_json(request)

    old_po = obj.purchase_order
    if "purchase_order_id" in p:
        new_po_id = p.get("purchase_order_id")
        if new_po_id:
            from ..sub_models.place_stock_order_mod import PlaceStockOrderInfo
            obj.purchase_order = PlaceStockOrderInfo.objects.filter(pk=new_po_id).first()
        else:
            obj.purchase_order = None

    obj.invoice_number = normalize_text(p.get("invoice_number", obj.invoice_number))
    obj.invoice_date = p.get("invoice_date", obj.invoice_date)
    obj.tax = _to_decimal(p.get("tax", obj.tax))
    obj.total_value = _to_decimal(p.get("total_value", obj.total_value))
    if "total_after_tax" in p:
        obj.total_after_tax = _to_decimal(p.get("total_after_tax", obj.total_after_tax))
    obj.notes = p.get("notes", obj.notes)
    obj.status_id = p.get("status_id", obj.status_id)
    obj.save()

    # Update items if provided
    items_payload = p.get("items")
    if isinstance(items_payload, list):
        try:
            # Remove existing items not in payload
            existing_ids = {item.pk for item in obj.items.all()}
            payload_ids = {row.get("id") for row in items_payload if row.get("id")}
            to_delete = existing_ids - payload_ids
            if to_delete:
                delete_rows = list(StockPurchaseItem.objects.filter(pk__in=list(to_delete)).only("id", "grn_number", "lce_estimate_id"))
                blocked_message = _blocked_delete_message(delete_rows)
                if blocked_message:
                    return JsonResponse({"status": "warning", "message": blocked_message}, status=400)
                StockPurchaseItem.objects.filter(pk__in=list(to_delete)).delete()
            # Update or create items
            for row in items_payload:
                item_id = row.get("id")
                if item_id and StockPurchaseItem.objects.filter(pk=item_id, vendor_detail=obj).exists():
                    item = StockPurchaseItem.objects.get(pk=item_id, vendor_detail=obj)
                else:
                    item = StockPurchaseItem(vendor_detail=obj)
                item_category, item_master = _resolve_item_row_references(row)
                item.item_category = item_category or (item_master.item_category if item_master else None)
                item.item_name = item_master.item_name if item_master else normalize_text(row.get("item_name", ""))
                item.item_code = item_master
                po_item_id = row.get("po_item_id")
                if po_item_id:
                    item.po_item_id = po_item_id
                elif obj.purchase_order and item.item_code:
                    matched = obj.purchase_order.items.filter(item_code_ref=item.item_code).first()
                    if matched:
                        item.po_item_id = matched.id
                purchased_qty = _to_decimal(row.get("purchase_qty", row.get("quantity")), "0")
                consumed_qty = _allocation_totals_for_purchase_items([item.pk]).get(item.pk, Decimal("0"))
                if purchased_qty < consumed_qty:
                    return JsonResponse(
                        {
                            "message": (
                                f"Purchased Qty for {item.grn_number or 'this GRN'} cannot be less than "
                                f"its consumed quantity ({consumed_qty})."
                            )
                        },
                        status=400,
                    )
                item.purchase_qty = purchased_qty
                item.quantity = consumed_qty
                item.unit_price = _to_decimal(row.get("unit_price"), "0")
                item.tax = _to_decimal(row.get("tax"), "0")
                item.total_price = item.purchase_qty * item.unit_price
                item.save()

            # Recalculate vendor detail totals from saved items
            saved_items = list(obj.items.all())
            obj.total_value = sum((i.total_price for i in saved_items), Decimal("0"))
            obj.total_after_tax = sum((i.total_after_tax for i in saved_items), Decimal("0"))
            obj.save(update_fields=["total_value", "total_after_tax", "updated_at"])

            from .place_stock_order_api import update_po_status_from_grn
            if obj.purchase_order:
                update_po_status_from_grn(obj.purchase_order)
            if old_po and old_po != obj.purchase_order:
                update_po_status_from_grn(old_po)
            sync_all_master_item_physical_qty()
        except ValueError as exc:
            return JsonResponse({"message": str(exc)}, status=400)

    return JsonResponse({'success': True, 'stock_purchase': _serialize(obj)})


@require_GET
def stock_purchase_item_trace_api_view(request, item_id):
    na = _ensure_authenticated(request)
    if na:
        return na

    item = StockPurchaseItem.objects.select_related("vendor_detail", "lce_estimate", "item_code").filter(pk=item_id).first()
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
                    "item_code": getattr(_safe_related(item, "item_code"), "item_code", "") if getattr(item, "item_code_id", None) else "",
                    "item_name": item.item_name,
                    "purchase_id": getattr(_safe_related(item, "vendor_detail"), "purchase_id", None),
                    "purchase_number": getattr(_safe_related(item, "vendor_detail"), "invoice_number", "") or "",
                },
                "modules": modules,
            }
        }
    )
