from django.conf import settings
from django.db import migrations, models


def seed_request_rejected_status(apps, schema_editor):
    RetrievalStatusInfo = apps.get_model("erp_app", "RetrievalStatusInfo")
    RetrievalStatusInfo.objects.get_or_create(status_name="Request Rejected")


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0070_normalize_not_purchased_stock_status"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="projectcostingiteminfo",
            name="rejection_comment",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="projectcostingiteminfo",
            name="requested_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="requested_project_costing_items",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="projectcostingiteminfo",
            name="requested_on",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(seed_request_rejected_status, migrations.RunPython.noop),
    ]

