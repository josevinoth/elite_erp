from django.db import models
from ..utils import normalize_text


class NonMOEProductSeries_info(models.Model):
    nmps_name = models.CharField(max_length=255, unique=True)
    nmps_created_at = models.DateTimeField(auto_now_add=True)
    nmps_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nmps_name"]

    def __str__(self):
        return self.nmps_name

    def save(self, *args, **kwargs):
        self.nmps_name = normalize_text(self.nmps_name)
        super().save(*args, **kwargs)

