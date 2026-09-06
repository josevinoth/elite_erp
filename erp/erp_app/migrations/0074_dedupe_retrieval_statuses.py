from django.db import migrations


def dedupe_retrieval_statuses(apps, _schema_editor):
    RetrievalStatusInfo = apps.get_model("erp_app", "RetrievalStatusInfo")
    ProjectCostingItemInfo = apps.get_model("erp_app", "ProjectCostingItemInfo")

    canonical_statuses = [
        "No Action",
        "Item Requested",
        "Item Supplied",
        "Item Rejected",
        "Item Accepted",
        "Item Return",
        "Item Return Accepted",
    ]

    for canonical_name in canonical_statuses:
        canonical_obj = RetrievalStatusInfo.objects.filter(status_name=canonical_name).order_by("id").first()
        if not canonical_obj:
            canonical_obj = RetrievalStatusInfo.objects.filter(status_name__iexact=canonical_name).order_by("id").first()
        if not canonical_obj:
            canonical_obj = RetrievalStatusInfo.objects.create(status_name=canonical_name)
        elif canonical_obj.status_name != canonical_name:
            canonical_obj.status_name = canonical_name
            canonical_obj.save(update_fields=["status_name"])

        duplicate_ids = list(
            RetrievalStatusInfo.objects.filter(status_name__iexact=canonical_name)
            .exclude(pk=canonical_obj.pk)
            .values_list("id", flat=True)
        )
        if duplicate_ids:
            ProjectCostingItemInfo.objects.filter(retrieval_status_id__in=duplicate_ids).update(retrieval_status_id=canonical_obj.pk)
            RetrievalStatusInfo.objects.filter(pk__in=duplicate_ids).delete()

    alias_rows = list(RetrievalStatusInfo.objects.filter(status_name__iexact="Request Rejected").values_list("id", flat=True))
    if alias_rows:
        canonical_obj = RetrievalStatusInfo.objects.filter(status_name__iexact="Item Rejected").order_by("id").first()
        if not canonical_obj:
            canonical_obj = RetrievalStatusInfo.objects.create(status_name="Item Rejected")
        ProjectCostingItemInfo.objects.filter(retrieval_status_id__in=alias_rows).update(retrieval_status_id=canonical_obj.pk)
        RetrievalStatusInfo.objects.filter(pk__in=alias_rows).exclude(pk=canonical_obj.pk).delete()


def noop_reverse(_apps, _schema_editor):
    return None


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0073_project_owner_on_project"),
    ]

    operations = [
        migrations.RunPython(dedupe_retrieval_statuses, noop_reverse),
    ]

