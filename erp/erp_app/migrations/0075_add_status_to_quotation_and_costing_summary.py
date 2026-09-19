from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0074_dedupe_retrieval_statuses"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                    ALTER TABLE erp_app_projectquotationsummaryinfo
                    ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'Work In Progress';
                    ALTER TABLE erp_app_projectcostingsummaryinfo
                    ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'Work In Progress';
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
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
            ],
        ),
    ]

