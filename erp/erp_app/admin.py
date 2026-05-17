from django.contrib import admin

from .sub_models import CountryCurrency, ItemCategory, LabFurnitureItem, LCEBalanceSettlement, LCEEstimate


@admin.register(CountryCurrency)
class CountryCurrencyAdmin(admin.ModelAdmin):
	list_display = ("country_name", "currency_code", "currency_name", "is_active", "sort_order")
	search_fields = ("country_name", "currency_code", "currency_name")
	list_filter = ("is_active",)


@admin.register(ItemCategory)
class ItemCategoryAdmin(admin.ModelAdmin):
	list_display = ("name", "created_at", "updated_at")
	search_fields = ("name",)


@admin.register(LabFurnitureItem)
class LabFurnitureItemAdmin(admin.ModelAdmin):
	list_display = ("item_code", "item_name", "item_category", "created_at", "updated_at")
	search_fields = ("item_code", "item_name", "item_category__name")
	list_filter = ("item_category",)


@admin.register(LCEEstimate)
class LCEEstimateAdmin(admin.ModelAdmin):
	list_display = ("stock_purchase", "total_supplier_price", "total_supplier_price_omr", "total", "updated_at")
	search_fields = ("stock_purchase__item_name", "stock_purchase__invoice_number", "created_by")


@admin.register(LCEBalanceSettlement)
class LCEBalanceSettlementAdmin(admin.ModelAdmin):
	list_display = ("lce_estimate", "settlement_date", "foreign_currency", "amount", "factor", "value")
	list_filter = ("settlement_date", "foreign_currency")
	search_fields = ("lce_estimate__created_by",)


