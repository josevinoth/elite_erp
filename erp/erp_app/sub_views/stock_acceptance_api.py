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
        "stock returned": RetrievalStatusInfo.STATUS_ITEM_RETURN,
        "item return": RetrievalStatusInfo.STATUS_ITEM_RETURN,
    }
    return mapping.get(normalized)


@api_view(["GET"])
def stock_acceptance_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    supplied_status = RetrievalStatusInfo.objects.filter(
        status_name__iexact=RetrievalStatusInfo.STATUS_ITEM_SUPPLIED
    ).first()
    if not supplied_status:
        return Response(
            {"items": [], "status": "success", "message": "Stock acceptance items loaded successfully."},
            status=status.HTTP_200_OK,
        )

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
    ).filter(retrieval_status=supplied_status)

    if not _is_admin_user(request.user):
        queryset = queryset.filter(costing_id__project__project_owner=request.user)

    items = list(queryset.order_by("id"))
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

    current_status = str(getattr(item.retrieval_status, "status_name", "") or "")
    if current_status.lower() != RetrievalStatusInfo.STATUS_ITEM_SUPPLIED.lower():
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

