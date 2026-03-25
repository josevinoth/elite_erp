from django.db import models
from ..utils import normalize_text
class StockPurchase(models.Model):
    item_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    vendor = models.CharField(max_length=200, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = models.CharField(max_length=30, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    purchase_date = models.DateField(null=True, blank=True)
    invoice_number = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['-purchase_date', '-created_at']
    def __str__(self):
        return self.item_name

    def save(self, *args, **kwargs):
        for field in ["item_name", "category", "vendor", "unit", "invoice_number", "notes"]:
            setattr(self, field, normalize_text(getattr(self, field)))

        super().save(*args, **kwargs)

