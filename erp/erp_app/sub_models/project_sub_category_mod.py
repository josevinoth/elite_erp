from django.db import models
from ..utils import normalize_text


class ProjectSubCategory_info(models.Model):
    psc_name = models.CharField(max_length=255, unique=True)
    psc_created_at = models.DateTimeField(auto_now_add=True)
    psc_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["psc_name"]

    def __str__(self):
        return self.psc_name

    def save(self, *args, **kwargs):
        self.psc_name = normalize_text(self.psc_name)
        super().save(*args, **kwargs)

