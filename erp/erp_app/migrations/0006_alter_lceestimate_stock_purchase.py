from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0005_lceestimate"),
    ]

    operations = [
        migrations.AlterField(
            model_name="lceestimate",
            name="stock_purchase",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="lce_estimate",
                to="erp_app.stockpurchase",
            ),
        ),
    ]

