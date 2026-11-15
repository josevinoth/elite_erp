from decimal import Decimal
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..sub_models import (
    CostTypeInfo,
    ItemType_info,
    LabFurnitureItem,
    ProjectCostingItemInfo,
    ProjectCostingSummaryInfo,
    ProjectCostingTemplate,
    ProjectQuotationItemInfo,
    ProjectQuotationSummaryInfo,
    ProjectQuotationTemplate,
    ProjectTemplate,
    ProjectTemplateItem,
    RetrievalStatusInfo,
)
from ..sub_models.project_quotation_items_mod import _resolve_cost_per_qty
from ..utils import normalize_text


def _serialize_template(tmpl, include_items=False):
    data = {
        "id": tmpl.id,
        "name": tmpl.name,
        "description": tmpl.description,
        "items_count": tmpl.items.count(),
        "updated_by": tmpl.updated_by,
        "created_at": tmpl.created_at.isoformat() if tmpl.created_at else None,
        "updated_at": tmpl.updated_at.isoformat() if tmpl.updated_at else None,
    }
    if include_items:
        items = []
        for item in tmpl.items.select_related("item_code", "item_code__item_category", "item_code__uom").all():
            lab_item = item.item_code
            category_name = lab_item.item_category.name if lab_item and lab_item.item_category else ""
            item_code_val = lab_item.item_code if lab_item else ""
            item_name_val = lab_item.item_name if lab_item else ""
            uom_name = getattr(lab_item.uom, "name", "") if lab_item and getattr(lab_item, "uom", None) else ""
            cost_per_qty = _resolve_cost_per_qty(lab_item)
            display_name = f"{item_code_val} _ {category_name} _ {item_name_val}".strip(" _")
            items.append({
                "id": item.id,
                "item_code_id": lab_item.id if lab_item else None,
                "item_code": item_code_val,
                "item_category_id": lab_item.item_category_id if lab_item else None,
                "item_category_name": category_name,
                "item_name": item_name_val,
                "uom": uom_name,
                "qty": float(item.qty),
                "cost_per_qty": float(cost_per_qty),
                "display_name": display_name,
            })
        data["items"] = items
    return data


def _serialize_quotation_template(app):
    return {
        "id": app.id,
        "template_id": app.template_id,
        "template_name": app.template_name,
        "qty": float(app.qty),
        "items_count": app.items.count(),
        "applied_by": app.applied_by,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "updated_at": app.updated_at.isoformat() if app.updated_at else None,
    }


def _serialize_costing_template(app):
    return {
        "id": app.id,
        "template_id": app.template_id,
        "template_name": app.template_name,
        "qty": float(app.qty),
        "items_count": app.items.count(),
        "applied_by": app.applied_by,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "updated_at": app.updated_at.isoformat() if app.updated_at else None,
    }


# ==============================================================================
# PROJECT TEMPLATES CRUD
# ==============================================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_project_templates_api_view(request):
    templates = ProjectTemplate.objects.all().order_by("name")
    return Response({
        "templates": [_serialize_template(t) for t in templates]
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_project_template_api_view(request):
    data = request.data or {}
    name = normalize_text(data.get("name", ""))
    if not name:
        return Response({"name": ["Template name is required."]}, status=status.HTTP_400_BAD_REQUEST)

    if ProjectTemplate.objects.filter(name__iexact=name).exists():
        return Response({"name": ["A template with this name already exists."]}, status=status.HTTP_400_BAD_REQUEST)

    description = normalize_text(data.get("description", ""))
    updated_by = request.user.get_full_name() or request.user.username

    with transaction.atomic():
        template = ProjectTemplate.objects.create(
            name=name,
            description=description,
            updated_by=updated_by,
        )
        items_payload = data.get("items") or []
        for row in items_payload:
            item_code_id = row.get("item_code") or row.get("item_code_id")
            raw_qty = row.get("qty", 1)
            try:
                qty = Decimal(str(raw_qty))
            except Exception:
                qty = Decimal("1")
            if qty <= 0:
                continue

            lab_item = LabFurnitureItem.objects.filter(pk=item_code_id).first()
            if not lab_item:
                lab_item = LabFurnitureItem.objects.filter(item_code_ref__item_code__iexact=str(item_code_id).strip()).first()
            if lab_item:
                ProjectTemplateItem.objects.create(
                    template=template,
                    item_code=lab_item,
                    qty=qty,
                )

    return Response({
        "success": True,
        "template": _serialize_template(template, include_items=True),
    }, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def project_template_detail_api_view(request, pk):
    template = get_object_or_404(ProjectTemplate, pk=pk)

    if request.method == "GET":
        return Response({
            "template": _serialize_template(template, include_items=True)
        })

    if request.method == "DELETE":
        quotation_usage = template.quotation_applications.count()
        costing_usage = template.costing_applications.count()
        if quotation_usage > 0 or costing_usage > 0:
            return Response({
                "message": f"Cannot delete template. It is currently applied in {quotation_usage} quotation(s) and {costing_usage} costing(s)."
            }, status=status.HTTP_400_BAD_REQUEST)
        template.delete()
        return Response({"success": True, "message": "Project template deleted successfully."})

    # PUT / PATCH
    data = request.data or {}
    name = normalize_text(data.get("name", template.name))
    if not name:
        return Response({"name": ["Template name is required."]}, status=status.HTTP_400_BAD_REQUEST)

    if ProjectTemplate.objects.filter(name__iexact=name).exclude(pk=pk).exists():
        return Response({"name": ["A template with this name already exists."]}, status=status.HTTP_400_BAD_REQUEST)

    description = normalize_text(data.get("description", template.description))
    updated_by = request.user.get_full_name() or request.user.username

    with transaction.atomic():
        template.name = name
        template.description = description
        template.updated_by = updated_by
        template.save()

        if "items" in data:
            items_payload = data.get("items") or []
            existing_items_map = {item.item_code_id: item for item in template.items.all()}
            payload_item_ids = set()

            for row in items_payload:
                item_code_id = row.get("item_code") or row.get("item_code_id")
                raw_qty = row.get("qty", 1)
                try:
                    qty = Decimal(str(raw_qty))
                except Exception:
                    qty = Decimal("1")
                if qty <= 0:
                    continue

                lab_item = LabFurnitureItem.objects.filter(pk=item_code_id).first()
                if not lab_item:
                    lab_item = LabFurnitureItem.objects.filter(item_code_ref__item_code__iexact=str(item_code_id).strip()).first()
                if lab_item:
                    payload_item_ids.add(lab_item.id)
                    if lab_item.id in existing_items_map:
                        item_obj = existing_items_map[lab_item.id]
                        if item_obj.qty != qty:
                            item_obj.qty = qty
                            item_obj.save(update_fields=["qty", "updated_at"])
                    else:
                        ProjectTemplateItem.objects.create(
                            template=template,
                            item_code=lab_item,
                            qty=qty,
                        )

            # Delete items omitted from the payload
            for item_id, item_obj in existing_items_map.items():
                if item_id not in payload_item_ids:
                    item_obj.delete()

    return Response({
        "success": True,
        "template": _serialize_template(template, include_items=True),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def check_project_template_downstream_api_view(request, pk):
    template = get_object_or_404(ProjectTemplate, pk=pk)
    quotation_usage = template.quotation_applications.count()
    costing_usage = template.costing_applications.count()
    details = []
    if quotation_usage > 0:
        details.append(f"Applied in {quotation_usage} Project Quotation(s)")
    if costing_usage > 0:
        details.append(f"Applied in {costing_usage} Project Costing(s)")

    return Response({
        "has_downstream": bool(quotation_usage or costing_usage),
        "details": details,
    })


# ==============================================================================
# PROJECT QUOTATION TEMPLATES INTEGRATION
# ==============================================================================

def _resolve_quotation(quotation_pk):
    val = str(quotation_pk).strip()
    if val.isdigit():
        q = ProjectQuotationSummaryInfo.objects.filter(pk=int(val)).first()
        if q:
            return q
    q = ProjectQuotationSummaryInfo.objects.filter(quotation_number=val).first()
    if q:
        return q
    raise Http404(f"Project quotation '{quotation_pk}' not found.")


def _resolve_costing(costing_pk):
    val = str(costing_pk).strip()
    if val.isdigit():
        c = ProjectCostingSummaryInfo.objects.filter(pk=int(val)).first()
        if c:
            return c
    raise Http404(f"Project costing '{costing_pk}' not found.")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_quotation_templates_api_view(request, quotation_pk):
    quotation = _resolve_quotation(quotation_pk)
    applied = quotation.applied_templates.all().order_by("-id")
    return Response({
        "applied_templates": [_serialize_quotation_template(a) for a in applied]
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def preview_quotation_template_api_view(request, quotation_pk):
    _resolve_quotation(quotation_pk)
    template_id = request.data.get("template_id")
    template = get_object_or_404(ProjectTemplate, pk=template_id)

    raw_multiplier = request.data.get("qty", 1)
    try:
        multiplier = Decimal(str(raw_multiplier))
    except Exception:
        multiplier = Decimal("1")
    if multiplier <= 0:
        multiplier = Decimal("1")

    preview_items = []
    for item in template.items.select_related("item_code", "item_code__item_category", "item_code__uom").all():
        lab_item = item.item_code
        category_name = lab_item.item_category.name if lab_item and lab_item.item_category else ""
        item_code_val = lab_item.item_code if lab_item else ""
        item_name_val = lab_item.item_name if lab_item else ""
        uom_name = getattr(lab_item.uom, "name", "") if lab_item and getattr(lab_item, "uom", None) else ""
        cost_per_qty = _resolve_cost_per_qty(lab_item)
        multiplied_qty = (item.qty * multiplier).quantize(Decimal("0.01"))
        display_name = f"{item_code_val} _ {category_name} _ {item_name_val}".strip(" _")

        preview_items.append({
            "item_code_id": lab_item.id if lab_item else None,
            "item_code": item_code_val,
            "item_category_id": lab_item.item_category_id if lab_item else None,
            "item_category_name": category_name,
            "item_name": item_name_val,
            "uom": uom_name,
            "base_qty": float(item.qty),
            "qty": float(multiplied_qty),
            "cost_per_qty": float(cost_per_qty),
            "total_cost": float(multiplied_qty * cost_per_qty),
            "display_name": display_name,
        })

    return Response({
        "template": {"id": template.id, "name": template.name},
        "multiplier_qty": float(multiplier),
        "total_items": len(preview_items),
        "preview_items": preview_items,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def apply_quotation_template_api_view(request, quotation_pk):
    quotation = _resolve_quotation(quotation_pk)
    template_id = request.data.get("template_id")
    template = get_object_or_404(ProjectTemplate, pk=template_id)

    raw_multiplier = request.data.get("qty", 1)
    try:
        multiplier = Decimal(str(raw_multiplier))
    except Exception:
        multiplier = Decimal("1")
    if multiplier <= 0:
        multiplier = Decimal("1")

    material_cost_type = CostTypeInfo.objects.filter(name__iexact="MATERIAL").first()
    if not material_cost_type:
        material_cost_type = CostTypeInfo.objects.create(name="MATERIAL")

    user_name = request.user.get_full_name() or request.user.username
    items_added = 0

    with transaction.atomic():
        applied_record = ProjectQuotationTemplate.objects.create(
            quotation=quotation,
            template=template,
            template_name=template.name,
            qty=multiplier,
            applied_by=user_name,
        )

        default_item_type = ItemType_info.objects.first()

        for t_item in template.items.select_related("item_code", "item_code__item_category", "item_code__item_type").all():
            lab_item = t_item.item_code
            multiplied_qty = (t_item.qty * multiplier).quantize(Decimal("0.01"))
            if multiplied_qty <= 0:
                continue

            item_type = getattr(lab_item, "item_type", None) or default_item_type
            quotation_item = ProjectQuotationItemInfo(
                quotation_number=quotation,
                cost_type=material_cost_type,
                item_code=lab_item,
                item_category=lab_item.item_category,
                item_name=lab_item.item_name,
                item_type=item_type,
                requested_qty=multiplied_qty,
                applied_template=applied_record,
            )
            quotation_item._allow_requested_qty_override = True
            quotation_item.save()
            items_added += 1

        quotation.save()

    return Response({
        "success": True,
        "message": f"Template '{template.name}' applied successfully. {items_added} item(s) added.",
        "applied_template": _serialize_quotation_template(applied_record),
        "items_added_count": items_added,
    }, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_quotation_template_api_view(request, quotation_pk, applied_id):
    quotation = _resolve_quotation(quotation_pk)
    applied_record = get_object_or_404(ProjectQuotationTemplate, pk=applied_id, quotation=quotation)

    with transaction.atomic():
        template_name = applied_record.template_name
        dependent_items = applied_record.items.all()
        count = dependent_items.count()
        dependent_items.delete()
        applied_record.delete()
        quotation.save()

    return Response({
        "success": True,
        "message": f"Project template '{template_name}' and all its {count} dependent item(s) have been removed from the quotation.",
        "deleted_items_count": count,
    })


# ==============================================================================
# PROJECT COSTING TEMPLATES INTEGRATION
# ==============================================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_costing_templates_api_view(request, costing_pk):
    costing = _resolve_costing(costing_pk)
    applied = costing.applied_templates.all().order_by("-id")
    return Response({
        "applied_templates": [_serialize_costing_template(a) for a in applied]
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def preview_costing_template_api_view(request, costing_pk):
    _resolve_costing(costing_pk)
    template_id = request.data.get("template_id")
    template = get_object_or_404(ProjectTemplate, pk=template_id)

    raw_multiplier = request.data.get("qty", 1)
    try:
        multiplier = Decimal(str(raw_multiplier))
    except Exception:
        multiplier = Decimal("1")
    if multiplier <= 0:
        multiplier = Decimal("1")

    preview_items = []
    for item in template.items.select_related("item_code", "item_code__item_category", "item_code__uom").all():
        lab_item = item.item_code
        category_name = lab_item.item_category.name if lab_item and lab_item.item_category else ""
        item_code_val = lab_item.item_code if lab_item else ""
        item_name_val = lab_item.item_name if lab_item else ""
        uom_name = getattr(lab_item.uom, "name", "") if lab_item and getattr(lab_item, "uom", None) else ""
        cost_per_qty = _resolve_cost_per_qty(lab_item)
        multiplied_qty = (item.qty * multiplier).quantize(Decimal("0.01"))
        display_name = f"{item_code_val} _ {category_name} _ {item_name_val}".strip(" _")

        preview_items.append({
            "item_code_id": lab_item.id if lab_item else None,
            "item_code": item_code_val,
            "item_category_id": lab_item.item_category_id if lab_item else None,
            "item_category_name": category_name,
            "item_name": item_name_val,
            "uom": uom_name,
            "base_qty": float(item.qty),
            "qty": float(multiplied_qty),
            "cost_per_qty": float(cost_per_qty),
            "total_cost": float(multiplied_qty * cost_per_qty),
            "display_name": display_name,
        })

    return Response({
        "template": {"id": template.id, "name": template.name},
        "multiplier_qty": float(multiplier),
        "total_items": len(preview_items),
        "preview_items": preview_items,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def apply_costing_template_api_view(request, costing_pk):
    costing = _resolve_costing(costing_pk)
    template_id = request.data.get("template_id")
    template = get_object_or_404(ProjectTemplate, pk=template_id)

    raw_multiplier = request.data.get("qty", 1)
    try:
        multiplier = Decimal(str(raw_multiplier))
    except Exception:
        multiplier = Decimal("1")
    if multiplier <= 0:
        multiplier = Decimal("1")

    material_cost_type = CostTypeInfo.objects.filter(name__iexact="MATERIAL").first()
    if not material_cost_type:
        material_cost_type = CostTypeInfo.objects.create(name="MATERIAL")

    requested_status = RetrievalStatusInfo.objects.filter(
        status_name__iexact=RetrievalStatusInfo.STATUS_ITEM_REQUESTED
    ).first()
    if not requested_status:
        requested_status = RetrievalStatusInfo.objects.create(status_name=RetrievalStatusInfo.STATUS_ITEM_REQUESTED)

    user_name = request.user.get_full_name() or request.user.username
    items_added = 0

    with transaction.atomic():
        applied_record = ProjectCostingTemplate.objects.create(
            costing=costing,
            template=template,
            template_name=template.name,
            qty=multiplier,
            applied_by=user_name,
        )

        default_item_type = ItemType_info.objects.first()

        for t_item in template.items.select_related("item_code", "item_code__item_category", "item_code__item_type").all():
            lab_item = t_item.item_code
            multiplied_qty = (t_item.qty * multiplier).quantize(Decimal("0.01"))
            if multiplied_qty <= 0:
                continue

            item_type = getattr(lab_item, "item_type", None) or default_item_type
            costing_item = ProjectCostingItemInfo(
                costing_id=costing,
                cost_type=material_cost_type,
                item_code=lab_item,
                item_category=lab_item.item_category,
                item_name=lab_item.item_name,
                item_type=item_type,
                requested_qty=multiplied_qty,
                retrieval_status=requested_status,
                applied_template=applied_record,
            )
            costing_item.save()
            items_added += 1

        costing.save()

    return Response({
        "success": True,
        "message": f"Template '{template.name}' applied successfully. {items_added} item(s) added.",
        "applied_template": _serialize_costing_template(applied_record),
        "items_added_count": items_added,
    }, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_costing_template_api_view(request, costing_pk, applied_id):
    costing = _resolve_costing(costing_pk)
    applied_record = get_object_or_404(ProjectCostingTemplate, pk=applied_id, costing=costing)

    dependent_items = applied_record.items.all()
    # Check if any dependent item has progressed beyond "Item Requested"
    progressed_items = []
    for item in dependent_items:
        ret_status = item.retrieval_status
        if ret_status and ret_status.status_name.strip().lower() != RetrievalStatusInfo.STATUS_ITEM_REQUESTED.lower():
            progressed_items.append(f"{item.item_name} ({ret_status.status_name})")

    if progressed_items:
        detail_msg = ", ".join(progressed_items[:3])
        if len(progressed_items) > 3:
            detail_msg += f" and {len(progressed_items) - 3} more"
        return Response({
            "message": f"Cannot remove template '{applied_record.template_name}'. {len(progressed_items)} item(s) have already progressed beyond 'Item Requested' state: {detail_msg}."
        }, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        template_name = applied_record.template_name
        count = dependent_items.count()
        dependent_items.delete()
        applied_record.delete()
        costing.save()

    return Response({
        "success": True,
        "message": f"Project template '{template_name}' and all its {count} dependent item(s) have been removed from the costing.",
        "deleted_items_count": count,
    })
