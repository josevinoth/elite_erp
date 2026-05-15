from django.db import models

from ..utils import normalize_text
from .vendor import Vendor


class StockPurchaseVendorDetail(models.Model):
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="stock_purchase_details")
    invoice_number = models.CharField(max_length=100, blank=True)
    invoice_date = models.DateField(null=True, blank=True)
    tax = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-invoice_date", "-created_at"]

    def __str__(self):
        return self.vendor.name

    def save(self, *args, **kwargs):
        for field in ["invoice_number"]:
            setattr(self, field, normalize_text(getattr(self, field)))

        super().save(*args, **kwargs)


class StockPurchase(models.Model):
    purchase_number = models.CharField(max_length=60, unique=True, null=True, blank=True)
    vendor_detail = models.ForeignKey(
        StockPurchaseVendorDetail,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchases",
    )

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
        return self.purchase_number or self.item_name

    def save(self, *args, **kwargs):
        for field in ["purchase_number", "item_name", "category", "vendor", "unit", "invoice_number", "notes"]:
            setattr(self, field, normalize_text(getattr(self, field)))

        super().save(*args, **kwargs)


class StockPurchaseItem(models.Model):
    stock_purchase = models.ForeignKey(StockPurchase, on_delete=models.CASCADE, related_name="items")
    grn_number = models.CharField(max_length=7, unique=True, blank=True)
    item_category = models.CharField(max_length=120, blank=True)
    item_name = models.CharField(max_length=200)
    item_code = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.item_name

    def save(self, *args, **kwargs):
        self.item_category = normalize_text(self.item_category)
        self.item_name = normalize_text(self.item_name)
        self.item_code = normalize_text(self.item_code)
        self.total_price = (self.quantity or 0) * (self.unit_price or 0)

        # Normalize legacy GRN values (e.g. 0000001) to prefixed format (GRN0001).
        if self.grn_number and not str(self.grn_number).upper().startswith("GRN"):
            self.grn_number = f"GRN{self.pk:04d}" if self.pk else ""

        is_new = self.pk is None
        super().save(*args, **kwargs)

        # Generate a stable GRN like GRN0001 after first insert.
        if (is_new or not self.grn_number) and self.pk:
            self.grn_number = f"GRN{self.pk:04d}"
            super().save(update_fields=["grn_number"])

