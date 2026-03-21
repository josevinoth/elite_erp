from django.contrib.auth.models import User
from django.db import models

from .user_status_option import UserStatusOption


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    status = models.ForeignKey(
        UserStatusOption,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="user_profiles",
    )

    def __str__(self):
        return self.user.username

