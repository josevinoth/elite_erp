from rest_framework import serializers

from ..sub_models.item_costing_mod import ItemCostingInfo

class ItemCostingSerializer(serializers.ModelSerializer):
    project_ref = serializers.SerializerMethodField()
    item_category = serializers.CharField(source="ic_item_category.name", read_only=True)
    tem_code = serializers.CharField(source="ic_item_code", read_only=True)
    item_description = serializers.CharField(source="ic_item_description", read_only=True)
    uom = serializers.CharField(source="ic_uom.symbol", read_only=True)
    qty = serializers.IntegerField(source="ic_qty")
    cost_max = serializers.DecimalField(source="ic_cost_max", max_digits=14, decimal_places=3, read_only=True)
    cost_min = serializers.DecimalField(source="ic_cost_min", max_digits=14, decimal_places=3, read_only=True)
    cost = serializers.DecimalField(source="ic_cost", max_digits=14, decimal_places=3)
    total_price = serializers.DecimalField(source="ic_total_price", max_digits=14, decimal_places=3)

    def get_project_ref(self, obj):
        project = getattr(obj, "ic_project_ref", None)
        if not project:
            return ""
        project_id = str(getattr(project, "project_id", "") or "").strip()
        project_name = str(getattr(project, "project_name", "") or "").strip()
        if project_id and project_name:
            return f"{project_id} - {project_name}"
        return project_id or project_name

    class Meta:
        model = ItemCostingInfo
        fields = [
            "id",
            "ic_project_ref",
            "ic_item_category",
            "ic_item_code",
            "ic_item_description",
            "ic_qty",
            "ic_cost_max",
            "ic_cost_min",
            "ic_cost",
            "ic_uom",
            "ic_total_price",
            "ic_updated_by",
            "ic_created_at",
            "ic_updated_at",
            "project_ref",
            "item_category",
            "item_code",
            "item_description",
            "uom",
            "qty",
            "cost_max",
            "cost_min",
            "cost",
            "total_price",
        ]
