from django.db import models

from ..utils import normalize_text


class StockStatusInfo(models.Model):
    id = models.AutoField(primary_key=True)
    STATUS_IN_STOCK = "In-Stock"
    STATUS_PARTIAL_STOCK = "Partial Stock"
    STATUS_NO_STOCK = "No Stock"
    STATUS_NOT_PURCHASED = "Not Purchased"

    STATUS_CHOICES = [
        (STATUS_IN_STOCK, STATUS_IN_STOCK),
        (STATUS_PARTIAL_STOCK, STATUS_PARTIAL_STOCK),
        (STATUS_NO_STOCK, STATUS_NO_STOCK),
        (STATUS_NOT_PURCHASED, STATUS_NOT_PURCHASED),
    ]

    status_name = models.CharField(max_length=50, unique=True, choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status_name"]
        verbose_name = "Stock Status"
        verbose_name_plural = "Stock Statuses"

    def __str__(self):
        return self.status_name

    def save(self, *args, **kwargs):
        self.status_name = normalize_text(self.status_name)
        super().save(*args, **kwargs)


