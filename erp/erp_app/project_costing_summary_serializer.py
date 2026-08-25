from rest_framework import serializers

from .sub_models import Project, ProjectQuotationSummaryInfo
from .sub_models.project_costing_summary_mod import ProjectCostingSummaryInfo


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
    # Human-readable read-only display fields
    quotation_number = serializers.CharField(source="quotation_number.quotation_number", read_only=True)
    project_code = serializers.CharField(source="project.project_id", read_only=True)

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
            # editable financial inputs
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
            # calculated / derived (read-only)
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
