from django.db import models

class StockPurchaseStatusOption(models.Model):
    name = models.CharField(max_length=32, unique=True)  # mandatory, no choices
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
