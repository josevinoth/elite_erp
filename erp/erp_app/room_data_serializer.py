from rest_framework import serializers

from .sub_models.room_data_mod import RoomDataInfo


class RoomDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomDataInfo
        fields = ["id", "room_name"]

