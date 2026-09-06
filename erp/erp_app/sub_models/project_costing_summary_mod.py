from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from ..utils import calculate_summary_totals, normalize_text
from .project import Project
from .project_quotation_summary_mod import ProjectQuotationSummaryInfo


class ProjectCostingSummaryInfo(models.Model):
    costing_id = models.CharField(max_length=20, unique=True, blank=True)
    quotation_number = models.ForeignKey(
        ProjectQuotationSummaryInfo,
        on_delete=models.PROTECT,
        related_name="project_costing_summaries",
    )
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="project_costing_summaries")
    project_name = models.CharField(max_length=200, blank=True)

    # Financial fields — cloned from ProjectQuotationSummaryInfo
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
        verbose_name = "Project Costing Summary"
        verbose_name_plural = "Project Costing Summaries"

    def __str__(self):
        return self.costing_id or f"Project Costing {self.pk or 'new'}"

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
            petrol_expenses=self.petrol_expenses,
            transport_installation_team=self.transport_installation_team,
        )
        self.final_material_cost = totals["final_material_cost"]
        self.total_cost_to_elite = totals["total_cost_to_elite"]
        self.total_markup = totals["total_markup"]
        self.planned_order_value = totals["planned_order_value"]
        self.discount = totals["discount"]
        self.undiscounted_quote_value = totals["undiscounted_quote_value"]
        self.factor = totals["factor"]

    def clean(self):
        if getattr(self, "quotation_number", None) is None:
            raise ValidationError({"quotation_number": "Quotation number is required."})
        if getattr(self, "project", None) is None:
            self.project = self.quotation_number.project
        self.project_name = normalize_text(getattr(self.project, "project_name", ""))

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
        self._recalculate_derived_fields()

    def save(self, *args, **kwargs):
        self.full_clean()
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating and not self.costing_id:
            self.costing_id = f"PS_{10000 + self.pk}"
            super().save(update_fields=["costing_id"])