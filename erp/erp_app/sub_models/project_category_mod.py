from django.db import models
from ..utils import normalize_text


class ProjectCategory_info(models.Model):
    pc_name = models.CharField(max_length=255, unique=True)
    pc_created_at = models.DateTimeField(auto_now_add=True)
    pc_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["pc_name"]

    def __str__(self):
        return self.pc_name

    def save(self, *args, **kwargs):
        self.pc_name = normalize_text(self.pc_name)
        super().save(*args, **kwargs)

