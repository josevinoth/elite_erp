from decimal import Decimal

from ..project_quotation_serializer import ProjectQuotationSerializer
from ..sub_models import Project
from ..sub_models.CostType_mod import CostTypeInfo
from ..sub_models.project_quotation_mod import ProjectQuotationItemInfo


class ProjectQuotationView:
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

    def _serialize_project(self, project, rows):
        serializer_context = self.get_serializer_context()
        flat_items = ProjectQuotationSerializer(rows, many=True, context=serializer_context).data
        bom_hierarchy = ProjectQuotationSerializer.build_nested_hierarchy(rows, context=serializer_context)
        total_cost = sum((Decimal(str(row.total_cost or 0)) for row in rows), Decimal("0"))
        return {
            "project_id": project.id,
            "project_code": project.project_id,
            "project_name": project.project_name,
            "description": project.description,
            "item_count": len(rows),
            "total_cost": str(total_cost),
            "items": flat_items,
            "bom_hierarchy": bom_hierarchy,
        }

    def list_payload(self):
        rows = list(
            ProjectQuotationItemInfo.objects.select_related(
                "project",
                "cost_type",
                "item_category",
                "item_code",
            ).order_by("project_id", "id")
        )
        rows_by_project = {}
        for row in rows:
            rows_by_project.setdefault(row.project.pk, []).append(row)

        projects_payload = []
        for project in Project.objects.order_by("project_id", "project_name"):
            project_rows = rows_by_project.get(project.pk, [])
            projects_payload.append(self._serialize_project(project, project_rows))

        material_cost_type = CostTypeInfo.objects.filter(name__iexact="MATERIAL").first()
        return {
            "projects": projects_payload,
            "cost_types": self._serialize_cost_types(),
            "material_cost_type_id": material_cost_type.pk if material_cost_type else None,
        }

    def detail_payload(self, row):
        project_rows = list(
            ProjectQuotationItemInfo.objects.filter(project=row.project)
            .select_related("project", "cost_type", "item_category", "item_code")
            .order_by("id")
        )
        return {
            "project_quotation_item": ProjectQuotationSerializer(row, context=self.get_serializer_context()).data,
            "project": self._serialize_project(row.project, project_rows),
        }



