from django.core.validators import RegexValidator
from django.db import models

from ..utils import normalize_text
from .cut_optimiser import UOM
from .item_category import ItemCategory
from .item_type_mod import ItemType_info

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
    uom = models.ForeignKey(UOM, on_delete=models.PROTECT, null=True, blank=True, related_name="lab_furniture_items_uom")
    item_type = models.ForeignKey(ItemType_info, on_delete=models.PROTECT, default=1,related_name="lab_furniture_items_type",)
    length = models.DecimalField(max_digits=12, decimal_places=1, default=0)
    width = models.DecimalField(max_digits=12, decimal_places=1, default=0)
    height = models.DecimalField(max_digits=12, decimal_places=1, default=0)
    volume = models.DecimalField(max_digits=14, decimal_places=1, default=0)
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
        self.volume = (self.length or 0) * (self.width or 0) * (self.height or 0)
        super().save(*args, **kwargs)

