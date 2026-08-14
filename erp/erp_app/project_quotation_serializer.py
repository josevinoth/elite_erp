from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .sub_models import ItemCategory, LabFurnitureItem, Project
from .sub_models.CostType_mod import CostTypeInfo
from .sub_models.project_quotation_mod import ProjectQuotationItemInfo, build_project_quotation_hierarchy


class ProjectQuotationSerializer(serializers.ModelSerializer):
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all())
    project_code = serializers.CharField(source="project.project_id", read_only=True)
    project_name = serializers.CharField(source="project.project_name", read_only=True)

    cost_type_id = serializers.PrimaryKeyRelatedField(source="cost_type", queryset=CostTypeInfo.objects.order_by("name"))
    cost_type = serializers.CharField(source="cost_type.name", read_only=True)
    cost_type_description = serializers.CharField(source="cost_type.description", read_only=True)

    item_category_id = serializers.PrimaryKeyRelatedField(
        source="item_category",
        queryset=ItemCategory.objects.all(),
        required=False,
        allow_null=True,
    )
    item_category = serializers.CharField(source="item_category.name", read_only=True)

    item_code_id = serializers.PrimaryKeyRelatedField(
        source="item_code",
        queryset=LabFurnitureItem.objects.select_related("item_category").all(),
        required=False,
        allow_null=True,
    )
    item_code = serializers.CharField(source="item_code.item_code", read_only=True)

    children = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProjectQuotationItemInfo
        fields = [
            "id",
            "project_id",
            "project_code",
            "project_name",
            "cost_type_id",
            "cost_type",
            "cost_type_description",
            "level",
            "item_category_id",
            "item_category",
            "item_name",
            "item_code_id",
            "item_code",
            "requested_qty",
            "purchase_qty",
            "cost_per_qty",
            "total_cost",
            "children",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "total_cost", "children", "created_at", "updated_at"]

    def get_children(self, _obj):
        return []

    def validate(self, attrs):
        source = self.instance or ProjectQuotationItemInfo()
        candidate = ProjectQuotationItemInfo()
        if getattr(source, "pk", None):
            candidate.pk = source.pk

        field_names = [
            "project",
            "cost_type",
            "level",
            "item_category",
            "item_name",
            "item_code",
            "requested_qty",
            "purchase_qty",
            "cost_per_qty",
            "total_cost",
        ]
        for field_name in field_names:
            value = attrs[field_name] if field_name in attrs else getattr(source, field_name, None)
            setattr(candidate, field_name, value)

        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"non_field_errors": exc.messages})

        normalized = {
            "project": candidate.project,
            "cost_type": candidate.cost_type,
            "level": candidate.level,
            "item_category": candidate.item_category,
            "item_name": candidate.item_name,
            "item_code": candidate.item_code,
            "requested_qty": candidate.requested_qty,
            "purchase_qty": candidate.purchase_qty,
            "cost_per_qty": candidate.cost_per_qty,
            "total_cost": candidate.total_cost,
        }
        attrs.update(normalized)
        return attrs

    @classmethod
    def build_nested_hierarchy(cls, rows, context=None):
        serialized_rows = [dict(item) for item in cls(rows, many=True, context=context).data]
        rows_by_id = {row.id: serialized for row, serialized in zip(rows, serialized_rows)}
        hierarchy_nodes = build_project_quotation_hierarchy(rows)

        def serialize_node(node):
            item = node["item"]
            serialized = dict(rows_by_id.get(item.id, {}))
            serialized["children"] = [serialize_node(child) for child in node["children"]]
            return serialized

        return [serialize_node(node) for node in hierarchy_nodes]

