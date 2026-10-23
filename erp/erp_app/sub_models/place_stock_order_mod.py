from django.db import models

from .project_costing_items_mod import ProjectCostingItemInfo
from .project_costing_summary_mod import ProjectCostingSummaryInfo
from .vendor import Vendor


class PlaceStockOrderInfo(models.Model):
    order_code = models.CharField(max_length=20, unique=True, blank=True, db_index=True)
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="placed_stock_orders")
    costing = models.ForeignKey(ProjectCostingSummaryInfo, on_delete=models.PROTECT, related_name="placed_stock_orders")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return self.order_code or f"PSO-{self.pk or 'new'}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.order_code and self.pk:
            self.order_code = f"PSO_{10000 + int(self.pk)}"
            super().save(update_fields=["order_code"])


class PlaceStockOrderItem(models.Model):
    order = models.ForeignKey(PlaceStockOrderInfo, on_delete=models.CASCADE, related_name="items")
    costing_item = models.ForeignKey(ProjectCostingItemInfo, on_delete=models.PROTECT, related_name="place_order_links")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        unique_together = (("order", "costing_item"),)

    def __str__(self):
        return f"{self.order_id}-{self.costing_item_id}"

