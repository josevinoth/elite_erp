from rest_framework import serializers
from ..sub_models.project_layout_drawing import ProjectLayoutDrawing

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
