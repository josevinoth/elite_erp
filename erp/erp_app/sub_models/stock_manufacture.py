from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from .item_category import ItemCategory
from .lab_furniture_item import LabFurnitureItem
from .cut_optimiser import UOM
from ..utils import normalize_text


class StockManufactureItem(models.Model):
    """Tracks items manufactured in-house. No vendor / GRN required."""

    item_category = models.ForeignKey(
        ItemCategory,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="stock_manufacture_items",
    )
    item_code = models.ForeignKey(
        LabFurnitureItem,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="stock_manufacture_items",
    )
    item_name = models.CharField(max_length=200)
    item_type = models.ForeignKey(
        "erp_app.ItemType_info",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="stock_manufacture_items",
    )
    uom = models.ForeignKey(
        UOM,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="stock_manufacture_items",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    length = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    width = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    height = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    volume = models.DecimalField(max_digits=16, decimal_places=4, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "Stock Manufacture Item"
        verbose_name_plural = "Stock Manufacture Items"

    def __str__(self):
        return self.item_name or f"ManufItem #{self.pk}"

    def sync_from_item_master(self):
        """Pull immutable display/core fields from LabFurnitureItem."""
        if not getattr(self, "item_code_id", None):
            return

        lab = self.item_code
        self.item_name = normalize_text(lab.item_name)
        if getattr(lab, "item_category_id", None):
            self.item_category_id = lab.item_category_id
        if getattr(lab, "item_type_id", None):
            self.item_type_id = lab.item_type_id
        if getattr(lab, "uom_id", None):
            self.uom_id = lab.uom_id
        self.length = lab.length
        self.width = lab.width
        self.height = lab.height
        self.volume = lab.volume

    def save(self, *args, **kwargs):
        # Manufacturing records must be unique per item code.
        if getattr(self, "item_code_id", None):
            enforce_duplicate_check = True
            if self.pk:
                current_item_code_id = (
                    StockManufactureItem.objects.filter(pk=self.pk)
                    .values_list("item_code_id", flat=True)
                    .first()
                )
                if current_item_code_id == self.item_code_id:
                    enforce_duplicate_check = False

            if enforce_duplicate_check:
                duplicate_qs = StockManufactureItem.objects.filter(item_code_id=self.item_code_id)
                if self.pk:
                    duplicate_qs = duplicate_qs.exclude(pk=self.pk)
                if duplicate_qs.exists():
                    raise ValidationError("This item code already exists in Stock Manufacture.")

        # Sync display and dimensional values from Item Master when item_code is set.
        self.sync_from_item_master()

        self.item_name = normalize_text(self.item_name)
        self.total_price = Decimal(str(self.quantity or 0)) * Decimal(str(self.unit_price or 0))
        self.volume = (
            Decimal(str(self.length or 0))
            * Decimal(str(self.width or 0))
            * Decimal(str(self.height or 0))
        )
        super().save(*args, **kwargs)

