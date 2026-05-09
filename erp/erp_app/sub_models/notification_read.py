from django.conf import settings
from django.db import models

from .comment import Comment
from .task import Task


class TaskNotificationRead(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="task_notification_reads",
    )
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="notification_reads",
    )
    read_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "task")
        indexes = [
            models.Index(fields=["user", "task"]),
            models.Index(fields=["user", "-read_at"]),
        ]


class CommentNotificationRead(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comment_notification_reads",
    )
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name="notification_reads",
    )
    read_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "comment")
        indexes = [
            models.Index(fields=["user", "comment"]),
            models.Index(fields=["user", "-read_at"]),
        ]

