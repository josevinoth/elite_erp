from django.db import transaction
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..project_costing_items_serializer import ProjectCostingItemSerializer
from ..sub_models.project_costing_items_mod import ProjectCostingItemInfo
from ..sub_models.retrieval_status_mod import RetrievalStatusInfo
from .project_costing_api import (
    _apply_allocation_status,
    _can_edit_stock_retrieval,
    _ensure_authenticated,
    _get_item_allocations,
    _is_admin_user,
    _save_item_from_allocations,
)


def _resolve_target_retrieval_status(value):
    normalized = str(value or "").strip().lower()
    mapping = {
        "item accepted": RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
        "accept": RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
        "item requested": RetrievalStatusInfo.STATUS_ITEM_REQUESTED,
        "reject": RetrievalStatusInfo.STATUS_ITEM_REQUESTED,
    }
    return mapping.get(normalized)


def _is_stock_acceptance_item(item):
    retrieval_name = str(getattr(getattr(item, "retrieval_status", None), "status_name", "") or "").strip().lower()
    return retrieval_name == RetrievalStatusInfo.STATUS_ITEM_SUPPLIED.lower()


@api_view(["GET"])
def stock_acceptance_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    supplied_status = RetrievalStatusInfo.objects.filter(
        status_name__iexact=RetrievalStatusInfo.STATUS_ITEM_SUPPLIED
    ).first()

    queryset = ProjectCostingItemInfo.objects.select_related(
        "costing_id",
        "costing_id__quotation_number",
        "costing_id__project",
        "cost_type",
        "item_category",
        "item_code__item_type",
        "room_name",
        "stock_status",
        "retrieval_status",
    ).prefetch_related("grn_allocations__purchase_item__vendor_detail__vendor", "grn_allocations__retrieval_status")

    if supplied_status:
        queryset = queryset.filter(retrieval_status=supplied_status)
    else:
        queryset = queryset.filter(retrieval_status__status_name__iexact=RetrievalStatusInfo.STATUS_ITEM_SUPPLIED)

    if not (_is_admin_user(request.user) or _can_edit_stock_retrieval(request.user)):
        queryset = queryset.filter(costing_id__project__project_owner=request.user)

    items = [row for row in queryset.order_by("id") if _is_stock_acceptance_item(row)]
    data = ProjectCostingItemSerializer(items, many=True, context={"request": request}).data
    return Response(
        {"items": data, "status": "success", "message": "Stock acceptance items loaded successfully."},
        status=status.HTTP_200_OK,
    )


@api_view(["PATCH"])
@csrf_protect
def stock_acceptance_edit_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    item_id = request.data.get("item_id") or request.data.get("id")
    if not item_id:
        return Response({"status": "error", "message": "item_id is required."}, status=400)

    try:
        item = ProjectCostingItemInfo.objects.select_related(
            "costing_id__project",
            "stock_status",
            "retrieval_status",
        ).get(pk=item_id)
    except ProjectCostingItemInfo.DoesNotExist:
        return Response({"status": "error", "message": "Project costing item not found."}, status=404)

    is_admin = _is_admin_user(request.user)
    is_owner = item.costing_id.project.project_owner_id == request.user.id
    is_stock_team = _can_edit_stock_retrieval(request.user)
    if not (is_admin or is_owner or is_stock_team):
        return Response(
            {"status": "error", "message": "Only project owner, admin, or stock team can update stock acceptance status."},
            status=403,
        )

    if not _is_stock_acceptance_item(item):
        return Response(
            {"status": "error", "message": "Only Item Supplied items can be updated from Stock Acceptance."},
            status=400,
        )

    action = str(request.data.get("action", "")).strip().lower()
    if action not in {"accept", "reject"}:
        action = str(
            request.data.get("stock_status_name") or request.data.get("stock_status") or request.data.get("retrieval_status_name") or ""
        ).strip().lower()
    target_name = _resolve_target_retrieval_status(action)
    if not target_name:
        return Response(
            {
                "status": "error",
                "message": "Action must move the item to Item Accepted or back to Item Requested.",
            },
            status=400,
        )

    try:
        with transaction.atomic():
            _apply_allocation_status(item, target_name)
            allocations = _get_item_allocations(item)
            request_user = request.user if target_name == RetrievalStatusInfo.STATUS_ITEM_REQUESTED else None
            _save_item_from_allocations(item, allocations, request_user=request_user, rejection_comment="")
    except ValueError as exc:
        return Response({"status": "error", "message": str(exc)}, status=400)

    serialized = ProjectCostingItemSerializer(item, context={"request": request}).data
    return Response(
        {
            "success": True,
            "item": serialized,
            "message": "Stock acceptance approved." if target_name == RetrievalStatusInfo.STATUS_ITEM_ACCEPTED else "Stock acceptance rejected and moved back to Item Requested.",
        },
        status=status.HTTP_200_OK,
    )
