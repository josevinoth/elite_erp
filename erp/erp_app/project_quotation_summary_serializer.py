from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .sub_models import Project
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

    class Meta:
        model = ProjectQuotationSummaryInfo
        fields = [
            "id",
            "quotation_number",
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

