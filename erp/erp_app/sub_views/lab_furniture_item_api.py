import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import ItemCategory, LabFurnitureItem
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
    return normalize_text(value).upper()[:6]


def _serialize_category(obj):
    return {
        "id": obj.pk,
        "name": obj.name,
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


def _next_item_code():
    existing = list(LabFurnitureItem.objects.values_list("item_code", flat=True))
    max_num = 0
    for code in existing:
        code = _normalize_code(code)
        if code.startswith("LF") and code[2:].isdigit():
            max_num = max(max_num, int(code[2:]))
    return f"LF{max_num + 1:04d}"


def _serialize(obj):
    return {
        "id": obj.pk,
        "item_code": obj.item_code,
        "item_name": obj.item_name,
        "item_category": obj.item_category.name if obj.item_category_id else "",
        "item_category_id": obj.item_category_id,
    }


def _duplicate_exists(item_name, item_category, exclude_id=None):
    qs = LabFurnitureItem.objects.filter(
        item_name__iexact=item_name,
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

    rows = LabFurnitureItem.objects.select_related("item_category").order_by("item_category__name", "item_name")
    return JsonResponse({"lab_furniture_items": [_serialize(row) for row in rows]})


@require_POST
@csrf_protect
def create_lab_furniture_item_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    item_name = normalize_text(payload.get("item_name", ""))
    item_category = _resolve_category(payload.get("item_category", ""))
    item_code = _normalize_code(payload.get("item_code", "")) or _next_item_code()

    if not item_name:
        return JsonResponse({"message": "Item name is required."}, status=400)
    if not item_category:
        return JsonResponse({"message": "Item category is required."}, status=400)
    if _duplicate_exists(item_name, item_category):
        return JsonResponse({"message": "Item already exists in this category."}, status=400)
    if LabFurnitureItem.objects.filter(item_code__iexact=item_code).exists():
        return JsonResponse({"message": "Item code already exists."}, status=400)

    obj = LabFurnitureItem.objects.create(
        item_name=item_name,
        item_category=item_category,
        item_code=item_code,
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
    item_name = normalize_text(payload.get("item_name", obj.item_name))
    item_category = _resolve_category(payload.get("item_category", obj.item_category))
    item_code = _normalize_code(payload.get("item_code", obj.item_code))

    if not item_name:
        return JsonResponse({"message": "Item name is required."}, status=400)
    if not item_category:
        return JsonResponse({"message": "Item category is required."}, status=400)
    if _duplicate_exists(item_name, item_category, exclude_id=obj.pk):
        return JsonResponse({"message": "Item already exists in this category."}, status=400)
    if LabFurnitureItem.objects.filter(item_code__iexact=item_code).exclude(pk=obj.pk).exists():
        return JsonResponse({"message": "Item code already exists."}, status=400)

    obj.item_name = item_name
    obj.item_category = item_category
    obj.item_code = item_code
    obj.save()
    return JsonResponse({"success": True, "lab_furniture_item": _serialize(obj)})

