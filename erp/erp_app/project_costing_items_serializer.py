from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .retrieval_status_serializer import RetrievalStatusSerializer
from .room_data_serializer import RoomDataSerializer
from .sub_models import ItemCategory, LabFurnitureItem
from .sub_models.CostType_mod import CostTypeInfo
from .sub_models.project_costing_items_mod import ProjectCostingItemInfo
from .sub_models.project_costing_summary_mod import ProjectCostingSummaryInfo
from .sub_models.retrieval_status_mod import RetrievalStatusInfo
from .sub_models.room_data_mod import RoomDataInfo
from .sub_models.stock_status_mod import StockStatusInfo


class ProjectCostingItemSerializer(serializers.ModelSerializer):
    requested_by_id = serializers.PrimaryKeyRelatedField(
        source="requested_by",
        queryset=get_user_model().objects.all(),
        required=False,
        allow_null=True,
    )
    requested_by_name = serializers.SerializerMethodField(read_only=True)
    costing_ref = serializers.CharField(source="costing_id.costing_id", read_only=True)
    quotation_number = serializers.CharField(source="costing_id.quotation_number.quotation_number", read_only=True)
    project_code = serializers.CharField(source="costing_id.project.project_id", read_only=True)
    project_name = serializers.CharField(source="costing_id.project_name", read_only=True)
    project_owner_id = serializers.IntegerField(source="costing_id.project.project_owner_id", read_only=True)
    project_owner_name = serializers.CharField(source="costing_id.project.project_owner.username", read_only=True)
    costing_id = serializers.PrimaryKeyRelatedField(queryset=ProjectCostingSummaryInfo.objects.all())
    item_category_id = serializers.PrimaryKeyRelatedField(
        source="item_category",
        queryset=ItemCategory.objects.all(),
        required=False,
        allow_null=True,
    )
    item_code_id = serializers.PrimaryKeyRelatedField(
        source="item_code",
        queryset=LabFurnitureItem.objects.select_related("item_category").all(),
        required=False,
        allow_null=True,
    )
    cost_type_id = serializers.PrimaryKeyRelatedField(
        source="cost_type",
        queryset=CostTypeInfo.objects.order_by("name"),
        required=False,
        allow_null=True,
    )
    room_name_id = serializers.PrimaryKeyRelatedField(
        source="room_name",
        queryset=RoomDataInfo.objects.order_by("room_name"),
        required=False,
        allow_null=True,
    )
    stock_status = serializers.SerializerMethodField(read_only=True)
    stock_status_id = serializers.PrimaryKeyRelatedField(
        source="stock_status",
        queryset=StockStatusInfo.objects.all(),
        required=False,
        allow_null=True,
    )
    retrieval_status = RetrievalStatusSerializer(read_only=True)
    retrieval_status_id = serializers.PrimaryKeyRelatedField(
        source="retrieval_status",
        queryset=RetrievalStatusInfo.objects.all(),
        required=False,
        allow_null=True,
    )
    item_type = serializers.SerializerMethodField(read_only=True)
    item_category = serializers.CharField(source="item_category.name", read_only=True)
    item_code = serializers.CharField(source="item_code.item_code", read_only=True)
    cost_type = serializers.CharField(source="cost_type.name", read_only=True)
    room_name = RoomDataSerializer(read_only=True)

    class Meta:
        model = ProjectCostingItemInfo
        validators = []
        fields = [
            "id",
            "costing_id",
            "costing_ref",
            "quotation_number",
            "project_code",
            "project_name",
            "project_owner_id",
            "project_owner_name",
            "cost_type_id",
            "cost_type",
            "item_category_id",
            "item_category",
            "item_name",
            "item_code_id",
            "item_code",
            "item_type",
            "room_name_id",
            "room_name",
            "purchase_qty",
            "requested_qty",
            "cost_per_qty",
            "max_cost",
            "min_cost",
            "actual_cost",
            "total_cost",
            "stock_status",
            "stock_status_id",
            "retrieval_status",
            "retrieval_status_id",
            "requested_by_id",
            "requested_by_name",
            "requested_on",
            "rejection_comment",
            "length",
            "width",
            "height",
            "volume",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "stock_status",
            "item_category",
            "item_code",
            "item_type",
            "cost_type",
            "room_name",
            "cost_per_qty",
            "max_cost",
            "min_cost",
            "total_cost",
            "length",
            "width",
            "height",
            "volume",
            "created_at",
            "updated_at",
        ]

    def get_item_type(self, obj):
        item_code = getattr(obj, "item_code", None)
        nested_item_type = getattr(item_code, "item_type", None) if item_code else getattr(obj, "item_type", None)
        return getattr(nested_item_type, "it_name", "") if nested_item_type else ""

    def get_stock_status(self, obj):
        status_obj = getattr(obj, "stock_status", None)
        if not status_obj:
            return None
        return {"id": status_obj.pk, "status_name": status_obj.status_name}

    def get_requested_by_name(self, obj):
        user = getattr(obj, "requested_by", None)
        if not user:
            return ""
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        if full_name:
            return full_name
        return getattr(user, "username", "") or getattr(user, "email", "")

    def validate(self, attrs):
        source = self.instance or ProjectCostingItemInfo()
        candidate = ProjectCostingItemInfo()
        if getattr(source, "pk", None):
            candidate.pk = source.pk
            candidate._state.adding = False

        field_names = [
            "costing_id",
            "cost_type",
            "item_category",
            "item_name",
            "item_code",
            "item_type",
            "room_name",
            "purchase_qty",
            "requested_qty",
            "cost_per_qty",
            "max_cost",
            "min_cost",
            "actual_cost",
            "total_cost",
            "length",
            "width",
            "height",
            "volume",
            "stock_status",
            "retrieval_status",
            "requested_by",
            "requested_on",
            "rejection_comment",
        ]
        for field_name in field_names:
            value = attrs[field_name] if field_name in attrs else getattr(source, field_name, None)
            setattr(candidate, field_name, value)

        if getattr(candidate, "item_code", None) is not None and getattr(candidate, "costing_id", None) is not None:
            duplicate_queryset = ProjectCostingItemInfo.objects.filter(
                costing_id=candidate.costing_id,
                item_code=candidate.item_code,
            )
            if candidate.pk:
                duplicate_queryset = duplicate_queryset.exclude(pk=candidate.pk)
            if duplicate_queryset.exists():
                raise serializers.ValidationError(
                    {"item_code_id": ["Duplicate item code is not allowed for this project costing."]}
                )

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
        target = instance or ProjectCostingItemInfo()
        for field, value in validated_data.items():
            setattr(target, field, value)

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
