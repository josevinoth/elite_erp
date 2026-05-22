from django.http import JsonResponse
from django.views.decorators.http import require_GET
from ..sub_models.stock_purchase_status_option import StockPurchaseStatusOption

@require_GET
def list_stock_purchase_status_options_api_view(request):
    rows = StockPurchaseStatusOption.objects.filter(is_active=True).order_by('id')
    return JsonResponse({
        "status_options": [
            {"id": row.id, "name": row.name} for row in rows
        ]
    })

