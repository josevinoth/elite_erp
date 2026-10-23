from django.contrib.auth.models import User
from django.db import models

class yesno_info(models.Model):
    yn_value = models.CharField(max_length=20)


    class Meta:
        ordering = ['-yn_value']

    def __str__(self):
        return self.yn_value