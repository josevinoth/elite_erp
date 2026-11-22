from django.db import migrations, models
import django.db.models.deletion


def forward_copy_item_reference(apps, schema_editor):
    ItemReference = apps.get_model("erp_app", "ItemReference")
    ItemCodeName = apps.get_model("erp_app", "ItemCodeName")
    LabFurnitureItem = apps.get_model("erp_app", "LabFurnitureItem")

    lookup_by_old_id = {}
    for row in ItemReference.objects.all().order_by("id"):
        lookup, _ = ItemCodeName.objects.get_or_create(
            item_code=row.code,
            defaults={"item_name": row.name},
        )
        if lookup.item_name != row.name:
            lookup.item_name = row.name
            lookup.save(update_fields=["item_name"])
        lookup_by_old_id[row.id] = lookup.id

    for item in LabFurnitureItem.objects.all().order_by("id"):
        new_lookup_id = lookup_by_old_id.get(getattr(item, "item_reference_id", None))
        if not new_lookup_id:
            continue
        item.item_code_ref_id = new_lookup_id
        item.item_name_ref_id = new_lookup_id
        item.save(update_fields=["item_code_ref", "item_name_ref"])


def reverse_copy_item_reference(apps, schema_editor):
    ItemReference = apps.get_model("erp_app", "ItemReference")
    ItemCodeName = apps.get_model("erp_app", "ItemCodeName")
    LabFurnitureItem = apps.get_model("erp_app", "LabFurnitureItem")

    ref_by_lookup_id = {}
    for row in ItemCodeName.objects.all().order_by("id"):
        reference, _ = ItemReference.objects.get_or_create(
            code=row.item_code,
            defaults={"name": row.item_name},
        )
        if reference.name != row.item_name:
            reference.name = row.item_name
            reference.save(update_fields=["name"])
        ref_by_lookup_id[row.id] = reference.id

    for item in LabFurnitureItem.objects.all().order_by("id"):
        old_ref_id = ref_by_lookup_id.get(getattr(item, "item_code_ref_id", None))
        if not old_ref_id:
            continue
        item.item_reference_id = old_ref_id
        item.save(update_fields=["item_reference"])


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0010_alter_labfurnitureitem_item_reference_required"),
    ]

    operations = [
        migrations.CreateModel(
            name="ItemCodeName",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_code", models.CharField(max_length=20, unique=True)),
                ("item_name", models.CharField(max_length=255, unique=True)),
            ],
            options={"ordering": ["item_code"]},
        ),
        migrations.AddField(
            model_name="labfurnitureitem",
            name="item_code_ref",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="item_master_code_rows", to="erp_app.itemcodename"),
        ),
        migrations.AddField(
            model_name="labfurnitureitem",
            name="item_name_ref",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="item_master_name_rows", to="erp_app.itemcodename"),
        ),
        migrations.RunPython(forward_copy_item_reference, reverse_copy_item_reference),
        migrations.AlterField(
            model_name="labfurnitureitem",
            name="item_code_ref",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="item_master_code_rows", to="erp_app.itemcodename"),
        ),
        migrations.AlterField(
            model_name="labfurnitureitem",
            name="item_name_ref",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="item_master_name_rows", to="erp_app.itemcodename"),
        ),
        migrations.RemoveField(
            model_name="labfurnitureitem",
            name="item_reference",
        ),
        migrations.DeleteModel(
            name="ItemReference",
        ),
    ]

