# views_cut_optimiser.py

import json
from decimal import Decimal, InvalidOperation
from typing import Any, cast

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from ..sub_models.cut_optimiser import CutOptimiserRecord, CutSize, UOM
from ..sub_models.project import Project


def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return None


def _read_json(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (TypeError, ValueError):
        return {}


def _to_decimal(value):
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, TypeError, ValueError):
        return None


def _to_int(value, default=None):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError, AttributeError):
        return default


def _normalize_revision(value, default="1"):
    raw = str(value or default).strip()
    if raw.lower().startswith("r"):
        raw = raw[1:]
    return raw or default


def _resolve_project(payload):
    project_id = payload.get("project", payload.get("selectedProjectKey"))
    if project_id in (None, ""):
        return None
    try:
        return Project.objects.get(pk=int(project_id))
    except (Project.DoesNotExist, TypeError, ValueError):
        return None


def _resolve_uom(payload):
    value = payload.get("dimension_unit")
    if value in (None, ""):
        form = payload.get("form")
        if isinstance(form, dict):
            value = form.get("dimUnit")

    if value in (None, ""):
        return None

    if isinstance(value, int) or (isinstance(value, str) and value.isdigit()):
        return UOM.objects.filter(pk=int(value)).first()

    return UOM.objects.filter(symbol__iexact=str(value).strip()).first()


def _extract_raw_sheet(payload):
    raw_sheets = payload.get("rawSheets")
    if isinstance(raw_sheets, list) and raw_sheets:
        row = raw_sheets[0] if isinstance(raw_sheets[0], dict) else {}
        return {
            "name": str(row.get("name") or "").strip(),
            "length": _to_decimal(row.get("length")),
            "width": _to_decimal(row.get("width")),
            "blade_thk": _to_decimal(row.get("blade_thk", row.get("raw_sheet_blade_thk"))),
        }

    return {
        "name": str(payload.get("raw_sheet_name") or "").strip(),
        "length": _to_decimal(payload.get("raw_sheet_length")),
        "width": _to_decimal(payload.get("raw_sheet_width")),
        "blade_thk": _to_decimal(payload.get("raw_sheet_blade_thk")),
    }


def _extract_cut_sizes(payload):
    cut_items = payload.get("cutItems")
    if isinstance(cut_items, list):
        rows = []
        for item in cut_items:
            if not isinstance(item, dict):
                continue
            width = _to_decimal(item.get("width", item.get("length")))
            length = _to_decimal(item.get("length"))
            quantity = _to_int(item.get("quantity"), 1) or 1
            if width is None or length is None:
                continue
            rows.append({
                "name": str(item.get("name") or "").strip() or "Cut",
                "width": width,
                "length": length,
                "quantity": max(1, quantity),
            })
        return rows

    cut_sizes = payload.get("cut_sizes")
    if isinstance(cut_sizes, list):
        rows = []
        for item in cut_sizes:
            if not isinstance(item, dict):
                continue
            width = _to_decimal(item.get("width"))
            length = _to_decimal(item.get("length"))
            quantity = _to_int(item.get("quantity"), 1) or 1
            if width is None or length is None:
                continue
            rows.append({
                "name": str(item.get("name") or "").strip() or "Cut",
                "width": width,
                "length": length,
                "quantity": max(1, quantity),
            })
        return rows

    return []


def _serialize_record(record: Any):
    record = cast(Any, record)
    cut_sizes = list(record.cut_sizes.all().order_by("id"))
    return {
        "id": record.pk,
        "project": record.project_id,
        "project_name": record.project.project_name,
        "project_id": record.project.project_id,
        "revision": record.revision,
        "cut_optimiser_id": record.cut_optimiser_id,
        "updated_by": record.updated_by_id,
        "raw_sheet_name": record.raw_sheet_name or "",
        "raw_sheet_length": "" if record.raw_sheet_length is None else str(record.raw_sheet_length),
        "raw_sheet_width": "" if record.raw_sheet_width is None else str(record.raw_sheet_width),
        "raw_sheet_blade_thk": "" if record.raw_sheet_blade_thk is None else str(record.raw_sheet_blade_thk),
        "dimension_unit": record.dimension_unit_id,
        "cut_sizes": [
            {
                "id": row.pk,
                "name": row.name,
                "width": str(row.width),
                "length": str(row.length),
                "quantity": row.quantity,
            }
            for row in cut_sizes
        ],
        "created_at": record.created_at.isoformat() if record.created_at else "",
        "updated_at": record.updated_at.isoformat() if record.updated_at else "",
    }


def _apply_record_data(record, payload, request, *, is_create):
    project = _resolve_project(payload) or getattr(record, "project", None)
    if project is None:
        return "Project is required."

    raw_sheet = _extract_raw_sheet(payload)
    revision = _normalize_revision(payload.get("revision", getattr(record, "revision", "1")))
    cut_optimiser_id = str(payload.get("cut_optimiser_id") or getattr(record, "cut_optimiser_id", "") or "").strip()

    record.project = project
    record.revision = revision
    if is_create and cut_optimiser_id:
        record.cut_optimiser_id = cut_optimiser_id
    record.updated_by = request.user
    record.raw_sheet_name = raw_sheet["name"] or None
    record.raw_sheet_length = raw_sheet["length"]
    record.raw_sheet_width = raw_sheet["width"]
    record.raw_sheet_blade_thk = raw_sheet["blade_thk"]
    record.dimension_unit = _resolve_uom(payload)

    try:
        record.validate_unique()
    except ValidationError as exc:
        messages = exc.message_dict.get("non_field_errors") or exc.messages
        return messages[0] if messages else "Validation failed."

    return None


def _replace_cut_sizes(record, payload):
    rows = _extract_cut_sizes(payload)
    record.cut_sizes.all().delete()
    for row in rows:
        CutSize.objects.create(cut_optimiser_record=record, **row)


@require_http_methods(["GET", "POST"])
@csrf_protect
def list_cut_optimiser(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    if request.method == "POST":
        payload = _read_json(request)
        record = cast(Any, CutOptimiserRecord())
        message = _apply_record_data(record, payload, request, is_create=True)
        if message:
            return JsonResponse({"message": message}, status=400)

        try:
            with transaction.atomic():
                record.save()
        except IntegrityError:
            return JsonResponse({"message": "Cut Optimiser ID already exists."}, status=400)

        return JsonResponse(_serialize_record(record), status=201)

    rows = cast(Any, CutOptimiserRecord.objects.select_related("project", "updated_by", "dimension_unit").prefetch_related("cut_sizes"))

    project_id = request.GET.get("project")
    if project_id not in (None, ""):
        rows = rows.filter(project_id=project_id)

    revision = request.GET.get("revision")
    if revision not in (None, ""):
        rows = rows.filter(revision=_normalize_revision(revision))

    cut_optimiser_id = request.GET.get("cut_optimiser_id")
    if cut_optimiser_id not in (None, ""):
        rows = rows.filter(cut_optimiser_id__iexact=str(cut_optimiser_id).strip())

    ordering = request.GET.get("ordering") or "-id"
    if ordering not in {"id", "-id", "created_at", "-created_at", "updated_at", "-updated_at"}:
        ordering = "-id"
    rows = rows.order_by(ordering)

    total = rows.count()
    limit = _to_int(request.GET.get("limit"))
    if limit and limit > 0:
        rows = rows[:limit]

    return JsonResponse({
        "count": total,
        "results": [_serialize_record(row) for row in rows],
    })


@require_http_methods(["POST"])
@csrf_protect
def create_cut_optimiser(request):
    return list_cut_optimiser(request)


@require_http_methods(["GET", "PATCH", "PUT", "DELETE"])
@csrf_protect
def cut_optimiser_detail(request, pk):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        record = cast(Any, CutOptimiserRecord.objects.select_related("project", "updated_by", "dimension_unit").prefetch_related("cut_sizes").get(pk=pk))
    except CutOptimiserRecord.DoesNotExist:
        return JsonResponse({"message": "Record not found."}, status=404)

    if request.method == "GET":
        return JsonResponse(_serialize_record(record))

    if request.method == "DELETE":
        record.delete()
        return JsonResponse({"success": True, "message": "Deleted."})

    payload = _read_json(request)
    message = _apply_record_data(record, payload, request, is_create=False)
    if message:
        return JsonResponse({"message": message}, status=400)

    try:
        with transaction.atomic():
            record.save()
    except IntegrityError:
        return JsonResponse({"message": "Cut Optimiser ID already exists."}, status=400)

    return JsonResponse(_serialize_record(record))


def _serialize_cut_size(cut_size):
    return {
        "id": cut_size.pk,
        "name": str(cut_size.name),
        "width": str(cut_size.width),
        "length": str(cut_size.length),
        "quantity": cut_size.quantity,
    }


@require_http_methods(["GET", "POST"])
@csrf_protect
def list_cut_sizes(request, cut_optimiser_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        record = cast(Any, CutOptimiserRecord.objects.get(pk=cut_optimiser_id))
    except CutOptimiserRecord.DoesNotExist:
        return JsonResponse({"message": "Cut Optimiser Record not found."}, status=404)

    if request.method == "GET":
        rows = record.cut_sizes.all().order_by("id")
        return JsonResponse({
            "count": rows.count(),
            "results": [_serialize_cut_size(row) for row in rows],
        })

    payload = _read_json(request)
    name = str(payload.get("name") or "").strip() or "Cut"
    width = _to_decimal(payload.get("width"))
    length = _to_decimal(payload.get("length"))
    quantity = _to_int(payload.get("quantity"), 1) or 1

    if width is None or length is None:
        return JsonResponse({"message": "Width and length are required."}, status=400)

    cut_size = CutSize.objects.create(
        cut_optimiser_record=record,
        name=name,
        width=width,
        length=length,
        quantity=max(1, quantity),
    )

    return JsonResponse(_serialize_cut_size(cut_size), status=201)


@require_http_methods(["GET", "PATCH", "DELETE"])
@csrf_protect
def cut_size_detail(request, cut_optimiser_id, cut_size_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    try:
        record = cast(Any, CutOptimiserRecord.objects.get(pk=cut_optimiser_id))
    except CutOptimiserRecord.DoesNotExist:
        return JsonResponse({"message": "Cut Optimiser Record not found."}, status=404)

    try:
        cut_size = record.cut_sizes.get(pk=cut_size_id)
    except CutSize.DoesNotExist:
        return JsonResponse({"message": "Cut Size not found."}, status=404)

    if request.method == "GET":
        return JsonResponse(_serialize_cut_size(cut_size))

    if request.method == "DELETE":
        cut_size.delete()
        return JsonResponse({"success": True, "message": "Deleted."})

    payload = _read_json(request)
    cut_size.name = str(payload.get("name") or cut_size.name).strip() or "Cut"
    cut_size.width = _to_decimal(payload.get("width")) or cut_size.width
    cut_size.length = _to_decimal(payload.get("length")) or cut_size.length
    cut_size.quantity = _to_int(payload.get("quantity"), cut_size.quantity) or cut_size.quantity

    if cut_size.width is None or cut_size.length is None:
        return JsonResponse({"message": "Width and length are required."}, status=400)

    cut_size.save()
    return JsonResponse(_serialize_cut_size(cut_size))
