from rest_framework import serializers

from .sub_models import Project
from .sub_models.cut_optimiser import CutOptimiserRecord, CutSize, UOM
from .sub_models.project_layout_drawing import ProjectLayoutDrawing

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

