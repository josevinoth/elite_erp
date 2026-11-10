from collections import defaultdict
from decimal import Decimal
from django.db.models import Sum

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..sub_models.project_costing_items_mod import ProjectCostingItemInfo
from ..sub_models.project_quotation_items_mod import ProjectQuotationItemInfo
from ..sub_models.place_stock_order_mod import PlaceStockOrderItem
from ..sub_models.lab_furniture_item import LabFurnitureItem
from ..sub_models.stock_purchase import StockPurchaseItem


def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return Response({"status": "error", "message": "Authentication required."}, status=401)
    return None


def _format_user_name(user):
    if not user:
        return ""
    full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
    return full_name or getattr(user, "username", "") or ""


def _resolve_requested_by(item, project=None):
    req_user = getattr(item, "requested_by", None)
    if req_user:
        name = _format_user_name(req_user)
        if name:
            return name

    if project:
        owner = getattr(project, "project_owner", None)
        if owner:
            name = _format_user_name(owner)
            if name:
                return name

        updated = getattr(project, "updated_by", None)
        if updated:
            name = _format_user_name(updated)
            if name:
                return name

    return "—"


def _resolve_item_type_name(item):
    for obj in (getattr(item, "item_type", None), getattr(getattr(item, "item_code", None), "item_type", None)):
        if not obj:
            continue
        val = getattr(obj, "it_name", None) or getattr(obj, "name", None) or str(obj)
        val = str(val or "").strip()
        if val and val.lower() != "none":
            return val
    return "—"


@api_view(["GET"])
def items_to_order_api_view(request):
    """
    Retrieve missing stock items from Work In Progress Costings and Quotations,
    aggregated item-wise (one consolidated row per unique item code).
    Precedence rule: If a project contains both a Quotation and a Costing,
    the items in Costing are considered (Costing is the cloned version of Quotation).
    Costing items require retrieval_status 'Item Requested'.
    Deducts available warehouse stock and active PO ordered quantities across items.
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    project_id = request.GET.get("project_id")
    stage_filter = str(request.GET.get("stage") or "").strip().lower()

    # 1. Pre-query active PO items (status "Order Placed" or "Order Partially Received")
    # Cancelled POs are excluded (so cancelled items return to Items to Order).
    # Order Received POs are excluded here because received items are in physical stock.
    active_po_items = (
        PlaceStockOrderItem.objects.filter(
            order__status__in=["Order Placed", "Order Partially Received"]
        )
        .select_related("order", "item_code_ref", "item_code_ref__item_code_ref")
    )

    # 1. Pull missing stock from Completed Quotations
    if not stage_filter or stage_filter == "quotation":
        quotation_items = (
            ProjectQuotationItemInfo.objects.filter(
                quotation_number__status__status_name__iexact="Completed",
                cost_type__name__iexact="MATERIAL",
            )
            .select_related(
                "quotation_number",
                "quotation_number__project",
                "quotation_number__project__project_owner",
                "quotation_number__project__updated_by",
                "item_code",
                "item_code__item_type",
                "item_code",
                "item_category",
                "item_type",
                "stock_status",
            )
            .order_by("-quotation_number__updated_at", "id")
        )
        if project_id:
            quotation_items = quotation_items.filter(quotation_number__project_id=project_id)

        for item in quotation_items:
            req_qty = Decimal(str(item.requested_qty or 0))
            pur_qty = Decimal(str(item.purchase_qty or 0))
            missing_qty = req_qty - pur_qty if pur_qty > 0 else req_qty
            status_name = str(getattr(item.stock_status, "status_name", "") or "")
            is_missing = (
                missing_qty > 0
                or status_name.lower() in {"no stock", "partial stock", "not purchased"}
                or pur_qty <= 0
            )
            if is_missing and missing_qty > 0:
                project = getattr(item.quotation_number, "project", None) if getattr(item, "quotation_number", None) else None
                req_by = _resolve_requested_by(item, project)
                req_date = (
                    item.created_at.strftime("%Y-%m-%d %H:%M")
                    if getattr(item, "created_at", None)
                    else (
                        item.quotation_number.created_at.strftime("%Y-%m-%d %H:%M")
                        if getattr(item, "quotation_number", None) and getattr(item.quotation_number, "created_at", None)
                        else "—"
                    )
                )
                project = getattr(item.quotation_number, "project", None)
                owner = getattr(project, "project_owner", None)
                req_by = (
                    f"{owner.first_name} {owner.last_name}".strip() or owner.username
                    if owner
                    else "—"
                )
                req_date = (
                    item.created_at.strftime("%Y-%m-%d %H:%M")
                    if getattr(item, "created_at", None)
                    else (
                        item.quotation_number.created_at.strftime("%Y-%m-%d %H:%M")
                        if getattr(item, "quotation_number", None) and getattr(item.quotation_number, "created_at", None)
                        else "—"
                    )
                )
                cat_name = getattr(item.item_category, "name", "") or getattr(item.item_code, "item_category_name", "") or "—"
                code_name = getattr(item.item_code, "item_code", "") or "—"
                item_name = item.item_name or getattr(item.item_code, "item_name", "") or "—"
                type_name = _resolve_item_type_name(item)
                quo_num = getattr(item.quotation_number, "quotation_number", "") or (f"Q-{item.quotation_number_id}" if getattr(item, "quotation_number_id", None) else "—")
                proj_id = getattr(project, "project_id", "") or (str(project.id) if project else "") or "—"
                proj_name = getattr(project, "project_name", "") or getattr(item.quotation_number, "project_name", "") or "—"
                type_name = getattr(getattr(item, "item_type", None), "name", "") or getattr(getattr(item.item_code, "item_type", None), "name", "") or "—"

                results.append({
                    "id": f"quo-{item.id}",
                    "item_id": item.id,
                    "stage": "Quotation",
                    "quotation_number": quo_num,
                    "costing_number": "—",
                    "reference_number": quo_num,
                    "project_id": proj_id,
                    "project_name": proj_name,
                    "quotation_number": item.quotation_number.quotation_number or f"Q-{item.quotation_number_id}",
                    "costing_number": "—",
                    "reference_number": item.quotation_number.quotation_number or f"Q-{item.quotation_number_id}",
                    "project_id": getattr(project, "project_id", "") or str(project.id),
                    "project_name": getattr(project, "project_name", "") or item.quotation_number.project_name or "—",
                    "item_category": cat_name,
                    "item_name": item_name,
                    "item_code": code_name,
                    "item_type": type_name,
                    "requested_qty": str(req_qty),
                    "purchase_qty": str(pur_qty),
                    "order_qty": str(missing_qty),
                    "stock_status": status_name or ("Partial Stock" if pur_qty > 0 else "No Stock"),
                    "requested_by": req_by,
                    "requested_date": req_date,
                    "updated_by": req_by,
                    "updated_on": req_date,
                })

    # 2. Pull missing stock from Completed Costings
    if not stage_filter or stage_filter == "costing":
        costing_items = (
            ProjectCostingItemInfo.objects.filter(
                costing_id__status__status_name__iexact="Completed",
                cost_type__name__iexact="MATERIAL",
            )
            .select_related(
                "costing_id",
                "costing_id__quotation_number",
                "costing_id__project",
                "costing_id__project__project_owner",
                "costing_id__project__updated_by",
                "item_code",
                "item_code__item_type",
                "item_code",
                "item_category",
                "item_type",
                "stock_status",
                "requested_by",
            )
            entry["item_type"] = _resolve_item_type_name(c)

    # 4. Pull missing stock from Work In Progress Quotations (exclude projects already in Costing)
    quotation_items = (
        ProjectQuotationItemInfo.objects.filter(
            quotation_number__status__status_name__iexact="Work In Progress",
            cost_type__name__iexact="MATERIAL",
            requested_qty__gt=0,
        )
        .exclude(quotation_number__project_id__in=costing_project_ids)
        .select_related(
            "quotation_number",
            "quotation_number__project",
            "item_code",
            "item_code__item_code_ref",
            "item_code__item_type",
            "item_code__item_category",
            "item_category",
            "item_type",
        )
        .order_by("-quotation_number__updated_at", "id")
    )
    if project_id:
        quotation_items = quotation_items.filter(quotation_number__project_id=project_id)

    quotation_by_code = defaultdict(lambda: {
        "requested_qty": Decimal("0"),
        "item_code_ref_id": None,
        "item_name": "",
        "item_category": "",
        "item_type": "",
        "count": 0,
        "stage": "Quotation",
    })

    for q in quotation_items:
        code = getattr(q.item_code, "item_code", "") or ""
        code = code.strip().upper()
        if not code:
            continue
        entry = quotation_by_code[code]
        entry["requested_qty"] += Decimal(str(q.requested_qty or 0))
        entry["count"] += 1
        if not entry["item_code_ref_id"]:
            entry["item_code_ref_id"] = getattr(q, "item_code_id", None)
            entry["item_name"] = q.item_name or getattr(q.item_code, "item_name", "") or ""
            entry["item_category"] = (
                getattr(q.item_category, "name", "")
                or getattr(getattr(q.item_code, "item_category", None), "name", "")
                or ""
            )
            if is_missing and missing_qty > 0:
                project = getattr(item.costing_id, "project", None) if getattr(item, "costing_id", None) else None
                req_by = _resolve_requested_by(item, project)
                req_date = (
                    item.requested_on.strftime("%Y-%m-%d %H:%M")
                    if getattr(item, "requested_on", None)
                    else (
                        item.created_at.strftime("%Y-%m-%d %H:%M")
                        if getattr(item, "created_at", None)
                        else (
                            item.costing_id.created_at.strftime("%Y-%m-%d %H:%M")
                            if getattr(item, "costing_id", None) and getattr(item.costing_id, "created_at", None)
                            else "—"
                        )
                    )
                )
                project = getattr(item.costing_id, "project", None)
                owner = item.requested_by or getattr(project, "project_owner", None)
                req_by = (
                    f"{owner.first_name} {owner.last_name}".strip() or owner.username
                    if owner
                    else "—"
                )
                req_date = (
                    item.requested_on.strftime("%Y-%m-%d %H:%M")
                    if getattr(item, "requested_on", None)
                    else (
                        item.created_at.strftime("%Y-%m-%d %H:%M")
                        if getattr(item, "created_at", None)
                        else (
                            item.costing_id.created_at.strftime("%Y-%m-%d %H:%M")
                            if getattr(item, "costing_id", None) and getattr(item.costing_id, "created_at", None)
                            else "—"
                        )
                    )
                )
                cat_name = getattr(item.item_category, "name", "") or getattr(item.item_code, "item_category_name", "") or "—"
                code_name = getattr(item.item_code, "item_code", "") or "—"
                item_name = item.item_name or getattr(item.item_code, "item_name", "") or "—"
                type_name = _resolve_item_type_name(item)
                costing_ref = getattr(item.costing_id, "costing_id", "") or (f"C-{item.costing_id_id}" if getattr(item, "costing_id_id", None) else "—")
                quotation_no = getattr(getattr(item.costing_id, "quotation_number", None), "quotation_number", "") or "—"
                proj_id = getattr(project, "project_id", "") or (str(project.id) if project else "") or "—"
                proj_name = getattr(project, "project_name", "") or getattr(item.costing_id, "project_name", "") or "—"
                type_name = getattr(getattr(item, "item_type", None), "name", "") or getattr(getattr(item.item_code, "item_type", None), "name", "") or "—"
                quotation_no = getattr(item.costing_id.quotation_number, "quotation_number", "") or "—"

                results.append({
                    "id": f"cost-{item.id}",
                    "item_id": item.id,
                    "stage": "Costing",
                    "quotation_number": str(quotation_no),
                    "costing_number": costing_ref,
                    "reference_number": costing_ref,
                    "project_id": proj_id,
                    "project_name": proj_name,
                    "costing_number": item.costing_id.costing_id or f"C-{item.costing_id_id}",
                    "reference_number": item.costing_id.costing_id or f"C-{item.costing_id_id}",
                    "project_id": getattr(project, "project_id", "") or str(project.id),
                    "project_name": getattr(project, "project_name", "") or item.costing_id.project_name or "—",
                    "item_category": cat_name,
                    "item_name": item_name,
                    "item_code": code_name,
                    "item_type": type_name,
                    "requested_qty": str(req_qty),
                    "purchase_qty": str(pur_qty),
                    "order_qty": str(missing_qty),
                    "stock_status": status_name or ("Partial Stock" if pur_qty > 0 else "No Stock"),
                    "requested_by": req_by,
                    "requested_date": req_date,
                    "updated_by": req_by,
                    "updated_on": req_date,
                })

    return Response({
        "status": "success",
        "items": results,
        "total_items": len(results),
        "message": "Items to order retrieved successfully.",
    }, status=status.HTTP_200_OK)
