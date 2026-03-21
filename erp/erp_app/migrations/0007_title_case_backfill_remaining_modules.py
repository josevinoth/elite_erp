from django.db import migrations


def _to_title_case(value):
    if value in (None, ""):
        return ""
    return str(value).strip().replace("_", " ").title()


def _normalize_rows(model, fields):
    for obj in model.objects.all():
        changed = []
        for field in fields:
            current = getattr(obj, field)
            normalized = _to_title_case(current)
            if current != normalized:
                setattr(obj, field, normalized)
                changed.append(field)
        if changed:
            obj.save(update_fields=changed)


def forwards(apps, schema_editor):
    vendor_model = apps.get_model("erp_app", "Vendor")
    project_model = apps.get_model("erp_app", "Project")
    stock_purchase_model = apps.get_model("erp_app", "StockPurchase")
    stock_maintenance_model = apps.get_model("erp_app", "StockMaintenance")

    _normalize_rows(
        vendor_model,
        ["name", "contact_person", "email", "phone", "address"],
    )

    _normalize_rows(
        project_model,
        ["name", "description", "client_name", "status"],
    )

    _normalize_rows(
        stock_purchase_model,
        ["item_name", "category", "vendor", "unit", "invoice_number", "notes"],
    )

    _normalize_rows(
        stock_maintenance_model,
        ["item_name", "category", "movement_type", "unit", "location", "notes"],
    )


def noop_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):
    dependencies = [
        ("erp_app", "0006_task_title_case_backfill"),
    ]

    operations = [
        migrations.RunPython(forwards, noop_reverse),
    ]

