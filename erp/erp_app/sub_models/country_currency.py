from django.db import models

from ..utils import normalize_text


class CountryCurrency(models.Model):
    country_name = models.CharField(max_length=120)
    currency_code = models.CharField(max_length=12, unique=True)
    currency_name = models.CharField(max_length=80)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "country_name", "currency_code"]

    def __str__(self):
        return f"{self.country_name} - {self.currency_code}"

    def save(self, *args, **kwargs):
        self.country_name = normalize_text(self.country_name)
        self.currency_code = normalize_text(self.currency_code).upper()
        self.currency_name = normalize_text(self.currency_name)
        super().save(*args, **kwargs)

