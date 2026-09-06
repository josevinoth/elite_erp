from django.core.exceptions import ValidationError
from django.db import models

from ..utils import normalize_text


class RetrievalStatusInfo(models.Model):
    id = models.AutoField(primary_key=True)

    STATUS_NO_ACTION = "No Action"
    STATUS_ITEM_REQUESTED = "Item Requested"
    STATUS_ITEM_SUPPLIED = "Item Supplied"
    STATUS_REQUEST_REJECTED = "Item Rejected"
    STATUS_ITEM_ACCEPTED = "Item Accepted"
    STATUS_ITEM_RETURN = "Item Return"
    STATUS_ITEM_RETURN_ACCEPTED = "Item Return Accepted"

    STATUS_CHOICES = [
        (STATUS_NO_ACTION, STATUS_NO_ACTION),
        (STATUS_ITEM_REQUESTED, STATUS_ITEM_REQUESTED),
        (STATUS_ITEM_SUPPLIED, STATUS_ITEM_SUPPLIED),
        (STATUS_REQUEST_REJECTED, STATUS_REQUEST_REJECTED),
        (STATUS_ITEM_ACCEPTED, STATUS_ITEM_ACCEPTED),
        (STATUS_ITEM_RETURN, STATUS_ITEM_RETURN),
        (STATUS_ITEM_RETURN_ACCEPTED, STATUS_ITEM_RETURN_ACCEPTED),
    ]

    status_name = models.CharField(max_length=50, unique=True, choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status_name"]
        verbose_name = "Retrieval Status"
        verbose_name_plural = "Retrieval Statuses"

    def __str__(self):
        return self.status_name

    def save(self, *args, **kwargs):
        status_name = normalize_text(self.status_name)
        canonical_map = {
            self.STATUS_NO_ACTION.lower(): self.STATUS_NO_ACTION,
            self.STATUS_ITEM_REQUESTED.lower(): self.STATUS_ITEM_REQUESTED,
            self.STATUS_ITEM_SUPPLIED.lower(): self.STATUS_ITEM_SUPPLIED,
            self.STATUS_REQUEST_REJECTED.lower(): self.STATUS_REQUEST_REJECTED,
            "request rejected": self.STATUS_REQUEST_REJECTED,
            self.STATUS_ITEM_ACCEPTED.lower(): self.STATUS_ITEM_ACCEPTED,
            self.STATUS_ITEM_RETURN.lower(): self.STATUS_ITEM_RETURN,
            self.STATUS_ITEM_RETURN_ACCEPTED.lower(): self.STATUS_ITEM_RETURN_ACCEPTED,
        }
        self.status_name = canonical_map.get(status_name.lower(), status_name)
        if RetrievalStatusInfo.objects.filter(status_name__iexact=self.status_name).exclude(pk=self.pk).exists():
            raise ValidationError({"status_name": "Retrieval status already exists."})
        super().save(*args, **kwargs)

