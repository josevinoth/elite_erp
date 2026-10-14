from django.db import models

from ..utils import normalize_text


class ItemCodeName(models.Model):
    item_code = models.CharField(max_length=20, unique=True)
    item_name = models.CharField(max_length=255, unique=True)

    class Meta:
        ordering = ["item_code"]

    def __str__(self):
        return f"{self.item_code} - {self.item_name}"

    def save(self, *args, **kwargs):
        self.item_code = normalize_text(self.item_code).upper()
        self.item_name = normalize_text(self.item_name)
        super().save(*args, **kwargs)

