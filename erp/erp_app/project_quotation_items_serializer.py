from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .sub_models import ItemCategory, LabFurnitureItem, Project
from .sub_models.CostType_mod import CostTypeInfo
from .sub_models.project_quotation_items_mod import ProjectQuotationItemInfo, build_project_quotation_hierarchy
from .sub_models.project_quotation_summary_mod import ProjectQuotationSummaryInfo
from .sub_models.room_data_mod import RoomDataInfo
from .room_data_serializer import RoomDataSerializer


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
    item_type = serializers.SerializerMethodField(read_only=True)
    room_name_id = serializers.PrimaryKeyRelatedField(
        source="room_name",
        queryset=RoomDataInfo.objects.order_by("room_name"),
        required=False,
        allow_null=True,
    )
    room_name = RoomDataSerializer(read_only=True)
    stock_status = serializers.SerializerMethodField(read_only=True)
    stock_status_name = serializers.CharField(source="stock_status.status_name", read_only=True)

    children = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProjectQuotationItemInfo
        validators = []
        fields = [
            "id",
            "quotation_number",
            "project_id",
            "project_name",
            "cost_type_id",
            "cost_type",
            "cost_type_description",
            "item_category_id",
            "item_category",
            "item_name",
            "item_code_id",
            "item_code",
            "item_type",
            "room_name_id",
            "room_name",
            "stock_status",
            "stock_status_name",
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
            "stock_status",
            "stock_status_name",
            "purchase_qty",
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

    def get_item_type(self, obj):
        item_code = getattr(obj, "item_code", None)
        nested_item_type = getattr(item_code, "item_type", None) if item_code else None
        return getattr(nested_item_type, "it_name", "") if nested_item_type else ""

    def get_stock_status(self, obj):
        status = getattr(obj, "stock_status", None)
        if not status:
            return None
        return {
            "id": status.pk,
            "status_name": status.status_name,
        }

    @staticmethod
    def _as_bool(value):
        if isinstance(value, bool):
            return value
        return str(value or "").strip().lower() in {"1", "true", "yes", "y", "on"}

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
            candidate._state.adding = False

        resolved_summary = self._resolve_summary(attrs)
        if resolved_summary is None:
            raise serializers.ValidationError({"quotation_number": "Quotation number or project_id is required."})
        attrs["quotation_number"] = resolved_summary

        allow_over_request = self._as_bool(self.context.get("allow_requested_qty_override"))

        field_names = [
            "quotation_number",
            "cost_type",
            "item_category",
            "item_name",
            "item_code",
            "room_name",
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

        if candidate.item_code_id and candidate.quotation_number_id:
            duplicate_queryset = ProjectQuotationItemInfo.objects.filter(
                quotation_number=candidate.quotation_number,
                item_code=candidate.item_code,
            )
            if candidate.pk:
                duplicate_queryset = duplicate_queryset.exclude(pk=candidate.pk)
            if duplicate_queryset.exists():
                raise serializers.ValidationError(
                    {"item_code_id": ["Duplicate item code is not allowed for this quotation."]}
                )

        candidate._allow_requested_qty_override = allow_over_request

        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"non_field_errors": exc.messages})

        normalized = {field_name: getattr(candidate, field_name) for field_name in field_names}
        attrs.update(normalized)
        return attrs

    def _build_instance(self, validated_data, instance=None):
        target = instance or ProjectQuotationItemInfo()
        for field, value in validated_data.items():
            setattr(target, field, value)

        allow_over_request = self._as_bool(self.context.get("allow_requested_qty_override"))
        target._allow_requested_qty_override = allow_over_request

        try:
            target.full_clean()
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"non_field_errors": exc.messages})
        return target

    def create(self, validated_data):
        instance = self._build_instance(validated_data)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        instance = self._build_instance(validated_data, instance=instance)
        instance.save()
        return instance

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

