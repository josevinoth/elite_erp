from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0011_replace_itemreference_with_itemcodename"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="labfurnitureitem",
            unique_together={("item_name_ref", "item_category")},
        ),
        migrations.RemoveField(
            model_name="labfurnitureitem",
            name="item_code",
        ),
        migrations.RemoveField(
            model_name="labfurnitureitem",
            name="item_name",
        ),
    ]
