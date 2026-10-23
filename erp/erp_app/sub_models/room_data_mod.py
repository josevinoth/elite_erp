from django.db import models


class RoomDataInfo(models.Model):
    id = models.AutoField(primary_key=True)
    room_name = models.CharField(max_length=255, unique=True)

    class Meta:
        verbose_name = "Room Data"
        verbose_name_plural = "Room Data"
        ordering = ["room_name"]

    def __str__(self):
        return self.room_name

