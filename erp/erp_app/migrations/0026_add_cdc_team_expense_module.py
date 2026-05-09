import os
import re
from datetime import date, datetime

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def _normalize_text(value):
    if value in (None, ""):
        return ""
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s*([-_])\s*", r"\1", text)
    return text


def _to_title_case(value):
    text = _normalize_text(value)
    return text.title() if text else ""


def _to_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def seed_cdc_expense_module(apps, schema_editor):
    ExpenseItem = apps.get_model("erp_app", "ExpenseItem")
    ExpenseStatusOption = apps.get_model("erp_app", "ExpenseStatusOption")
    ExpenseSession = apps.get_model("erp_app", "ExpenseSession")
    CDCTeamExpense = apps.get_model("erp_app", "CDCTeamExpense")
    UserProfile = apps.get_model("erp_app", "UserProfile")

    for status_name in ["Paid", "Pending", "Unpaid"]:
        ExpenseStatusOption.objects.get_or_create(name=status_name)

    excel_path = os.path.join(str(settings.BASE_DIR), "erp_app", "media", "expense.xlsx")
    if not os.path.exists(excel_path):
        return

    try:
        import openpyxl
    except ImportError:
        return

    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb.active

    cdc_user_lookup = {
        profile.user.username.strip().lower(): profile.user_id
        for profile in UserProfile.objects.select_related("user", "team").filter(
            team__name__iexact="CDC Team",
            user__is_active=True,
        )
        if profile.user_id and profile.user
    }

    imported_any = False
    for row in ws.iter_rows(min_row=2, values_only=True):
        expense_date_raw = row[0] if len(row) > 0 else None
        item_raw = row[1] if len(row) > 1 else None
        session_raw = row[2] if len(row) > 2 else None
        qty_raw = row[3] if len(row) > 3 else None
        price_raw = row[4] if len(row) > 4 else None
        status_raw = row[6] if len(row) > 6 else None
        paid_by_raw = row[7] if len(row) > 7 else None
        settled_on_raw = row[8] if len(row) > 8 else None
        settled_by_raw = row[9] if len(row) > 9 else None

        if not any([expense_date_raw, item_raw, session_raw, qty_raw, price_raw, status_raw, paid_by_raw, settled_on_raw, settled_by_raw]):
            continue

        item_name = _to_title_case(item_raw)
        session_name = _to_title_case(session_raw)
        status_name = _to_title_case(status_raw) or "Pending"
        if not item_name or not session_name:
            continue

        item_obj, _ = ExpenseItem.objects.get_or_create(name=item_name)
        session_obj, _ = ExpenseSession.objects.get_or_create(name=session_name)
        status_obj, _ = ExpenseStatusOption.objects.get_or_create(name=status_name)

        settled_by_id = None
        settled_by_key = _normalize_text(settled_by_raw).lower()
        if settled_by_key:
            settled_by_id = cdc_user_lookup.get(settled_by_key)

        qty = int(qty_raw or 0)
        price = int(price_raw or 0)
        CDCTeamExpense.objects.create(
            expense_date=_to_date(expense_date_raw),
            item_id=item_obj.id,
            session_id=session_obj.id,
            qty=max(qty, 0),
            price=max(price, 0),
            total_cost=max(qty, 0) * max(price, 0),
            status_id=status_obj.id,
            paid_by=_normalize_text(paid_by_raw),
            settled_on=_to_date(settled_on_raw),
            settled_by_id=settled_by_id,
            updated_by="System Import",
        )
        imported_any = True

    if not imported_any:
        # Ensure common defaults exist even if workbook has no importable rows.
        for item_name in ["Water Can", "Tea", "Lunch"]:
            ExpenseItem.objects.get_or_create(name=item_name)
        for session_name in ["Morning", "Evening"]:
            ExpenseSession.objects.get_or_create(name=session_name)


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0025_move_proposal_date_from_task_to_project"),
    ]

    operations = [
        migrations.CreateModel(
            name="ExpenseItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, unique=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="ExpenseSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, unique=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="ExpenseStatusOption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, unique=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="CDCTeamExpense",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("expense_date", models.DateField(blank=True, null=True)),
                ("qty", models.PositiveIntegerField(default=0)),
                ("price", models.PositiveIntegerField(default=0)),
                ("total_cost", models.PositiveIntegerField(default=0)),
                ("paid_by", models.CharField(blank=True, max_length=255)),
                ("settled_on", models.DateField(blank=True, null=True)),
                ("updated_by", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("item", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="cdc_team_expenses", to="erp_app.expenseitem")),
                ("session", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="cdc_team_expenses", to="erp_app.expensesession")),
                ("settled_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="cdc_team_expenses_settled", to=settings.AUTH_USER_MODEL)),
                ("status", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="cdc_team_expenses", to="erp_app.expensestatusoption")),
            ],
            options={"ordering": ["-expense_date", "-created_at"]},
        ),
        migrations.RunPython(seed_cdc_expense_module, reverse_noop),
    ]

