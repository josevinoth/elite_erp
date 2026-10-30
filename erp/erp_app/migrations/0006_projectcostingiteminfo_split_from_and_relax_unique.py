from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0005_projectcostingitemallocation_pending_return_qty_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectcostingiteminfo",
            name="split_from",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="split_items",
                to="erp_app.projectcostingiteminfo",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="projectcostingiteminfo",
            unique_together=set(),
        ),
    ]

