from django.db.models import Q
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..project_costing_items_serializer import ProjectCostingItemSerializer
from ..sub_models.project_costing_items_mod import ProjectCostingItemInfo
from ..sub_models.retrieval_status_mod import RetrievalStatusInfo
from .project_costing_api import _ensure_authenticated, _is_admin_user


def _resolve_target_retrieval_status(value):
    normalized = str(value or "").strip().lower()
    mapping = {
        "stock accepted": RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
        "item accepted": RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
        "stock returned": RetrievalStatusInfo.STATUS_NO_ACTION,
        "item return": RetrievalStatusInfo.STATUS_NO_ACTION,
    }
    return mapping.get(normalized)


def _is_stock_supplied_item(item):
    retrieval_name = str(getattr(getattr(item, "retrieval_status", None), "status_name", "") or "").strip().lower()
    stock_name = str(getattr(getattr(item, "stock_status", None), "status_name", "") or "").strip().lower()
    return retrieval_name == RetrievalStatusInfo.STATUS_ITEM_SUPPLIED.lower() or stock_name == "stock supplied"


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
    )

    if supplied_status:
        queryset = queryset.filter(
            Q(retrieval_status=supplied_status) | Q(stock_status__status_name__iexact="Stock Supplied")
        )
    else:
        queryset = queryset.filter(stock_status__status_name__iexact="Stock Supplied")

    if not _is_admin_user(request.user):
        queryset = queryset.filter(costing_id__project__project_owner=request.user)

    items = [row for row in queryset.order_by("id") if _is_stock_supplied_item(row)]
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
    if not (is_admin or is_owner):
        return Response(
            {"status": "error", "message": "Only project owner or admin can update stock acceptance status."},
            status=403,
        )

    if not _is_stock_supplied_item(item):
        return Response(
            {"status": "error", "message": "Only Stock Supplied items can be updated from Stock Acceptance."},
            status=400,
        )

    target_name = _resolve_target_retrieval_status(
        request.data.get("stock_status_name") or request.data.get("stock_status") or request.data.get("retrieval_status_name")
    )
    if not target_name:
        return Response(
            {
                "status": "error",
                "message": "stock_status_name must be Stock Accepted or Stock Returned.",
            },
            status=400,
        )

    target_status = RetrievalStatusInfo.objects.filter(status_name__iexact=target_name).first()
    if not target_status:
        target_status = RetrievalStatusInfo.objects.create(status_name=target_name)

    item.retrieval_status = target_status
    item.save(update_fields=["retrieval_status", "updated_at"])

    serialized = ProjectCostingItemSerializer(item, context={"request": request}).data
    return Response(
        {"success": True, "item": serialized, "message": "Stock acceptance status updated."},
        status=status.HTTP_200_OK,
    )
