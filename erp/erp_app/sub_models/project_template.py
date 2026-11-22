from decimal import Decimal
from django.db import models
from .lab_furniture_item import LabFurnitureItem
from .project_quotation_summary_mod import ProjectQuotationSummaryInfo
from .project_costing_summary_mod import ProjectCostingSummaryInfo
from ..utils import normalize_text


class ProjectTemplate(models.Model):
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    updated_by = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Project Template"
        verbose_name_plural = "Project Templates"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name = normalize_text(self.name)
        self.description = normalize_text(self.description)
        self.updated_by = normalize_text(self.updated_by)
        super().save(*args, **kwargs)


class ProjectTemplateItem(models.Model):
    template = models.ForeignKey(
        ProjectTemplate,
        on_delete=models.CASCADE,
        related_name="items",
    )
    item_code = models.ForeignKey(
        LabFurnitureItem,
        on_delete=models.PROTECT,
        related_name="template_items",
    )
    qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("1"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["template", "item_code__item_code_ref__item_code"]
        unique_together = [("template", "item_code")]
        verbose_name = "Project Template Item"
        verbose_name_plural = "Project Template Items"

    def __str__(self):
        code = getattr(self.item_code, "item_code", "") if self.item_code else ""
        return f"{self.template.name} - {code} ({self.qty})"


class ProjectQuotationTemplate(models.Model):
    quotation = models.ForeignKey(
        ProjectQuotationSummaryInfo,
        to_field="quotation_number",
        db_column="quotation_number",
        on_delete=models.CASCADE,
        related_name="applied_templates",
    )
    template = models.ForeignKey(
        ProjectTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotation_applications",
    )
    template_name = models.CharField(max_length=200)
    qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("1"))
    applied_by = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "Project Quotation Template"
        verbose_name_plural = "Project Quotation Templates"

    def __str__(self):
        return f"{self.quotation_id} - {self.template_name} (x{self.qty})"


class ProjectCostingTemplate(models.Model):
    costing = models.ForeignKey(
        ProjectCostingSummaryInfo,
        on_delete=models.CASCADE,
        related_name="applied_templates",
    )
    template = models.ForeignKey(
        ProjectTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="costing_applications",
    )
    template_name = models.CharField(max_length=200)
    qty = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("1"))
    applied_by = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "Project Costing Template"
        verbose_name_plural = "Project Costing Templates"

    def __str__(self):
        return f"{self.costing_id} - {self.template_name} (x{self.qty})"
