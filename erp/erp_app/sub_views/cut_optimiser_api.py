from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from ..sub_models.cut_optimiser import CutOptimiserRecord, CutSize
import json

@csrf_exempt
@require_http_methods(["POST"])
def save_cut_sizes(request):
    data = json.loads(request.body.decode("utf-8"))
    record_id = data.get("record_id")
    cut_sizes = data.get("cut_sizes", [])
    if not record_id:
        return JsonResponse({"error": "Missing record_id"}, status=400)
    try:
        record = CutOptimiserRecord.objects.get(pk=record_id)
    except CutOptimiserRecord.DoesNotExist:
        return JsonResponse({"error": "Record not found"}, status=404)
    # Remove old cut sizes
    record.cut_sizes.all().delete()
    # Add new cut sizes
    for cs in cut_sizes:
        CutSize.objects.create(
            cut_optimiser_record=record,
            name=cs.get("name", ""),
            length=cs.get("length", 0),
            width=cs.get("width", 0),
            quantity=cs.get("quantity", 1),
        )
    return JsonResponse({"success": True})

@csrf_exempt
@require_http_methods(["GET"])
def get_cut_sizes(request, record_id):
    try:
        record = CutOptimiserRecord.objects.get(pk=record_id)
    except CutOptimiserRecord.DoesNotExist:
        return JsonResponse({"error": "Record not found"}, status=404)
    cut_sizes = [
        {
            "id": cs.id,
            "name": cs.name,
            "length": float(cs.length),
            "width": float(cs.width),
            "quantity": cs.quantity,
        }
        for cs in record.cut_sizes.all()
    ]
    return JsonResponse({"cut_sizes": cut_sizes})



