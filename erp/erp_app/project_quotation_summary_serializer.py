from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .sub_models import Project
from .sub_models.quotation_status_mod import QuotationStatusInfo
from .sub_models.project_quotation_summary_mod import ProjectQuotationSummaryInfo


class ProjectQuotationSummarySerializer(serializers.ModelSerializer):
    project_id = serializers.PrimaryKeyRelatedField(
        source="project",
        queryset=Project.objects.all(),
        error_messages={
            "required": "Project is required.",
            "null": "Project is required.",
            "does_not_exist": "Selected project was not found.",
            "incorrect_type": "Project is required.",
        },
    )
    quotation_status = serializers.SlugRelatedField(
        source="status",
        slug_field="status_name",
        queryset=QuotationStatusInfo.objects.all(),
        required=False,
    )
    status = serializers.CharField(required=False, write_only=True)
    quotation_status_id = serializers.CharField(source="status_id", read_only=True)
    quotation_status_name = serializers.CharField(source="status.status_name", read_only=True)

    @staticmethod
    def _allow_completed_without_items(instance=None, context=None):
        return bool(
            getattr(instance, "_allow_completed_without_items", False)
            or (context or {}).get("allow_completed_without_items", False)
        )

    class Meta:
        model = ProjectQuotationSummaryInfo
        fields = [
            "id",
            "quotation_number",
            "quotation_status",
            "status",
            "quotation_status_id",
            "quotation_status_name",
            "project_id",
            "project_name",
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
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "quotation_number",
            "project_name",
            "total_material_cost",
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

    def validate(self, attrs):
        raw_status_name = attrs.get("status")
        if isinstance(raw_status_name, str):
            normalized_status_name = raw_status_name.strip()
            if not normalized_status_name:
                attrs.pop("status", None)
            else:
                resolved_status = QuotationStatusInfo.objects.filter(
                    status_name__iexact=normalized_status_name
                ).first()
                if not resolved_status:
                    raise serializers.ValidationError({"status": ["Invalid quotation status."]})
                attrs["status"] = resolved_status

        if self.instance is None and "project" not in attrs:
            raise serializers.ValidationError({"project_id": ["Project is required."]})

        source = self.instance or ProjectQuotationSummaryInfo()
        candidate = ProjectQuotationSummaryInfo()
        if getattr(source, "pk", None):
            candidate.pk = source.pk
            candidate._state.adding = False
            candidate.quotation_number = source.quotation_number

        field_names = [
            "project",
            "status",
            "project_name",
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
        target = instance or ProjectQuotationSummaryInfo()
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

