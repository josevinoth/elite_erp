import json
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods, require_POST

from ..sub_models import StockPurchaseVendorDetail, Vendor
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


def _to_decimal(value, fallback="0"):
    if value is None or value == "":
        return Decimal(str(fallback))
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal(str(fallback))


def _serialize(obj):
    return {
        "id": obj.pk,
        "vendor_id": obj.vendor.pk,
        "vendor_name": obj.vendor.name,
        "invoice_number": obj.invoice_number,
        "invoice_date": str(obj.invoice_date) if obj.invoice_date else "",
        "tax": str(obj.tax),
        "total_value": str(obj.total_value),
    }


def _resolve_vendor(vendor_id):
    if not vendor_id:
        return None
    return Vendor.objects.filter(id=vendor_id).first()


def _invoice_number_exists(invoice_number, exclude_id=None):
    normalized = normalize_text(invoice_number)
    if not normalized:
        return False

    qs = StockPurchaseVendorDetail.objects.filter(invoice_number__iexact=normalized)
    if exclude_id is not None:
        qs = qs.exclude(id=exclude_id)
    return qs.exists()



@require_POST
@csrf_protect
def create_stock_purchase_vendor_detail_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    payload = _read_json(request)
    vendor = _resolve_vendor(payload.get("vendor_id"))
    if not vendor:
        return JsonResponse({"message": "Vendor is required."}, status=400)

    invoice_number = normalize_text(payload.get("invoice_number", ""))
    invoice_date = payload.get("invoice_date") or None
    if not invoice_number:
        return JsonResponse({"message": "Invoice number is required."}, status=400)
    if not invoice_date:
        return JsonResponse({"message": "Invoice date is required."}, status=400)
    if _invoice_number_exists(invoice_number):
        return JsonResponse({"message": "Invoice number already exists."}, status=400)

    obj = StockPurchaseVendorDetail.objects.create(
        vendor=vendor,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        tax=_to_decimal(payload.get("tax"), "0"),
        total_value=_to_decimal(payload.get("total_value"), "0"),
    )
    return JsonResponse({"success": True, "vendor_detail": _serialize(obj)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@csrf_protect
def stock_purchase_vendor_detail_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na

    try:
        obj = StockPurchaseVendorDetail.objects.get(id=pk)
    except StockPurchaseVendorDetail.DoesNotExist:
        return JsonResponse({"message": "Record not found."}, status=404)

    if request.method == "DELETE":
        obj.delete()
        return JsonResponse({"success": True, "message": "Deleted."})

    payload = _read_json(request)
    next_vendor = _resolve_vendor(payload.get("vendor_id")) if "vendor_id" in payload else obj.vendor
    if not next_vendor:
        return JsonResponse({"message": "Vendor is required."}, status=400)

    next_invoice_number = normalize_text(payload.get("invoice_number", obj.invoice_number))
    next_invoice_date = payload.get("invoice_date") or obj.invoice_date
    if not next_invoice_number:
        return JsonResponse({"message": "Invoice number is required."}, status=400)
    if not next_invoice_date:
        return JsonResponse({"message": "Invoice date is required."}, status=400)
    if _invoice_number_exists(next_invoice_number, exclude_id=obj.pk):
        return JsonResponse({"message": "Invoice number already exists."}, status=400)

    obj.vendor = next_vendor
    obj.invoice_number = next_invoice_number
    obj.invoice_date = next_invoice_date
    obj.tax = _to_decimal(payload.get("tax", obj.tax), str(obj.tax))
    obj.total_value = _to_decimal(payload.get("total_value", obj.total_value), str(obj.total_value))
    obj.save()
    return JsonResponse({"success": True, "vendor_detail": _serialize(obj)})

