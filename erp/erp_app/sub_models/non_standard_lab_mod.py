from django.db import models
from ..utils import normalize_text


class NonStandardLab_info(models.Model):
    nsl_name = models.CharField(max_length=255, unique=True)
    nsl_created_at = models.DateTimeField(auto_now_add=True)
    nsl_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nsl_name"]

    def __str__(self):
        return self.nsl_name

    def save(self, *args, **kwargs):
        self.nsl_name = normalize_text(self.nsl_name)
        super().save(*args, **kwargs)

