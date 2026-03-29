from datetime import date as _date

from django.db import models

from ..utils import normalize_text
from .project_status_option import ProjectStatusOption


def _coerce_date(value):
    if not value:
        return None
    if isinstance(value, _date):
        return value
    try:
        return _date.fromisoformat(str(value).split(" ")[0])
    except (ValueError, AttributeError):
        return None

class Project(models.Model):
    project_id = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    project_name = models.CharField(max_length=200, blank=True)
    proposal_date = models.DateField(null=True, blank=True)
    updated_by = models.CharField(max_length=255, blank=True)
    order_value_omr = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    status = models.ForeignKey(
        ProjectStatusOption,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="projects",
    )
    expected_customer_need_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.project_id

    def save(self, *args, **kwargs):
        self.project_id = normalize_text(self.project_id)
        self.description = normalize_text(self.description)
        self.project_name = normalize_text(self.project_name)
        self.updated_by = normalize_text(self.updated_by)
        self.proposal_date = _coerce_date(self.proposal_date)
        self.expected_customer_need_date = _coerce_date(self.expected_customer_need_date)

        super().save(*args, **kwargs)

