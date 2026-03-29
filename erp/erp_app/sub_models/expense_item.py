from django.db import models

from ..utils import to_title_case


class ExpenseItem(models.Model):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name = to_title_case(self.name)
        super().save(*args, **kwargs)

