from datetime import date as _date

from django.contrib.auth.models import User
from django.db import models
from django.db.models import PROTECT

from ..utils import normalize_text
from .project_status_option import ProjectStatusOption
from ..sub_models.yes_no_mod import yesno_info

def _coerce_date(value):
    if not value:
        return None
    if isinstance(value, _date):
        return value
    try:
        return _date.fromisoformat(str(value).split(" ")[0])
    except (ValueError, AttributeError):
        return None


class Project(models.Model):
    project_id = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    project_name = models.CharField(max_length=200, blank=True)
    project_location = models.CharField(max_length=200, blank=True)
    proposal_date = models.DateField(null=True, blank=True)
    material_required_date = models.DateField(null=True, blank=True)
    project_completion_date = models.DateField(null=True, blank=True)
    mas_approved = models.ForeignKey(yesno_info,default=2,on_delete=PROTECT,related_name="mas_approved")
    advance_payment_received = models.ForeignKey(yesno_info,default=2,on_delete=PROTECT,related_name="advance_payment_received")
    prod_dwg_issued = models.ForeignKey(yesno_info,default=2,on_delete=PROTECT,related_name="prod_dwg_issued")
    prod_dwg_issued_justification=models.TextField(max_length=1000,null=True,blank=True)
    prod_dwg_release_date = models.DateField(null=True, blank=True)
    prod_dwg_issued_sf = models.ForeignKey(yesno_info,default=2,on_delete=PROTECT,related_name="prod_dwg_issued_sf") #sf steel factory
    prod_dwg_issued_sf_justification=models.TextField(max_length=1000,null=True,blank=True)
    prod_dwg_release_date_sf = models.DateField(null=True, blank=True) # production drawing issued to steel factory
    mas_justification=models.TextField(max_length=1000,null=True,blank=True)
    drawing_approved = models.ForeignKey(yesno_info, default=2, on_delete=PROTECT,related_name="drawing_approved_id")
    drawing_justification = models.TextField(max_length=1000, null=True, blank=True)
    prev_proj_replica = models.ForeignKey(yesno_info, default=2, on_delete=PROTECT,related_name="prev_proj_replica")# previous project replica
    order_value_omr = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    status = models.ForeignKey(ProjectStatusOption,null=True,blank=True,on_delete=models.SET_NULL,related_name="status")
    expected_customer_need_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User,on_delete=models.PROTECT,related_name="updated_projects")

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.project_id

    def save(self, *args, **kwargs):
        self.project_id = normalize_text(self.project_id)
        self.description = normalize_text(self.description)
        self.project_name = normalize_text(self.project_name)
        self.proposal_date = _coerce_date(self.proposal_date)
        self.expected_customer_need_date = _coerce_date(self.expected_customer_need_date)

        super().save(*args, **kwargs)

