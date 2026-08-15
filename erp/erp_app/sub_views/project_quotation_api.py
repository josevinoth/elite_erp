from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..project_quotation_items_serializer import ProjectQuotationItemSerializer
from ..project_quotation_summary_serializer import ProjectQuotationSummarySerializer
from ..sub_models.project_quotation_items_mod import ProjectQuotationItemInfo, validate_project_quotation_hierarchy
from ..sub_models.project_quotation_summary_mod import ProjectQuotationSummaryInfo
from .project_quotation_view import ProjectQuotationItemView, ProjectQuotationSummaryView


BOM_HIERARCHY_ERROR = "Invalid BOM hierarchy: children must be linked to immediate parent level."


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return None


def _serializer_error_response(serializer):
    errors = serializer.errors
    message = "Validation failed."
    non_field_errors = errors.get("non_field_errors") if isinstance(errors, dict) else None
    if non_field_errors:
        message = str(non_field_errors[0])
    else:
        for value in errors.values() if isinstance(errors, dict) else []:
            if isinstance(value, (list, tuple)) and value:
                message = str(value[0])
                break
            if isinstance(value, dict):
                nested_values = list(value.values())
                if nested_values:
                    nested = nested_values[0]
                    if isinstance(nested, (list, tuple)) and nested:
                        message = str(nested[0])
                        break
    return Response({"message": message, "errors": errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@csrf_protect
def quotations_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    if request.method == "GET":
        project_id = request.GET.get("project_id")
        payload = ProjectQuotationSummaryView(request).list_payload(project_id=project_id)
        return Response(payload, status=status.HTTP_200_OK)

    serializer = ProjectQuotationSummarySerializer(data=request.data)
    if not serializer.is_valid():
        return _serializer_error_response(serializer)

    summary = serializer.save()
    payload = ProjectQuotationSummaryView(request).detail_payload(summary)
    return Response({"success": True, **payload}, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@csrf_protect
def quotation_detail_api_view(request, pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        summary = ProjectQuotationSummaryInfo.objects.select_related("project").get(pk=pk)
    except ProjectQuotationSummaryInfo.DoesNotExist:
        return JsonResponse({"message": "Quotation summary not found."}, status=404)

    if request.method == "GET":
        payload = ProjectQuotationSummaryView(request).detail_payload(summary)
        return Response(payload, status=status.HTTP_200_OK)

    if request.method == "DELETE":
        summary.delete()
        payload = ProjectQuotationSummaryView(request).list_payload()
        return Response({"success": True, "message": "Quotation deleted.", **payload}, status=status.HTTP_200_OK)

    serializer = ProjectQuotationSummarySerializer(summary, data=request.data, partial=True)
    if not serializer.is_valid():
        return _serializer_error_response(serializer)

    updated = serializer.save()
    payload = ProjectQuotationSummaryView(request).detail_payload(updated)
    return Response({"success": True, **payload}, status=status.HTTP_200_OK)


@api_view(["GET", "POST"])
@csrf_protect
def quotation_items_api_view(request, pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        summary = ProjectQuotationSummaryInfo.objects.select_related("project").get(pk=pk)
    except ProjectQuotationSummaryInfo.DoesNotExist:
        return JsonResponse({"message": "Quotation summary not found."}, status=404)

    if request.method == "GET":
        payload = ProjectQuotationItemView(request).list_payload(summary)
        return Response(payload, status=status.HTTP_200_OK)

    payload_data = {**request.data, "quotation_number": summary.quotation_number}
    serializer = ProjectQuotationItemSerializer(data=payload_data)
    if not serializer.is_valid():
        return _serializer_error_response(serializer)

    serializer.save()
    payload = ProjectQuotationSummaryView(request).detail_payload(summary)
    return Response({"success": True, **payload}, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@csrf_protect
def quotation_item_detail_api_view(request, quotation_pk, item_pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        summary = ProjectQuotationSummaryInfo.objects.select_related("project").get(pk=quotation_pk)
    except ProjectQuotationSummaryInfo.DoesNotExist:
        return JsonResponse({"message": "Quotation summary not found."}, status=404)

    try:
        row = ProjectQuotationItemInfo.objects.select_related(
            "quotation_number",
            "cost_type",
            "item_category",
            "item_code",
        ).get(pk=item_pk, quotation_number=summary)
    except ProjectQuotationItemInfo.DoesNotExist:
        return JsonResponse({"message": "Quotation item not found."}, status=404)

    if request.method == "DELETE":
        delete_pk = row.pk
        row.delete()
        validate_project_quotation_hierarchy(summary, delete_pk=delete_pk)
        summary.save()
        payload = ProjectQuotationSummaryView(request).detail_payload(summary)
        return Response({"success": True, "message": "Quotation item deleted.", **payload}, status=status.HTTP_200_OK)

    serializer = ProjectQuotationItemSerializer(row, data=request.data, partial=True)
    if not serializer.is_valid():
        return _serializer_error_response(serializer)

    serializer.save()
    payload = ProjectQuotationSummaryView(request).detail_payload(summary)
    return Response({"success": True, **payload}, status=status.HTTP_200_OK)


@api_view(["GET"])
def list_project_quotations_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    return quotations_api_view(request)


@api_view(["POST"])
@csrf_protect
def create_project_quotation_item_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    serializer = ProjectQuotationItemSerializer(data=request.data)
    if not serializer.is_valid():
        return _serializer_error_response(serializer)

    row = serializer.save()
    payload = ProjectQuotationSummaryView(request).detail_payload(row.quotation_number)
    return Response({"success": True, **payload}, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@csrf_protect
def project_quotation_item_detail_api_view(request, pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        row = ProjectQuotationItemInfo.objects.select_related(
            "quotation_number",
            "cost_type",
            "item_category",
            "item_code",
        ).get(pk=pk)
    except ProjectQuotationItemInfo.DoesNotExist:
        return JsonResponse({"message": "Project quotation item not found."}, status=404)

    if request.method == "GET":
        return Response(ProjectQuotationSummaryView(request).detail_payload(row.quotation_number), status=status.HTTP_200_OK)

    if request.method == "DELETE":
        summary = row.quotation_number
        delete_pk = row.pk
        row.delete()
        validate_project_quotation_hierarchy(summary, delete_pk=delete_pk)
        summary.save()
        payload = ProjectQuotationSummaryView(request).list_payload()
        return Response({"success": True, "message": "Project quotation item deleted.", **payload}, status=status.HTTP_200_OK)

    serializer = ProjectQuotationItemSerializer(row, data=request.data, partial=True)
    if not serializer.is_valid():
        return _serializer_error_response(serializer)

    updated_row = serializer.save()
    payload = ProjectQuotationSummaryView(request).detail_payload(updated_row.quotation_number)
    return Response({"success": True, **payload}, status=status.HTTP_200_OK)

