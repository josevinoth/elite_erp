from django.contrib.auth.models import User
from django.db import models

from .project import Project
from .item_category import ItemCategory


class ItemCostingInfo(models.Model):
    ic_project_ref = models.ForeignKey(Project,on_delete=models.PROTECT,related_name="ic_project_ref",default=1)
    ic_item_category = models.ForeignKey(ItemCategory, on_delete=models.PROTECT, related_name="item_costing_categories", default=1)
    ic_item_code = models.CharField(max_length=20)
    ic_item_description = models.CharField(max_length=255)
    ic_qty = models.PositiveIntegerField(default=0)
    ic_cost_max = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    ic_cost_min = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    ic_cost = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    ic_total_price = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    ic_created_at = models.DateTimeField(auto_now_add=True)
    ic_updated_at = models.DateTimeField(auto_now=True)
    ic_updated_by = models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name="ic_updated_by")

    class Meta:
        ordering = ["ic_item_code"]

    def __str__(self):
        return str(self.ic_item_code)

