from django.db import models
from ..utils import normalize_text


class ApprovalStatus_info(models.Model):
    as_name = models.CharField(max_length=255, unique=True)
    as_created_at = models.DateTimeField(auto_now_add=True)
    as_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["as_name"]

    def __str__(self):
        return self.as_name

    def save(self, *args, **kwargs):
        self.as_name = normalize_text(self.as_name)
        super().save(*args, **kwargs)

