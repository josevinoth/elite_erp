from django.db import models

from ..utils import normalize_text
from .item_category import ItemCategory


class ItemCodeName(models.Model):
    PROCUREMENT_CLASSIFICATION_CHOICES = [
        ("OMAN", "OMAN"),
        ("UAE", "UAE"),
        ("IMP", "IMP"),
    ]
    BUSINESS_CRITICALITY_CHOICES = [
        ("VIP", "VIP"),
        ("CRITICAL", "CRITICAL"),
        ("NON CRITICAL", "NON CRITICAL"),
        ("UNDESIRED", "UNDESIRED"),
    ]

    item_code = models.CharField(max_length=20, unique=True)
    item_name = models.CharField(max_length=255, unique=True)
    item_category = models.ForeignKey(
        ItemCategory,
        on_delete=models.PROTECT,
        related_name="item_code_names",
        null=True,
        blank=True,
    )
    procurement_classification = models.CharField(
        max_length=20,
        blank=True,
        default="",
        choices=PROCUREMENT_CLASSIFICATION_CHOICES,
    )
    business_criticality = models.CharField(
        max_length=30,
        blank=True,
        default="",
        choices=BUSINESS_CRITICALITY_CHOICES,
    )

    class Meta:
        ordering = ["item_code"]

    def __str__(self):
        return f"{self.item_code} - {self.item_name}"

    def save(self, *args, **kwargs):
        self.item_code = normalize_text(self.item_code).upper()
        self.item_name = normalize_text(self.item_name)
        if self.procurement_classification:
            self.procurement_classification = normalize_text(self.procurement_classification).upper()
        if self.business_criticality:
            self.business_criticality = normalize_text(self.business_criticality).upper()
        super().save(*args, **kwargs)
