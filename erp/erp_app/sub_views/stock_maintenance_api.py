import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from ..sub_models import StockMaintenance, StockMaintenanceTypeOption
from ..utils import normalize_text, to_title_case
def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({'message': 'Authentication required.'}, status=401)
    return None
def _read_json(request):
    try:
        return json.loads(request.body.decode('utf-8') or '{}')
    except (TypeError, ValueError):
        return {}


def _serialize(obj):
    return {
        'id': obj.id,
        'item_name': obj.item_name,
        'category': obj.category,
        'movement_type': obj.movement_type,
        'quantity': str(obj.quantity),
        'unit': obj.unit,
        'location': obj.location,
        'movement_date': str(obj.movement_date) if obj.movement_date else '',
        'notes': obj.notes,
    }

@require_GET
def list_stock_maintenance_meta_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    movement_types = list(StockMaintenanceTypeOption.objects.values_list("name", flat=True))
    return JsonResponse({"movement_types": movement_types})


@require_POST
@csrf_protect
def create_stock_maintenance_type_option_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    payload = _read_json(request)
    name = to_title_case(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Movement type is required."}, status=400)

    obj, _created = StockMaintenanceTypeOption.objects.get_or_create(name=name)
    return JsonResponse({"success": True, "name": obj.name})
@require_GET
def list_stock_maintenance_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    return JsonResponse({'stock_maintenance': [_serialize(o) for o in StockMaintenance.objects.all()]})
@require_POST
@csrf_protect
def create_stock_maintenance_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    p = _read_json(request)
    name = normalize_text(p.get('item_name', ''))
    if not name:
        return JsonResponse({'message': 'Item name is required.'}, status=400)

    movement_type = to_title_case(p.get('movement_type', ''))
    if movement_type:
        StockMaintenanceTypeOption.objects.get_or_create(name=movement_type)

    obj = StockMaintenance.objects.create(
        item_name=name,
        category=normalize_text(p.get('category', '')),
        movement_type=movement_type,
        quantity=p.get('quantity') or 0,
        unit=normalize_text(p.get('unit', '')),
        location=normalize_text(p.get('location', '')),
        movement_date=p.get('movement_date') or None,
        notes=normalize_text(p.get('notes', '')),
    )
    return JsonResponse({'success': True, 'stock_maintenance': _serialize(obj)}, status=201)
@require_http_methods(['PATCH', 'DELETE'])
@csrf_protect
def stock_maintenance_detail_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na
    try:
        obj = StockMaintenance.objects.get(id=pk)
    except StockMaintenance.DoesNotExist:
        return JsonResponse({'message': 'Record not found.'}, status=404)
    if request.method == 'DELETE':
        obj.delete()
        return JsonResponse({'success': True, 'message': 'Deleted.'})
    p = _read_json(request)
    name = normalize_text(p.get('item_name', obj.item_name))
    if not name:
        return JsonResponse({'message': 'Item name is required.'}, status=400)
    obj.item_name = name
    obj.category = normalize_text(p.get('category', obj.category))
    obj.movement_type = to_title_case(p.get('movement_type', obj.movement_type))
    if obj.movement_type:
        StockMaintenanceTypeOption.objects.get_or_create(name=obj.movement_type)
    obj.quantity = p.get('quantity', obj.quantity)
    obj.unit = normalize_text(p.get('unit', obj.unit))
    obj.location = normalize_text(p.get('location', obj.location))
    obj.movement_date = p.get('movement_date') or obj.movement_date
    obj.notes = normalize_text(p.get('notes', obj.notes))
    obj.save()
    return JsonResponse({'success': True, 'stock_maintenance': _serialize(obj)})
