from rest_framework import serializers

from .sub_models.retrieval_status_mod import RetrievalStatusInfo


class RetrievalStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = RetrievalStatusInfo
        fields = ["id", "status_name"]

