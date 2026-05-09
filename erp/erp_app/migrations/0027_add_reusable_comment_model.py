from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0026_add_cdc_team_expense_module"),
    ]

    operations = [
        migrations.CreateModel(
            name="Comment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("module_name", models.CharField(max_length=100)),
                ("record_id", models.PositiveIntegerField()),
                ("comment_datetime", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_by", models.CharField(max_length=255)),
                ("comments", models.TextField()),
                ("reference_link", models.URLField(blank=True, max_length=1000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-comment_datetime", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(fields=["module_name", "record_id"], name="erp_app_com_module__4378ff_idx"),
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(fields=["module_name", "record_id", "-comment_datetime"], name="erp_app_com_module__e2bcab_idx"),
        ),
    ]

