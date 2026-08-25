from django.db import transaction
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..sub_models import PlaceStockOrderInfo, PlaceStockOrderItem, ProjectCostingItemInfo, Vendor


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return Response({"status": "error", "message": "Authentication required."}, status=401)
    return None


def _is_not_purchased(item):
    return str(getattr(getattr(item, "stock_status", None), "status_name", "")).strip().lower() == "not purchased"


def _serialize_vendor(vendor):
    return {
        "id": vendor.pk,
        "vendor_code": vendor.vendor_code,
        "vendor_name": vendor.name,
        "address": vendor.address,
        "phone_number": vendor.phone,
        "email_id": vendor.email,
        "contact_person": vendor.contact_person,
    }


def _serialize_costing_item(row):
    return {
        "id": row.pk,
        "costing_id": row.costing_id_id,
        "costing_code": getattr(row.costing_id, "costing_id", ""),
        "item_category": getattr(getattr(row, "item_category", None), "name", "") or "-",
        "item_name": row.item_name or "-",
        "item_code": getattr(getattr(row, "item_code", None), "item_code", "") or "-",
        "item_type": getattr(getattr(row, "item_type", None), "it_name", "") or "-",
        "purchase_qty": str(row.purchase_qty),
        "requested_qty": str(row.requested_qty),
        "length": str(row.length),
        "width": str(row.width),
        "height": str(row.height),
        "volume": str(row.volume),
        "stock_status": getattr(getattr(row, "stock_status", None), "status_name", "") or "-",
    }


@api_view(["GET"])
def place_stock_order_meta_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    vendors = Vendor.objects.order_by("name")
    rows = (
        ProjectCostingItemInfo.objects
        .select_related("costing_id", "item_category", "item_code", "item_type", "stock_status")
        .order_by("costing_id_id", "id")
    )
    not_purchased_rows = [row for row in rows if _is_not_purchased(row)]

    return Response(
        {
            "status": "success",
            "vendors": [_serialize_vendor(vendor) for vendor in vendors],
            "items": [_serialize_costing_item(row) for row in not_purchased_rows],
            "message": "Place stock order data loaded successfully.",
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@csrf_protect
def place_stock_order_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    vendor_id = request.data.get("vendor_id")
    item_ids = request.data.get("item_ids")
    email_id = str(request.data.get("email_id") or "").strip()

    if not vendor_id:
        return Response({"status": "error", "message": "Vendor is required."}, status=400)
    vendor = Vendor.objects.filter(pk=vendor_id).first()
    if not vendor:
        return Response({"status": "error", "message": "Selected vendor does not exist."}, status=404)

    if email_id and "@" not in email_id:
        return Response({"status": "error", "message": "Email must contain '@'."}, status=400)

    if not isinstance(item_ids, list) or not item_ids:
        return Response({"status": "error", "message": "Select at least one item."}, status=400)

    rows = list(
        ProjectCostingItemInfo.objects
        .select_related("costing_id", "stock_status")
        .filter(pk__in=item_ids)
    )
    if len(rows) != len(set(str(item_id) for item_id in item_ids)):
        return Response({"status": "error", "message": "One or more selected items are invalid."}, status=400)

    invalid_stock = [row for row in rows if not _is_not_purchased(row)]
    if invalid_stock:
        return Response({"status": "error", "message": "Only 'Not Purchased' items can be ordered."}, status=400)

    costing_ids = {row.costing_id_id for row in rows}
    if len(costing_ids) != 1:
        return Response({"status": "error", "message": "All selected items must belong to the same costing."}, status=400)

    with transaction.atomic():
        order = PlaceStockOrderInfo.objects.create(vendor=vendor, costing_id_id=rows[0].costing_id_id)
        PlaceStockOrderItem.objects.bulk_create(
            [PlaceStockOrderItem(order=order, costing_item=row) for row in rows],
            ignore_conflicts=True,
        )

    return Response(
        {
            "success": True,
            "status": "success",
            "message": "Stock order placed successfully.",
            "order": {
                "id": order.pk,
                "order_code": order.order_code,
                "vendor_id": vendor.pk,
                "costing_id": order.costing_id_id,
                "item_count": len(rows),
            },
        },
        status=status.HTTP_201_CREATED,
    )

