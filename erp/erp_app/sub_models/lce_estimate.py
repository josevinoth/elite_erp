from django.db import models

from ..utils import normalize_text
from .stock_purchase import StockPurchase


class LCEEstimate(models.Model):
    stock_purchase = models.OneToOneField(
        StockPurchase,
        on_delete=models.CASCADE,
        related_name="lce_estimate",
        null=True,
        blank=True,
    )

    ex_works_material_cost = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    packing_charges = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    documentation = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    other_charges_1 = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    other_charges_2 = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    other_charges_3 = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    other_charges_4 = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    total_supplier_price = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    advance_payment_value = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    bank_exchange_rate = models.DecimalField(max_digits=14, decimal_places=6, default=0)
    advance_payment_value_omr = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    balance_payment_value = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    balance_payment_value_omr = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    total_supplier_price_omr = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    bank_muscat_charge_advance_payment = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    bank_muscat_charge_balance_payment = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    freight_charge = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    customs_duty_omr = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    oman_customs_boe_charge_omr = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    rop_customs_inspection_charge = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    unloading_charge_muscat_stores_1 = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    unloading_charge_muscat_stores_2 = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    loading_charge_muscat_stores_delivery = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    total = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    created_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        if self.stock_purchase:
            return f"LCE - Purchase #{self.stock_purchase.pk}"
        return f"LCE - Record #{self.pk}"

    def save(self, *args, **kwargs):
        self.created_by = normalize_text(self.created_by)
        super().save(*args, **kwargs)


