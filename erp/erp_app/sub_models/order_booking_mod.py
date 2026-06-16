from django.db import models

from ..utils import normalize_text
from .country_currency import CountryCurrency
from .project import Project


class order_booking_info(models.Model):
    ob_project_number = models.ForeignKey(Project,on_delete=models.SET_NULL,null=True,blank=True,)
    cost_head = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    currency = models.ForeignKey(
        CountryCurrency,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lce_cost_details",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    unit = models.CharField(max_length=30, blank=True)
    reference_note = models.CharField(max_length=255, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"{self.cost_head} ({self.project.project_id if self.project else 'No Project'})"

    def save(self, *args, **kwargs):
        self.cost_head = normalize_text(self.cost_head)
        self.unit = normalize_text(self.unit)
        self.reference_note = normalize_text(self.reference_note)
        self.remarks = normalize_text(self.remarks)
        self.created_by = normalize_text(self.created_by)
        super().save(*args, **kwargs)

