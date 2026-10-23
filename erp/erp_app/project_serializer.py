from rest_framework import serializers
from django.core.exceptions import ObjectDoesNotExist

from .sub_models import Project


class ProjectSerializer(serializers.ModelSerializer):
	updated_by = serializers.SerializerMethodField()
	status = serializers.SerializerMethodField()
	project_owner_name = serializers.SerializerMethodField()

	class Meta:
		model = Project
		fields = "__all__"

	def get_updated_by(self, obj):
		try:
			return obj.updated_by.username if obj.updated_by else ""
		except ObjectDoesNotExist:
			return ""

	def get_status(self, obj):
		try:
			return obj.status.name if obj.status else ""
		except ObjectDoesNotExist:
			return ""

	def get_project_owner_name(self, obj):
		try:
			return obj.project_owner.username if obj.project_owner else ""
		except ObjectDoesNotExist:
			return ""


__all__ = ["ProjectSerializer"]

