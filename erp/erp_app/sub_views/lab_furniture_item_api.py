import json
from decimal import Decimal, InvalidOperation

from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import ItemCategory, ItemCodeName, LabFurnitureItem, UOM, ItemType_info
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
    return {
        "id": obj.pk,
        "item_code": obj.item_code,
        "item_name": obj.item_name,
        "label": f"{obj.item_code} - {obj.item_name}",
    }


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


def _serialize(obj):
    item_category_id = getattr(obj, "item_category_id", None)
    uom_id = getattr(obj, "uom_id", None)
    item_type_id = getattr(obj, "item_type_id", None)
    updated_by_id = getattr(obj, "updated_by_id", None)
    return {
        "id": obj.pk,
        "item_code_ref_id": getattr(obj, "item_code_ref_id", None),
        "item_name_ref_id": getattr(obj, "item_name_ref_id", None),
        "item_code": obj.item_code,
        "item_name": obj.item_name,
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
        "recommended_free_stock_qty": int(getattr(obj, "recommended_free_stock_qty", 0) or 0),
        "warning_alert_qty": int(getattr(obj, "warning_alert_qty", 0) or 0),
        "to_order_qty": int(getattr(obj, "to_order_qty", 0) or 0),
        "physical_plus_ordered_qty": int(getattr(obj, "physical_plus_ordered_qty", 0) or 0),
        "physical_qty": int(getattr(obj, "physical_qty", 0) or 0),
        "ordered_qty": int(getattr(obj, "ordered_qty", 0) or 0),
        "total_reqd": int(getattr(obj, "total_reqd", 0) or 0),
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

    rows = ItemCodeName.objects.order_by("item_code")
    return JsonResponse({"item_code_names": [_serialize_item_code_name(row) for row in rows]})


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


@require_GET
def list_lab_furniture_items_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    rows = (
        LabFurnitureItem.objects.select_related("item_code_ref", "item_name_ref", "item_category", "uom", "item_type", "updated_by")
        .annotate(
            available_qty=Coalesce(
                Sum("stock_purchase_items__quantity"),
                Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2)),
            )
        )
        .order_by("item_category__name", "item_name_ref__item_name")
    )
    return JsonResponse({"lab_furniture_items": [_serialize(row) for row in rows]})


@require_POST
@csrf_protect
def create_lab_furniture_item_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    item_category = _resolve_category(payload.get("item_category_id", payload.get("item_category", "")))
    item_code_name = _resolve_item_code_name(
        lookup_id=payload.get("item_code_ref_id", payload.get("item_name_ref_id")),
        code=payload.get("item_code"),
        name=payload.get("item_name"),
    )
    uom = _resolve_uom(payload.get("uom_id", payload.get("uom")))
    item_type = _resolve_item_type(payload.get("item_type_id", payload.get("item_type")))
    length = _to_decimal(payload.get("length"), "0")
    width = _to_decimal(payload.get("width"), "0")
    height = _to_decimal(payload.get("height"), "0")
    recommended_free_stock_qty = _to_int(payload.get("recommended_free_stock_qty"), 0)
    warning_alert_qty = _to_int(payload.get("warning_alert_qty"), 0)
    to_order_qty = _to_int(payload.get("to_order_qty"), 0)
    physical_plus_ordered_qty = _to_int(payload.get("physical_plus_ordered_qty"), 0)
    physical_qty = _to_int(payload.get("physical_qty"), 0)
    ordered_qty = _to_int(payload.get("ordered_qty"), 0)
    total_reqd = _to_int(payload.get("total_reqd"), 0)

    if not item_code_name:
        return JsonResponse({"message": "Valid item code reference is required."}, status=400)
    if not item_category:
        return JsonResponse({"message": "Item category is required."}, status=400)
    if _duplicate_exists(item_code_name, item_category):
        return JsonResponse({"message": "Item already exists in this category."}, status=400)
    if LabFurnitureItem.objects.filter(item_code_ref=item_code_name).exists():
        return JsonResponse({"message": "Item code already exists."}, status=400)
    if payload.get("uom_id") not in (None, "") and not uom:
        return JsonResponse({"message": "Selected UOM was not found."}, status=400)
    if payload.get("item_type_id") not in (None, "") and not item_type:
        return JsonResponse({"message": "Selected Item Type was not found."}, status=400)

    obj = LabFurnitureItem.objects.create(
        item_code_ref=item_code_name,
        item_name_ref=item_code_name,
        item_category=item_category,
        uom=uom,
        item_type=item_type,
        length=length,
        width=width,
        height=height,
        recommended_free_stock_qty=recommended_free_stock_qty,
        warning_alert_qty=warning_alert_qty,
        to_order_qty=to_order_qty,
        physical_plus_ordered_qty=physical_plus_ordered_qty,
        physical_qty=physical_qty,
        ordered_qty=ordered_qty,
        total_reqd=total_reqd,
        updated_by=request.user,
    )
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
    item_category = _resolve_category(
        payload.get("item_category_id", payload.get("item_category", obj.item_category))
    )
    item_code_name = _resolve_item_code_name(
        lookup_id=payload.get("item_code_ref_id", payload.get("item_name_ref_id", getattr(obj, "item_code_ref_id", None))),
        code=payload.get("item_code", obj.item_code),
        name=payload.get("item_name", obj.item_name),
    )
    current_uom_id = getattr(obj, "uom_id", None)
    uom = _resolve_uom(payload.get("uom_id", payload.get("uom", current_uom_id)))
    current_item_type_id = getattr(obj, "item_type_id", None)
    item_type = _resolve_item_type(payload.get("item_type_id", payload.get("item_type", current_item_type_id)))
    length = _to_decimal(payload.get("length", obj.length), "0")
    width = _to_decimal(payload.get("width", obj.width), "0")
    height = _to_decimal(payload.get("height", obj.height), "0")
    recommended_free_stock_qty = _to_int(payload.get("recommended_free_stock_qty", obj.recommended_free_stock_qty), 0)
    warning_alert_qty = _to_int(payload.get("warning_alert_qty", obj.warning_alert_qty), 0)
    to_order_qty = _to_int(payload.get("to_order_qty", obj.to_order_qty), 0)
    physical_plus_ordered_qty = _to_int(payload.get("physical_plus_ordered_qty", obj.physical_plus_ordered_qty), 0)
    physical_qty = _to_int(payload.get("physical_qty", obj.physical_qty), 0)
    ordered_qty = _to_int(payload.get("ordered_qty", obj.ordered_qty), 0)
    total_reqd = _to_int(payload.get("total_reqd", obj.total_reqd), 0)

    if not item_code_name:
        return JsonResponse({"message": "Valid item code reference is required."}, status=400)
    if not item_category:
        return JsonResponse({"message": "Item category is required."}, status=400)
    if _duplicate_exists(item_code_name, item_category, exclude_id=obj.pk):
        return JsonResponse({"message": "Item already exists in this category."}, status=400)
    if LabFurnitureItem.objects.filter(item_code_ref=item_code_name).exclude(pk=obj.pk).exists():
        return JsonResponse({"message": "Item code already exists."}, status=400)
    if payload.get("uom_id") not in (None, "") and not uom:
        return JsonResponse({"message": "Selected UOM was not found."}, status=400)
    if payload.get("item_type_id") not in (None, "") and not item_type:
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
    obj.physical_plus_ordered_qty = physical_plus_ordered_qty
    obj.physical_qty = physical_qty
    obj.ordered_qty = ordered_qty
    obj.total_reqd = total_reqd
    obj.updated_by = request.user
    obj.save()
    return JsonResponse({"success": True, "lab_furniture_item": _serialize(obj)})

