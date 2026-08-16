from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce

from ..utils import calculate_costs, normalize_text
from .CostType_mod import CostTypeInfo
from .item_category import ItemCategory
from .item_costing_mod import ItemCostingInfo
from .item_type_mod import ItemType_info
from .lab_furniture_item import LabFurnitureItem
from .project_quotation_summary_mod import ProjectQuotationSummaryInfo
from .room_data_mod import RoomDataInfo
from .stock_purchase import StockPurchaseItem
from .stock_status_mod import StockStatusInfo


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


def _resolve_purchase_qty(item_code, fallback=0):
    normalized_code = normalize_text(getattr(item_code, "item_code", item_code)).upper()
    if not normalized_code:
        return _as_decimal(fallback)

    aggregate = StockPurchaseItem.objects.filter(item_code__item_code__iexact=normalized_code).aggregate(
        total_qty=Coalesce(
            Sum("quantity"),
            Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2)),
        )
    )
    resolved_qty = _as_decimal(aggregate.get("total_qty", 0))
    if resolved_qty <= Decimal("0"):
        return _as_decimal(fallback)
    return resolved_qty


def _has_purchase_history(item_code):
    normalized_code = normalize_text(getattr(item_code, "item_code", item_code)).upper()
    if not normalized_code:
        return False
    return StockPurchaseItem.objects.filter(item_code__item_code__iexact=normalized_code).exists()


def _resolve_stock_status_name(item_code, requested_qty, purchase_qty):
    if not item_code:
        return StockStatusInfo.STATUS_IN_STOCK

    requested = _as_decimal(requested_qty)
    purchased = _as_decimal(purchase_qty)
    has_history = _has_purchase_history(item_code)

    if not has_history:
        return StockStatusInfo.STATUS_NOT_PURCHASED
    if purchased <= Decimal("0"):
        return StockStatusInfo.STATUS_NO_STOCK
    if purchased < requested:
        return StockStatusInfo.STATUS_PARTIAL_STOCK
    return StockStatusInfo.STATUS_IN_STOCK


def _resolve_stock_status(status_name):
    normalized = normalize_text(status_name)
    if not normalized:
        normalized = StockStatusInfo.STATUS_IN_STOCK

    existing = StockStatusInfo.objects.filter(status_name__iexact=normalized).order_by("id").first()
    if existing:
        return existing

    return StockStatusInfo.objects.create(status_name=normalized)


def _sync_dimensions_from_item_master(instance, item_master=None):
    if not item_master:
        instance.length = Decimal("0")
        instance.width = Decimal("0")
        instance.height = Decimal("0")
        instance.volume = Decimal("0")
        return

    instance.length = _as_decimal(getattr(item_master, "length", 0))
    instance.width = _as_decimal(getattr(item_master, "width", 0))
    instance.height = _as_decimal(getattr(item_master, "height", 0))
    instance.volume = _as_decimal(getattr(item_master, "volume", 0))


def build_project_quotation_hierarchy(items):
    # Level-based hierarchy was removed; keep flat nodes for response compatibility.
    return [{"item": item, "children": []} for item in items]


def validate_project_quotation_hierarchy(quotation, candidate=None, delete_pk=None):
    if not quotation:
        return

    existing_items = list(
        ProjectQuotationItemInfo.objects.filter(quotation_number=quotation)
        .select_related("quotation_number", "cost_type", "item_category", "item_code__item_type")
        .defer("item_type")
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
    quotation_number = models.ForeignKey(
        ProjectQuotationSummaryInfo,
        to_field="quotation_number",
        db_column="quotation_number",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quotation_items",
    )
    cost_type = models.ForeignKey(CostTypeInfo, on_delete=models.PROTECT, related_name="project_quotation_items")
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
    item_type = models.ForeignKey(ItemType_info, on_delete=models.PROTECT, default=1,related_name="item_type",)
    room_name = models.ForeignKey(
        RoomDataInfo,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quotation_items",
    )
    stock_status = models.ForeignKey(StockStatusInfo, on_delete=models.PROTECT, null=True, blank=True)

    requested_qty = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    purchase_qty = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cost_per_qty = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    length = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    width = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    height = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    volume = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    max_cost = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    min_cost = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    actual_cost = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    total_cost = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["quotation_number", "id"]
        verbose_name = "Project Quotation Item"
        verbose_name_plural = "Project Quotation Items"
        unique_together = (("quotation_number", "item_code"),)

    def __str__(self):
        quote_key = getattr(self, "quotation_number_id", None) or getattr(self, "quotation_number", None)
        return f"{quote_key} - {self.cost_type.name} - {self.item_name or 'Quotation Item'}"

    def _update_summary_totals(self):
        summary = self.quotation_number
        if summary:
            summary.save()

    def clean(self):
        self.item_name = normalize_text(self.item_name)

        if getattr(self, "quotation_number", None) is None:
            raise ValidationError({"quotation_number": "Quotation number is required."})
        if getattr(self, "cost_type", None) is None:
            raise ValidationError({"cost_type": "Cost type is required."})

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
            # Keep existing purchase_qty for legacy rows if no stock quantity exists yet.
            self.purchase_qty = _resolve_purchase_qty(resolved_master, fallback=self.purchase_qty)
            allow_over_request = bool(getattr(self, "_allow_requested_qty_override", False))
            if self.requested_qty > self.purchase_qty and not allow_over_request:
                raise ValidationError({"requested_qty": "Requested Qty cannot be greater than Purchase Qty."})
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
            self.item_name = ""
            self.item_code = None
            self.purchase_qty = Decimal("0")
            _sync_dimensions_from_item_master(self)
            costs = calculate_costs(None, self.requested_qty, actual_cost=self.actual_cost)
            self.max_cost = costs["max_cost"]
            self.min_cost = costs["min_cost"]
            self.actual_cost = costs["actual_cost"]
            self.cost_per_qty = costs["cost_per_qty"]
            self.total_cost = costs["total_cost"]
            self.stock_status = _resolve_stock_status(StockStatusInfo.STATUS_IN_STOCK)

        validate_project_quotation_hierarchy(self.quotation_number, candidate=self)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        self._update_summary_totals()

