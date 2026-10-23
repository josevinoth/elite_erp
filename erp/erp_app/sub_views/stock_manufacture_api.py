from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..serializers import StockManufactureItemSerializer
from ..sub_models import StockManufactureItem


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return None


@api_view(["GET"])
def list_stock_manufacture_items_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    rows = (
        StockManufactureItem.objects
        .select_related("item_category", "item_code", "item_type", "uom")
        .order_by("-id")
    )
    serializer = StockManufactureItemSerializer(rows, many=True)
    return Response({"stock_manufacture_items": serializer.data})


@api_view(["POST"])
@csrf_protect
def create_stock_manufacture_item_api_view(request):
    na = _ensure_authenticated(request)
    if na:
        return na
    serializer = StockManufactureItemSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    obj = serializer.save()
    return Response(
        {"success": True, "stock_manufacture_item": StockManufactureItemSerializer(obj).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(["PATCH", "DELETE"])
@csrf_protect
def stock_manufacture_item_detail_api_view(request, pk):
    na = _ensure_authenticated(request)
    if na:
        return na
    try:
        obj = StockManufactureItem.objects.select_related(
            "item_category", "item_code", "item_type", "uom"
        ).get(pk=pk)
    except StockManufactureItem.DoesNotExist:
        return JsonResponse({"message": "Record not found."}, status=404)

    if request.method == "DELETE":
        obj.delete()
        return JsonResponse({"success": True, "message": "Deleted."})

    serializer = StockManufactureItemSerializer(obj, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(
            {"message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    saved_obj = serializer.save()
    return Response(
        {"success": True, "stock_manufacture_item": StockManufactureItemSerializer(saved_obj).data}
    )

