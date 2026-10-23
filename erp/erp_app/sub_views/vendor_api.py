from django.db import IntegrityError
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..sub_models.vendor import Vendor
from ..vendor_serializer import VendorSerializer


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return Response({"status": "error", "message": "Authentication required."}, status=401)
    return None


def _normalize_vendor_payload(payload):
    data = dict(payload or {})
    if "vendor_name" not in data and "name" in data:
        data["vendor_name"] = data.get("name")
    if "email_id" not in data and "email" in data:
        data["email_id"] = data.get("email")
    if "phone_number" not in data and "phone" in data:
        data["phone_number"] = data.get("phone")
    return data


@api_view(["GET", "POST"])
@csrf_protect
def vendor_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    if request.method == "GET":
        vendors = Vendor.objects.order_by("-id")
        serializer = VendorSerializer(vendors, many=True)
        return Response({"vendors": serializer.data, "status": "success"}, status=status.HTTP_200_OK)

    serializer = VendorSerializer(data=_normalize_vendor_payload(request.data))
    if not serializer.is_valid():
        message = "Validation failed."
        if isinstance(serializer.errors, dict):
            first = next(iter(serializer.errors.values()), None)
            if isinstance(first, (list, tuple)) and first:
                message = str(first[0])
        return Response({"status": "error", "message": message, "errors": serializer.errors}, status=400)

    try:
        vendor = serializer.save()
    except IntegrityError:
        return Response({"status": "error", "message": "Vendor already exists."}, status=400)

    return Response({"success": True, "vendor": VendorSerializer(vendor).data}, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@csrf_protect
def vendor_detail_api_view(request, vendor_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    vendor = Vendor.objects.filter(pk=vendor_id).first()
    if not vendor:
        return Response({"status": "error", "message": "Vendor not found."}, status=404)

    if request.method == "DELETE":
        vendor.delete()
        return Response({"success": True, "message": "Vendor deleted."}, status=status.HTTP_200_OK)

    serializer = VendorSerializer(vendor, data=_normalize_vendor_payload(request.data), partial=True)
    if not serializer.is_valid():
        message = "Validation failed."
        if isinstance(serializer.errors, dict):
            first = next(iter(serializer.errors.values()), None)
            if isinstance(first, (list, tuple)) and first:
                message = str(first[0])
        return Response({"status": "error", "message": message, "errors": serializer.errors}, status=400)

    try:
        updated = serializer.save()
    except IntegrityError:
        return Response({"status": "error", "message": "Vendor already exists."}, status=400)

    return Response({"success": True, "vendor": VendorSerializer(updated).data}, status=status.HTTP_200_OK)

