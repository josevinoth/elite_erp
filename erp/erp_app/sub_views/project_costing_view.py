from django.db import transaction

from ..project_costing_items_serializer import ProjectCostingItemSerializer
from ..project_costing_summary_serializer import ProjectCostingSummarySerializer
from ..retrieval_status_serializer import RetrievalStatusSerializer
from ..sub_models.CostType_mod import CostTypeInfo
from ..sub_models.project_costing_items_mod import ProjectCostingItemInfo
from ..sub_models.project_costing_summary_mod import ProjectCostingSummaryInfo
from ..sub_models.project_quotation_items_mod import ProjectQuotationItemInfo
from ..sub_models.retrieval_status_mod import RetrievalStatusInfo


class ProjectCostingSummaryView:
    def __init__(self, request=None):
        self.request = request

    def get_serializer_context(self):
        return {"request": self.request} if self.request is not None else {}

    @staticmethod
    def ensure_retrieval_statuses_seeded():
        legacy_labels = ["Request Rejected", "item Rejected"]
        canonical = RetrievalStatusInfo.STATUS_REQUEST_REJECTED
        canonical_obj = RetrievalStatusInfo.objects.filter(status_name__iexact=canonical).first()
        if canonical_obj:
            RetrievalStatusInfo.objects.filter(status_name__in=legacy_labels).exclude(pk=canonical_obj.pk).delete()
        else:
            legacy_obj = RetrievalStatusInfo.objects.filter(status_name__in=legacy_labels).order_by("id").first()
            if legacy_obj:
                legacy_obj.status_name = canonical
                legacy_obj.save(update_fields=["status_name"])

        for status_name in [
            RetrievalStatusInfo.STATUS_NO_ACTION,
            RetrievalStatusInfo.STATUS_ITEM_REQUESTED,
            RetrievalStatusInfo.STATUS_ITEM_SUPPLIED,
            RetrievalStatusInfo.STATUS_REQUEST_REJECTED,
            RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
            RetrievalStatusInfo.STATUS_ITEM_RETURN,
            RetrievalStatusInfo.STATUS_ITEM_RETURN_ACCEPTED,
        ]:
            RetrievalStatusInfo.objects.get_or_create(status_name=status_name)

    def _serialize_retrieval_statuses(self):
        self.ensure_retrieval_statuses_seeded()
        rows = RetrievalStatusInfo.objects.order_by("status_name")
        return RetrievalStatusSerializer(rows, many=True).data

    def _cost_types_payload(self):
        rows = list(CostTypeInfo.objects.order_by("name"))
        material = next((r for r in rows if r.name.upper() == "MATERIAL"), None)
        return {
            "cost_types": [{"id": r.pk, "name": r.name} for r in rows],
            "material_cost_type_id": material.pk if material else None,
        }

    def _serialize_summary(self, summary):
        return {
            **ProjectCostingSummarySerializer(summary, context=self.get_serializer_context()).data,
            "status": "success",
        }

    def list_payload(self):
        summaries = ProjectCostingSummaryInfo.objects.select_related("project", "quotation_number").order_by("-id")
        return {
            "costings": [self._serialize_summary(row) for row in summaries],
            "retrieval_statuses": self._serialize_retrieval_statuses(),
            "status": "success",
            "message": "Project costing summaries loaded successfully.",
        }

    def detail_payload(self, summary):
        items = list(
            ProjectCostingItemInfo.objects.filter(costing_id=summary)
            .select_related("cost_type", "item_category", "item_code__item_type", "room_name", "stock_status", "retrieval_status", "requested_by")
            .order_by("id")
        )
        ct = self._cost_types_payload()
        return {
            "costing": self._serialize_summary(summary),
            "items": ProjectCostingItemSerializer(items, many=True, context=self.get_serializer_context()).data,
            "retrieval_statuses": self._serialize_retrieval_statuses(),
            "cost_types": ct["cost_types"],
            "material_cost_type_id": ct["material_cost_type_id"],
            "status": "success",
            "message": "Project costing loaded successfully.",
        }

    @transaction.atomic
    def clone_from_quotation(self, quotation_summary):
        self.ensure_retrieval_statuses_seeded()
        costing = ProjectCostingSummaryInfo.objects.create(
            quotation_number=quotation_summary,
            project=quotation_summary.project,
            project_name=quotation_summary.project_name,
            # Snapshot all financial fields from the quotation
            planned_order_value=quotation_summary.planned_order_value,
            total_material_cost=quotation_summary.total_material_cost,
            petrol_expenses=quotation_summary.petrol_expenses,
            transport_installation_team=quotation_summary.transport_installation_team,
            contingency=quotation_summary.contingency,
            final_material_cost=quotation_summary.final_material_cost,
            transportation=quotation_summary.transportation,
            food_accomodation=quotation_summary.food_accomodation,
            loading=quotation_summary.loading,
            unloading=quotation_summary.unloading,
            installation=quotation_summary.installation,
            business_development=quotation_summary.business_development,
            total_cost_to_elite=quotation_summary.total_cost_to_elite,
            markup=quotation_summary.markup,
            total_markup=quotation_summary.total_markup,
            discount=quotation_summary.discount,
            undiscounted_quote_value=quotation_summary.undiscounted_quote_value,
            factor=quotation_summary.factor,
        )

        quotation_items = ProjectQuotationItemInfo.objects.filter(quotation_number=quotation_summary).select_related(
            "cost_type",
            "item_category",
            "item_code__item_type",
            "stock_status",
            "room_name",
        )
        default_retrieval = RetrievalStatusInfo.objects.filter(status_name__iexact=RetrievalStatusInfo.STATUS_NO_ACTION).first()
        if not default_retrieval:
            default_retrieval = RetrievalStatusInfo.objects.create(status_name=RetrievalStatusInfo.STATUS_NO_ACTION)

        for row in quotation_items:
            ProjectCostingItemInfo.objects.create(
                costing_id=costing,
                cost_type=row.cost_type,
                item_category=row.item_category,
                item_name=row.item_name,
                item_code=row.item_code,
                item_type=row.item_type,
                room_name=row.room_name,
                purchase_qty=row.purchase_qty,
                requested_qty=row.requested_qty,
                cost_per_qty=row.cost_per_qty,
                max_cost=row.max_cost,
                min_cost=row.min_cost,
                actual_cost=row.actual_cost,
                total_cost=row.total_cost,
                length=row.length,
                width=row.width,
                height=row.height,
                volume=row.volume,
                stock_status=row.stock_status,
                retrieval_status=default_retrieval,
            )
        return costing


class ProjectCostingItemView:
    def __init__(self, request=None):
        self.request = request

    def get_serializer_context(self):
        return {"request": self.request} if self.request is not None else {}

    def list_payload(self, summary):
        items = list(
            ProjectCostingItemInfo.objects.filter(costing_id=summary)
            .select_related("cost_type", "item_category", "item_code__item_type", "room_name", "stock_status", "retrieval_status", "requested_by")
            .order_by("id")
        )
        return {
            "costing_id": summary.costing_id,
            "project_id": summary.project_id,
            "project_name": summary.project_name,
            "items": ProjectCostingItemSerializer(items, many=True, context=self.get_serializer_context()).data,
            "status": "success",
            "message": "Project costing items loaded successfully.",
        }

    def stock_retrieval_payload(self):
        ProjectCostingSummaryView.ensure_retrieval_statuses_seeded()
        allowed_status_ids = list(
            RetrievalStatusInfo.objects.filter(
                status_name__in=[
                    RetrievalStatusInfo.STATUS_ITEM_REQUESTED,
                    RetrievalStatusInfo.STATUS_ITEM_SUPPLIED,
                    RetrievalStatusInfo.STATUS_REQUEST_REJECTED,
                ]
            ).values_list("id", flat=True)
        )
        queryset = ProjectCostingItemInfo.objects.select_related("costing_id", "cost_type", "item_category", "item_code__item_type", "room_name", "stock_status", "retrieval_status", "requested_by")
        queryset = queryset.filter(retrieval_status_id__in=allowed_status_ids)
        items = list(queryset.order_by("id"))
        return {
            "items": ProjectCostingItemSerializer(items, many=True, context=self.get_serializer_context()).data,
            "status": "success",
            "message": "Stock retrieval items loaded successfully.",
        }

    def stock_return_payload(self):
        status_obj = RetrievalStatusInfo.objects.filter(status_name__iexact=RetrievalStatusInfo.STATUS_ITEM_RETURN).first()
        queryset = ProjectCostingItemInfo.objects.select_related("costing_id", "cost_type", "item_category", "item_code__item_type", "room_name", "stock_status", "retrieval_status")
        if status_obj:
            queryset = queryset.filter(retrieval_status=status_obj)
        items = list(queryset.order_by("id"))
        return {
            "items": ProjectCostingItemSerializer(items, many=True, context=self.get_serializer_context()).data,
            "status": "success",
            "message": "Stock return items loaded successfully.",
        }

