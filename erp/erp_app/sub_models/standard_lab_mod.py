from django.db import models
from ..utils import normalize_text


class StandardLab_info(models.Model):
    sl_name = models.CharField(max_length=255, unique=True)
    sl_created_at = models.DateTimeField(auto_now_add=True)
    sl_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sl_name"]

    def __str__(self):
        return self.psc_name

    def save(self, *args, **kwargs):
        self.sl_name = normalize_text(self.sl_name)
        super().save(*args, **kwargs)

