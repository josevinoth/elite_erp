from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from ..utils import normalize_text
from .CostType_mod import CostTypeInfo
from .item_category import ItemCategory
from .item_costing_mod import ItemCostingInfo
from .lab_furniture_item import LabFurnitureItem
from .project import Project
from .stock_purchase import StockPurchaseItem


BOM_HIERARCHY_ERROR = "Invalid BOM hierarchy: children must be linked to immediate parent level."
MATERIAL_COST_TYPE_NAME = "MATERIAL"


def _is_material_cost_type(cost_type):
    return str(getattr(cost_type, "name", "") or "").strip().upper() == MATERIAL_COST_TYPE_NAME


def _as_decimal(value, default="0"):
    if value in (None, ""):
        return Decimal(str(default))
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(str(default))


def _resolve_material_item(item_category, item_name, item_code):
    if item_code:
        return item_code

    if not item_category:
        return None

    normalized_name = normalize_text(item_name)
    if not normalized_name:
        return None

    matches = LabFurnitureItem.objects.select_related("item_category").filter(
        item_category=item_category,
        item_name__iexact=normalized_name,
    ).order_by("id")
    if matches.count() == 1:
        return matches.first()
    return None


def _resolve_cost_per_qty(item_code):
    normalized_code = normalize_text(getattr(item_code, "item_code", item_code)).upper()
    if not normalized_code:
        return Decimal("0")

    latest_item_cost = (
        ItemCostingInfo.objects.filter(ic_item_code__iexact=normalized_code)
        .order_by("-ic_updated_at", "-id")
        .first()
    )
    if latest_item_cost and latest_item_cost.ic_cost is not None:
        return _as_decimal(latest_item_cost.ic_cost)

    latest_purchase = (
        StockPurchaseItem.objects.filter(item_code__item_code__iexact=normalized_code)
        .order_by("-updated_at", "-id")
        .first()
    )
    if latest_purchase:
        if latest_purchase.lce_cost not in (None, ""):
            return _as_decimal(latest_purchase.lce_cost)
        return _as_decimal(latest_purchase.unit_price)

    return Decimal("0")


def build_project_quotation_hierarchy(items):
    tree = []
    stack = []

    for item in items:
        level = int(getattr(item, "level", 0) or 0)
        node = {"item": item, "children": []}

        while stack and int(getattr(stack[-1]["item"], "level", 0) or 0) >= level:
            stack.pop()

        if level == 0:
            tree.append(node)
        else:
            if not stack or int(getattr(stack[-1]["item"], "level", 0) or 0) != level - 1:
                raise ValidationError(BOM_HIERARCHY_ERROR)
            stack[-1]["children"].append(node)

        stack.append(node)

    return tree


def validate_project_quotation_hierarchy(project, candidate=None, delete_pk=None):
    if not project:
        return

    existing_items = list(
        ProjectQuotationItemInfo.objects.filter(project=project)
        .select_related("project", "cost_type", "item_category", "item_code")
        .order_by("id")
    )

    merged_items = []
    candidate_applied = False
    for item in existing_items:
        if delete_pk is not None and item.pk == delete_pk:
            continue
        if candidate is not None and candidate.pk is not None and item.pk == candidate.pk:
            merged_items.append(candidate)
            candidate_applied = True
        else:
            merged_items.append(item)

    if candidate is not None and not candidate_applied:
        merged_items.append(candidate)

    build_project_quotation_hierarchy(merged_items)


class ProjectQuotationItemInfo(models.Model):
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="project_quotation_items")
    cost_type = models.ForeignKey(CostTypeInfo, on_delete=models.PROTECT, related_name="project_quotation_items")
    level = models.IntegerField(default=0)
    item_category = models.ForeignKey(
        ItemCategory,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="project_quotation_items",
    )
    item_name = models.CharField(max_length=255, blank=True)
    item_code = models.ForeignKey(
        LabFurnitureItem,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="project_quotation_items",
    )
    requested_qty = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    purchase_qty = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cost_per_qty = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    total_cost = models.DecimalField(max_digits=16, decimal_places=3, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["project_id", "id"]
        verbose_name = "Project Quotation Item"
        verbose_name_plural = "Project Quotation Items"

    def __str__(self):
        return f"{self.project.project_id} - {self.cost_type.name} - {self.item_name or 'Quotation Item'}"

    def clean(self):
        self.item_name = normalize_text(self.item_name)

        if getattr(self, "project", None) is None:
            raise ValidationError({"project": "Project is required."})
        if getattr(self, "cost_type", None) is None:
            raise ValidationError({"cost_type": "Cost type is required."})
        if self.level is None or int(self.level) < 0:
            raise ValidationError({"level": "Level must be 0 or greater."})

        self.requested_qty = _as_decimal(self.requested_qty)
        self.purchase_qty = _as_decimal(self.purchase_qty)
        self.cost_per_qty = _as_decimal(self.cost_per_qty)

        if self.requested_qty < 0:
            raise ValidationError({"requested_qty": "Requested Qty must be 0 or greater."})
        if self.purchase_qty < 0:
            raise ValidationError({"purchase_qty": "Purchase Qty must be 0 or greater."})
        if self.cost_per_qty < 0:
            raise ValidationError({"cost_per_qty": "Cost per Qty must be 0 or greater."})

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
            if self.cost_per_qty == 0:
                self.cost_per_qty = _resolve_cost_per_qty(resolved_master)
        else:
            self.item_category = None
            self.item_name = ""
            self.item_code = None

        self.total_cost = self.requested_qty * self.cost_per_qty
        validate_project_quotation_hierarchy(self.project, candidate=self)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


