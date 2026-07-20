import json
from decimal import Decimal

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import ItemCategory, ItemCostingInfo, LabFurnitureItem, Project, StockPurchaseItem
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


def _to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_decimal(value, default=Decimal("0")):
    try:
        return Decimal(str(value))
    except Exception:
        return default


def _parse_paging(request):
    page = max(1, _to_int(request.GET.get("page", 1), 1))
    page_size = _to_int(request.GET.get("page_size", 20), 20)
    page_size = min(max(page_size, 1), 200)
    return page, page_size

def _resolve_project(value):
    if value in (None, ""):
        return None

    if isinstance(value, int) or (isinstance(value, str) and str(value).isdigit()):
        return Project.objects.filter(pk=int(value)).first()

    text = normalize_text(value)
    if not text:
        return None

    # Try project_id first, then project_name
    return (
        Project.objects.filter(project_id__iexact=text).first()
        or Project.objects.filter(project_name__iexact=text).first()
    )

def _resolve_item_category(value):
    if value in (None, ""):
        return None

    if isinstance(value, int) or (isinstance(value, str) and str(value).isdigit()):
        return ItemCategory.objects.filter(pk=int(value)).first()

    text = normalize_text(value)
    if not text:
        return None
    return ItemCategory.objects.filter(name__iexact=text).first()


def _resolve_lab_item(item_category, item_description, item_code):
    if not item_category:
        return None

    qs = LabFurnitureItem.objects.filter(item_category=item_category)

    if item_description:
        qs = qs.filter(item_name__iexact=item_description)
    if item_code:
        qs = qs.filter(item_code__iexact=item_code)

    return qs.first()


def _compute_costs(item_code, qty):
    normalized_code = normalize_text(item_code).upper()
    costs = [
        _to_decimal(value, Decimal("0"))
        for value in StockPurchaseItem.objects.filter(item_code__iexact=normalized_code).values_list("lce_cost", flat=True)
    ]

    if not costs:
        cost_max = Decimal("0")
        cost_min = Decimal("0")
        cost = Decimal("0")
    else:
        cost_max = max(costs)
        cost_min = min(costs)
        cost = (cost_max + cost_min) / Decimal("2")

    total_price = cost * Decimal(str(max(int(qty or 0), 0)))
    return {
        "ic_cost_max": cost_max,
        "ic_cost_min": cost_min,
        "ic_cost": cost,
        "ic_total_price": total_price,
    }


def _empty_purchase_reference():
    return {
        "purchase_qty": "0",
        "purchase_uom": "",
        "purchase_uom_id": None,
        "purchase_length": "0",
        "purchase_width": "0",
        "purchase_height": "0",
    }


def _get_purchase_reference(item_code):
    normalized_code = normalize_text(item_code).upper()
    if not normalized_code:
        return _empty_purchase_reference()

    purchase_item = (
        StockPurchaseItem.objects.select_related("uom")
        .filter(item_code__iexact=normalized_code)
        .order_by("-updated_at", "-id")
        .first()
    )
    if not purchase_item:
        return _empty_purchase_reference()

    purchase_uom = getattr(purchase_item, "uom", None)
    purchase_uom_id = getattr(purchase_uom, "pk", None)
    uom_label = ""
    if purchase_uom_id and purchase_uom:
        if purchase_uom.name and purchase_uom.symbol:
            uom_label = f"{purchase_uom.name} ({purchase_uom.symbol})"
        else:
            uom_label = purchase_uom.symbol or purchase_uom.name or ""

    return {
        "purchase_qty": str(purchase_item.quantity),
        "purchase_uom": uom_label,
        "purchase_uom_id": purchase_uom_id,
        "purchase_length": str(purchase_item.length),
        "purchase_width": str(purchase_item.width),
        "purchase_height": str(purchase_item.height),
    }


def _project_ref_label(project):
    if not project:
        return ""
    project_id = str(project.project_id or "").strip()
    project_name = str(project.project_name or "").strip()
    if project_id and project_name:
        return f"{project_id} - {project_name}"
    return project_id or project_name


def _serialize(row):
    purchase_reference = _get_purchase_reference(row.ic_item_code)
    project_ref_id = getattr(row, "ic_project_ref_id", None)
    item_category_id = getattr(row, "ic_item_category_id", None)
    updated_by_id = getattr(row, "ic_updated_by_id", None)
    return {
        "id": row.pk,
        "project_ref": _project_ref_label(row.ic_project_ref) if project_ref_id else "",
        "project_ref_id": project_ref_id,
        "item_category": row.ic_item_category.name if item_category_id else "",
        "item_category_id": item_category_id,
        "item_code": row.ic_item_code,
        "item_description": row.ic_item_description,
        "qty": row.ic_qty,
        "cost_max": str(row.ic_cost_max),
        "cost_min": str(row.ic_cost_min),
        "cost": str(row.ic_cost),
        "uom": purchase_reference["purchase_uom"],
        "uom_id": purchase_reference["purchase_uom_id"],
        "purchase_qty": purchase_reference["purchase_qty"],
        "purchase_uom": purchase_reference["purchase_uom"],
        "purchase_length": purchase_reference["purchase_length"],
        "purchase_width": purchase_reference["purchase_width"],
        "purchase_height": purchase_reference["purchase_height"],
        "total_price": str(row.ic_total_price),
        "updated_by": row.ic_updated_by.username if updated_by_id else "",
        "updated_on": row.ic_updated_at.isoformat() if row.ic_updated_at else "",
    }


def _validate_and_prepare(payload, request, existing=None):
     project_ref = _resolve_project(payload.get("project_ref_id", payload.get("ic_project_ref")))
     item_category = _resolve_item_category(payload.get("item_category_id", payload.get("ic_item_category")))
     item_description = normalize_text(
         payload.get("item_description", payload.get("ic_item_description", existing.ic_item_description if existing else ""))
     )
     item_code = normalize_text(payload.get("item_code", payload.get("ic_item_code", ""))).upper()
     qty = _to_int(payload.get("qty", payload.get("ic_qty", existing.ic_qty if existing else 0)), -1)

     if not project_ref:
         return None, JsonResponse({"message": "Project Ref is required."}, status=400)
     if not item_category:
         return None, JsonResponse({"message": "Item Category is required."}, status=400)
     if not item_code:
         return None, JsonResponse({"message": "Item Code is required."}, status=400)
     if not item_description:
         return None, JsonResponse({"message": "Item Description is required."}, status=400)
     if qty < 0:
         return None, JsonResponse({"message": "Qty must be 0 or greater."}, status=400)

     matched_item = _resolve_lab_item(item_category, item_description, item_code)
     if not matched_item:
         return None, JsonResponse({"message": "Selected category, description, and item code do not match Item Master."}, status=400)

     costs = _compute_costs(item_code, qty)
     
     # Check if user provided a manual ic_cost override
     manual_cost = payload.get("ic_cost", payload.get("cost"))
     if manual_cost is not None:
         manual_cost = _to_decimal(manual_cost)
         # Use manual cost and recalculate total_price
         ic_cost = manual_cost
         ic_total_price = manual_cost * Decimal(str(max(int(qty or 0), 0)))
     else:
         # Use calculated costs
         ic_cost = costs["ic_cost"]
         ic_total_price = costs["ic_total_price"]

     prepared = {
         "ic_project_ref": project_ref,
         "ic_item_category": item_category,
         "ic_item_code": item_code,
         "ic_item_description": matched_item.item_name,
         "ic_qty": qty,
         "ic_cost_max": costs["ic_cost_max"],
         "ic_cost_min": costs["ic_cost_min"],
         "ic_cost": ic_cost,
         "ic_total_price": ic_total_price,
         "ic_updated_by": request.user,
     }
     return prepared, None


@require_GET
def list_item_costing_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    rows = ItemCostingInfo.objects.select_related("ic_project_ref", "ic_item_category", "ic_updated_by").order_by("-id")
    page, page_size = _parse_paging(request)

    total = rows.count()
    start = (page - 1) * page_size
    paged = rows[start:start + page_size]

    return JsonResponse(
        {
            "count": total,
            "page": page,
            "page_size": page_size,
            "results": [_serialize(row) for row in paged],
        }
    )


@require_GET
def item_costing_meta_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    item_categories = ItemCategory.objects.order_by("name")
    lab_items = LabFurnitureItem.objects.select_related("item_category").order_by("item_category__name", "item_name", "item_code")
    projects = Project.objects.order_by("project_id", "project_name")

    return JsonResponse(
        {
            "project_refs": [
        {
            "id": row.pk,
            "name": f"{row.project_id} - {row.project_name}".strip(" -"),
        }
        for row in projects
    ],
            "item_categories": [{"id": row.pk, "name": row.name} for row in item_categories],
            "lab_items": [
                {
                    "id": row.pk,
                    "item_category_id": row.item_category.pk,
                    "item_category": row.item_category.name,
                    "item_name": row.item_name,
                    "item_code": row.item_code,
                }
                for row in lab_items
            ],
        }
    )


@require_GET
def item_costing_cost_preview_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    item_code = normalize_text(request.GET.get("item_code", "")).upper()
    qty = _to_int(request.GET.get("qty", 0), 0)
    if not item_code:
        return JsonResponse({"message": "item_code query param is required."}, status=400)

    costs = _compute_costs(item_code, qty)
    purchase_reference = _get_purchase_reference(item_code)
    return JsonResponse(
        {
            "item_code": item_code,
            "qty": max(qty, 0),
            "cost_max": str(costs["ic_cost_max"]),
            "cost_min": str(costs["ic_cost_min"]),
            "cost": str(costs["ic_cost"]),
            "total_price": str(costs["ic_total_price"]),
            "purchase_qty": purchase_reference["purchase_qty"],
            "purchase_uom": purchase_reference["purchase_uom"],
            "purchase_uom_id": purchase_reference["purchase_uom_id"],
            "purchase_length": purchase_reference["purchase_length"],
            "purchase_width": purchase_reference["purchase_width"],
            "purchase_height": purchase_reference["purchase_height"],
        }
    )


@require_POST
@csrf_protect
def create_item_costing_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    payload = _read_json(request)
    prepared, error = _validate_and_prepare(payload, request)
    if error:
        return error

    row = ItemCostingInfo.objects.create(**prepared)
    return JsonResponse({"success": True, "item": _serialize(row)}, status=201)


@require_http_methods(["GET", "PATCH", "PUT", "DELETE"])
@csrf_protect
def item_costing_detail_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na

    try:
        row = ItemCostingInfo.objects.select_related("ic_project_ref", "ic_item_category", "ic_updated_by").get(pk=pk)
    except ItemCostingInfo.DoesNotExist:
        return JsonResponse({"message": "Item Costing record not found."}, status=404)

    if request.method == "GET":
        return JsonResponse({"item": _serialize(row)})

    if request.method == "DELETE":
        row.delete()
        return JsonResponse({"success": True, "message": "Item Costing record deleted."})

    payload = _read_json(request)
    prepared, error = _validate_and_prepare(payload, request, existing=row)
    if error:
        return error

    for key, value in prepared.items():
        setattr(row, key, value)
    row.save()
    return JsonResponse({"success": True, "item": _serialize(row)})

