from decimal import Decimal

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..sub_models.project_costing_items_mod import ProjectCostingItemInfo
from ..sub_models.project_quotation_items_mod import ProjectQuotationItemInfo


def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return Response({"status": "error", "message": "Authentication required."}, status=401)
    return None


@api_view(["GET"])
def items_to_order_api_view(request):
    """
    Retrieve missing stock items from Completed Quotations and Completed Project Costings.
    Lists item details, quotation/costing number, project name, requested qty, purchase/available qty,
    order qty (missing stock), requested by, and requested date.
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    project_id = request.GET.get("project_id")
    stage_filter = str(request.GET.get("stage") or "").strip().lower()

    results = []

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
                project = item.quotation_number.project
                owner = getattr(project, "project_owner", None)
                req_by = (
                    f"{owner.first_name} {owner.last_name}".strip() or owner.username
                    if owner
                    else "—"
                )
                req_date = (
                    item.created_at.strftime("%Y-%m-%d %H:%M")
                    if item.created_at
                    else (
                        item.quotation_number.created_at.strftime("%Y-%m-%d %H:%M")
                        if item.quotation_number and item.quotation_number.created_at
                        else "—"
                    )
                )
                cat_name = getattr(item.item_category, "name", "") or getattr(item.item_code, "item_category_name", "") or "—"
                code_name = getattr(item.item_code, "item_code", "") or "—"
                item_name = item.item_name or getattr(item.item_code, "item_name", "") or "—"
                type_name = getattr(getattr(item, "item_type", None), "name", "") or getattr(getattr(item.item_code, "item_type", None), "name", "") or "—"

                results.append({
                    "id": f"quo-{item.id}",
                    "item_id": item.id,
                    "stage": "Quotation",
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
                "item_code",
                "item_category",
                "item_type",
                "stock_status",
                "requested_by",
            )
            .order_by("-costing_id__updated_at", "id")
        )
        if project_id:
            costing_items = costing_items.filter(costing_id__project_id=project_id)

        for item in costing_items:
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
                project = item.costing_id.project
                owner = item.requested_by or getattr(project, "project_owner", None)
                req_by = (
                    f"{owner.first_name} {owner.last_name}".strip() or owner.username
                    if owner
                    else "—"
                )
                req_date = (
                    item.requested_on.strftime("%Y-%m-%d %H:%M")
                    if item.requested_on
                    else (
                        item.created_at.strftime("%Y-%m-%d %H:%M")
                        if item.created_at
                        else (
                            item.costing_id.created_at.strftime("%Y-%m-%d %H:%M")
                            if item.costing_id and item.costing_id.created_at
                            else "—"
                        )
                    )
                )
                cat_name = getattr(item.item_category, "name", "") or getattr(item.item_code, "item_category_name", "") or "—"
                code_name = getattr(item.item_code, "item_code", "") or "—"
                item_name = item.item_name or getattr(item.item_code, "item_name", "") or "—"
                type_name = getattr(getattr(item, "item_type", None), "name", "") or getattr(getattr(item.item_code, "item_type", None), "name", "") or "—"
                quotation_no = getattr(item.costing_id.quotation_number, "quotation_number", "") or "—"

                results.append({
                    "id": f"cost-{item.id}",
                    "item_id": item.id,
                    "stage": "Costing",
                    "quotation_number": str(quotation_no),
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
