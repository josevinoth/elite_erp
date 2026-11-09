from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..sub_models import (
    PlaceStockOrderInfo,
    PlaceStockOrderItem,
    ProjectCostingItemInfo,
    ProjectQuotationItemInfo,
    LabFurnitureItem,
    Vendor,
)


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return Response({"status": "error", "message": "Authentication required."}, status=401)
    return None


def _format_user_name(user):
    if not user:
        return ""
    full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
    return full_name or getattr(user, "username", "") or ""


def _serialize_vendor(vendor):
    return {
        "id": vendor.pk,
        "vendor_code": vendor.vendor_code or "",
        "vendor_name": vendor.name or "",
        "address": vendor.address or "",
        "phone_number": vendor.phone or "",
        "email_id": vendor.email or "",
        "contact_person": vendor.contact_person or "",
    }


def _serialize_order_item(item):
    from ..sub_models.stock_purchase import StockPurchaseItem
    received_sum = StockPurchaseItem.objects.filter(po_item=item).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
    if received_sum == 0 and item.item_code_ref_id:
        received_sum = StockPurchaseItem.objects.filter(vendor_detail__purchase_order=item.order, item_code_id=item.item_code_ref_id).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
    balance_qty = max(Decimal("0"), item.order_qty - received_sum)
    return {
        "id": item.pk,
        "item_code_ref_id": item.item_code_ref_id,
        "item_code": item.item_code,
        "item_name": item.item_name,
        "item_category": item.item_category,
        "combined_label": item.combined_label,
        "requested_qty": str(item.requested_qty),
        "order_qty": str(item.order_qty),
        "received_qty": str(received_sum),
        "balance_qty": str(balance_qty),
        "stage": item.stage,
        "reference_number": item.reference_number,
        "project_id": item.project_id,
        "project_name": item.project_name,
        "costing_item_id": item.costing_item_id,
        "quotation_item_id": item.quotation_item_id,
        "created_at": item.created_at.strftime("%Y-%m-%d %H:%M") if item.created_at else "",
    }


def sync_all_master_item_ordered_qty():
    """
    Recalculates ordered_qty on all LabFurnitureItem records based on active POs
    (status 'Order Placed' or 'Order Partially Received'), and updates
    physical_plus_ordered_qty and to_order_qty.
    """
    from collections import defaultdict
    from ..sub_models.stock_purchase import StockPurchaseItem

    active_po_items = (
        PlaceStockOrderItem.objects.filter(
            order__status__in=["Order Placed", "Order Partially Received"]
        )
        .select_related("order", "item_code_ref", "item_code_ref__item_code_ref")
    )

    received_by_po_item = dict(
        StockPurchaseItem.objects.filter(po_item__isnull=False)
        .values("po_item_id")
        .annotate(tot=Sum("quantity"))
        .values_list("po_item_id", "tot")
    )

    ordered_by_code = defaultdict(Decimal)
    for p in active_po_items:
        rec = received_by_po_item.get(p.id) or Decimal("0")
        bal = max(Decimal("0"), p.order_qty - rec)
        if bal <= 0:
            continue
        code = (p.item_code or "").strip().upper()
        if not code and p.item_code_ref and getattr(p.item_code_ref, "item_code_ref", None):
            code = p.item_code_ref.item_code_ref.item_code.strip().upper()
        if code:
            ordered_by_code[code] += bal

    all_masters = LabFurnitureItem.objects.select_related("item_code_ref")
    for m in all_masters:
        if not m.item_code_ref:
            continue
        code = m.item_code_ref.item_code.strip().upper()
        new_ord = ordered_by_code.get(code, Decimal("0"))
        phys = Decimal(str(m.physical_qty or 0))
        tot_req = Decimal(str(m.total_reqd or 0))
        rec_free = Decimal(str(m.recommended_free_stock_qty or 0))

        phys_plus_ord = phys + new_ord
        to_ord = tot_req - phys_plus_ord
        to_ord_inc = tot_req + rec_free - phys_plus_ord

        if (m.ordered_qty != new_ord or
            m.physical_plus_ordered_qty != phys_plus_ord or
            m.to_order_qty != to_ord or
            m.to_order_qty_including_free_stock != to_ord_inc):
            m.ordered_qty = new_ord
            m.physical_plus_ordered_qty = phys_plus_ord
            m.to_order_qty = to_ord
            m.to_order_qty_including_free_stock = to_ord_inc
            m.save(update_fields=[
                "ordered_qty",
                "physical_plus_ordered_qty",
                "to_order_qty",
                "to_order_qty_including_free_stock",
            ])


def update_po_status_from_grn(po):
    """
    Recalculates and updates the PO status based on received GRN quantities:
    - If all items in the PO have received_sum >= order_qty -> 'Order Received'
    - Else if any item has received_sum > 0 -> 'Order Partially Received'
    - Else -> 'Order Placed'
    """
    if not po:
        return None
    if isinstance(po, (int, str)) and str(po).isdigit():
        po = PlaceStockOrderInfo.objects.filter(pk=int(po)).first()
    if not po or po.status == "Cancelled":
        return po

    from ..sub_models.stock_purchase import StockPurchaseItem
    po_items = list(po.items.all())
    if not po_items:
        return po

    all_fully_received = True
    any_received = False

    for item in po_items:
        received_sum = StockPurchaseItem.objects.filter(po_item=item).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
        if received_sum == 0 and item.item_code_ref_id:
            received_sum = StockPurchaseItem.objects.filter(vendor_detail__purchase_order=po, item_code_id=item.item_code_ref_id).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
        if received_sum > 0:
            any_received = True
        if received_sum < item.order_qty:
            all_fully_received = False

    if all_fully_received:
        new_status = "Order Received"
    elif any_received:
        new_status = "Order Partially Received"
    else:
        new_status = "Order Placed"

    if po.status != new_status:
        po.status = new_status
        po.save(update_fields=["status", "updated_at"])
    sync_all_master_item_ordered_qty()
    return po


def _serialize_order(order, include_items=False):
    vendor = order.vendor
    data = {
        "id": order.pk,
        "po_number": order.order_code,
        "order_code": order.order_code,
        "vendor_id": order.vendor_id,
        "vendor_code": vendor.vendor_code or "",
        "vendor_name": vendor.name or "",
        "vendor_phone": vendor.phone or "",
        "vendor_email": vendor.email or "",
        "vendor_address": vendor.address or "",
        "vendor_contact_person": vendor.contact_person or "",
        "total_items": order.total_items or order.items.count(),
        "total_qty": str(order.total_qty),
        "status": order.status,
        "created_at": order.created_at.strftime("%Y-%m-%d %H:%M") if order.created_at else "",
        "created_by": _format_user_name(order.created_by),
    }
    if include_items:
        data["items"] = [_serialize_order_item(i) for i in order.items.all()]
    return data


@api_view(["GET"])
def list_placed_stock_orders_api_view(request):
    """
    List all created Purchase Orders (Place Stock Orders).
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    orders = (
        PlaceStockOrderInfo.objects.select_related("vendor", "created_by")
        .prefetch_related("items")
        .order_by("-id")
    )
    return Response({
        "status": "success",
        "orders": [_serialize_order(o, include_items=False) for o in orders],
        "total": orders.count(),
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
def placed_stock_order_detail_api_view(request, pk):
    """
    Retrieve single Purchase Order with complete itemized rows.
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    order = (
        PlaceStockOrderInfo.objects.select_related("vendor", "created_by")
        .prefetch_related("items")
        .filter(pk=pk)
        .first()
    )
    if not order:
        return Response({"status": "error", "message": "Purchase order not found."}, status=404)

    order_dict = _serialize_order(order, include_items=True)
    return Response({
        "status": "success",
        "order": order_dict,
        "items": order_dict.get("items", []),
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
def place_stock_order_vendors_api_view(request):
    """
    Return vendors list and all catalog items for the Place Order modal dropdown.
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    vendors = Vendor.objects.order_by("name")

    master_items = (
        LabFurnitureItem.objects.select_related("item_code_ref", "item_name_ref", "item_category")
        .order_by("item_code_ref__item_code")
    )
    serialized_items = []
    for it in master_items:
        code = it.item_code_ref.item_code if it.item_code_ref else ""
        name = it.item_name_ref.item_name if it.item_name_ref else (it.item_name or "")
        cat = it.item_category.name if it.item_category else ""
        combined = f"{code} _ {cat} _ {name}".strip(" _")
        serialized_items.append({
            "id": f"master-{it.pk}",
            "item_code_ref_id": it.pk,
            "item_code": code,
            "item_name": name,
            "item_category": cat,
            "combined_label": combined,
            "stage": "Manual",
            "requested_qty": "0.00",
            "order_qty": "1.00",
        })

    return Response({
        "status": "success",
        "vendors": [_serialize_vendor(v) for v in vendors],
        "master_items": serialized_items,
    }, status=status.HTTP_200_OK)


@api_view(["POST"])
@csrf_protect
def create_place_stock_order_api_view(request):
    """
    Create a new Purchase Order (PO_FY(26_27)_0000+ID) with vendor details and items.
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    vendor_id = request.data.get("vendor_id")
    items_data = request.data.get("items") or []

    if not vendor_id:
        return Response({"status": "error", "message": "Vendor is required."}, status=400)

    vendor = Vendor.objects.filter(pk=vendor_id).first()
    if not vendor:
        return Response({"status": "error", "message": "Selected vendor not found."}, status=404)

    if not isinstance(items_data, list) or len(items_data) == 0:
        return Response({"status": "error", "message": "At least one item is required to place an order."}, status=400)

    with transaction.atomic():
        order = PlaceStockOrderInfo.objects.create(
            vendor=vendor,
            created_by=request.user if request.user.is_authenticated else None,
            status="Order Placed",
        )

        item_objs = []
        total_qty = Decimal("0")

        for row in items_data:
            qty_val = Decimal(str(row.get("order_qty") or row.get("requested_qty") or "0"))
            req_qty_val = Decimal(str(row.get("requested_qty") or "0"))
            total_qty += qty_val

            code = str(row.get("item_code") or "").strip()
            name = str(row.get("item_name") or "").strip()
            cat = str(row.get("item_category") or "").strip()
            combined = str(row.get("combined_label") or "").strip()
            if not combined:
                combined = f"{code} _ {cat} _ {name}".strip(" _")

            ref_id = row.get("item_code_ref_id")
            item_ref = None
            if ref_id:
                item_ref = LabFurnitureItem.objects.filter(pk=ref_id).first()
            elif code:
                item_ref = LabFurnitureItem.objects.filter(item_code_ref__item_code__iexact=code).first()

            if item_ref:
                if not code and item_ref.item_code_ref:
                    code = item_ref.item_code_ref.item_code
                if not name and item_ref.item_name_ref:
                    name = item_ref.item_name_ref.item_name
                if not cat and item_ref.item_category:
                    cat = item_ref.item_category.name
                if not combined:
                    combined = f"{code} _ {cat} _ {name}".strip(" _")

            costing_item_id = row.get("costing_item_id")
            if not costing_item_id and row.get("stage") == "Costing":
                costing_item_id = row.get("item_id")
            if not costing_item_id and str(row.get("id", "")).startswith("cost-"):
                try:
                    costing_item_id = int(str(row.get("id")).replace("cost-", ""))
                except Exception:
                    pass

            costing_item = None
            if costing_item_id:
                costing_item = ProjectCostingItemInfo.objects.filter(pk=costing_item_id).first()

            quotation_item_id = row.get("quotation_item_id")
            if not quotation_item_id and row.get("stage") == "Quotation":
                quotation_item_id = row.get("item_id")
            if not quotation_item_id and str(row.get("id", "")).startswith("quot-"):
                try:
                    quotation_item_id = int(str(row.get("id")).replace("quot-", ""))
                except Exception:
                    pass

            quotation_item = None
            if quotation_item_id:
                quotation_item = ProjectQuotationItemInfo.objects.filter(pk=quotation_item_id).first()

            item_objs.append(
                PlaceStockOrderItem(
                    order=order,
                    item_code_ref=item_ref,
                    item_code=code,
                    item_name=name,
                    item_category=cat,
                    combined_label=combined,
                    requested_qty=req_qty_val,
                    order_qty=qty_val,
                    stage=str(row.get("stage") or "Manual").strip(),
                    reference_number=str(row.get("reference_number") or "").strip(),
                    project_id=str(row.get("project_id") or "").strip(),
                    project_name=str(row.get("project_name") or "").strip(),
                    costing_item=costing_item,
                    quotation_item=quotation_item,
                )
            )

        PlaceStockOrderItem.objects.bulk_create(item_objs)

        order.total_items = len(item_objs)
        order.total_qty = total_qty
        order.save(update_fields=["total_items", "total_qty"])

    sync_all_master_item_ordered_qty()

    return Response(
        {
            "success": True,
            "status": "success",
            "message": f"Purchase Order {order.order_code} created successfully.",
            "order": _serialize_order(order, include_items=True),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@csrf_protect
def cancel_placed_stock_order_api_view(request, pk):
    """
    Cancel a Purchase Order. Its ordered items will return to 'Items to Order'.
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    order = PlaceStockOrderInfo.objects.filter(pk=pk).first()
    if not order:
        return Response({"status": "error", "message": "Purchase Order not found."}, status=404)

    if str(order.status).lower() == "cancelled":
        return Response({"status": "error", "message": "This Purchase Order is already cancelled."}, status=400)

    order.status = "Cancelled"
    order.save(update_fields=["status", "updated_at"])

    sync_all_master_item_ordered_qty()

    return Response({
        "success": True,
        "status": "success",
        "message": f"Purchase Order {order.order_code} has been cancelled successfully.",
        "order": _serialize_order(order, include_items=True),
    }, status=status.HTTP_200_OK)


# Aliases for backwards compatibility
place_stock_order_api_view = create_place_stock_order_api_view
place_stock_order_meta_api_view = place_stock_order_vendors_api_view

