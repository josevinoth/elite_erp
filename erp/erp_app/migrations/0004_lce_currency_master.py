from django.db import migrations, models
import django.db.models.deletion


SEED_CURRENCIES = [
    ("Oman", "OMR", "Omani Rial", 10),
    ("United States", "USD", "US Dollar", 20),
    ("Eurozone", "EUR", "Euro", 30),
    ("United Kingdom", "GBP", "Pound Sterling", 40),
    ("India", "INR", "Indian Rupee", 50),
    ("United Arab Emirates", "AED", "UAE Dirham", 60),
    ("Saudi Arabia", "SAR", "Saudi Riyal", 70),
    ("Qatar", "QAR", "Qatari Riyal", 80),
    ("Kuwait", "KWD", "Kuwaiti Dinar", 90),
    ("Bahrain", "BHD", "Bahraini Dinar", 100),
    ("China", "CNY", "Chinese Yuan", 110),
    ("Japan", "JPY", "Japanese Yen", 120),
    ("Singapore", "SGD", "Singapore Dollar", 130),
    ("Malaysia", "MYR", "Malaysian Ringgit", 140),
    ("Australia", "AUD", "Australian Dollar", 150),
    ("Canada", "CAD", "Canadian Dollar", 160),
    ("Global", "FOREIGN", "Foreign Currency", 170),
    ("Global", "RATE", "Rate", 180),
]


def _normalize_text(value):
    return " ".join(str(value or "").strip().split())


def seed_currency_master_and_map_lce(apps, schema_editor):
    CountryCurrency = apps.get_model("erp_app", "CountryCurrency")
    LCECostDetail = apps.get_model("erp_app", "LCECostDetail")

    for country_name, code, currency_name, sort_order in SEED_CURRENCIES:
        CountryCurrency.objects.update_or_create(
            currency_code=code,
            defaults={
                "country_name": country_name,
                "currency_name": currency_name,
                "sort_order": sort_order,
                "is_active": True,
            },
        )

    code_lookup = {
        row.currency_code.upper(): row
        for row in CountryCurrency.objects.all()
    }

    for detail in LCECostDetail.objects.all().iterator():
        old_value = _normalize_text(getattr(detail, "currency", "")).upper()
        selected = code_lookup.get(old_value)

        if selected is None and old_value:
            selected = (
                CountryCurrency.objects.filter(currency_name__iexact=old_value).first()
                or CountryCurrency.objects.filter(currency_name__icontains=old_value).first()
            )

        if selected is None:
            selected = code_lookup.get("OMR")

        detail.currency_option_id = selected.id if selected else None
        detail.save(update_fields=["currency_option"])


def unseed_currency_master_and_map_lce(apps, schema_editor):
    CountryCurrency = apps.get_model("erp_app", "CountryCurrency")
    LCECostDetail = apps.get_model("erp_app", "LCECostDetail")

    for detail in LCECostDetail.objects.select_related("currency_option").all().iterator():
        code = ""
        if detail.currency_option_id:
            code = _normalize_text(detail.currency_option.currency_code).upper()
        detail.currency = code
        detail.save(update_fields=["currency"])

    CountryCurrency.objects.filter(currency_code__in=[row[1] for row in SEED_CURRENCIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0003_itemcategory_alter_labfurnitureitem_options_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="CountryCurrency",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("country_name", models.CharField(max_length=120)),
                ("currency_code", models.CharField(max_length=12, unique=True)),
                ("currency_name", models.CharField(max_length=80)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["sort_order", "country_name", "currency_code"]},
        ),
        migrations.AddField(
            model_name="lcecostdetail",
            name="currency_option",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="erp_app.countrycurrency"),
        ),
        migrations.RunPython(seed_currency_master_and_map_lce, unseed_currency_master_and_map_lce),
        migrations.RemoveField(
            model_name="lcecostdetail",
            name="currency",
        ),
        migrations.RenameField(
            model_name="lcecostdetail",
            old_name="currency_option",
            new_name="currency",
        ),
        migrations.AlterField(
            model_name="lcecostdetail",
            name="currency",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="lce_cost_details", to="erp_app.countrycurrency"),
        ),
    ]

