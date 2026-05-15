import json
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ..sub_models import StockPurchase, StockPurchaseItem, StockPurchaseVendorDetail, Vendor
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


def _to_decimal(value, fallback="0"):
    if value is None or value == "":
        return Decimal(str(fallback))
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal(str(fallback))


def _serialize_vendor_detail(vendor_detail):
    if not vendor_detail:
        return None
    return {
        "id": vendor_detail.id,
        "vendor_id": vendor_detail.vendor_id,
        "vendor_name": vendor_detail.vendor.name,
        "invoice_number": vendor_detail.invoice_number,
        "invoice_date": str(vendor_detail.invoice_date) if vendor_detail.invoice_date else "",
        "tax": str(vendor_detail.tax),
        "total_value": str(vendor_detail.total_value),
    }


def _serialize_item(item):
    raw_grn = str(item.grn_number or "").strip()
    if raw_grn and not raw_grn.upper().startswith("GRN"):
        raw_grn = f"GRN{item.id:04d}"

    return {
        "id": item.id,
        "grn_number": raw_grn,
        "item_category": item.item_category,
        "item_name": item.item_name,
        "item_code": item.item_code,
        "quantity": str(item.quantity),
        "unit_price": str(item.unit_price),
        "total_price": str(item.total_price),
    }


def _serialize(obj):
    items = list(obj.items.all())
    first_item = items[0] if items else None
    vendor_detail = _serialize_vendor_detail(obj.vendor_detail)

    return {
        "id": obj.id,
        "purchase_number": obj.purchase_number,
        "notes": obj.notes,
        "vendor_detail_id": obj.vendor_detail_id,
        "vendor_detail": vendor_detail,
        "items": [_serialize_item(item) for item in items],
        "items_count": len(items),
        "purchase_total": str(sum((item.total_price for item in items), Decimal("0"))),
        # legacy keys kept for UI compatibility where needed
        "item_name": first_item.item_name if first_item else "",
        "category": first_item.item_category if first_item else "",
        "vendor": vendor_detail["vendor_name"] if vendor_detail else "",
        "quantity": str(first_item.quantity) if first_item else "0",
        "unit": obj.unit,
        "unit_price": str(first_item.unit_price) if first_item else "0",
        "total_price": str(first_item.total_price) if first_item else "0",
        "purchase_date": vendor_detail["invoice_date"] if vendor_detail else (str(obj.purchase_date) if obj.purchase_date else ""),
        "invoice_number": vendor_detail["invoice_number"] if vendor_detail else obj.invoice_number,
    }


def _resolve_vendor_detail(payload):
    vendor_detail_id = payload.get("vendor_detail_id")
    if vendor_detail_id:
        vendor_detail = StockPurchaseVendorDetail.objects.filter(id=vendor_detail_id).first()
        if not vendor_detail:
            raise ValueError("Selected vendor detail record was not found.")
        return vendor_detail

    vendor_payload = payload.get("vendor_detail") or {}
    vendor_id = vendor_payload.get("vendor_id")
    if not vendor_id:
        return None

    vendor = Vendor.objects.filter(id=vendor_id).first()
    if not vendor:
        raise ValueError("Selected vendor was not found.")

    return StockPurchaseVendorDetail.objects.create(
        vendor=vendor,
        invoice_number=normalize_text(vendor_payload.get("invoice_number", "")),
        invoice_date=vendor_payload.get("invoice_date") or None,
        tax=_to_decimal(vendor_payload.get("tax"), "0"),
        total_value=_to_decimal(vendor_payload.get("total_value"), "0"),
    )


def _sync_items(stock_purchase, items_payload):
    stock_purchase.items.all().delete()

    for row in items_payload:
        item_name = normalize_text(row.get("item_name", ""))
        if not item_name:
            continue

        quantity = _to_decimal(row.get("quantity"), "0")
        unit_price = _to_decimal(row.get("unit_price"), "0")
        StockPurchaseItem.objects.create(
            stock_purchase=stock_purchase,
            item_category=normalize_text(row.get("item_category", "")),
            item_name=item_name,
            item_code=normalize_text(row.get("item_code", "")),
            quantity=quantity,
            unit_price=unit_price,
            total_price=quantity * unit_price,
        )


def _first_duplicate_code_in_payload(items_payload):
    seen = set()
    for row in items_payload:
        code = normalize_text(row.get("item_code", "")).upper()
        if not code:
            continue
        if code in seen:
            return code
        seen.add(code)
    return None


def _first_duplicate_name_in_payload(items_payload):
    seen = set()
    for row in items_payload:
        name = normalize_text(row.get("item_name", "")).lower()
        if not name:
            continue
        if name in seen:
            return row.get("item_name", "")
        seen.add(name)
    return None


def _first_duplicate_code_for_invoice(invoice_number, items_payload, exclude_purchase_id=None):
    invoice = normalize_text(invoice_number)
    if not invoice:
        return None

    candidate_codes = {
        normalize_text(row.get("item_code", "")).upper()
        for row in items_payload
        if normalize_text(row.get("item_code", ""))
    }
    if not candidate_codes:
        return None

    for code in candidate_codes:
        qs = StockPurchaseItem.objects.filter(
            stock_purchase__vendor_detail__invoice_number__iexact=invoice,
            item_code__iexact=code,
        )
        if exclude_purchase_id:
            qs = qs.exclude(stock_purchase_id=exclude_purchase_id)
        if qs.exists():
            return code
    return None


@require_GET
def list_stock_purchases_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    rows = StockPurchase.objects.select_related("vendor_detail").prefetch_related("items").order_by("-id")
    return JsonResponse({"stock_purchases": [_serialize(o) for o in rows]})


@require_POST
@csrf_protect
def create_stock_purchase_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na

    p = _read_json(request)

    purchase_number = normalize_text(p.get("purchase_number", "")) or None
    items_payload = p.get("items") or []
    if not isinstance(items_payload, list) or len(items_payload) == 0:
        return JsonResponse({"message": "At least one item is required."}, status=400)

    duplicate_code = _first_duplicate_code_in_payload(items_payload)
    if duplicate_code:
        return JsonResponse({"message": f"Duplicate item code ({duplicate_code}) is not allowed in the same invoice."}, status=400)

    duplicate_name = _first_duplicate_name_in_payload(items_payload)
    if duplicate_name:
        return JsonResponse({"message": f"Duplicate item name ({duplicate_name}) is not allowed in the same invoice."}, status=400)

    if purchase_number and StockPurchase.objects.filter(purchase_number=purchase_number).exists():
        return JsonResponse({"message": "Purchase number already exists."}, status=400)

    try:
        vendor_detail = _resolve_vendor_detail(p)
    except ValueError as exc:
        return JsonResponse({"message": str(exc)}, status=400)

    invoice_duplicate_code = _first_duplicate_code_for_invoice(vendor_detail.invoice_number if vendor_detail else "", items_payload)
    if invoice_duplicate_code:
        return JsonResponse({"message": f"Duplicate item code ({invoice_duplicate_code}) is not allowed for this invoice number."}, status=400)

    obj = StockPurchase.objects.create(
        purchase_number=purchase_number,
        vendor_detail=vendor_detail,
        notes=normalize_text(p.get("notes", "")),
        # legacy fields populated from first row for old integrations.
        item_name=normalize_text((items_payload[0] or {}).get("item_name", "")),
        category=normalize_text((items_payload[0] or {}).get("item_category", "")),
        vendor=vendor_detail.vendor.name if vendor_detail else "",
        quantity=_to_decimal((items_payload[0] or {}).get("quantity"), "0"),
        unit=normalize_text(p.get("unit", "")),
        unit_price=_to_decimal((items_payload[0] or {}).get("unit_price"), "0"),
        total_price=_to_decimal((items_payload[0] or {}).get("total_price"), "0"),
        purchase_date=vendor_detail.invoice_date if vendor_detail else None,
        invoice_number=vendor_detail.invoice_number if vendor_detail else "",
    )

    _sync_items(obj, items_payload)
    return JsonResponse({"success": True, "stock_purchase": _serialize(obj)}, status=201)


@require_http_methods(['GET', 'PATCH', 'DELETE'])
@csrf_protect
def stock_purchase_detail_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na
    try:
        obj = StockPurchase.objects.get(id=pk)
    except StockPurchase.DoesNotExist:
        return JsonResponse({'message': 'Record not found.'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'stock_purchase': _serialize(obj)})

    if request.method == 'DELETE':
        obj.delete()
        return JsonResponse({'success': True, 'message': 'Deleted.'})

    p = _read_json(request)

    purchase_number = normalize_text(p.get("purchase_number", obj.purchase_number or "")) or None
    if purchase_number:
        duplicate = StockPurchase.objects.filter(purchase_number=purchase_number).exclude(id=obj.id).exists()
        if duplicate:
            return JsonResponse({"message": "Purchase number already exists."}, status=400)

    obj.purchase_number = purchase_number
    obj.notes = normalize_text(p.get("notes", obj.notes))
    if "vendor_detail" in p or "vendor_detail_id" in p:
        try:
            obj.vendor_detail = _resolve_vendor_detail(p)
        except ValueError as exc:
            return JsonResponse({"message": str(exc)}, status=400)

    items_payload = p.get("items")
    if isinstance(items_payload, list):
        duplicate_code = _first_duplicate_code_in_payload(items_payload)
        if duplicate_code:
            return JsonResponse({"message": f"Duplicate item code ({duplicate_code}) is not allowed in the same invoice."}, status=400)

        duplicate_name = _first_duplicate_name_in_payload(items_payload)
        if duplicate_name:
            return JsonResponse({"message": f"Duplicate item name ({duplicate_name}) is not allowed in the same invoice."}, status=400)

        invoice_duplicate_code = _first_duplicate_code_for_invoice(
            obj.vendor_detail.invoice_number if obj.vendor_detail else "",
            items_payload,
            exclude_purchase_id=obj.id,
        )
        if invoice_duplicate_code:
            return JsonResponse({"message": f"Duplicate item code ({invoice_duplicate_code}) is not allowed for this invoice number."}, status=400)
        _sync_items(obj, items_payload)

    first_item = obj.items.order_by("id").first()
    if first_item:
        obj.item_name = first_item.item_name
        obj.category = first_item.item_category
        obj.quantity = first_item.quantity
        obj.unit_price = first_item.unit_price
        obj.total_price = first_item.total_price

    if obj.vendor_detail:
        obj.vendor = obj.vendor_detail.vendor.name
        obj.invoice_number = obj.vendor_detail.invoice_number
        obj.purchase_date = obj.vendor_detail.invoice_date

    obj.save()
    return JsonResponse({'success': True, 'stock_purchase': _serialize(obj)})
