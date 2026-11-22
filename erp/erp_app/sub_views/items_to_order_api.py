from collections import defaultdict
from decimal import Decimal
from django.db.models import Case, F, Sum, When

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..sub_models.project_costing_items_mod import ProjectCostingItemInfo
from ..sub_models.place_stock_order_mod import PlaceStockOrderItem
from ..sub_models.lab_furniture_item import LabFurnitureItem
from ..sub_models.stock_purchase import StockPurchaseItem


def _ensure_authenticated(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return Response({"status": "error", "message": "Authentication required."}, status=401)
    return None


def _format_user_name(user):
    if not user:
        return ""
    full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
    return full_name or getattr(user, "username", "") or ""


def _resolve_requested_by(item, project=None):
    req_user = getattr(item, "requested_by", None)
    if req_user:
        name = _format_user_name(req_user)
        if name:
            return name

    if project:
        owner = getattr(project, "project_owner", None)
        if owner:
            name = _format_user_name(owner)
            if name:
                return name

        updated = getattr(project, "updated_by", None)
        if updated:
            name = _format_user_name(updated)
            if name:
                return name

    return "—"


def _resolve_item_type_name(item):
    for obj in (getattr(item, "item_type", None), getattr(getattr(item, "item_code", None), "item_type", None)):
        if not obj:
            continue
        val = getattr(obj, "it_name", None) or getattr(obj, "name", None) or str(obj)
        val = str(val or "").strip()
        if val and val.lower() != "none":
            return val
    return "—"


@api_view(["GET"])
def items_to_order_api_view(request):
    """
    Retrieve missing stock items from Work In Progress Costings and Quotations,
    aggregated item-wise (one consolidated row per unique item code).
    Precedence rule: If a project contains both a Quotation and a Costing,
    the items in Costing are considered (Costing is the cloned version of Quotation).
    Costing items require retrieval_status 'Item Requested'.
    Deducts available warehouse stock and active PO ordered quantities across items.
    """
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    project_id = request.GET.get("project_id")
    stage_filter = str(request.GET.get("stage") or "").strip().lower()

    # 1. Pre-query active PO items (status "Order Placed" or "Order Partially Received")
    # Cancelled POs are excluded (so cancelled items return to Items to Order).
    # Order Received POs are excluded here because received items are in physical stock.
    active_po_items = (
        PlaceStockOrderItem.objects.filter(
            order__status__in=["Order Placed", "Order Partially Received"]
        )
        .select_related("order", "item_code_ref", "item_code_ref__item_code_ref")
    )

    received_by_po_item = dict(
        StockPurchaseItem.objects.filter(po_item__isnull=False)
        .values("po_item_id")
        .annotate(tot=Sum(Case(When(purchase_qty__gt=0, then=F("purchase_qty")), default=F("quantity"))))
        .values_list("po_item_id", "tot")
    )

    po_by_code = defaultdict(Decimal)
    for p in active_po_items:
        rec = received_by_po_item.get(p.id) or Decimal("0")
        bal = max(Decimal("0"), p.order_qty - rec)
        if bal <= 0:
            continue

        code = (p.item_code or "").strip().upper()
        if not code and p.item_code_ref and getattr(p.item_code_ref, "item_code_ref", None):
            code = p.item_code_ref.item_code_ref.item_code.strip().upper()

        if code:
            po_by_code[code] += bal

    # 2. Master item physical stock per item_code (including GRN / StockPurchase intake)
    sp_totals_by_code = dict(
        StockPurchaseItem.objects.filter(item_code__item_code_ref__isnull=False)
        .values("item_code__item_code_ref__item_code")
        .annotate(tot=Sum(
            Case(
                When(purchase_qty__gt=0, then=F("purchase_qty") - F("quantity")),
                default=F("quantity"),
            )
        ))
        .values_list("item_code__item_code_ref__item_code", "tot")
    )

    master_items = LabFurnitureItem.objects.select_related(
        "item_code_ref", "item_name_ref", "item_category", "item_type"
    )
    physical_by_code = {}
    master_by_code = {}
    for m in master_items:
        if m.item_code_ref:
            code = m.item_code_ref.item_code.strip().upper()
            phys = Decimal(str(m.physical_qty or 0))
            sp_tot = Decimal(str(sp_totals_by_code.get(code) or 0))
            physical_by_code[code] = max(phys, sp_tot)
            master_by_code[code] = m

    # 3. Pull missing stock from Work In Progress Costings (Item Requested, Material)
    costing_items = (
        ProjectCostingItemInfo.objects.filter(
            costing_id__status__status_name__iexact="Work In Progress",
            cost_type__name__iexact="MATERIAL",
            retrieval_status__status_name__iexact="Item Requested",
            requested_qty__gt=0,
        )
        .select_related(
            "costing_id",
            "costing_id__quotation_number",
            "costing_id__project",
            "costing_id__updated_by",
            "item_code",
            "item_code__item_code_ref",
            "item_code__item_type",
            "item_code__item_category",
            "item_category",
            "item_type",
            "requested_by",
        )
        .order_by("-costing_id__updated_at", "id")
    )
    if project_id:
        costing_items = costing_items.filter(costing_id__project_id=project_id)

    costing_by_code = defaultdict(lambda: {
        "requested_qty": Decimal("0"),
        "item_code_ref_id": None,
        "item_name": "",
        "item_category": "",
        "item_type": "",
        "count": 0,
        "stage": "Costing",
        "references": set(),
        "projects": {},
        "requested_bys": set(),
        "requested_dates": [],
        "updated_bys": set(),
        "updated_dates": [],
    })

    costing_project_ids = set()
    for c in costing_items:
        if c.costing_id and c.costing_id.project_id:
            costing_project_ids.add(c.costing_id.project_id)
        code = getattr(c.item_code, "item_code", "") or ""
        code = code.strip().upper()
        if not code:
            continue
        entry = costing_by_code[code]
        entry["requested_qty"] += Decimal(str(c.requested_qty or 0))
        entry["count"] += 1

        costing = c.costing_id
        qtn = getattr(costing, "quotation_number", None)
        prj = getattr(costing, "project", None)
        ref_no = getattr(costing, "costing_id", None) or getattr(qtn, "quotation_number", None) or f"COST-{costing.id}"
        if ref_no:
            entry["references"].add(str(ref_no).strip())

        prj_code = getattr(prj, "project_id", "") or ""
        prj_title = getattr(prj, "project_name", "") or ""
        if prj_code or prj_title:
            entry["projects"][prj_code] = prj_title

        req_by = (
            getattr(c.requested_by, "get_full_name", lambda: "")()
            or getattr(c.requested_by, "username", "")
            or ""
        ).strip()
        if req_by:
            entry["requested_bys"].add(req_by)

        req_date = c.requested_on or c.created_at
        if req_date:
            entry["requested_dates"].append(req_date)

        upd_by = getattr(costing, "updated_by", None)
        upd_name = (
            getattr(upd_by, "get_full_name", lambda: "")()
            or getattr(upd_by, "username", "")
            or ""
        ).strip()
        if upd_name:
            entry["updated_bys"].add(upd_name)

        upd_date = c.updated_at or getattr(costing, "updated_at", None)
        if upd_date:
            entry["updated_dates"].append(upd_date)

        if not entry["item_code_ref_id"]:
            entry["item_code_ref_id"] = getattr(c, "item_code_id", None)
            entry["item_name"] = c.item_name or getattr(c.item_code, "item_name", "") or ""
            entry["item_category"] = (
                getattr(c.item_category, "name", "")
                or getattr(getattr(c.item_code, "item_category", None), "name", "")
                or ""
            )
            entry["item_type"] = _resolve_item_type_name(c)

    results = []
    for code in sorted(costing_by_code.keys()):
        info = costing_by_code[code]
        req_qty = info["requested_qty"]
        avail_phys = physical_by_code.get(code, Decimal("0"))
        avail_ord = po_by_code.get(code, Decimal("0"))

        # Physical stock available
        alloc_phys = min(req_qty, avail_phys)
        rem = req_qty - alloc_phys

        # Active POs placed
        alloc_ord = min(rem, avail_ord)
        to_order = rem - alloc_ord

        # Only include in Items to Order if to_order > 0
        if to_order > 0:
            if alloc_ord > 0:
                stock_status = "Partially Ordered"
            elif alloc_phys > 0:
                stock_status = "Partial Stock"
            else:
                stock_status = "No Stock"

            m = master_by_code.get(code)
            cat = info["item_category"] or (m.item_category.name if m and m.item_category else "") or "—"
            name = info["item_name"] or (m.item_name if m else "") or "—"
            combined = f"{code} _ {cat} _ {name}"

            ref_list = sorted(info.get("references", []))
            ref_str = ", ".join(ref_list) if ref_list else "—"

            prj_dict = info.get("projects", {})
            p_ids = [pid for pid in prj_dict.keys() if pid]
            p_names = [pname for pname in prj_dict.values() if pname]
            combined_prj_parts = []
            for pid, pname in sorted(prj_dict.items()):
                if pid and pname:
                    combined_prj_parts.append(f"{pid} _ {pname}")
                elif pid:
                    combined_prj_parts.append(pid)
                elif pname:
                    combined_prj_parts.append(pname)
            combined_project_str = ", ".join(combined_prj_parts) if combined_prj_parts else "—"
            project_id_str = ", ".join(sorted(p_ids)) if p_ids else "—"
            project_name_str = ", ".join(sorted(p_names)) if p_names else "—"

            req_by_list = sorted(info.get("requested_bys", []))
            req_by_str = ", ".join(req_by_list) if req_by_list else "—"

            req_dates = info.get("requested_dates", [])
            req_date_str = max(req_dates).strftime("%Y-%m-%d %H:%M") if req_dates else "—"

            upd_by_list = sorted(info.get("updated_bys", []))
            upd_by_str = ", ".join(upd_by_list) if upd_by_list else (req_by_str if req_by_str != "—" else "—")

            upd_dates = info.get("updated_dates", [])
            upd_date_str = max(upd_dates).strftime("%Y-%m-%d %H:%M") if upd_dates else (req_date_str if req_date_str != "—" else "—")

            results.append({
                "id": f"item-{code}",
                "item_id": info["item_code_ref_id"] or (m.pk if m else None),
                "item_code": code,
                "item_name": name,
                "item_category": cat,
                "item_type": info["item_type"] or "MATERIAL",
                "combined_item": combined,
                "combined_label": combined,
                "item_code_ref_id": info["item_code_ref_id"] or (m.pk if m else None),
                "stage": info["stage"],
                "reference_number": ref_str,
                "project_id": project_id_str,
                "project_name": project_name_str,
                "combined_project": combined_project_str,
                "requested_by": req_by_str,
                "requested_date": req_date_str,
                "updated_by": upd_by_str,
                "updated_on": upd_date_str,
                "requested_qty": f"{req_qty:.2f}",
                "purchase_qty": f"{alloc_phys:.2f}",
                "already_ordered_qty": f"{alloc_ord:.2f}",
                "order_qty": f"{to_order:.2f}",
                "stock_status": stock_status,
                "requests_count": info["count"],
            })

    return Response({
        "status": "success",
        "items": results,
        "total_items": len(results),
    }, status=status.HTTP_200_OK)
