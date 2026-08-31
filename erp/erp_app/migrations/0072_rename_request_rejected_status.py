from django.db import migrations


def rename_request_rejected_status(apps, schema_editor):
    RetrievalStatusInfo = apps.get_model("erp_app", "RetrievalStatusInfo")
    old_label = "Request Rejected"
    new_label = "Item Rejected"

    target = RetrievalStatusInfo.objects.filter(status_name__iexact=new_label).first()
    if target:
        RetrievalStatusInfo.objects.filter(status_name__iexact=old_label).exclude(pk=target.pk).delete()
        return

    old_status = RetrievalStatusInfo.objects.filter(status_name__iexact=old_label).first()
    if old_status:
        old_status.status_name = new_label
        old_status.save(update_fields=["status_name"])


def rename_item_rejected_status_back(apps, schema_editor):
    RetrievalStatusInfo = apps.get_model("erp_app", "RetrievalStatusInfo")
    old_label = "Request Rejected"
    new_label = "Item Rejected"

    target = RetrievalStatusInfo.objects.filter(status_name__iexact=old_label).first()
    if target:
        RetrievalStatusInfo.objects.filter(status_name__iexact=new_label).exclude(pk=target.pk).delete()
        return

    new_status = RetrievalStatusInfo.objects.filter(status_name__iexact=new_label).first()
    if new_status:
        new_status.status_name = old_label
        new_status.save(update_fields=["status_name"])


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0071_project_costing_request_tracking"),
    ]

    operations = [
        migrations.RunPython(rename_request_rejected_status, rename_item_rejected_status_back),
    ]

