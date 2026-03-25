from django.db import models

from ..utils import to_title_case


class Activity(models.Model):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "activities"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name = to_title_case(self.name)
        super().save(*args, **kwargs)

