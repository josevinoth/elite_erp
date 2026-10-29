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


def _serialize(vendor):
    return {
        'id': vendor.id,
        'name': vendor.name,
        'category_id': vendor.category_id,
        'category_name': vendor.category.name if vendor.category else '',
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

    vendor = Vendor.objects.create(
        name=name,
        category=category,
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
