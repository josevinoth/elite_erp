from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0005_fix_task_legacy_columns_nullable"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="timesheet",
            name="uniq_timesheet_emp_task_billing_date",
        ),
        migrations.AddConstraint(
            model_name="timesheet",
            constraint=models.UniqueConstraint(
                fields=("employee_name", "task", "billing_date", "efforts"),
                name="uniq_timesheet_emp_task_bill_date_efforts",
            ),
        ),
    ]

