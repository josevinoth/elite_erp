from django.db import models
from ..utils import normalize_text, to_title_case
class StockMaintenance(models.Model):
    item_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    movement_type = models.CharField(max_length=50, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = models.CharField(max_length=30, blank=True)
    location = models.CharField(max_length=150, blank=True)
    movement_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['-movement_date', '-created_at']
    def __str__(self):
        return self.item_name

    def save(self, *args, **kwargs):
        self.item_name = normalize_text(self.item_name)
        self.category = normalize_text(self.category)
        self.movement_type = to_title_case(self.movement_type)
        self.unit = normalize_text(self.unit)
        self.location = normalize_text(self.location)
        self.notes = normalize_text(self.notes)

        super().save(*args, **kwargs)

