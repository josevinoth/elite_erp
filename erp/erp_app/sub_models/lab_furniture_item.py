from django.conf import settings
from django.db import models

from ..utils import normalize_text
from .cut_optimiser import UOM
from .item_code_name import ItemCodeName
from .item_category import ItemCategory
from .item_type_mod import ItemType_info

class LabFurnitureItem(models.Model):
    item_code_ref = models.ForeignKey(
        ItemCodeName,
        on_delete=models.PROTECT,
        related_name="item_master_code_rows",
    )
    item_name_ref = models.ForeignKey(
        ItemCodeName,
        on_delete=models.PROTECT,
        related_name="item_master_name_rows",
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
    recommended_free_stock_qty = models.IntegerField(default=0)
    warning_alert_qty = models.IntegerField(default=0)
    to_order_qty = models.IntegerField(default=0)
    physical_plus_ordered_qty = models.IntegerField(default=0)
    physical_qty = models.IntegerField(default=0)
    ordered_qty = models.IntegerField(default=0)
    total_reqd = models.IntegerField(default=0)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_lab_furniture_items",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["item_category__name", "item_name_ref__item_name"]
        unique_together = [("item_name_ref", "item_category")]

    def __str__(self):
        return f"{self.item_code} - {self.item_name}"

    @property
    def item_code(self):
        lookup = getattr(self, "item_code_ref", None)
        return normalize_text(getattr(lookup, "item_code", "")).upper()

    @property
    def item_name(self):
        lookup = getattr(self, "item_name_ref", None)
        return normalize_text(getattr(lookup, "item_name", ""))

    def save(self, *args, **kwargs):
        lookup = getattr(self, "item_code_ref", None) or getattr(self, "item_name_ref", None)
        if lookup:
            self.item_code_ref = lookup
            self.item_name_ref = lookup
        self.volume = (self.length or 0) * (self.width or 0) * (self.height or 0)
        super().save(*args, **kwargs)

