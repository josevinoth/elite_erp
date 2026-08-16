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

    @staticmethod
    def _item_validation_state(item):
        requested_qty = Decimal(str(getattr(item, "requested_qty", 0) or 0))
        purchase_qty = Decimal(str(getattr(item, "purchase_qty", 0) or 0))
        cost_type_name = str(getattr(getattr(item, "cost_type", None), "name", "") or "").strip().upper()
        item_code = str(getattr(getattr(item, "item_code", None), "item_code", "") or "").strip()

        if cost_type_name != "MATERIAL":
            return {"status": "success", "message": "Quotation item validated successfully."}
        if not getattr(item, "item_code_id", None):
            return {"status": "error", "message": "Invalid item code for quotation item."}
        if purchase_qty <= 0:
            return {
                "status": "error",
                "message": f"Missing purchase data for item code {item_code or 'selected item'}.",
            }
        if requested_qty > purchase_qty:
            return {
                "status": "warning",
                "message": f"Requested Qty is greater than Purchase Qty for item code {item_code}.",
            }
        return {
            "status": "success",
            "message": f"Requested Qty is within Purchase Qty for item code {item_code}.",
        }

    def _validation_payload(self, items, default_success_message):
        item_messages = [self._item_validation_state(item) for item in items]
        for candidate in item_messages:
            if candidate["status"] == "error":
                return {**candidate, "validation_messages": item_messages}
        for candidate in item_messages:
            if candidate["status"] == "warning":
                return {**candidate, "validation_messages": item_messages}
        return {
            "status": "success",
            "message": default_success_message,
            "validation_messages": item_messages,
        }

    def _serialize_summary(self, summary, items=None):
        summary_items = items
        if summary_items is None:
            summary_items = list(
                ProjectQuotationItemInfo.objects.filter(quotation_number=summary)
                .select_related("quotation_number", "cost_type", "item_category", "item_code__item_type", "room_name")
                .defer("item_type")
                .order_by("id")
            )
        validation = self._validation_payload(summary_items, "Quotation summary validated successfully.")
        return {
            **ProjectQuotationSummarySerializer(summary, context=self.get_serializer_context()).data,
            "total_quotation_cost": str(summary.total_cost_to_elite or 0),
            "project_code": getattr(summary.project, "project_id", ""),
            "status": validation["status"],
            "message": validation["message"],
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
            "status": "success",
            "message": "Quotation summaries loaded successfully.",
        }

    def detail_payload(self, summary):
        items = list(
            ProjectQuotationItemInfo.objects.filter(quotation_number=summary)
            .select_related("quotation_number", "cost_type", "item_category", "item_code__item_type", "room_name")
            .defer("item_type")
            .order_by("id")
        )
        validation = self._validation_payload(items, "Quotation summary validated successfully.")
        return {
            "quotation": self._serialize_summary(summary, items=items),
            "items": ProjectQuotationItemSerializer(items, many=True, context=self.get_serializer_context()).data,
            "bom_hierarchy": ProjectQuotationItemSerializer.build_nested_hierarchy(
                items,
                context=self.get_serializer_context(),
            ),
            "cost_types": self._serialize_cost_types(),
            "status": validation["status"],
            "message": validation["message"],
            "validation_messages": validation["validation_messages"],
        }


class ProjectQuotationItemView:
    def __init__(self, request=None):
        self.request = request

    def get_serializer_context(self):
        return {"request": self.request} if self.request is not None else {}

    def list_payload(self, summary):
        items = list(
            ProjectQuotationItemInfo.objects.filter(quotation_number=summary)
            .select_related("quotation_number", "cost_type", "item_category", "item_code__item_type", "room_name")
            .defer("item_type")
            .order_by("id")
        )
        total_cost = sum((Decimal(str(row.total_cost or 0)) for row in items), Decimal("0"))
        validation = ProjectQuotationSummaryView(request=self.request)._validation_payload(
            items,
            "Quotation items validated successfully.",
        )
        return {
            "quotation_number": summary.quotation_number,
            "project_id": summary.project_id,
            "project_name": summary.project_name,
            "total_quotation_cost": str(total_cost),
            "items": ProjectQuotationItemSerializer(items, many=True, context=self.get_serializer_context()).data,
            "bom_hierarchy": ProjectQuotationItemSerializer.build_nested_hierarchy(items, context=self.get_serializer_context()),
            "status": validation["status"],
            "message": validation["message"],
            "validation_messages": validation["validation_messages"],
        }


# Compatibility aliases retained for existing imports.
ProjectQuotationView = ProjectQuotationSummaryView
ProjectQuotationListView = ProjectQuotationSummaryView



