from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..room_data_serializer import RoomDataSerializer
from ..sub_models.room_data_mod import RoomDataInfo
from ..utils import normalize_text


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"status": "error", "message": "Authentication required."}, status=401)
    return None


@api_view(["GET"])
def list_rooms_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    rows = RoomDataInfo.objects.order_by("room_name")
    return Response(
        {
            "status": "success",
            "rooms": RoomDataSerializer(rows, many=True).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@csrf_protect
def add_room_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    room_name = normalize_text((request.data or {}).get("room_name", ""))
    if not room_name:
        return Response(
            {
                "status": "error",
                "message": "Room name is required.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    existing = RoomDataInfo.objects.filter(room_name__iexact=room_name).first()
    if existing:
        return Response(
            {
                "status": "error",
                "message": "Room name already exists.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = RoomDataSerializer(data={"room_name": room_name})
    if not serializer.is_valid():
        message = "Failed to add room."
        for values in serializer.errors.values():
            if isinstance(values, (list, tuple)) and values:
                message = str(values[0])
                break
        return Response(
            {
                "status": "error",
                "message": message,
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer.save()
    return Response(
        {
            "status": "success",
            "message": "Room added successfully.",
            "room": serializer.data,
        },
        status=status.HTTP_201_CREATED,
    )

