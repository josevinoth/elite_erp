from django.db import migrations


class Migration(migrations.Migration):
    """
    Placeholder for the historical financial-fields migration.

    This keeps later migrations loadable in environments where the earlier
    schema already exists but the source migration file is no longer present.
    """

    dependencies = [
        ("erp_app", "0052_seed_project_quotation_cost_types"),
    ]

    operations = []
