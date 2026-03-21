from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

DEFAULT_STATUSES = ["Active", "Inactive", "New Registration"]


def seed_statuses_and_profiles(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserStatusOption = apps.get_model("erp_app", "UserStatusOption")
    UserProfile = apps.get_model("erp_app", "UserProfile")

    status_map = {}
    for name in DEFAULT_STATUSES:
        status_obj, _ = UserStatusOption.objects.get_or_create(name=name)
        status_map[name] = status_obj

    for user in User.objects.all():
        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.status_id:
            continue
        profile.status = status_map["Active"] if user.is_active else status_map["Inactive"]
        profile.save(update_fields=["status"])


class Migration(migrations.Migration):
    dependencies = [
        ("erp_app", "0017_move_order_value_from_task_to_project"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserStatusOption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, unique=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "status",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="user_profiles",
                        to="erp_app.userstatusoption",
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.RunPython(seed_statuses_and_profiles, migrations.RunPython.noop),
    ]
