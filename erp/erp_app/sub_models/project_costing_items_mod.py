from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from ..utils import calculate_costs, normalize_text
from .CostType_mod import CostTypeInfo
from .item_category import ItemCategory
from .item_type_mod import ItemType_info
from .lab_furniture_item import LabFurnitureItem
from .project_costing_summary_mod import ProjectCostingSummaryInfo
from .project_quotation_items_mod import (
    _as_decimal,
    _is_material_cost_type,
    _resolve_material_item,
    _resolve_purchase_qty,
    _resolve_stock_status,
    _resolve_stock_status_name,
    _sync_dimensions_from_item_master,
)
from .retrieval_status_mod import RetrievalStatusInfo
from .room_data_mod import RoomDataInfo
from .stock_status_mod import StockStatusInfo


class ProjectCostingItemInfo(models.Model):
    costing_id = models.ForeignKey(
        ProjectCostingSummaryInfo,
        on_delete=models.PROTECT,
        related_name="costing_items",
    )
    cost_type = models.ForeignKey(
        CostTypeInfo,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="project_costing_items",
    )
    item_category = models.ForeignKey(
        ItemCategory,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="project_costing_items",
    )
    item_name = models.CharField(max_length=255, blank=True)
    item_code = models.ForeignKey(
        LabFurnitureItem,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="project_costing_items",
    )
    item_type = models.ForeignKey(ItemType_info, on_delete=models.PROTECT, default=1, related_name="project_costing_items")
    room_name = models.ForeignKey(
        RoomDataInfo,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="project_costing_items",
    )
    purchase_qty = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    requested_qty = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cost_per_qty = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    max_cost = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    min_cost = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    actual_cost = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    total_cost = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    length = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    width = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    height = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    volume = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    stock_status = models.ForeignKey(StockStatusInfo, on_delete=models.PROTECT, null=True, blank=True)
    retrieval_status = models.ForeignKey(
        RetrievalStatusInfo,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="project_costing_items",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_project_costing_items",
    )
    requested_on = models.DateTimeField(null=True, blank=True)
    rejection_comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["costing_id", "id"]
        verbose_name = "Project Costing Item"
        verbose_name_plural = "Project Costing Items"
        unique_together = (("costing_id", "item_code"),)

    def __str__(self):
        costing_pk = getattr(self.costing_id, "pk", None)
        return f"{costing_pk or '-'} - {self.item_name or 'Costing Item'}"

    def _default_retrieval_status(self):
        status = RetrievalStatusInfo.objects.filter(status_name__iexact=RetrievalStatusInfo.STATUS_NO_ACTION).first()
        if not status:
            status = RetrievalStatusInfo.objects.create(status_name=RetrievalStatusInfo.STATUS_NO_ACTION)
        return status

    def clean(self):
        if getattr(self, "costing_id", None) is None:
            raise ValidationError({"costing_id": "Costing summary is required."})

        self.item_name = normalize_text(self.item_name)
        self.requested_qty = _as_decimal(self.requested_qty)
        self.purchase_qty = _as_decimal(self.purchase_qty)
        self.cost_per_qty = _as_decimal(self.cost_per_qty)
        self.max_cost = _as_decimal(self.max_cost)
        self.min_cost = _as_decimal(self.min_cost)
        self.actual_cost = _as_decimal(self.actual_cost)
        self.length = _as_decimal(self.length)
        self.width = _as_decimal(self.width)
        self.height = _as_decimal(self.height)
        self.volume = _as_decimal(self.volume)

        if self.requested_qty < 0:
            raise ValidationError({"requested_qty": "Requested Qty must be 0 or greater."})
        if self.cost_per_qty < 0:
            raise ValidationError({"cost_per_qty": "Cost per Qty must be 0 or greater."})
        if self.actual_cost < 0:
            raise ValidationError({"actual_cost": "Actual Cost must be 0 or greater."})

        if self.retrieval_status is None:
            self.retrieval_status = self._default_retrieval_status()

        if _is_material_cost_type(self.cost_type):
            item_category_id = getattr(self, "item_category_id", None)
            item_code_id = getattr(self, "item_code_id", None)
            if item_category_id is None:
                raise ValidationError({"item_category": "Item category is required when cost type is MATERIAL."})
            if not self.item_name and item_code_id is None:
                raise ValidationError({"item_name": "Item name is required when cost type is MATERIAL."})

            resolved_master = _resolve_material_item(self.item_category, self.item_name, self.item_code)
            if resolved_master is None:
                raise ValidationError(
                    {"item_name": "Selected item category and item name do not resolve to a valid Item Master row."}
                )

            if item_category_id and resolved_master.item_category_id != item_category_id:
                raise ValidationError({"item_category": "Selected item does not belong to the chosen item category."})

            normalized_name = normalize_text(self.item_name)
            if normalized_name and normalize_text(resolved_master.item_name) != normalized_name:
                raise ValidationError({"item_name": "Selected item code does not match the chosen item name."})

            self.item_category = resolved_master.item_category
            self.item_name = normalize_text(resolved_master.item_name)
            self.item_code = resolved_master
            self.item_type = getattr(resolved_master, "item_type", self.item_type)
            self.purchase_qty = _resolve_purchase_qty(resolved_master, fallback=self.purchase_qty)
            _sync_dimensions_from_item_master(self, resolved_master)

            actual_override = None if self.actual_cost == 0 else self.actual_cost
            costs = calculate_costs(resolved_master, self.requested_qty, actual_cost=actual_override)
            self.max_cost = costs["max_cost"]
            self.min_cost = costs["min_cost"]
            self.actual_cost = costs["actual_cost"]
            self.cost_per_qty = costs["cost_per_qty"]
            self.total_cost = costs["total_cost"]
            status_name = _resolve_stock_status_name(
                resolved_master,
                requested_qty=self.requested_qty,
                purchase_qty=self.purchase_qty,
            )
            self.stock_status = _resolve_stock_status(status_name)
        else:
            self.item_category = None
            self.item_code = None
            self.purchase_qty = Decimal("0")
            self.item_name = normalize_text(self.item_name)
            _sync_dimensions_from_item_master(self)
            costs = calculate_costs(None, self.requested_qty, actual_cost=self.actual_cost)
            self.max_cost = costs["max_cost"]
            self.min_cost = costs["min_cost"]
            self.actual_cost = costs["actual_cost"]
            self.cost_per_qty = costs["cost_per_qty"]
            self.total_cost = costs["total_cost"]
            self.stock_status = _resolve_stock_status(StockStatusInfo.STATUS_IN_STOCK)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

