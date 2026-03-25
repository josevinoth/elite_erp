import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from ..sub_models import Vendor
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
def _serialize(vendor):
    return {
        'id': vendor.id,
        'name': vendor.name,
        'contact_person': vendor.contact_person,
        'email': vendor.email,
        'phone': vendor.phone,
        'address': vendor.address,
    }
@require_GET
def list_vendors_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    vendors = Vendor.objects.all()
    return JsonResponse({'vendors': [_serialize(v) for v in vendors]})
@require_POST
@csrf_protect
def create_vendor_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    payload = _read_json(request)
    name = normalize_text(payload.get('name', ''))
    if not name:
        return JsonResponse({'message': 'Name is required.'}, status=400)
    vendor = Vendor.objects.create(
        name=name,
        contact_person=normalize_text(payload.get('contact_person', '')),
        email=normalize_text(payload.get('email', '')),
        phone=normalize_text(payload.get('phone', '')),
        address=normalize_text(payload.get('address', '')),
    )
    return JsonResponse({'success': True, 'vendor': _serialize(vendor)}, status=201)
@require_http_methods(['PATCH', 'DELETE'])
@csrf_protect
def vendor_detail_api_view(request, vendor_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    try:
        vendor = Vendor.objects.get(id=vendor_id)
    except Vendor.DoesNotExist:
        return JsonResponse({'message': 'Vendor not found.'}, status=404)
    if request.method == 'DELETE':
        vendor.delete()
        return JsonResponse({'success': True, 'message': 'Vendor deleted.'})
    payload = _read_json(request)
    name = normalize_text(payload.get('name', vendor.name))
    if not name:
        return JsonResponse({'message': 'Name is required.'}, status=400)
    vendor.name = name
    vendor.contact_person = normalize_text(payload.get('contact_person', vendor.contact_person))
    vendor.email = normalize_text(payload.get('email', vendor.email))
    vendor.phone = normalize_text(payload.get('phone', vendor.phone))
    vendor.address = normalize_text(payload.get('address', vendor.address))
    vendor.save()
    return JsonResponse({'success': True, 'vendor': _serialize(vendor)})
