from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0009_itemreference_alter_labfurnitureitem_item_code_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="UPDATE erp_app_labfurnitureitem SET item_reference_id = NULL WHERE item_reference_id IS NOT NULL AND item_reference_id NOT IN (SELECT id FROM erp_app_itemreference)",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.AlterField(
            model_name="labfurnitureitem",
            name="item_reference",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="item_master_rows",
                to="erp_app.itemreference",
            ),
        ),
    ]

