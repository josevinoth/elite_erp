import datetime

from django.db import models
from django.utils import timezone

from ..utils import normalize_text


class Comment(models.Model):
    module_name = models.CharField(max_length=100)
    record_id = models.PositiveIntegerField()
    comment_datetime = models.DateTimeField(default=timezone.now)
    updated_by = models.CharField(max_length=255)
    comments = models.TextField()
    reference_link = models.URLField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-comment_datetime", "-id"]
        indexes = [
            models.Index(fields=["module_name", "record_id"]),
            models.Index(fields=["module_name", "record_id", "-comment_datetime"]),
        ]

    def __str__(self):
        dt = self.comment_datetime
        if isinstance(dt, datetime.datetime):
            return f"{self.module_name}:{self.record_id} @ {dt.isoformat()}"
        return f"{self.module_name}:{self.record_id}"

    def save(self, *args, **kwargs):
        self.module_name = normalize_text(self.module_name).lower()
        self.updated_by = normalize_text(self.updated_by)
        self.comments = normalize_text(self.comments)
        self.reference_link = normalize_text(self.reference_link)
        super().save(*args, **kwargs)


class CommentAttachment(models.Model):
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to="comment_attachments/%Y/%m/%d")
    original_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.original_name or self.file.name


