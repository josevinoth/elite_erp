from django.core.validators import RegexValidator
from django.db import models

from ..utils import normalize_text
from .item_category import ItemCategory


class LabFurnitureItem(models.Model):
    item_name = models.CharField(max_length=255)
    item_code = models.CharField(
        max_length=6,
        unique=True,
        validators=[RegexValidator(r"^[A-Za-z0-9]{1,6}$", "Item code must be alphanumeric and max 6 characters.")],
    )
    item_category = models.ForeignKey(
        ItemCategory,
        on_delete=models.PROTECT,
        related_name="items",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["item_category__name", "item_name"]
        unique_together = [("item_name", "item_category")]

    def __str__(self):
        return f"{self.item_code} - {self.item_name}"

    def save(self, *args, **kwargs):
        self.item_name = normalize_text(self.item_name)
        self.item_code = normalize_text(self.item_code).upper()[:6]
        super().save(*args, **kwargs)

