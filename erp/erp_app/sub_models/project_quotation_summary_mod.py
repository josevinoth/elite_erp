from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from ..utils import calculate_summary_totals, normalize_text
from .project import Project


class ProjectQuotationSummaryInfo(models.Model):
    quotation_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="project_quotation_summaries")
    project_name = models.CharField(max_length=200, blank=True)

    total_material_cost = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    petrol_expenses = models.IntegerField(default=0)
    transport_installation_team = models.IntegerField(default=0)
    contingency = models.IntegerField(default=0)
    final_material_cost = models.DecimalField(max_digits=16, decimal_places=2, default=0)

    transportation = models.IntegerField(default=0)
    food_accomodation = models.IntegerField(default=0)
    loading = models.IntegerField(default=0)
    unloading = models.IntegerField(default=0)
    installation = models.IntegerField(default=0)
    business_development = models.IntegerField(default=0)
    total_cost_to_elite = models.DecimalField(max_digits=16, decimal_places=2, default=0)

    markup = models.DecimalField(max_digits=7, decimal_places=4, default=0)
    total_markup = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    planned_order_value = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    undiscounted_quote_value = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    factor = models.DecimalField(max_digits=16, decimal_places=4, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["project_id", "id"]
        verbose_name = "Project Quotation Summary"
        verbose_name_plural = "Project Quotation Summaries"

    def __str__(self):
        return self.quotation_number or f"Quotation {self.pk or 'new'}"

    @staticmethod
    def _as_decimal(value, default="0"):
        if value in (None, ""):
            return Decimal(str(default))
        try:
            return Decimal(str(value))
        except Exception:
            return Decimal(str(default))

    @staticmethod
    def _as_int(value, default=0):
        try:
            return int(value)
        except Exception:
            return int(default)

    def _material_items_total(self):
        if not self.pk:
            return Decimal("0")
        return sum(
            (
                self._as_decimal(total_cost)
                for total_cost in self.quotation_items.filter(cost_type__name__iexact="MATERIAL").values_list(
                    "total_cost",
                    flat=True,
                )
            ),
            Decimal("0"),
        )

    def _sync_project_snapshot(self):
        self.project_name = normalize_text(getattr(self.project, "project_name", ""))

    def _recalculate_derived_fields(self):
        totals = calculate_summary_totals(
            total_material_cost=self.total_material_cost,
            contingency=self.contingency,
            transportation=self.transportation,
            food_accomodation=self.food_accomodation,
            loading=self.loading,
            unloading=self.unloading,
            installation=self.installation,
            business_development=self.business_development,
            markup=self.markup,
        )
        self.final_material_cost = totals["final_material_cost"]
        self.total_cost_to_elite = totals["total_cost_to_elite"]
        self.total_markup = totals["total_markup"]
        self.planned_order_value = totals["planned_order_value"]
        self.discount = totals["discount"]
        self.undiscounted_quote_value = totals["undiscounted_quote_value"]
        self.factor = totals["factor"]

    def full_recalculate(self):
        self.total_material_cost = self._material_items_total()
        self._recalculate_derived_fields()

    def clean(self):
        if getattr(self, "project", None) is None:
            raise ValidationError({"project": "Project is required."})

        self._sync_project_snapshot()
        self.total_material_cost = self._as_decimal(self.total_material_cost)
        self.petrol_expenses = self._as_int(self.petrol_expenses)
        self.transport_installation_team = self._as_int(self.transport_installation_team)
        self.contingency = self._as_int(self.contingency)
        self.transportation = self._as_int(self.transportation)
        self.food_accomodation = self._as_int(self.food_accomodation)
        self.loading = self._as_int(self.loading)
        self.unloading = self._as_int(self.unloading)
        self.installation = self._as_int(self.installation)
        self.business_development = self._as_int(self.business_development)
        self.markup = self._as_decimal(self.markup)

        if self.pk:
            self.total_material_cost = self._material_items_total()
        self._recalculate_derived_fields()

    def save(self, *args, **kwargs):
        self.full_clean()
        creating = self.pk is None
        super().save(*args, **kwargs)

        updates = []
        if creating and not self.quotation_number:
            self.quotation_number = f"CQ_{10000 + self.pk}"
            updates.append("quotation_number")

        refreshed_total = self._material_items_total()
        if refreshed_total != self.total_material_cost:
            self.total_material_cost = refreshed_total
            self._recalculate_derived_fields()
            updates.extend(
                [
                    "total_material_cost",
                    "final_material_cost",
                    "total_cost_to_elite",
                    "total_markup",
                    "planned_order_value",
                    "discount",
                    "undiscounted_quote_value",
                    "factor",
                ]
            )

        if updates:
            super().save(update_fields=sorted(set(updates)))


