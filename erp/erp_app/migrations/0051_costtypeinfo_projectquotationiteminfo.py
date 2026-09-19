from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Placeholder for a historical migration omitted from this workspace.

    The live database is expected to already contain the schema changes from
    the original migration history; this file only restores a valid graph.
    """

    dependencies = [
        ("erp_app", "0007_projectlayoutdrawing_projectlayoutdrawingattachment"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="StockStatusInfo",
                    fields=[
                        ("id", models.AutoField(primary_key=True, serialize=False)),
                        ("status_name", models.CharField(max_length=50, unique=True)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                    ],
                ),
                migrations.CreateModel(
                    name="RetrievalStatusInfo",
                    fields=[
                        ("id", models.AutoField(primary_key=True, serialize=False)),
                        ("status_name", models.CharField(max_length=50, unique=True)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                    ],
                ),
                migrations.CreateModel(
                    name="Vendor",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("name", models.CharField(max_length=200, unique=True)),
                        ("email", models.CharField(blank=True, max_length=254)),
                    ],
                ),
                migrations.CreateModel(
                    name="ProjectQuotationSummaryInfo",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                    ],
                ),
                migrations.CreateModel(
                    name="ProjectCostingSummaryInfo",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                    ],
                ),
                migrations.CreateModel(
                    name="ProjectCostingItemInfo",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("stock_status", models.ForeignKey(blank=True, null=True, on_delete=models.PROTECT, to="erp_app.stockstatusinfo")),
                        (
                            "retrieval_status",
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=models.PROTECT,
                                related_name="project_costing_items",
                                to="erp_app.retrievalstatusinfo",
                            ),
                        ),
                    ],
                ),
                migrations.CreateModel(
                    name="ProjectQuotationItemInfo",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                        ("stock_status", models.ForeignKey(blank=True, null=True, on_delete=models.PROTECT, to="erp_app.stockstatusinfo")),
                    ],
                ),
            ],
        ),
    ]
