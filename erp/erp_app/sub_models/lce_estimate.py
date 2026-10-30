from django.db import models

from ..utils import normalize_text
from .country_currency import CountryCurrency


class LCEChargeTypeOption(models.Model):
    name = models.CharField(max_length=120, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name = normalize_text(self.name)
        super().save(*args, **kwargs)


class LCEEstimate(models.Model):
    ex_works_material_cost = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    packing_charges = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    documentation = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    other_charges_1 = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    other_charges_1_type = models.CharField(max_length=120, blank=True)
    other_charges_2 = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    other_charges_2_type = models.CharField(max_length=120, blank=True)
    other_charges_3 = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    other_charges_3_type = models.CharField(max_length=120, blank=True)
    other_charges_4 = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    other_charges_4_type = models.CharField(max_length=120, blank=True)
    foreign_currency = models.ForeignKey(
        CountryCurrency,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lce_estimates",
    )
    total_supplier_price = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    advance_payment_value = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    bank_exchange_rate = models.DecimalField(max_digits=14, decimal_places=6, default=0)
    advance_payment_value_omr = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    balance_payment_value = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    bank_exchange_rate_balance = models.DecimalField(max_digits=14, decimal_places=6, default=0)
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

    # Direct item link and purchase cost fields
    item_code = models.ForeignKey(
        "erp_app.LabFurnitureItem",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lce_estimates",
    )
    item_category = models.CharField(max_length=200, blank=True)
    item_name = models.CharField(max_length=200, blank=True)
    max_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    min_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    actual_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    lce_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    total = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    created_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"LCE - Record #{self.pk}"

    def calculate_cost_from_purchases(self):
        if not self.item_code:
            return
        from decimal import Decimal
        from .stock_purchase import StockPurchaseItem
        rows = StockPurchaseItem.objects.filter(
            models.Q(item_code=self.item_code) |
            models.Q(item_code__item_code_ref__item_code__iexact=self.item_code.item_code)
        )
        costs = []
        for r in rows:
            if r.unit_price not in (None, "") and Decimal(str(r.unit_price)) > 0:
                costs.append(Decimal(str(r.unit_price)).quantize(Decimal("0.01")))
            elif r.unit_price not in (None, ""):
                costs.append(Decimal(str(r.unit_price)).quantize(Decimal("0.01")))
            elif r.total_price and r.quantity and r.quantity > 0:
                costs.append((Decimal(str(r.total_price)) / Decimal(str(r.quantity))).quantize(Decimal("0.01")))
        positive_costs = [c for c in costs if c > Decimal("0.00")]
        final_costs = positive_costs if positive_costs else costs
        if final_costs:
            self.min_cost = min(final_costs)
            self.max_cost = max(final_costs)
        else:
            self.min_cost = Decimal("0.00")
            self.max_cost = Decimal("0.00")
        if self.actual_cost in (None, "", 0, Decimal("0")):
            self.actual_cost = self.max_cost
        if self.ex_works_material_cost:
            cf = self.total / self.ex_works_material_cost
            self.lce_cost = (self.actual_cost * cf).quantize(Decimal("0.01"))

    def save(self, *args, **kwargs):
        from decimal import Decimal
        self.created_by = normalize_text(self.created_by)
        self.other_charges_1_type = normalize_text(self.other_charges_1_type)
        self.other_charges_2_type = normalize_text(self.other_charges_2_type)
        self.other_charges_3_type = normalize_text(self.other_charges_3_type)
        self.other_charges_4_type = normalize_text(self.other_charges_4_type)
        if self.item_code:
            if not self.item_name:
                self.item_name = self.item_code.item_name
            if not self.item_category:
                self.item_category = getattr(self.item_code.item_category, "name", "")
            self.calculate_cost_from_purchases()
        if (self.actual_cost in (None, "", 0, Decimal("0"))) and self.max_cost:
            self.actual_cost = self.max_cost
        if self.ex_works_material_cost:
            cf = self.total / self.ex_works_material_cost
            self.lce_cost = (self.actual_cost * cf).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)


class LCEEstimateItem(models.Model):
    lce_estimate = models.ForeignKey(
        LCEEstimate,
        on_delete=models.CASCADE,
        related_name="items",
    )
    item_code = models.ForeignKey(
        "erp_app.LabFurnitureItem",
        on_delete=models.PROTECT,
        related_name="lce_item_rows",
    )
    item_category = models.CharField(max_length=200, blank=True)
    item_name = models.CharField(max_length=200, blank=True)
    min_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    max_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    actual_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    lce_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.item_code} (Actual: {self.actual_cost}, LCE: {self.lce_cost})"

    def calculate_cost_from_purchases(self):
        if not self.item_code:
            return
        from decimal import Decimal
        from .stock_purchase import StockPurchaseItem
        rows = StockPurchaseItem.objects.filter(
            models.Q(item_code=self.item_code) |
            models.Q(item_code__item_code_ref__item_code__iexact=self.item_code.item_code)
        )
        costs = []
        for r in rows:
            if r.unit_price not in (None, "") and Decimal(str(r.unit_price)) > 0:
                costs.append(Decimal(str(r.unit_price)).quantize(Decimal("0.01")))
            elif r.unit_price not in (None, ""):
                costs.append(Decimal(str(r.unit_price)).quantize(Decimal("0.01")))
            elif r.total_price and r.quantity and r.quantity > 0:
                costs.append((Decimal(str(r.total_price)) / Decimal(str(r.quantity))).quantize(Decimal("0.01")))
        positive_costs = [c for c in costs if c > Decimal("0.00")]
        final_costs = positive_costs if positive_costs else costs
        if final_costs:
            self.min_cost = min(final_costs)
            self.max_cost = max(final_costs)
        else:
            self.min_cost = Decimal("0.00")
            self.max_cost = Decimal("0.00")
        if self.actual_cost in (None, "", 0, Decimal("0")):
            self.actual_cost = self.max_cost

    def save(self, *args, **kwargs):
        from decimal import Decimal
        if self.item_code:
            if not self.item_name:
                self.item_name = self.item_code.item_name
            if not self.item_category:
                self.item_category = getattr(self.item_code.item_category, "name", "")
            self.calculate_cost_from_purchases()
        if (self.actual_cost in (None, "", 0, Decimal("0"))) and self.max_cost:
            self.actual_cost = self.max_cost
        if self.lce_estimate and self.lce_estimate.ex_works_material_cost:
            cf = self.lce_estimate.total / self.lce_estimate.ex_works_material_cost
            self.lce_cost = (self.actual_cost * cf).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)


# Backward / forward compatibility aliases
LandingCostEstimate = LCEEstimate
LandingCostEstimateItem = LCEEstimateItem


class LCEBalanceSettlement(models.Model):
    lce_estimate = models.ForeignKey(
        LCEEstimate,
        on_delete=models.CASCADE,
        related_name="balance_settlements",
    )
    settlement_date = models.DateField()
    foreign_currency = models.ForeignKey(
        CountryCurrency,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lce_balance_settlements",
    )
    amount = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    factor = models.DecimalField(max_digits=14, decimal_places=6, default=0)
    value = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["settlement_date", "id"]

    def __str__(self):
        return f"LCE Settlement #{self.pk}"


