from rest_framework import serializers

from .sub_models import Project
from .sub_models import ItemCategory, LabFurnitureItem, StockManufactureItem
from .sub_models.cut_optimiser import CutOptimiserRecord, CutSize, UOM
from .sub_models.item_type_mod import ItemType_info
from .sub_models.project_layout_drawing import ProjectLayoutDrawing
from .utils import normalize_text

class ProjectSerializer(serializers.ModelSerializer):
    updated_by = serializers.CharField(source="updated_by.username", read_only=True)
    status = serializers.CharField(source="status.name", read_only=True)

    class Meta:
        model = Project
        fields = "__all__"

class CutSizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CutSize
        fields = ['id', 'name', 'width', 'length', 'quantity']


class CutOptimiserRecordSerializer(serializers.ModelSerializer):
    cut_sizes = CutSizeSerializer(many=True, required=False, default=list)
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    raw_sheet_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    raw_sheet_length = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    raw_sheet_width = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    raw_sheet_blade_thk = serializers.DecimalField(max_digits=3, decimal_places=2, required=False, allow_null=True)
    dimension_unit = serializers.PrimaryKeyRelatedField(queryset=UOM.objects.all(), required=False, allow_null=True)
    link_input = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = CutOptimiserRecord
        fields = ['id', 'project', 'project_name', 'revision', 'cut_optimiser_id', 'updated_by',
                  'raw_sheet_name', 'raw_sheet_length', 'raw_sheet_width', 'raw_sheet_blade_thk', 'dimension_unit', 'link_input', 'cut_sizes',
                  'created_at', 'updated_at']

    def create(self, validated_data):
        import sys
        print("[DEBUG] CutOptimiserRecordSerializer.create called", file=sys.stderr)
        print("[DEBUG] validated_data:", validated_data, file=sys.stderr)
        cut_sizes_data = validated_data.pop('cut_sizes', [])
        try:
            record = CutOptimiserRecord.objects.create(**validated_data)
            print(f"[DEBUG] Created CutOptimiserRecord: {record}", file=sys.stderr)
        except Exception as e:
            print(f"[ERROR] Failed to create CutOptimiserRecord: {e}", file=sys.stderr)
            raise
        for cut_size_data in cut_sizes_data:
            try:
                CutSize.objects.create(cut_optimiser_record=record, **cut_size_data)
            except Exception as e:
                print(f"[ERROR] Failed to create CutSize: {e} | data: {cut_size_data}", file=sys.stderr)
        return record

    def update(self, instance, validated_data):
        import json
        # Print the full incoming validated_data for debugging
        print("[DEBUG] Full validated_data in update:", json.dumps(validated_data, default=str))
        cut_sizes_data = validated_data.pop('cut_sizes', None)
        print("[DEBUG] cut_sizes_data:", cut_sizes_data)
        # Never allow cut_optimiser_id to be changed
        if 'cut_optimiser_id' in validated_data:
            validated_data.pop('cut_optimiser_id')
        # Update all fields in validated_data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        # --- CUT SIZES ---
        if cut_sizes_data is not None:
            try:
                existing_cuts = {int(c.id): c for c in instance.cut_sizes.all()}
            except AttributeError:
                existing_cuts = {int(c.id): c for c in instance.cutsize_set.all()}
            print(f"[DEBUG] Existing CutSize IDs: {list(existing_cuts.keys())}")
            sent_cut_ids = set()
            for cut_size_data in cut_sizes_data:
                cut_id = cut_size_data.get('id')
                print(f"[DEBUG] CutSize incoming id: {cut_id} (type: {type(cut_id)}) data: {cut_size_data}")
                try:
                    cut_id_int = int(cut_id)
                except (TypeError, ValueError):
                    cut_id_int = None
                if cut_id_int:
                    if cut_id_int in existing_cuts:
                        cut = existing_cuts[cut_id_int]
                        cut.name = cut_size_data.get('name', cut.name)
                        cut.width = cut_size_data.get('width', cut.width)
                        cut.length = cut_size_data.get('length', cut.length)
                        cut.quantity = cut_size_data.get('quantity', cut.quantity)
                        cut.save()
                        sent_cut_ids.add(cut_id_int)
                    else:
                        print(f"[WARNING] CutSize id {cut_id_int} not found in DB. Skipping creation to avoid duplicates. Data: {cut_size_data}")
                        # Optionally, you could raise an error here if this should never happen
                else:
                    print(f"[DEBUG] Creating new CutSize: {cut_size_data}")
                    CutSize.objects.create(cut_optimiser_record=instance, **{k: v for k, v in cut_size_data.items() if k != 'id'})
            # Delete removed
            for cid, cut in existing_cuts.items():
                if cid not in sent_cut_ids:
                    print(f"[DEBUG] Deleting CutSize id: {cid}")
                    cut.delete()
        # Debug log
        print(f"[DEBUG] Updated CutOptimiserRecord with: {validated_data}, cut_sizes: {cut_sizes_data}")
        instance.refresh_from_db()
        return instance


class UOMSerializer(serializers.ModelSerializer):
    class Meta:
        model = UOM
        fields = ['id', 'name', 'symbol']


class ItemTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemType_info
        fields = ['id', 'it_name']


def _resolve_stock_manufacture_master(item_category, item_name):
    if not item_category:
        return None

    normalized_name = normalize_text(item_name)
    if not normalized_name:
        return None

    qs = LabFurnitureItem.objects.select_related("item_category", "uom", "item_type").filter(
        item_category=item_category,
        item_name__iexact=normalized_name,
    ).order_by("id")

    # Deterministic only: avoid guessing when multiple item masters share the same name.
    if qs.count() == 1:
        return qs.first()
    return None


class StockManufactureItemSerializer(serializers.ModelSerializer):
    item_category = serializers.SerializerMethodField(read_only=True)
    item_code = serializers.SerializerMethodField(read_only=True)
    item_type = serializers.SerializerMethodField(read_only=True)
    uom = serializers.SerializerMethodField(read_only=True)

    item_category_id = serializers.PrimaryKeyRelatedField(
        source="item_category",
        queryset=ItemCategory.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    item_code_id = serializers.PrimaryKeyRelatedField(
        source="item_code",
        queryset=LabFurnitureItem.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    item_type_id = serializers.PrimaryKeyRelatedField(
        source="item_type",
        queryset=ItemType_info.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    uom_id = serializers.PrimaryKeyRelatedField(
        source="uom",
        queryset=UOM.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = StockManufactureItem
        fields = [
            "id",
            "item_category",
            "item_category_id",
            "item_code",
            "item_code_id",
            "item_name",
            "item_type",
            "item_type_id",
            "uom",
            "uom_id",
            "quantity",
            "unit_price",
            "total_price",
            "length",
            "width",
            "height",
            "volume",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "total_price", "volume", "created_at", "updated_at"]

    def get_uom(self, obj):
        master = obj.item_code or _resolve_stock_manufacture_master(obj.item_category, obj.item_name)
        if obj.uom:
            return f"{obj.uom.name} ({obj.uom.symbol})"
        if not master or not master.uom:
            return ""
        return f"{master.uom.name} ({master.uom.symbol})"

    def get_item_category(self, obj):
        if obj.item_category:
            return obj.item_category.name
        master = obj.item_code or _resolve_stock_manufacture_master(obj.item_category, obj.item_name)
        return master.item_category.name if master and master.item_category else ""

    def get_item_code(self, obj):
        if obj.item_code:
            return obj.item_code.item_code
        master = _resolve_stock_manufacture_master(obj.item_category, obj.item_name)
        return master.item_code if master else ""

    def get_item_type(self, obj):
        if obj.item_type:
            return obj.item_type.it_name
        master = obj.item_code or _resolve_stock_manufacture_master(obj.item_category, obj.item_name)
        return master.item_type.it_name if master and master.item_type else ""

    def validate(self, attrs):
        item_code = attrs.get("item_code")
        if item_code is None and self.instance is not None:
            item_code = self.instance.item_code

        item_category = attrs.get("item_category")
        if item_category is None and self.instance is not None:
            item_category = self.instance.item_category

        item_name = attrs.get("item_name")
        if item_name is None and self.instance is not None:
            item_name = self.instance.item_name

        if not item_code:
            item_code = _resolve_stock_manufacture_master(item_category, item_name)

        if item_code is not None:
            should_check_duplicate = True
            if self.instance is not None and self.instance.item_code_id == item_code.id:
                # Backward compatible: allow updates to legacy duplicate rows
                # when the item code itself is not being changed.
                should_check_duplicate = False

            if should_check_duplicate:
                duplicate_qs = StockManufactureItem.objects.filter(item_code=item_code)
                if self.instance is not None:
                    duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
                if duplicate_qs.exists():
                    raise serializers.ValidationError(
                        {"item_code_id": "This item code already exists in Stock Manufacture."}
                    )

            if item_category and getattr(item_code, "item_category_id", None) and item_category.id != item_code.item_category_id:
                raise serializers.ValidationError(
                    {"item_category_id": "Selected item name/code does not belong to the chosen category."}
                )

            attrs["item_code"] = item_code
            attrs["item_name"] = normalize_text(item_code.item_name)
            attrs["item_category"] = item_code.item_category
            attrs["item_type"] = item_code.item_type
            attrs["uom"] = item_code.uom
            attrs["length"] = item_code.length
            attrs["width"] = item_code.width
            attrs["height"] = item_code.height
        else:
            if not normalize_text(item_name):
                raise serializers.ValidationError({"item_name": "Item name is required."})
            if item_category is None:
                raise serializers.ValidationError({"item_category_id": "Item category is required."})

        quantity = attrs.get("quantity", getattr(self.instance, "quantity", 0))
        unit_price = attrs.get("unit_price", getattr(self.instance, "unit_price", 0))
        length = attrs.get("length", getattr(self.instance, "length", 0))
        width = attrs.get("width", getattr(self.instance, "width", 0))
        height = attrs.get("height", getattr(self.instance, "height", 0))

        attrs["total_price"] = quantity * unit_price
        attrs["volume"] = length * width * height
        if "item_name" in attrs:
            attrs["item_name"] = normalize_text(attrs["item_name"])
        return attrs


class ProjectLayoutDrawingSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectLayoutDrawing
        fields = [
            "id", "project", "drawing_name", "file_url",
            "level_one_approver", "level_one_status",
            "level_one_message", "created_at", "updated_at"
        ]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

