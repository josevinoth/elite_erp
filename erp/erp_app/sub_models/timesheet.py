from django.db import models
from django.conf import settings

from ..utils import normalize_text
from .task import Task


class TimeSheet(models.Model):
    task = models.ForeignKey(Task, on_delete=models.PROTECT, related_name="timesheets")
    employee_name = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="timesheets",
    )
    billing_date = models.DateField()
    efforts = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-billing_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee_name", "task", "billing_date", "efforts"],
                name="uniq_timesheet_emp_task_bill_date_efforts",
            )
        ]

    def __str__(self):
        username = self.employee_name.username if self.employee_name_id else "Unassigned"
        return f"{username} - {self.billing_date}"

    def save(self, *args, **kwargs):
        self.remarks = normalize_text(self.remarks)
        super().save(*args, **kwargs)

