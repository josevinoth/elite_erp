from django.db import models
from django.contrib.auth.models import User

from ..utils import normalize_text
from .approval_status_mod import ApprovalStatus_info
from .project import Project


class ProjectLayoutDrawing(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="layout_drawings",
    )
    drawing_name = models.CharField(max_length=255, blank=True)
    file = models.FileField(
        upload_to="project_layout_drawings/%Y/%m/%d", null=True, blank=True
    )
    level_one_approver = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="layout_drawing_level_one_approvals",
    )
    level_one_status = models.ForeignKey(
        ApprovalStatus_info,
        default=3,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="layout_drawing_level_one_statuses",
    )
    level_one_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.drawing_name or f"Drawing {self.id}"

    def save(self, *args, **kwargs):
        self.drawing_name = normalize_text(self.drawing_name)
        self.level_one_message = normalize_text(self.level_one_message)
        super().save(*args, **kwargs)
