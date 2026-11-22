from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0015_projectquotationsummaryinfo_revision_number"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="projectquotationsummaryinfo",
            options={
                "ordering": ["project_id", "revision_number", "id"],
                "verbose_name": "Project Quotation Summary",
                "verbose_name_plural": "Project Quotation Summaries",
            },
        ),
    ]

