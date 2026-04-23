import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from ..sub_models import StockPurchase
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


def _serialize(obj):
    return {
        'id': obj.id,
        'item_name': obj.item_name,
        'category': obj.category,
        'vendor': obj.vendor,
        'quantity': str(obj.quantity),
        'unit': obj.unit,
        'unit_price': str(obj.unit_price),
        'total_price': str(obj.total_price),
        'purchase_date': str(obj.purchase_date) if obj.purchase_date else '',
        'invoice_number': obj.invoice_number,
        'notes': obj.notes,
    }
@require_GET
def list_stock_purchases_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    return JsonResponse({'stock_purchases': [_serialize(o) for o in StockPurchase.objects.order_by('-id')]})
@require_POST
@csrf_protect
def create_stock_purchase_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    p = _read_json(request)
    name = normalize_text(p.get('item_name', ''))
    if not name:
        return JsonResponse({'message': 'Item name is required.'}, status=400)
    obj = StockPurchase.objects.create(
        item_name=name,
        category=normalize_text(p.get('category', '')),
        vendor=normalize_text(p.get('vendor', '')),
        quantity=p.get('quantity') or 0,
        unit=normalize_text(p.get('unit', '')),
        unit_price=p.get('unit_price') or 0,
        total_price=p.get('total_price') or 0,
        purchase_date=p.get('purchase_date') or None,
        invoice_number=normalize_text(p.get('invoice_number', '')),
        notes=normalize_text(p.get('notes', '')),
    )
    return JsonResponse({'success': True, 'stock_purchase': _serialize(obj)}, status=201)
@require_http_methods(['PATCH', 'DELETE'])
@csrf_protect
def stock_purchase_detail_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na
    try:
        obj = StockPurchase.objects.get(id=pk)
    except StockPurchase.DoesNotExist:
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
    obj.vendor = normalize_text(p.get('vendor', obj.vendor))
    obj.quantity = p.get('quantity', obj.quantity)
    obj.unit = normalize_text(p.get('unit', obj.unit))
    obj.unit_price = p.get('unit_price', obj.unit_price)
    obj.total_price = p.get('total_price', obj.total_price)
    obj.purchase_date = p.get('purchase_date') or obj.purchase_date
    obj.invoice_number = normalize_text(p.get('invoice_number', obj.invoice_number))
    obj.notes = normalize_text(p.get('notes', obj.notes))
    obj.save()
    return JsonResponse({'success': True, 'stock_purchase': _serialize(obj)})
