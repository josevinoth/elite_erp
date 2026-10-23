from django.db import models

from ..utils import normalize_text


class CostTypeInfo(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Cost Type"
        verbose_name_plural = "Cost Types"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name = normalize_text(self.name).upper()
        self.description = normalize_text(self.description)
        super().save(*args, **kwargs)

