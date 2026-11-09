from datetime import datetime
from decimal import Decimal
from django.contrib.auth.models import User
from django.db import models

from .lab_furniture_item import LabFurnitureItem
from .project_costing_items_mod import ProjectCostingItemInfo
from .project_costing_summary_mod import ProjectCostingSummaryInfo
from .project_quotation_items_mod import ProjectQuotationItemInfo
from .vendor import Vendor


def generate_po_number(pk):
    now = datetime.now()
    year = now.year % 100
    if now.month >= 4:
        fy = f"{year}_{year+1}"
    else:
        fy = f"{year-1}_{year}"
    return f"PO_FY({fy})_{pk:04d}"


class PlaceStockOrderInfo(models.Model):
    order_code = models.CharField(max_length=60, unique=True, blank=True, db_index=True)
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="placed_stock_orders")
    costing = models.ForeignKey(
        ProjectCostingSummaryInfo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="placed_stock_orders",
    )
    total_items = models.IntegerField(default=0)
    total_qty = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    status = models.CharField(max_length=50, default="Order Placed")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="placed_stock_orders",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return self.order_code or f"PO-{self.pk or 'new'}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.order_code and self.pk:
            self.order_code = generate_po_number(self.pk)
            super().save(update_fields=["order_code"])


class PlaceStockOrderItem(models.Model):
    order = models.ForeignKey(PlaceStockOrderInfo, on_delete=models.CASCADE, related_name="items")
    item_code_ref = models.ForeignKey(
        LabFurnitureItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="placed_stock_order_items",
    )
    item_code = models.CharField(max_length=100, blank=True)
    item_name = models.CharField(max_length=255, blank=True)
    item_category = models.CharField(max_length=255, blank=True)
    combined_label = models.CharField(max_length=500, blank=True)
    requested_qty = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    order_qty = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    stage = models.CharField(max_length=50, blank=True)
    reference_number = models.CharField(max_length=100, blank=True)
    project_id = models.CharField(max_length=100, blank=True)
    project_name = models.CharField(max_length=200, blank=True)
    costing_item = models.ForeignKey(
        ProjectCostingItemInfo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="place_order_links",
    )
    quotation_item = models.ForeignKey(
        ProjectQuotationItemInfo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="place_order_links",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.order_id} - {self.item_code} ({self.order_qty})"
