from django.db import models

from ..utils import normalize_text
from .task import Task


class TimeSheet(models.Model):
    task = models.ForeignKey(Task, on_delete=models.PROTECT, related_name="timesheets")
    employee_name = models.CharField(max_length=255)
    billing_date = models.DateField()
    efforts = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-billing_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee_name", "task", "billing_date"],
                name="uniq_timesheet_emp_task_billing_date",
            )
        ]

    def __str__(self):
        return f"{self.employee_name} - {self.billing_date}"

    def save(self, *args, **kwargs):
        self.employee_name = normalize_text(self.employee_name)
        self.remarks = normalize_text(self.remarks)
        super().save(*args, **kwargs)

