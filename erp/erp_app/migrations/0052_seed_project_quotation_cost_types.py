from django.db import migrations


DEFAULT_COST_TYPES = [
    ("INSTALLATION", "Installation cost for project delivery and assembly work."),
    ("LOADING", "Loading cost associated with project quotation items."),
    ("LOCAL TRANSPORTATION", "Local transportation cost associated with project quotation items."),
    ("MATERIAL", "Material item sourced from Item Master and stock costing."),
    ("TRANSPORTATION", "Transportation cost associated with project quotation items."),
    ("UNLOADING", "Unloading cost associated with project quotation items."),
]


def seed_cost_types(apps, schema_editor):
    CostTypeInfo = apps.get_model("erp_app", "CostTypeInfo")

    for name, description in DEFAULT_COST_TYPES:
        existing = CostTypeInfo.objects.filter(name__iexact=name).order_by("id").first()
        if existing:
            existing.name = name
            existing.description = description
            existing.save(update_fields=["name", "description"])
            continue

        CostTypeInfo.objects.create(name=name, description=description)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0051_costtypeinfo_projectquotationiteminfo"),
    ]

    operations = [
        migrations.RunPython(seed_cost_types, noop_reverse),
    ]

