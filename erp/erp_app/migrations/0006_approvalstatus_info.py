from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Placeholder for the historical 0006 migration.

    This repository snapshot is missing a portion of the original migration
    history. Keeping this no-op node preserves the dependency chain for
    databases that already have the historical schema in place.
    """

    initial = True

    dependencies = []

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="ApprovalStatus_info",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                    ],
                ),
                migrations.CreateModel(
                    name="Project",
                    fields=[
                        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                    ],
                ),
            ],
        ),
    ]
