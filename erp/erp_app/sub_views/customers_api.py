import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from ..sub_models import Customer
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
        return request.user.username or "Admin"
    return "Admin"


def _serialize(customer):
    updated_by = _clean_user_display(getattr(customer, 'updated_by', '')) or 'Admin'
    return {
        'id': customer.id,
        'customer_code': customer.customer_code or '',
        'customer_name': customer.name,
        'name': customer.name,
        'contact_number': customer.contact_number or '',
        'phone': customer.contact_number or '',
        'phone_number': customer.contact_number or '',
        'address': customer.address or '',
        'email': customer.email or '',
        'email_id': customer.email or '',
        'updated_by': updated_by,
        'updated_at': customer.updated_at.isoformat() if customer.updated_at else '',
        'updated_on': customer.updated_at.strftime("%Y-%m-%d %H:%M:%S") if customer.updated_at else '',
        'projects_count': customer.projects.count() if hasattr(customer, 'projects') else 0,
    }


@require_GET
def list_customers_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    customers = Customer.objects.prefetch_related('projects').order_by('-id')
    return JsonResponse({'customers': [_serialize(c) for c in customers]})


@require_POST
@csrf_protect
def create_customer_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    payload = _read_json(request)
    name = normalize_text(payload.get('name') or payload.get('customer_name') or '')
    if not name:
        return JsonResponse({'message': 'Customer name is required.'}, status=400)

    if Customer.objects.filter(name__iexact=name).exists():
        return JsonResponse({'message': 'Customer name already exists.'}, status=400)

    contact_number = normalize_text(payload.get('contact_number') or payload.get('phone_number') or payload.get('phone') or '')
    address = normalize_text(payload.get('address', ''))
    email = normalize_text(payload.get('email') or payload.get('email_id') or '')
    if email and "@" not in email:
        return JsonResponse({'message': "Email must contain '@'."}, status=400)

    updated_by = _resolve_request_user(request, payload)

    customer = Customer(
        name=name,
        contact_number=contact_number,
        address=address,
        email=email,
        updated_by=updated_by,
    )
    customer.save()
    return JsonResponse({'success': True, 'customer': _serialize(customer)}, status=201)


@require_http_methods(["GET", "PATCH", "PUT", "DELETE"])
@csrf_protect
def customer_detail_api_view(request, customer_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    customer = Customer.objects.filter(pk=customer_id).first()
    if not customer:
        return JsonResponse({'message': 'Customer not found.'}, status=404)

    if request.method == "GET":
        return JsonResponse({'customer': _serialize(customer)})

    if request.method in ["PATCH", "PUT"]:
        payload = _read_json(request)
        if 'name' in payload or 'customer_name' in payload:
            name = normalize_text(payload.get('name') or payload.get('customer_name') or '')
            if not name:
                return JsonResponse({'message': 'Customer name cannot be empty.'}, status=400)
            if Customer.objects.filter(name__iexact=name).exclude(pk=customer.pk).exists():
                return JsonResponse({'message': 'Customer name already exists.'}, status=400)
            customer.name = name

        if 'contact_number' in payload or 'phone_number' in payload or 'phone' in payload:
            customer.contact_number = normalize_text(
                payload.get('contact_number') or payload.get('phone_number') or payload.get('phone') or ''
            )

        if 'address' in payload:
            customer.address = normalize_text(payload.get('address', ''))

        if 'email' in payload or 'email_id' in payload:
            email = normalize_text(payload.get('email') or payload.get('email_id') or '')
            if email and "@" not in email:
                return JsonResponse({'message': "Email must contain '@'."}, status=400)
            customer.email = email

        customer.updated_by = _resolve_request_user(request, payload)
        customer.save()
        return JsonResponse({'success': True, 'customer': _serialize(customer)})

    if request.method == "DELETE":
        linked_projects = list(customer.projects.values_list('project_id', flat=True))
        if linked_projects:
            return JsonResponse({
                'has_downstream': True,
                'message': f"Cannot delete customer '{customer.name}' because it is linked to {len(linked_projects)} project(s): {', '.join(linked_projects[:5])}.",
                'details': [f"Project: {pid}" for pid in linked_projects],
            }, status=400)

        customer_name = customer.name
        customer.delete()
        return JsonResponse({'success': True, 'message': f"Customer '{customer_name}' deleted successfully."})


@require_GET
def check_customer_downstream_api_view(request, customer_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    customer = Customer.objects.filter(pk=customer_id).first()
    if not customer:
        return JsonResponse({'message': 'Customer not found.'}, status=404)

    linked_projects = list(customer.projects.values_list('project_id', flat=True))
    has_downstream = len(linked_projects) > 0
    return JsonResponse({
        'has_downstream': has_downstream,
        'details': [f"Project: {pid}" for pid in linked_projects],
    })

