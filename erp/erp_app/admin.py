from django.contrib import admin
from django.urls import path
from django.utils.html import format_html
from django.contrib.admin.models import LogEntry
from django.contrib.contenttypes.models import ContentType
from django.shortcuts import render, get_object_or_404
from django.utils.timezone import localtime

from .sub_models import CountryCurrency, ItemCategory, LabFurnitureItem, LCEBalanceSettlement, LCEEstimate


class HistoryMixin:
    def history_link(self, obj):
        url = f"history/{obj.pk}/"
        return format_html('<a class="button" href="{}">History</a>', url)
    history_link.short_description = 'History'
    history_link.allow_tags = True

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('history/<int:object_id>/', self.admin_site.admin_view(self.history_view), name=f'{self.model._meta.app_label}_{self.model._meta.model_name}_history'),
        ]
        return custom_urls + urls

    def history_view(self, request, object_id):
        obj = get_object_or_404(self.model, pk=object_id)
        content_type = ContentType.objects.get_for_model(self.model)
        log_entries = LogEntry.objects.filter(content_type=content_type, object_id=object_id).order_by('action_time')
        history = []
        for entry in log_entries:
            history.append({
                'updated_by': entry.user.get_username() if entry.user else 'system',
                'updated_on': localtime(entry.action_time),
                'updated_value': entry.change_message,
            })
        context = dict(
            self.admin_site.each_context(request),
            opts=self.model._meta,
            object=obj,
            history=history,
        )
        return render(request, 'admin/object_history_custom.html', context)


@admin.register(CountryCurrency)
class CountryCurrencyAdmin(HistoryMixin, admin.ModelAdmin):
	list_display = ("country_name", "currency_code", "currency_name", "is_active", "sort_order", "history_link")
	search_fields = ("country_name", "currency_code", "currency_name")
	list_filter = ("is_active",)


@admin.register(ItemCategory)
class ItemCategoryAdmin(HistoryMixin, admin.ModelAdmin):
	list_display = ("name", "created_at", "updated_at", "history_link")
	search_fields = ("name",)


@admin.register(LabFurnitureItem)
class LabFurnitureItemAdmin(HistoryMixin, admin.ModelAdmin):
	list_display = ("item_code", "item_name", "item_category", "created_at", "updated_at", "history_link")
	search_fields = ("item_code", "item_name", "item_category__name")
	list_filter = ("item_category",)


@admin.register(LCEEstimate)
class LCEEstimateAdmin(HistoryMixin, admin.ModelAdmin):
	list_display = ("total_supplier_price", "total_supplier_price_omr", "total", "updated_at", "history_link")
	search_fields = ("created_by",)


@admin.register(LCEBalanceSettlement)
class LCEBalanceSettlementAdmin(HistoryMixin, admin.ModelAdmin):
	list_display = ("lce_estimate", "settlement_date", "foreign_currency", "amount", "factor", "value", "history_link")
	list_filter = ("settlement_date", "foreign_currency")
	search_fields = ("lce_estimate__created_by",)
