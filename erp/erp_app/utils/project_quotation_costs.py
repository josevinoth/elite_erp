from decimal import Decimal

from .text import normalize_text


def _as_decimal(value, default="0"):
    if value in (None, ""):
        return Decimal(str(default))
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(str(default))


def calculate_costs(item_code, requested_qty, actual_cost=None):
    from ..sub_models.stock_purchase import StockPurchaseItem

    normalized_code = normalize_text(getattr(item_code, "item_code", item_code)).upper()
    requested_qty_decimal = _as_decimal(requested_qty)

    costs = []
    if normalized_code:
        purchase_rows = StockPurchaseItem.objects.filter(item_code__item_code__iexact=normalized_code).only(
            "lce_cost",
            "unit_price",
        )
        for row in purchase_rows:
            if row.lce_cost not in (None, ""):
                costs.append(_as_decimal(row.lce_cost))
            elif row.unit_price not in (None, ""):
                costs.append(_as_decimal(row.unit_price))

    min_cost = min(costs) if costs else Decimal("0")
    max_cost = max(costs) if costs else Decimal("0")

    effective_actual_cost = max_cost if actual_cost in (None, "") else _as_decimal(actual_cost)
    total_cost = requested_qty_decimal * effective_actual_cost

    return {
        "max_cost": max_cost,
        "min_cost": min_cost,
        "actual_cost": effective_actual_cost,
        "total_cost": total_cost,
        "cost_per_qty": effective_actual_cost,
    }


def _as_percent(value):
    decimal_value = _as_decimal(value)
    return decimal_value / Decimal("100") if decimal_value > Decimal("1") else decimal_value


def calculate_summary_totals(
    total_material_cost,
    contingency,
    transportation,
    loading_unloading,
    installation,
    business_development,
    markup,
):
    material_total = _as_decimal(total_material_cost)
    contingency_ratio = _as_percent(contingency)
    markup_ratio = _as_percent(markup)

    final_material_cost = material_total * (Decimal("1") + contingency_ratio)
    total_cost_to_elite = (
        final_material_cost
        + _as_decimal(transportation)
        + _as_decimal(loading_unloading)
        + _as_decimal(installation)
        + _as_decimal(business_development)
    )
    total_markup = markup_ratio * material_total
    planned_order_value = total_cost_to_elite + total_markup

    denominator = (Decimal("1") - markup_ratio) - planned_order_value
    discount = Decimal("0") if denominator == 0 else planned_order_value / denominator

    undiscounted_quote_value = planned_order_value + discount
    factor = Decimal("0") if material_total == 0 else undiscounted_quote_value / material_total

    return {
        "final_material_cost": final_material_cost,
        "total_cost_to_elite": total_cost_to_elite,
        "total_markup": total_markup,
        "planned_order_value": planned_order_value,
        "discount": discount,
        "undiscounted_quote_value": undiscounted_quote_value,
        "factor": factor,
    }


