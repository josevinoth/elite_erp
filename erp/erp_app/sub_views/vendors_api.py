import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from ..sub_models import Vendor, VendorCategory
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


def _clean_user_display(val):
    if not val:
        return ""
    if isinstance(val, dict):
        return val.get("username") or val.get("name") or str(val.get("id") or "")
    val_str = str(val).strip()
    if val_str.startswith("{") and ("username" in val_str or "name" in val_str):
        import re
        m = re.search(r"['\"]username['\"]\s*:\s*['\"]([^'\"]+)['\"]", val_str)
        if m:
            return m.group(1)
        m2 = re.search(r"['\"](?:name|label)['\"]\s*:\s*['\"]([^'\"]+)['\"]", val_str)
        if m2:
            return m2.group(1)
    return val_str


def _resolve_request_user(request, payload=None):
    if payload:
        user_val = payload.get("updated_by") or payload.get("created_by")
        if user_val:
            cleaned = _clean_user_display(user_val)
            if cleaned:
                return cleaned
    if request and request.user and request.user.is_authenticated:
        return request.user.username or "Jose"
    return "Jose"


def _serialize(vendor):
    updated_by = _clean_user_display(getattr(vendor, 'updated_by', '')) or 'Jose'
    return {
        'id': vendor.id,
        'vendor_code': vendor.vendor_code or '',
        'vendor_name': vendor.name,
        'name': vendor.name,
        'category_id': vendor.category_id,
        'category_name': vendor.category.name if vendor.category else '',
        'contact_person': vendor.contact_person,
        'phone_number': vendor.phone,
        'phone': vendor.phone,
        'email_id': vendor.email,
        'email': vendor.email,
        'address': vendor.address,
        'updated_at': vendor.updated_at.isoformat() if vendor.updated_at else '',
        'updated_on': vendor.updated_at.strftime("%Y-%m-%d %H:%M:%S") if vendor.updated_at else '',
        'updated_by': updated_by,
    }


@require_GET
def list_vendors_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    vendors = Vendor.objects.select_related('category').order_by('-id')
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

    # Check duplicate vendor name (case-insensitive)
    if Vendor.objects.filter(name__iexact=name).exists():
        return JsonResponse({'message': 'Vendor name already exists.'}, status=400)

    category_id = payload.get('category_id') or payload.get('category')
    category = None
    if category_id:
        if str(category_id).isdigit():
            category = VendorCategory.objects.filter(id=int(category_id)).first()
        else:
            category = VendorCategory.objects.filter(name__iexact=str(category_id).strip()).first()

    updated_by = _resolve_request_user(request, payload)
    vendor = Vendor.objects.create(
        name=name,
        category=category,
        contact_person=normalize_text(payload.get('contact_person', '')),
        email=normalize_text(payload.get('email', '')),
        phone=normalize_text(payload.get('phone', '')),
        address=normalize_text(payload.get('address', '')),
        updated_by=updated_by,
    )
    return JsonResponse({'success': True, 'vendor': _serialize(vendor)}, status=201)


@require_http_methods(['PATCH', 'DELETE'])
@csrf_protect
def vendor_detail_api_view(request, vendor_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    try:
        vendor = Vendor.objects.select_related('category').get(id=vendor_id)
    except Vendor.DoesNotExist:
        return JsonResponse({'message': 'Vendor not found.'}, status=404)
    if request.method == 'DELETE':
        vendor.delete()
        return JsonResponse({'success': True, 'message': 'Vendor deleted.'})
    payload = _read_json(request)
    name = normalize_text(payload.get('name', vendor.name))
    if not name:
        return JsonResponse({'message': 'Name is required.'}, status=400)

    if name.lower() != vendor.name.lower() and Vendor.objects.filter(name__iexact=name).exclude(id=vendor.id).exists():
        return JsonResponse({'message': 'Vendor name already exists.'}, status=400)

    if 'category_id' in payload or 'category' in payload:
        cat_val = payload.get('category_id') or payload.get('category')
        if not cat_val:
            vendor.category = None
        elif str(cat_val).isdigit():
            vendor.category = VendorCategory.objects.filter(id=int(cat_val)).first()
        else:
            vendor.category = VendorCategory.objects.filter(name__iexact=str(cat_val).strip()).first()

    vendor.name = name
    vendor.contact_person = normalize_text(payload.get('contact_person', vendor.contact_person))
    vendor.email = normalize_text(payload.get('email', vendor.email))
    vendor.phone = normalize_text(payload.get('phone', vendor.phone))
    vendor.address = normalize_text(payload.get('address', vendor.address))
    vendor.updated_by = _resolve_request_user(request, payload)
    vendor.save()
    return JsonResponse({'success': True, 'vendor': _serialize(vendor)})


@require_GET
def list_vendor_categories_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    # Ensure default categories exist
    for default_cat in ["Oman", "Overseas"]:
        VendorCategory.objects.get_or_create(name=default_cat)

    categories = VendorCategory.objects.order_by("name")
    return JsonResponse({
        'categories': [{'id': c.id, 'name': c.name} for c in categories]
    })


@require_POST
@csrf_protect
def create_vendor_category_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    payload = _read_json(request)
    name = normalize_text(payload.get('name', ''))
    if not name:
        return JsonResponse({'message': 'Category name is required.'}, status=400)

    if VendorCategory.objects.filter(name__iexact=name).exists():
        return JsonResponse({'message': 'Vendor category already exists.'}, status=400)

    category = VendorCategory.objects.create(name=name)
    return JsonResponse({'success': True, 'category': {'id': category.id, 'name': category.name}}, status=201)
