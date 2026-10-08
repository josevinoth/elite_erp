from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .retrieval_status_serializer import RetrievalStatusSerializer
from .room_data_serializer import RoomDataSerializer
from .sub_models import ItemCategory, LabFurnitureItem
from .sub_models.CostType_mod import CostTypeInfo
from .sub_models.project_costing_items_mod import ProjectCostingItemAllocation, ProjectCostingItemInfo
from .sub_models.project_costing_summary_mod import ProjectCostingSummaryInfo
from .sub_models.retrieval_status_mod import RetrievalStatusInfo
from .sub_models.room_data_mod import RoomDataInfo
from .sub_models.stock_purchase import StockPurchaseItem
from .sub_models.stock_status_mod import StockStatusInfo


class ProjectCostingItemAllocationSerializer(serializers.ModelSerializer):
    purchase_item_id = serializers.PrimaryKeyRelatedField(
        source="purchase_item",
        queryset=StockPurchaseItem.objects.select_related("vendor_detail__vendor", "item_code").all(),
    )
    retrieval_status_id = serializers.PrimaryKeyRelatedField(
        source="retrieval_status",
        queryset=RetrievalStatusInfo.objects.all(),
        required=False,
        allow_null=True,
    )
    grn_number = serializers.CharField(source="purchase_item.grn_number", read_only=True)
    vendor_name = serializers.CharField(source="purchase_item.vendor_detail.vendor.name", read_only=True)
    purchase_qty = serializers.SerializerMethodField(read_only=True)
    unit_price = serializers.CharField(source="purchase_item.unit_price", read_only=True)
    retrieval_status_name = serializers.CharField(source="retrieval_status.status_name", read_only=True)
    remaining_accepted_qty = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProjectCostingItemAllocation
        fields = [
            "id",
            "purchase_item_id",
            "grn_number",
            "vendor_name",
            "purchase_qty",
            "unit_price",
            "allocated_qty",
            "pending_return_qty",
            "returned_qty",
            "remaining_accepted_qty",
            "retrieval_status_id",
            "retrieval_status_name",
        ]

    def get_purchase_qty(self, obj):
        purchase_item = getattr(obj, "purchase_item", None)
        if not purchase_item:
            return "0"
        return str(getattr(purchase_item, "purchase_qty", None) or getattr(purchase_item, "quantity", 0) or 0)

    def get_remaining_accepted_qty(self, obj):
        allocated_qty = Decimal(str(getattr(obj, "allocated_qty", 0) or 0))
        returned_qty = Decimal(str(getattr(obj, "returned_qty", 0) or 0))
        remaining = allocated_qty - returned_qty
        if remaining < 0:
            remaining = Decimal("0")
        return str(remaining)


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
    purchase_item_id = serializers.PrimaryKeyRelatedField(
        source="purchase_item",
        queryset=StockPurchaseItem.objects.select_related("vendor_detail__vendor", "item_code").all(),
        required=False,
        allow_null=True,
    )
    purchase_item = serializers.SerializerMethodField(read_only=True)
    grn_allocations = ProjectCostingItemAllocationSerializer(many=True, required=False)

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
            "purchase_item_id",
            "purchase_item",
            "grn_allocations",
            "purchase_qty",
            "requested_qty",
            "accepted_qty",
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

    def get_purchase_item(self, obj):
        purchase_item = getattr(obj, "purchase_item", None)
        if not purchase_item:
            return None
        return {
            "id": purchase_item.pk,
            "grn_number": purchase_item.grn_number,
            "vendor_name": getattr(getattr(purchase_item, "vendor_detail", None), "vendor", None).name
            if getattr(getattr(purchase_item, "vendor_detail", None), "vendor", None)
            else "",
            "purchase_qty": str(getattr(purchase_item, "purchase_qty", None) or getattr(purchase_item, "quantity", 0) or 0),
            "unit_price": str(purchase_item.unit_price),
        }

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
            "purchase_item",
            "purchase_qty",
            "requested_qty",
            "accepted_qty",
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
            candidate_status_name = str(getattr(getattr(candidate, "retrieval_status", None), "status_name", "") or "")
            allowed_duplicate_statuses = {
                RetrievalStatusInfo.STATUS_ITEM_RETURN,
                RetrievalStatusInfo.STATUS_ITEM_RETURN_ACCEPTED,
            }
            blocking_duplicates = [
                row for row in duplicate_queryset.select_related("retrieval_status")
                if str(getattr(getattr(row, "retrieval_status", None), "status_name", "") or "") not in allowed_duplicate_statuses
            ]
            if blocking_duplicates and candidate_status_name not in allowed_duplicate_statuses:
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

        allocations_data = attrs.get("grn_allocations")
        if allocations_data is None and self.instance is None:
            allocations_data = []
        attrs["grn_allocations"] = self._validate_and_normalize_allocations(candidate, allocations_data)

        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"non_field_errors": exc.messages})

        normalized = {field_name: getattr(candidate, field_name) for field_name in field_names}
        attrs.update(normalized)
        return attrs

    def _validate_and_normalize_allocations(self, candidate, allocations_data):
        if allocations_data is None:
            return None

        if not isinstance(allocations_data, list):
            raise serializers.ValidationError({"grn_allocations": ["GRN allocations must be a list."]})

        if getattr(candidate, "item_code", None) is None:
            return []

        requested_qty = Decimal(str(getattr(candidate, "requested_qty", 0) or 0))
        normalized_rows = []
        total_allocated = Decimal("0")
        first_purchase_item = None
        requested_status = RetrievalStatusInfo.objects.filter(status_name__iexact=RetrievalStatusInfo.STATUS_ITEM_REQUESTED).first()
        default_status = getattr(candidate, "retrieval_status", None) or requested_status
        existing_allocations = {}
        if candidate.pk:
            existing_allocations = {
                row.purchase_item_id: row
                for row in ProjectCostingItemAllocation.objects.filter(costing_item_id=candidate.pk)
            }

        for row in allocations_data:
            purchase_item = row.get("purchase_item")
            if purchase_item is None:
                raise serializers.ValidationError({"grn_allocations": ["Each allocation requires purchase_item_id."]})
            if getattr(purchase_item, "item_code_id", None) != getattr(candidate, "item_code_id", None):
                raise serializers.ValidationError({"grn_allocations": ["Allocation GRN item code mismatch."]})

            qty = Decimal(str(row.get("allocated_qty", 0) or 0))
            if qty < 0:
                raise serializers.ValidationError({"grn_allocations": ["Allocated quantity must be 0 or greater."]})

            existing_allocation = existing_allocations.get(getattr(purchase_item, "pk", None))
            pending_return_qty = Decimal(
                str(
                    row.get(
                        "pending_return_qty",
                        getattr(existing_allocation, "pending_return_qty", 0),
                    ) or 0
                )
            )
            returned_qty = Decimal(
                str(
                    row.get(
                        "returned_qty",
                        getattr(existing_allocation, "returned_qty", 0),
                    ) or 0
                )
            )

            status_obj = row.get("retrieval_status") or default_status
            if not status_obj:
                raise serializers.ValidationError({"grn_allocations": ["Default retrieval status is not configured."]})

            purchased_qty = Decimal(
                str(getattr(purchase_item, "purchase_qty", None) or getattr(purchase_item, "quantity", 0) or 0)
            )
            consumed_qs = ProjectCostingItemAllocation.objects.select_related("retrieval_status", "costing_item__retrieval_status").filter(
                purchase_item=purchase_item,
                costing_item__retrieval_status__status_name__in=[
                    RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
                    RetrievalStatusInfo.STATUS_ITEM_RETURN,
                    RetrievalStatusInfo.STATUS_ITEM_RETURN_ACCEPTED,
                ],
            )
            if candidate.pk:
                consumed_qs = consumed_qs.exclude(costing_item_id=candidate.pk)
            consumed_qty = sum(
                (
                    max(
                        Decimal(str(x.allocated_qty or 0)) - Decimal(str(getattr(x, "returned_qty", 0) or 0)),
                        Decimal("0"),
                    )
                    for x in consumed_qs
                ),
                Decimal("0"),
            )
            available_qty = purchased_qty - consumed_qty
            if status_obj.status_name == RetrievalStatusInfo.STATUS_ITEM_ACCEPTED and qty > available_qty:
                raise serializers.ValidationError(
                    {
                        "grn_allocations": [
                            f"Allocated qty {qty} exceeds available balance {available_qty} for GRN {purchase_item.grn_number}."
                        ]
                    }
                )

            total_allocated += qty
            if first_purchase_item is None:
                first_purchase_item = purchase_item
            normalized_rows.append({
                "purchase_item": purchase_item,
                "allocated_qty": qty,
                "pending_return_qty": pending_return_qty,
                "returned_qty": returned_qty,
                "retrieval_status": status_obj,
            })

        if normalized_rows and total_allocated != requested_qty:
            raise serializers.ValidationError(
                {"grn_allocations": ["Total allocated quantity across GRNs must equal requested quantity."]}
            )

        candidate.purchase_item = first_purchase_item
        if first_purchase_item:
            candidate.purchase_qty = Decimal(
                str(getattr(first_purchase_item, "purchase_qty", None) or getattr(first_purchase_item, "quantity", 0) or 0)
            )

        accepted_qty = Decimal("0")
        for row in normalized_rows:
            status_name = str(getattr(row["retrieval_status"], "status_name", "") or "")
            if status_name in {
                RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
                RetrievalStatusInfo.STATUS_ITEM_RETURN,
            }:
                returned_qty = Decimal(str(row.get("returned_qty", 0) or 0))
                remaining = row["allocated_qty"] - returned_qty
                if remaining > 0:
                    accepted_qty += remaining
        candidate.accepted_qty = accepted_qty
        if candidate.accepted_qty < 0:
            candidate.accepted_qty = Decimal("0")

        return normalized_rows

    def _build_instance(self, validated_data, instance=None):
        allocations_data = validated_data.pop("grn_allocations", None)
        target = instance or ProjectCostingItemInfo()
        for field, value in validated_data.items():
            setattr(target, field, value)

        try:
            target.full_clean()
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"non_field_errors": exc.messages})
        return target, allocations_data

    @staticmethod
    def _sync_allocations(instance, allocations_data):
        if allocations_data is None:
            return

        existing = {
            row.purchase_item_id: row
            for row in ProjectCostingItemAllocation.objects.filter(costing_item=instance)
        }
        retained = set()
        accepted_qty = Decimal("0")

        for row in allocations_data:
            purchase_item = row["purchase_item"]
            allocation = existing.get(purchase_item.pk)
            if allocation is None:
                allocation = ProjectCostingItemAllocation(costing_item=instance, purchase_item=purchase_item)
            allocation.allocated_qty = row["allocated_qty"]
            allocation.pending_return_qty = row.get("pending_return_qty", getattr(allocation, "pending_return_qty", 0))
            allocation.returned_qty = row.get("returned_qty", getattr(allocation, "returned_qty", 0))
            allocation.retrieval_status = row["retrieval_status"]
            allocation.save()
            retained.add(purchase_item.pk)

            status_name = str(getattr(allocation.retrieval_status, "status_name", "") or "")
            if status_name in {
                RetrievalStatusInfo.STATUS_ITEM_ACCEPTED,
                RetrievalStatusInfo.STATUS_ITEM_RETURN,
            }:
                remaining = Decimal(str(allocation.allocated_qty or 0)) - Decimal(str(getattr(allocation, "returned_qty", 0) or 0))
                if remaining > 0:
                    accepted_qty += remaining

        stale_ids = [row.pk for pid, row in existing.items() if pid not in retained]
        if stale_ids:
            ProjectCostingItemAllocation.objects.filter(pk__in=stale_ids).delete()

        instance.accepted_qty = accepted_qty
        if instance.accepted_qty < 0:
            instance.accepted_qty = Decimal("0")
        instance.save(update_fields=["accepted_qty", "updated_at"])

    def create(self, validated_data):
        instance, allocations_data = self._build_instance(validated_data)
        instance.save()
        self._sync_allocations(instance, allocations_data)
        return instance

    def update(self, instance, validated_data):
        instance, allocations_data = self._build_instance(validated_data, instance=instance)
        instance.save()
        self._sync_allocations(instance, allocations_data)
        return instance
