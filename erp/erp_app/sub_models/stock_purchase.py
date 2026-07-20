from django.db import models

from ..utils import normalize_text
from .vendor import Vendor
from .cut_optimiser import UOM


class StockPurchaseVendorDetail(models.Model):
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="stock_purchase_details")
    invoice_number = models.CharField(max_length=100, blank=True)
    invoice_date = models.DateField(null=True, blank=True)
    tax = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True, null=True)
    status_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    purchase_id = models.CharField(max_length=10, unique=True, blank=True, null=True, db_index=True)

    class Meta:
        ordering = ["-invoice_date", "-created_at"]

    def __str__(self):
        return self.vendor.name

    def save(self, *args, **kwargs):
        # Auto-generate purchase_id if not set
        if not self.purchase_id:
            last = StockPurchaseVendorDetail.objects.order_by('-id').first()
            next_num = 1
            if last and last.purchase_id and last.purchase_id.startswith('SP'):
                try:
                    next_num = int(last.purchase_id[2:]) + 1
                except Exception:
                    pass
            self.purchase_id = f'SP{next_num:05d}'
        for field in ["invoice_number"]:
            setattr(self, field, normalize_text(getattr(self, field)))
        super().save(*args, **kwargs)


class StockPurchaseItem(models.Model):
    vendor_detail = models.ForeignKey(StockPurchaseVendorDetail, on_delete=models.CASCADE, related_name="items")
    lce_estimate = models.ForeignKey(
        "erp_app.LCEEstimate",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="linked_items",
    )
    grn_number = models.CharField(max_length=7, unique=True, blank=True)
    item_category = models.CharField(max_length=120, blank=True)
    item_name = models.CharField(max_length=200)
    item_code = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    lce_cost = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    uom = models.ForeignKey(UOM, on_delete=models.PROTECT, null=True, blank=True, related_name="stock_purchase_items")
    length = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    width = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    height = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    volume = models.DecimalField(max_digits=14, decimal_places=3, default=0)
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
        self.volume = (self.length or 0) * (self.width or 0) * (self.height or 0)

        # Normalize legacy GRN values (e.g. 0000001) to prefixed format (GRN0001).
        if self.grn_number and not str(self.grn_number).upper().startswith("GRN"):
            self.grn_number = f"GRN{self.pk:04d}" if self.pk else ""

        is_new = self.pk is None
        super().save(*args, **kwargs)

        # Generate a stable GRN like GRN0001 after first insert.
        if (is_new or not self.grn_number) and self.pk:
            self.grn_number = f"GRN{self.pk:04d}"
            super().save(update_fields=["grn_number"])
