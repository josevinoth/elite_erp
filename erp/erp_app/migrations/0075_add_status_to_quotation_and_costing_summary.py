from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0074_dedupe_retrieval_statuses"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectquotationsummaryinfo",
            name="status",
            field=models.CharField(
                choices=[
                    ("Work In Progress", "Work In Progress"),
                    ("Completed", "Completed"),
                    ("Hold", "Hold"),
                    ("Cancelled", "Cancelled"),
                ],
                default="Work In Progress",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="projectcostingsummaryinfo",
            name="status",
            field=models.CharField(
                choices=[
                    ("Work In Progress", "Work In Progress"),
                    ("Completed", "Completed"),
                    ("Hold", "Hold"),
                    ("Cancelled", "Cancelled"),
                ],
                default="Work In Progress",
                max_length=32,
            ),
        ),
    ]

