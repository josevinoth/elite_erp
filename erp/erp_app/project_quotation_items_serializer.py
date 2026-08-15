from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .sub_models import ItemCategory, LabFurnitureItem, Project
from .sub_models.CostType_mod import CostTypeInfo
from .sub_models.project_quotation_items_mod import ProjectQuotationItemInfo, build_project_quotation_hierarchy
from .sub_models.project_quotation_summary_mod import ProjectQuotationSummaryInfo


class ProjectQuotationItemSerializer(serializers.ModelSerializer):
    quotation_number = serializers.SlugRelatedField(
        slug_field="quotation_number",
        queryset=ProjectQuotationSummaryInfo.objects.order_by("quotation_number"),
        required=False,
    )
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all(), write_only=True, required=False)
    project_name = serializers.CharField(source="quotation_number.project_name", read_only=True)

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
            "quotation_number",
            "project_id",
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
            "max_cost",
            "min_cost",
            "actual_cost",
            "total_cost",
            "length",
            "width",
            "height",
            "volume",
            "children",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project_name",
            "total_cost",
            "max_cost",
            "min_cost",
            "length",
            "width",
            "height",
            "volume",
            "children",
            "created_at",
            "updated_at",
        ]

    def get_children(self, _obj):
        return []

    def _resolve_summary(self, attrs):
        explicit_summary = attrs.get("quotation_number")
        if explicit_summary:
            return explicit_summary

        source = self.instance
        if source is not None and getattr(source, "quotation_number", None):
            return source.quotation_number

        project = attrs.pop("project", None)
        if project is None:
            return None

        summary = (
            ProjectQuotationSummaryInfo.objects.filter(project=project)
            .order_by("id")
            .first()
        )
        if summary:
            return summary

        return ProjectQuotationSummaryInfo.objects.create(project=project)

    def validate(self, attrs):
        source = self.instance or ProjectQuotationItemInfo()
        candidate = ProjectQuotationItemInfo()
        if getattr(source, "pk", None):
            candidate.pk = source.pk

        resolved_summary = self._resolve_summary(attrs)
        if resolved_summary is None:
            raise serializers.ValidationError({"quotation_number": "Quotation number or project_id is required."})
        attrs["quotation_number"] = resolved_summary

        field_names = [
            "quotation_number",
            "cost_type",
            "level",
            "item_category",
            "item_name",
            "item_code",
            "requested_qty",
            "purchase_qty",
            "cost_per_qty",
            "max_cost",
            "min_cost",
            "actual_cost",
            "total_cost",
            "length",
            "width",
            "height",
            "volume",
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

        normalized = {field_name: getattr(candidate, field_name) for field_name in field_names}
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

