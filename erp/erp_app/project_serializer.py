from rest_framework import serializers

from .sub_models import Project


class ProjectSerializer(serializers.ModelSerializer):
	updated_by = serializers.CharField(source="updated_by.username", read_only=True)
	status = serializers.CharField(source="status.name", read_only=True)
	project_owner_name = serializers.CharField(source="project_owner.username", read_only=True)

	class Meta:
		model = Project
		fields = "__all__"


__all__ = ["ProjectSerializer"]


