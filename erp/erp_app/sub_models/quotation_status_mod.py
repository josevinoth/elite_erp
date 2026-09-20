from django.db import models

from ..utils import normalize_text


class QuotationStatusInfo(models.Model):
    STATUS_WORK_IN_PROGRESS = "Work In Progress"
    STATUS_COMPLETED = "Completed"
    STATUS_HOLD = "Hold"
    STATUS_CANCELLED = "Cancelled"
    STATUS_CHOICES = [
        (STATUS_WORK_IN_PROGRESS, STATUS_WORK_IN_PROGRESS),
        (STATUS_COMPLETED, STATUS_COMPLETED),
        (STATUS_HOLD, STATUS_HOLD),
        (STATUS_CANCELLED, STATUS_CANCELLED),
    ]

    status_name = models.CharField(max_length=32, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status_name"]
        verbose_name = "Quotation Status"
        verbose_name_plural = "Quotation Statuses"

    def __str__(self):
        return self.status_name

    def save(self, *args, **kwargs):
        self.status_name = normalize_text(self.status_name)
        super().save(*args, **kwargs)


def get_default_quotation_status_name():
    return QuotationStatusInfo.STATUS_WORK_IN_PROGRESS

