from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .sub_models import Project, ProjectQuotationSummaryInfo
from .sub_models.project_costing_summary_mod import ProjectCostingSummaryInfo
from .sub_models.quotation_status_mod import QuotationStatusInfo


class CostingStatusField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        if isinstance(data, str):
            normalized = data.strip()
            if not normalized:
                self.fail("does_not_exist", pk_value=data)

            queryset = self.get_queryset()
            resolved_by_name = queryset.filter(status_name__iexact=normalized).first() if queryset is not None else None
            if resolved_by_name is not None:
                return resolved_by_name

            if normalized.isdigit():
                data = int(normalized)
            else:
                self.fail("does_not_exist", pk_value=data)

        return super().to_internal_value(data)

    def to_representation(self, value):
        return str(getattr(value, "status_name", value) or "")


class ProjectCostingSummarySerializer(serializers.ModelSerializer):
    quotation_number_id = serializers.PrimaryKeyRelatedField(
        source="quotation_number",
        queryset=ProjectQuotationSummaryInfo.objects.select_related("project").all(),
        required=False,
        allow_null=True,
    )
    project_id = serializers.PrimaryKeyRelatedField(
        source="project",
        queryset=Project.objects.all(),
        required=False,
        allow_null=True,
    )
    status = CostingStatusField(queryset=QuotationStatusInfo.objects.all(), required=False)
    quotation_status = serializers.SlugRelatedField(
        source="status",
        slug_field="status_name",
        queryset=QuotationStatusInfo.objects.all(),
        required=False,
        write_only=True,
    )
    quotation_number = serializers.CharField(source="quotation_number.quotation_number", read_only=True)
    project_code = serializers.CharField(source="project.project_id", read_only=True)
    status_id = serializers.CharField(read_only=True)
    status_name = serializers.CharField(source="status.status_name", read_only=True)

    class Meta:
        model = ProjectCostingSummaryInfo
        fields = [
            "id",
            "costing_id",
            "quotation_number_id",
            "quotation_number",
            "project_id",
            "project_code",
            "project_name",
            "quotation_status",
            "status",
            "status_id",
            "status_name",
            "total_material_cost",
            "petrol_expenses",
            "transport_installation_team",
            "contingency",
            "transportation",
            "food_accomodation",
            "loading",
            "unloading",
            "installation",
            "business_development",
            "markup",
            "final_material_cost",
            "total_cost_to_elite",
            "total_markup",
            "planned_order_value",
            "discount",
            "undiscounted_quote_value",
            "factor",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "costing_id",
            "quotation_number",
            "project_code",
            "project_name",
            "status_id",
            "status_name",
            "final_material_cost",
            "total_cost_to_elite",
            "total_markup",
            "planned_order_value",
            "discount",
            "undiscounted_quote_value",
            "factor",
            "created_at",
            "updated_at",
        ]

    @staticmethod
    def _allow_completed_without_items(instance=None, context=None):
        return bool(
            getattr(instance, "_allow_completed_without_items", False)
            or (context or {}).get("allow_completed_without_items", False)
        )

    def validate(self, attrs):
        if self.instance is None and "quotation_number" not in attrs:
            raise serializers.ValidationError({"quotation_number_id": ["Quotation number is required."]})

        source = self.instance or ProjectCostingSummaryInfo()
        candidate = ProjectCostingSummaryInfo()
        if getattr(source, "pk", None):
            candidate.pk = source.pk
            candidate._state.adding = False
            candidate.costing_id = source.costing_id

        field_names = [
            "quotation_number",
            "project",
            "project_name",
            "status",
            "total_material_cost",
            "petrol_expenses",
            "transport_installation_team",
            "contingency",
            "final_material_cost",
            "transportation",
            "food_accomodation",
            "loading",
            "unloading",
            "installation",
            "business_development",
            "total_cost_to_elite",
            "markup",
            "total_markup",
            "planned_order_value",
            "discount",
            "undiscounted_quote_value",
            "factor",
        ]
        for field_name in field_names:
            value = attrs[field_name] if field_name in attrs else getattr(source, field_name, None)
            setattr(candidate, field_name, value)

        candidate._allow_completed_without_items = self._allow_completed_without_items(
            instance=self.instance,
            context=getattr(self, "context", {}),
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
        target = instance or ProjectCostingSummaryInfo()
        for field, value in validated_data.items():
            setattr(target, field, value)
        target._allow_completed_without_items = self._allow_completed_without_items(
            instance=instance,
            context=getattr(self, "context", {}),
        )
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
