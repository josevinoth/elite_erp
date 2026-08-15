from decimal import Decimal

from ..project_quotation_items_serializer import ProjectQuotationItemSerializer
from ..project_quotation_summary_serializer import ProjectQuotationSummarySerializer
from ..sub_models.CostType_mod import CostTypeInfo
from ..sub_models.project_quotation_items_mod import ProjectQuotationItemInfo
from ..sub_models.project_quotation_summary_mod import ProjectQuotationSummaryInfo


class ProjectQuotationSummaryView:
    def __init__(self, request=None):
        self.request = request

    def get_serializer_context(self):
        return {"request": self.request} if self.request is not None else {}

    def _serialize_cost_types(self):
        return [
            {
                "id": row.pk,
                "name": row.name,
                "description": row.description,
            }
            for row in CostTypeInfo.objects.order_by("name")
        ]

    def _serialize_summary(self, summary):
        return {
            **ProjectQuotationSummarySerializer(summary, context=self.get_serializer_context()).data,
            "total_quotation_cost": str(summary.total_cost_to_elite or 0),
            "project_code": getattr(summary.project, "project_id", ""),
        }

    def list_payload(self, project_id=None):
        summaries = ProjectQuotationSummaryInfo.objects.select_related("project").order_by("project__project_id", "id")
        if project_id not in (None, ""):
            summaries = summaries.filter(project_id=project_id)

        material_cost_type = CostTypeInfo.objects.filter(name__iexact="MATERIAL").first()
        serialized = [self._serialize_summary(summary) for summary in summaries]
        return {
            "quotations": serialized,
            "cost_types": self._serialize_cost_types(),
            "material_cost_type_id": material_cost_type.pk if material_cost_type else None,
        }

    def detail_payload(self, summary):
        items = list(
            ProjectQuotationItemInfo.objects.filter(quotation_number=summary)
            .select_related("quotation_number", "cost_type", "item_category", "item_code")
            .order_by("id")
        )
        return {
            "quotation": self._serialize_summary(summary),
            "items": ProjectQuotationItemSerializer(items, many=True, context=self.get_serializer_context()).data,
            "bom_hierarchy": ProjectQuotationItemSerializer.build_nested_hierarchy(
                items,
                context=self.get_serializer_context(),
            ),
            "cost_types": self._serialize_cost_types(),
        }


class ProjectQuotationItemView:
    def __init__(self, request=None):
        self.request = request

    def get_serializer_context(self):
        return {"request": self.request} if self.request is not None else {}

    def list_payload(self, summary):
        items = list(
            ProjectQuotationItemInfo.objects.filter(quotation_number=summary)
            .select_related("quotation_number", "cost_type", "item_category", "item_code")
            .order_by("id")
        )
        total_cost = sum((Decimal(str(row.total_cost or 0)) for row in items), Decimal("0"))
        return {
            "quotation_number": summary.quotation_number,
            "project_id": summary.project_id,
            "project_name": summary.project_name,
            "total_quotation_cost": str(total_cost),
            "items": ProjectQuotationItemSerializer(items, many=True, context=self.get_serializer_context()).data,
            "bom_hierarchy": ProjectQuotationItemSerializer.build_nested_hierarchy(items, context=self.get_serializer_context()),
        }


# Compatibility aliases retained for existing imports.
ProjectQuotationView = ProjectQuotationSummaryView
ProjectQuotationListView = ProjectQuotationSummaryView



