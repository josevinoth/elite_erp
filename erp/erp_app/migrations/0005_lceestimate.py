from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0004_lce_currency_master"),
    ]

    operations = [
        migrations.CreateModel(
            name="LCEEstimate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ex_works_material_cost", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("packing_charges", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("documentation", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("other_charges_1", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("other_charges_2", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("other_charges_3", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("other_charges_4", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("total_supplier_price", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("advance_payment_value", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("bank_exchange_rate", models.DecimalField(decimal_places=6, default=0, max_digits=14)),
                ("advance_payment_value_omr", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("balance_payment_value", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("balance_payment_value_omr", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("total_supplier_price_omr", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("bank_muscat_charge_advance_payment", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("bank_muscat_charge_balance_payment", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("freight_charge", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("customs_duty_omr", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("oman_customs_boe_charge_omr", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("rop_customs_inspection_charge", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("unloading_charge_muscat_stores_1", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("unloading_charge_muscat_stores_2", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("loading_charge_muscat_stores_delivery", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("total", models.DecimalField(decimal_places=3, default=0, max_digits=14)),
                ("created_by", models.CharField(blank=True, max_length=150)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("stock_purchase", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="lce_estimate", to="erp_app.stockpurchase")),
            ],
            options={
                "ordering": ["-updated_at", "-id"],
            },
        ),
    ]

