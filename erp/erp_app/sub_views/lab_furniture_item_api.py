from collections import defaultdict
import json
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError
from django.db.models import Case, DecimalField, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import (
    ItemCategory,
    ItemCodeName,
    LabFurnitureItem,
    UOM,
    ItemType_info,
    ProjectCostingItemAllocation,
    ProjectCostingItemInfo,
    ProjectQuotationItemInfo,
    RetrievalStatusInfo,
)
from ..utils import normalize_text


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return None


def _read_json(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (TypeError, ValueError):
        return {}


def _normalize_code(value):
    return normalize_text(value).upper()[:20]


def _serialize_category(obj):
    return {
        "id": obj.pk,
        "name": obj.name,
    }


def _serialize_item_code_name(obj):
    updated_by_user = getattr(obj, "updated_by", None)
    updated_by_name = ""
    if updated_by_user:
        updated_by_name = (
            getattr(updated_by_user, "get_full_name", lambda: "")()
            or getattr(updated_by_user, "username", "")
            or str(updated_by_user)
        )
    return {
        "id": obj.pk,
        "item_code": obj.item_code,
        "item_name": obj.item_name,
        "item_category_id": getattr(obj, "item_category_id", None),
        "item_category": obj.item_category.name if getattr(obj, "item_category_id", None) else "",
        "procurement_classification": getattr(obj, "procurement_classification", "") or "",
        "business_criticality": getattr(obj, "business_criticality", "") or "",
        "label": f"{obj.item_code} - {obj.item_name}",
        "updated_at": getattr(obj, "updated_at", None).isoformat() if getattr(obj, "updated_at", None) else "",
        "updated_on": getattr(obj, "updated_at", None).strftime("%Y-%m-%d %H:%M:%S") if getattr(obj, "updated_at", None) else "",
        "updated_by": updated_by_name,
    }


def _resolve_existing_category(value):
    if value in (None, ""):
        return None

    if isinstance(value, ItemCategory):
        return value

    if isinstance(value, int) or (isinstance(value, str) and str(value).isdigit()):
        return ItemCategory.objects.filter(pk=int(value)).first()

    raw = normalize_text(value)
    if not raw:
        return None

    return ItemCategory.objects.filter(name__iexact=raw).first()


def _resolve_category(value):
    if value in (None, ""):
        return None

    if isinstance(value, ItemCategory):
        return value

    if isinstance(value, int) or (isinstance(value, str) and str(value).isdigit()):
        return ItemCategory.objects.filter(pk=int(value)).first()

    raw = normalize_text(value)
    if not raw:
        return None

    category = ItemCategory.objects.filter(name__iexact=raw).first()
    if category:
        return category

    return ItemCategory.objects.create(name=raw)


def _category_exists_case_insensitive(name):
    return ItemCategory.objects.filter(name__iexact=normalize_text(name)).exists()


def _resolve_item_code_name(lookup_id=None, code=None, name=None):
    if lookup_id not in (None, ""):
        return ItemCodeName.objects.filter(pk=lookup_id).first()

    normalized_code = _normalize_code(code)
    if normalized_code:
        return ItemCodeName.objects.filter(item_code__iexact=normalized_code).first()

    normalized_name = normalize_text(name)
    if normalized_name:
        return ItemCodeName.objects.filter(item_name__iexact=normalized_name).first()

    return None


def _format_qty_number(val):
    if val in (None, ""):
        return 0
    try:
        d = Decimal(str(val)).quantize(Decimal("0.01"))
        if d == d.to_integral():
            return int(d)
        return float(d)
    except Exception:
        return 0


def _serialize(
    obj,
    calculated_total_reqd=None,
    calculated_ordered_qty=None,
    calculated_physical_qty=None,
    calculated_consumed_qty=None,
):
    item_category_id = getattr(obj, "item_category_id", None)
    uom_id = getattr(obj, "uom_id", None)
    item_type_id = getattr(obj, "item_type_id", None)
    updated_by_id = getattr(obj, "updated_by_id", None)

    if calculated_total_reqd is not None:
        total_reqd_dec = _to_decimal(calculated_total_reqd, "0")
    else:
        total_reqd_dec = _to_decimal(getattr(obj, "total_reqd", 0), "0")

    if calculated_physical_qty is not None:
        physical_qty = _to_decimal(calculated_physical_qty, "0")
    else:
        physical_qty = _to_decimal(getattr(obj, "physical_qty", 0), "0")
    if calculated_ordered_qty is not None:
        ordered_qty = _to_decimal(calculated_ordered_qty, "0")
    else:
        ordered_qty = _to_decimal(getattr(obj, "ordered_qty", 0), "0")
    physical_plus_ordered = physical_qty + ordered_qty
    recommended_free_stock = _to_decimal(getattr(obj, "recommended_free_stock_qty", 0), "0")
    to_order = total_reqd_dec - physical_plus_ordered
    to_order_including_free_stock = total_reqd_dec + recommended_free_stock - physical_plus_ordered

    return {
        "id": obj.pk,
        "item_code_ref_id": getattr(obj, "item_code_ref_id", None),
        "item_name_ref_id": getattr(obj, "item_name_ref_id", None),
        "item_code": obj.item_code,
        "item_name": obj.item_name,
        "procurement_classification": getattr(obj, "procurement_classification", "") or "",
        "business_criticality": getattr(obj, "business_criticality", "") or "",
        "item_category": obj.item_category.name if item_category_id else "",
        "item_category_id": item_category_id,
        "uom": f"{obj.uom.name} ({obj.uom.symbol})" if uom_id else "",
        "uom_id": uom_id,
        "item_type": obj.item_type.it_name if item_type_id else "",
        "item_type_id": item_type_id,
        "length": str(obj.length),
        "width": str(obj.width),
        "height": str(obj.height),
        "volume": str(obj.volume),
        "recommended_free_stock_qty": _format_qty_number(recommended_free_stock),
        "warning_alert_qty": _format_qty_number(getattr(obj, "warning_alert_qty", 0)),
        "to_order_qty": _format_qty_number(to_order),
        "to_order_qty_including_free_stock": _format_qty_number(to_order_including_free_stock),
        "physical_plus_ordered_qty": _format_qty_number(physical_plus_ordered),
        "physical_qty": _format_qty_number(physical_qty),
        "ordered_qty": _format_qty_number(ordered_qty),
        "consumed_qty": _format_qty_number(calculated_consumed_qty),
        "total_reqd": _format_qty_number(total_reqd_dec),
        "updated_by": obj.updated_by.username if updated_by_id else "",
        "updated_on": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else "",
        "available_qty": str(getattr(obj, "available_qty", 0) or 0),
    }


def _to_decimal(value, fallback="0"):
    if value in (None, ""):
        return Decimal(str(fallback))
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(str(fallback))


def _to_int(value, fallback=0):
    if value in (None, ""):
        return int(fallback)
    try:
        return int(value)
    except (ValueError, TypeError):
        return int(fallback)


def _resolve_uom(value):
    if value in (None, ""):
        return None

    if isinstance(value, int) or (isinstance(value, str) and str(value).isdigit()):
        return UOM.objects.filter(pk=int(value)).first()

    raw = normalize_text(value)
    if not raw:
        return None

    return UOM.objects.filter(name__iexact=raw).first() or UOM.objects.filter(symbol__iexact=raw).first()


def _resolve_item_type(value):
    if value in (None, ""):
        return None

    if isinstance(value, int) or (isinstance(value, str) and str(value).isdigit()):
        return ItemType_info.objects.filter(pk=int(value)).first()

    raw = normalize_text(value)
    if not raw:
        return None

    return ItemType_info.objects.filter(it_name__iexact=raw).first()


def _duplicate_exists(item_code_name, item_category, exclude_id=None):
    qs = LabFurnitureItem.objects.filter(
        item_name_ref=item_code_name,
        item_category=item_category,
    )
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    return qs.exists()


@require_GET
def list_lab_furniture_item_categories_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    rows = ItemCategory.objects.order_by("name")
    return JsonResponse({"item_categories": [_serialize_category(row) for row in rows]})


@require_GET
def list_item_code_names_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    rows = ItemCodeName.objects.select_related("item_category", "updated_by").order_by("item_code")
    return JsonResponse({"item_code_names": [_serialize_item_code_name(row) for row in rows]})


@require_POST
@csrf_protect
def create_item_code_name_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    item_code = _normalize_code(payload.get("item_code"))
    item_name = normalize_text(payload.get("item_name"))
    item_category = _resolve_existing_category(payload.get("item_category_id", payload.get("item_category")))
    procurement_classification = normalize_text(payload.get("procurement_classification", "")).upper()
    business_criticality = normalize_text(payload.get("business_criticality", "")).upper()

    if not item_code:
        return JsonResponse({"message": "Item code is required."}, status=400)
    if not item_name:
        return JsonResponse({"message": "Item name is required."}, status=400)
    if not item_category:
        return JsonResponse({"message": "Item category is required."}, status=400)

    if ItemCodeName.objects.filter(item_code__iexact=item_code).exists():
        return JsonResponse({"message": "Item code already exists."}, status=400)
    if ItemCodeName.objects.filter(item_name__iexact=item_name).exists():
        return JsonResponse({"message": "Item name already exists."}, status=400)

    obj = ItemCodeName(
        item_code=item_code,
        item_name=item_name,
        item_category=item_category,
        procurement_classification=procurement_classification,
        business_criticality=business_criticality,
        updated_by=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
    )
    try:
        obj.save()
    except IntegrityError:
        return JsonResponse({"message": "Unable to save item code name."}, status=400)

    return JsonResponse({"success": True, "item_code_name": _serialize_item_code_name(obj)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@csrf_protect
def item_code_name_detail_api_view(request, pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    obj = ItemCodeName.objects.select_related("item_category", "updated_by").filter(pk=pk).first()
    if not obj:
        return JsonResponse({"message": "Item code name not found."}, status=404)

    if request.method == "DELETE":
        if LabFurnitureItem.objects.filter(item_code_ref=obj).exists() or LabFurnitureItem.objects.filter(item_name_ref=obj).exists():
            return JsonResponse({"message": "Item code name is in use and cannot be deleted."}, status=400)

        obj.delete()
        return JsonResponse({"success": True, "message": "Item code name deleted."})

    payload = _read_json(request)
    item_code = _normalize_code(payload.get("item_code", obj.item_code))
    item_name = normalize_text(payload.get("item_name", obj.item_name))
    item_category = _resolve_existing_category(payload.get("item_category_id", payload.get("item_category", obj.item_category_id)))

    if not item_code:
        return JsonResponse({"message": "Item code is required."}, status=400)
    if not item_name:
        return JsonResponse({"message": "Item name is required."}, status=400)
    if not item_category:
        return JsonResponse({"message": "Item category is required."}, status=400)

    if ItemCodeName.objects.filter(item_code__iexact=item_code).exclude(pk=obj.pk).exists():
        return JsonResponse({"message": "Item code already exists."}, status=400)
    if ItemCodeName.objects.filter(item_name__iexact=item_name).exclude(pk=obj.pk).exists():
        return JsonResponse({"message": "Item name already exists."}, status=400)

    obj.item_code = item_code
    obj.item_name = item_name
    obj.item_category = item_category
    if getattr(request, "user", None) and request.user.is_authenticated:
        obj.updated_by = request.user
    if "procurement_classification" in payload:
        obj.procurement_classification = normalize_text(payload.get("procurement_classification", "")).upper()
    if "business_criticality" in payload:
        obj.business_criticality = normalize_text(payload.get("business_criticality", "")).upper()
    try:
        obj.save()
    except IntegrityError:
        return JsonResponse({"message": "Unable to save item code name."}, status=400)

    return JsonResponse({"success": True, "item_code_name": _serialize_item_code_name(obj)})


@require_POST
@csrf_protect
def create_lab_furniture_item_category_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    name = normalize_text(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Category name is required."}, status=400)
    if _category_exists_case_insensitive(name):
        return JsonResponse({"message": "Category already exists."}, status=400)

    obj, _created = ItemCategory.objects.get_or_create(name=name)
    return JsonResponse({"success": True, "item_category": _serialize_category(obj)}, status=201)


def get_item_requested_projects_data(item):
    """
    Returns list of projects requesting this item where status is 'Work In Progress'.
    Precedence: If a project contains both a Quotation and a Costing,
    the items in Costing are considered (Costing is the cloned version of Quotation).
    Costing items require retrieval_status__status_name__iexact='Item Requested'.
    """
    # 1. Costing items
    c_rows = (
        ProjectCostingItemInfo.objects.filter(
            item_code=item,
            costing_id__status__status_name__iexact="Work In Progress",
            retrieval_status__status_name__iexact="Item Requested",
            requested_qty__gt=0,
        )
        .values(
            "costing_id__project_id",
            "costing_id__project__project_id",
            "costing_id__project__project_name",
            "costing_id__costing_id",
        )
        .annotate(total_qty=Sum("requested_qty"))
        .order_by("costing_id__project__project_id")
    )

    projects = []
    for r in c_rows:
        code = r["costing_id__project__project_id"] or ""
        name = r["costing_id__project__project_name"] or ""
        display = f"{code} - {name}".strip(" -") if name else code
        projects.append({
            "project_id": code,
            "project_name": name,
            "project_display": display,
            "requested_qty": _format_qty_number(r["total_qty"]),
            "reference_no": r["costing_id__costing_id"] or "",
        })

    return projects


@require_GET
def item_requested_projects_api_view(request, pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    item = None
    pk_str = str(pk).strip()
    if pk_str.isdigit():
        item = (
            LabFurnitureItem.objects.select_related("item_code_ref", "item_name_ref", "item_category")
            .filter(pk=int(pk_str))
            .first()
        )
    if not item:
        clean_code = pk_str.replace("item-", "").strip()
        item = (
            LabFurnitureItem.objects.select_related("item_code_ref", "item_name_ref", "item_category")
            .filter(Q(item_code__iexact=clean_code) | Q(item_code_ref__item_code__iexact=clean_code))
            .first()
        )
    if not item:
        return JsonResponse({"message": "Item not found."}, status=404)

    projects = get_item_requested_projects_data(item)
    total_reqd = sum(Decimal(str(p["requested_qty"])) for p in projects)

    return JsonResponse({
        "success": True,
        "item_id": item.pk,
        "item_code": item.item_code,
        "item_name": item.item_name,
        "item_category": item.item_category.name if item.item_category else "",
        "total_reqd": _format_qty_number(total_reqd),
        "projects": projects,
    })


@require_GET
def item_ordered_pos_api_view(request, pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    item = (
        LabFurnitureItem.objects.select_related("item_code_ref", "item_name_ref", "item_category")
        .filter(pk=pk)
        .first()
    )
    if not item:
        return JsonResponse({"message": "Item not found."}, status=404)

    from ..sub_models.place_stock_order_mod import PlaceStockOrderItem
    code = (item.item_code or "").strip().upper()

    po_items = (
        PlaceStockOrderItem.objects.filter(
            Q(item_code_ref=item) | Q(item_code__iexact=code),
            order__status__iexact="Order Placed",
        )
        .select_related("order", "order__vendor")
        .order_by("-order__created_at", "-id")
    )

    pos_list = []
    total_ordered_qty = Decimal("0")
    for poi in po_items:
        order = poi.order
        qty = poi.order_qty or Decimal("0")
        total_ordered_qty += qty
        po_num = order.order_code or f"PO-{order.id}"
        pos_list.append({
            "id": poi.id,
            "po_id": order.id,
            "po_number": po_num,
            "order_code": po_num,
            "vendor_name": order.vendor.vendor_name if order.vendor else "—",
            "vendor_code": order.vendor.vendor_code if order.vendor else "",
            "order_qty": _format_qty_number(qty),
            "status": order.status or "Order Placed",
            "created_at": order.created_at.strftime("%Y-%m-%d %H:%M") if getattr(order, "created_at", None) else "—",
            "created_by": str(order.created_by or "—"),
        })

    return JsonResponse({
        "success": True,
        "item_id": item.pk,
        "item_code": item.item_code,
        "item_name": item.item_name,
        "item_category": item.item_category.name if item.item_category else "",
        "total_ordered_qty": _format_qty_number(total_ordered_qty),
        "pos": pos_list,
    })


def _consumed_retrieval_statuses():
    return [
        RetrievalStatusInfo.STATUS_ITEM_SUPPLIED,
        RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
        RetrievalStatusInfo.STATUS_ITEM_RETURN,
        RetrievalStatusInfo.STATUS_ITEM_RETURN_ACCEPTED,
    ]


def _allocation_consumption_rows(*, item_id=None, group_by_project=False):
    status_filter = Q(retrieval_status__status_name__in=_consumed_retrieval_statuses()) | Q(
        retrieval_status__isnull=True,
        costing_item__retrieval_status__status_name__in=_consumed_retrieval_statuses(),
    )
    rows = ProjectCostingItemAllocation.objects.filter(
        costing_item__item_code_id__isnull=False,
    ).filter(status_filter)
    if item_id is not None:
        rows = rows.filter(costing_item__item_code_id=item_id)

    group_fields = ["costing_item__item_code_id"]
    if group_by_project:
        group_fields.extend([
            "costing_item__costing_id__project_id",
            "costing_item__costing_id__project__project_id",
            "costing_item__costing_id__project__project_name",
        ])
    return rows.values(*group_fields).annotate(
        allocated_total=Sum("allocated_qty"),
        returned_total=Sum("returned_qty"),
    )


@require_GET
def item_consumed_projects_api_view(request, pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    item = (
        LabFurnitureItem.objects.select_related("item_code_ref", "item_name_ref", "item_category")
        .filter(pk=pk)
        .first()
    )
    if not item:
        return JsonResponse({"message": "Item not found."}, status=404)

    projects_by_id = {}
    for row in _allocation_consumption_rows(item_id=item.pk, group_by_project=True):
        project_id = row["costing_item__costing_id__project_id"]
        consumed_qty = (row["allocated_total"] or Decimal("0")) - (row["returned_total"] or Decimal("0"))
        if consumed_qty <= 0:
            continue
        project_code = row["costing_item__costing_id__project__project_id"] or ""
        project_name = row["costing_item__costing_id__project__project_name"] or ""
        project = projects_by_id.setdefault(project_id, {
            "project_id": project_code,
            "project_name": project_name,
            "consumed_qty": Decimal("0"),
        })
        project["consumed_qty"] += consumed_qty

    legacy_rows = (
        ProjectCostingItemInfo.objects.filter(
            item_code_id=item.pk,
            retrieval_status__status_name__in=_consumed_retrieval_statuses(),
            grn_allocations__isnull=True,
        )
        .values(
            "costing_id__project_id",
            "costing_id__project__project_id",
            "costing_id__project__project_name",
        )
        .annotate(consumed_total=Sum("accepted_qty"))
    )
    for row in legacy_rows:
        consumed_qty = row["consumed_total"] or Decimal("0")
        if consumed_qty <= 0:
            continue
        project_id = row["costing_id__project_id"]
        project = projects_by_id.setdefault(project_id, {
            "project_id": row["costing_id__project__project_id"] or "",
            "project_name": row["costing_id__project__project_name"] or "",
            "consumed_qty": Decimal("0"),
        })
        project["consumed_qty"] += consumed_qty

    projects = []
    for project in projects_by_id.values():
        project["project_display"] = (
            f'{project["project_id"]} - {project["project_name"]}'.strip(" -")
            if project["project_name"] else project["project_id"]
        )
        project["consumed_qty"] = _format_qty_number(project["consumed_qty"])
        projects.append(project)
    projects.sort(key=lambda project: (project["project_id"] or "").lower())
    total_consumed_qty = sum(
        (Decimal(str(project["consumed_qty"])) for project in projects),
        Decimal("0"),
    )

    return JsonResponse({
        "success": True,
        "item_id": item.pk,
        "item_code": item.item_code,
        "item_name": item.item_name,
        "item_category": item.item_category.name if item.item_category else "",
        "total_consumed_qty": _format_qty_number(total_consumed_qty),
        "projects": projects,
    })


@require_GET
def list_lab_furniture_items_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    # Live total_reqd for all items in 2 fast queries
    c_items = (
        ProjectCostingItemInfo.objects.filter(
            costing_id__status__status_name__iexact="Work In Progress",
            retrieval_status__status_name__iexact="Item Requested",
            requested_qty__gt=0,
        )
        .values("item_code_id", "costing_id__project_id")
        .annotate(tot=Sum("requested_qty"))
    )

    item_totals = defaultdict(Decimal)
    for c in c_items:
        i_id = c["item_code_id"]
        if i_id:
            item_totals[i_id] += c["tot"] or Decimal("0")

    from ..sub_models.place_stock_order_mod import PlaceStockOrderItem
    po_items_placed = (
        PlaceStockOrderItem.objects.filter(order__status__iexact="Order Placed")
        .values("item_code_ref_id", "item_code")
        .annotate(tot=Sum("order_qty"))
    )
    po_totals_by_id = defaultdict(Decimal)
    po_totals_by_code = defaultdict(Decimal)
    for p in po_items_placed:
        tot = p["tot"] or Decimal("0")
        if p["item_code_ref_id"]:
            po_totals_by_id[p["item_code_ref_id"]] += tot
        if p["item_code"]:
            po_totals_by_code[p["item_code"].strip().upper()] += tot

    consumed_totals = defaultdict(Decimal)
    for row in _allocation_consumption_rows():
        item_id = row["costing_item__item_code_id"]
        consumed_totals[item_id] += (
            (row["allocated_total"] or Decimal("0")) - (row["returned_total"] or Decimal("0"))
        )
    legacy_consumed_items = (
        ProjectCostingItemInfo.objects.filter(
            item_code_id__isnull=False,
            retrieval_status__status_name__in=_consumed_retrieval_statuses(),
            grn_allocations__isnull=True,
        )
        .values("item_code_id")
        .annotate(consumed_total=Sum("accepted_qty"))
    )
    for row in legacy_consumed_items:
        consumed_totals[row["item_code_id"]] += row["consumed_total"] or Decimal("0")

    rows = (
        LabFurnitureItem.objects.select_related("item_code_ref", "item_name_ref", "item_category", "uom", "item_type", "updated_by")
        .annotate(
            purchased_qty_total=Coalesce(
                Sum(
                    Case(
                        When(stock_purchase_items__purchase_qty__gt=0, then=F("stock_purchase_items__purchase_qty")),
                        default=F("stock_purchase_items__quantity"),
                        output_field=DecimalField(max_digits=12, decimal_places=0),
                    )
                ),
                Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2)),
            )
        )
        .order_by("item_category__name", "item_name_ref__item_name")
    )
    return JsonResponse({
        "lab_furniture_items": [
            _serialize(
                row,
                calculated_total_reqd=item_totals.get(row.pk),
                calculated_ordered_qty=(
                    po_totals_by_id.get(row.pk)
                    or po_totals_by_code.get((row.item_code or "").strip().upper(), Decimal("0"))
                ),
                calculated_physical_qty=max(
                    _to_decimal(row.purchased_qty_total, "0")
                    - consumed_totals.get(row.pk, Decimal("0")),
                    Decimal("0"),
                ),
                calculated_consumed_qty=consumed_totals.get(row.pk, Decimal("0")),
            )
            for row in rows
        ]
    })


@require_POST
@csrf_protect
def create_lab_furniture_item_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    raw_uom_value = payload.get("uom_id", payload.get("uom"))
    raw_item_type_value = payload.get("item_type_id", payload.get("item_type"))
    item_code_name = _resolve_item_code_name(
        lookup_id=payload.get("item_code_ref_id", payload.get("item_name_ref_id")),
        code=payload.get("item_code"),
        name=payload.get("item_name"),
    )
    item_category = _resolve_category(payload.get("item_category_id", payload.get("item_category", "")))
    if not item_category and item_code_name and getattr(item_code_name, "item_category", None):
        item_category = item_code_name.item_category
    uom = _resolve_uom(payload.get("uom_id", payload.get("uom")))
    item_type = _resolve_item_type(payload.get("item_type_id", payload.get("item_type")))
    length = _to_decimal(payload.get("length"), "0")
    width = _to_decimal(payload.get("width"), "0")
    height = _to_decimal(payload.get("height"), "0")
    recommended_free_stock_qty = _to_decimal(payload.get("recommended_free_stock_qty"), "0")
    warning_alert_qty = _to_decimal(payload.get("warning_alert_qty"), "0")
    physical_qty = _to_decimal(payload.get("physical_qty"), "0")
    ordered_qty = _to_decimal(payload.get("ordered_qty"), "0")
    physical_plus_ordered_qty = physical_qty + ordered_qty
    total_reqd = _to_decimal(payload.get("total_reqd"), "0")
    to_order_qty = total_reqd - physical_plus_ordered_qty
    to_order_qty_including_free_stock = total_reqd + recommended_free_stock_qty - physical_plus_ordered_qty
    procurement_classification = normalize_text(payload.get("procurement_classification", "")).upper()
    business_criticality = normalize_text(payload.get("business_criticality", "")).upper()

    if not item_code_name:
        return JsonResponse({"message": "Valid item code reference is required."}, status=400)
    if not item_category:
        return JsonResponse({"message": "Item category is required."}, status=400)
    if item_code_name.item_category_id and item_code_name.item_category_id != item_category.id:
        return JsonResponse({"message": "Selected item code belongs to a different category."}, status=400)
    if _duplicate_exists(item_code_name, item_category):
        return JsonResponse({"message": "Item already exists in this category."}, status=400)
    if LabFurnitureItem.objects.filter(item_code_ref=item_code_name).exists():
        return JsonResponse({"message": "Item code already exists."}, status=400)
    if raw_uom_value in (None, ""):
        return JsonResponse({"message": "UOM is required."}, status=400)
    if not uom:
        return JsonResponse({"message": "Selected UOM was not found."}, status=400)
    if raw_item_type_value in (None, ""):
        return JsonResponse({"message": "Item Type is required."}, status=400)
    if not item_type:
        return JsonResponse({"message": "Selected Item Type was not found."}, status=400)

    if not procurement_classification and getattr(item_code_name, "procurement_classification", None):
        procurement_classification = item_code_name.procurement_classification
    if not business_criticality and getattr(item_code_name, "business_criticality", None):
        business_criticality = item_code_name.business_criticality

    obj = LabFurnitureItem.objects.create(
        item_code_ref=item_code_name,
        item_name_ref=item_code_name,
        item_category=item_category,
        uom=uom,
        item_type=item_type,
        procurement_classification=procurement_classification,
        business_criticality=business_criticality,
        length=length,
        width=width,
        height=height,
        recommended_free_stock_qty=recommended_free_stock_qty,
        warning_alert_qty=warning_alert_qty,
        to_order_qty=to_order_qty,
        to_order_qty_including_free_stock=to_order_qty_including_free_stock,
        physical_plus_ordered_qty=physical_plus_ordered_qty,
        physical_qty=physical_qty,
        ordered_qty=ordered_qty,
        total_reqd=total_reqd,
        updated_by=request.user,
    )
    if item_code_name.item_category_id != item_category.id:
        item_code_name.item_category = item_category
        item_code_name.save(update_fields=["item_category"])
    return JsonResponse({"success": True, "lab_furniture_item": _serialize(obj)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@csrf_protect
def lab_furniture_item_detail_api_view(request, pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        obj = LabFurnitureItem.objects.get(pk=pk)
    except LabFurnitureItem.DoesNotExist:
        return JsonResponse({"message": "Record not found."}, status=404)

    if request.method == "DELETE":
        obj.delete()
        return JsonResponse({"success": True, "message": "Deleted."})

    payload = _read_json(request)
    raw_uom_value = payload.get("uom_id", payload.get("uom", getattr(obj, "uom_id", None)))
    raw_item_type_value = payload.get("item_type_id", payload.get("item_type", getattr(obj, "item_type_id", None)))
    item_code_name = _resolve_item_code_name(
        lookup_id=payload.get("item_code_ref_id", payload.get("item_name_ref_id", getattr(obj, "item_code_ref_id", None))),
        code=payload.get("item_code", obj.item_code),
        name=payload.get("item_name", obj.item_name),
    )
    item_category = _resolve_category(
        payload.get("item_category_id", payload.get("item_category", obj.item_category))
    )
    if not item_category and item_code_name and getattr(item_code_name, "item_category", None):
        item_category = item_code_name.item_category
    current_uom_id = getattr(obj, "uom_id", None)
    uom = _resolve_uom(payload.get("uom_id", payload.get("uom", current_uom_id)))
    current_item_type_id = getattr(obj, "item_type_id", None)
    item_type = _resolve_item_type(payload.get("item_type_id", payload.get("item_type", current_item_type_id)))
    length = _to_decimal(payload.get("length", obj.length), "0")
    width = _to_decimal(payload.get("width", obj.width), "0")
    height = _to_decimal(payload.get("height", obj.height), "0")
    recommended_free_stock_qty = _to_decimal(payload.get("recommended_free_stock_qty", obj.recommended_free_stock_qty), "0")
    warning_alert_qty = _to_decimal(payload.get("warning_alert_qty", obj.warning_alert_qty), "0")
    physical_qty = _to_decimal(payload.get("physical_qty", obj.physical_qty), "0")
    ordered_qty = _to_decimal(payload.get("ordered_qty", obj.ordered_qty), "0")
    physical_plus_ordered_qty = physical_qty + ordered_qty
    total_reqd = _to_decimal(payload.get("total_reqd", obj.total_reqd), "0")
    to_order_qty = total_reqd - physical_plus_ordered_qty
    to_order_qty_including_free_stock = total_reqd + recommended_free_stock_qty - physical_plus_ordered_qty

    if not item_code_name:
        return JsonResponse({"message": "Valid item code reference is required."}, status=400)
    if not item_category:
        return JsonResponse({"message": "Item category is required."}, status=400)
    if item_code_name.item_category_id and item_code_name.item_category_id != item_category.id:
        return JsonResponse({"message": "Selected item code belongs to a different category."}, status=400)
    if _duplicate_exists(item_code_name, item_category, exclude_id=obj.pk):
        return JsonResponse({"message": "Item already exists in this category."}, status=400)
    if LabFurnitureItem.objects.filter(item_code_ref=item_code_name).exclude(pk=obj.pk).exists():
        return JsonResponse({"message": "Item code already exists."}, status=400)
    if raw_uom_value in (None, ""):
        return JsonResponse({"message": "UOM is required."}, status=400)
    if not uom:
        return JsonResponse({"message": "Selected UOM was not found."}, status=400)
    if raw_item_type_value in (None, ""):
        return JsonResponse({"message": "Item Type is required."}, status=400)
    if not item_type:
        return JsonResponse({"message": "Selected Item Type was not found."}, status=400)

    obj.item_code_ref = item_code_name
    obj.item_name_ref = item_code_name
    obj.item_category = item_category
    obj.uom = uom
    obj.item_type = item_type
    obj.length = length
    obj.width = width
    obj.height = height
    obj.recommended_free_stock_qty = recommended_free_stock_qty
    obj.warning_alert_qty = warning_alert_qty
    obj.to_order_qty = to_order_qty
    obj.to_order_qty_including_free_stock = to_order_qty_including_free_stock
    obj.physical_plus_ordered_qty = physical_plus_ordered_qty
    obj.physical_qty = physical_qty
    obj.ordered_qty = ordered_qty
    obj.total_reqd = total_reqd
    if "procurement_classification" in payload:
        obj.procurement_classification = normalize_text(payload.get("procurement_classification", "")).upper()
    if "business_criticality" in payload:
        obj.business_criticality = normalize_text(payload.get("business_criticality", "")).upper()
    obj.updated_by = request.user
    obj.save()
    if item_code_name.item_category_id != item_category.id:
        item_code_name.item_category = item_category
        item_code_name.save(update_fields=["item_category"])
    return JsonResponse({"success": True, "lab_furniture_item": _serialize(obj)})
