from django.db import migrations, models
import django.db.models.deletion


def backfill_vendor_codes(apps, schema_editor):
    Vendor = apps.get_model("erp_app", "Vendor")
    for vendor in Vendor.objects.filter(vendor_code__isnull=True).order_by("id"):
        vendor.vendor_code = f"VC_{10000 + int(vendor.id)}"
        vendor.save(update_fields=["vendor_code"])


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0068_project_costing_financial_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="vendor",
            name="vendor_code",
            field=models.CharField(blank=True, db_index=True, max_length=20, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name="vendor",
            name="name",
            field=models.CharField(max_length=200, unique=True),
        ),
        migrations.AlterField(
            model_name="vendor",
            name="email",
            field=models.CharField(blank=True, max_length=254),
        ),
        migrations.RunPython(backfill_vendor_codes, migrations.RunPython.noop),
        migrations.CreateModel(
            name="PlaceStockOrderInfo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order_code", models.CharField(blank=True, db_index=True, max_length=20, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("costing", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="placed_stock_orders", to="erp_app.projectcostingsummaryinfo")),
                ("vendor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="placed_stock_orders", to="erp_app.vendor")),
            ],
            options={
                "ordering": ["-id"],
            },
        ),
        migrations.CreateModel(
            name="PlaceStockOrderItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("costing_item", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="place_order_links", to="erp_app.projectcostingiteminfo")),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="erp_app.placestockorderinfo")),
            ],
            options={
                "ordering": ["id"],
                "unique_together": {("order", "costing_item")},
            },
        ),
    ]


