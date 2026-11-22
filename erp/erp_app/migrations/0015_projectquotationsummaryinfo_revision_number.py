from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0014_alter_projectcostingsummaryinfo_quotation_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectquotationsummaryinfo",
            name="revision_number",
            field=models.IntegerField(default=1),
        ),
    ]

