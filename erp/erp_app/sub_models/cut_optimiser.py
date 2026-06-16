from django.contrib.auth.models import User
from django.db import models
from django.conf import settings

# Unit of Measure model
class UOM(models.Model):
    name = models.CharField(max_length=50, unique=True)
    symbol = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return f"{self.name} ({self.symbol})"




class CutOptimiserRecord(models.Model):
    project = models.ForeignKey('Project', on_delete=models.CASCADE)
    revision = models.CharField(max_length=10, default='1')
    cut_optimiser_id = models.CharField(max_length=20, unique=True, blank=True)
    updated_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='cut_optimiser_records')
    # Fields moved from RawSheet
    raw_sheet_name = models.CharField(max_length=100, blank=True, null=True)
    raw_sheet_length = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True,default=0)
    raw_sheet_width = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True,default=0)
    raw_sheet_blade_thk = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True,default=0)
    # Field moved from CutSize
    dimension_unit = models.ForeignKey('UOM', on_delete=models.SET_NULL, blank=True, null=True, related_name='cut_optimiser_records')
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # link_input removed

    class Meta:
        unique_together = ('project', 'revision')

    def validate_unique(self, exclude=None):
        super().validate_unique(exclude=exclude)
        if CutOptimiserRecord.objects.filter(project=self.project, revision=self.revision).exclude(pk=self.pk).exists():
            from django.core.exceptions import ValidationError
            raise ValidationError({
                "non_field_errors": [
                    "A record already exists for this Project and Revision. Click OK to create a new revision, or Cancel to stay on this form."
                ]
            })

    def save(self, *args, **kwargs):
        if not self.cut_optimiser_id:
            last = CutOptimiserRecord.objects.order_by('-id').first()
            if last and last.cut_optimiser_id and last.cut_optimiser_id.startswith('CP'):
                try:
                    last_num = int(last.cut_optimiser_id[2:])
                except ValueError:
                    last_num = 0
            else:
                last_num = 0
            self.cut_optimiser_id = f"CP{last_num+1:05d}"
        super().save(*args, **kwargs)


class CutSize(models.Model):
    cut_optimiser_record = models.ForeignKey(CutOptimiserRecord, on_delete=models.CASCADE, related_name='cut_sizes')
    name = models.CharField(max_length=100)
    width = models.DecimalField(max_digits=10, decimal_places=2)
    length = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    # dimension_unit removed, now in CutOptimiserRecord
    # Add other fields as needed

    def __str__(self):
        return f"{self.name} ({self.width}x{self.length}) x{self.quantity}"
