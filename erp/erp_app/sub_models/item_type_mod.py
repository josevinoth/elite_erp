from django.db import models

from ..utils import normalize_text


class ItemType_info(models.Model):
    it_name = models.CharField(max_length=255, unique=True)
    it_created_at = models.DateTimeField(auto_now_add=True)
    it_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["it_name"]

    def __str__(self):
        return self.it_name

    def save(self, *args, **kwargs):
        self.it_name = normalize_text(self.it_name)
        super().save(*args, **kwargs)

