from django.core.management.base import BaseCommand, CommandError

from ...sub_models import CDCTeamExpense
from ...utils import normalize_text


class Command(BaseCommand):
    help = (
        "Import expense dates for all CDC Team Expence rows from expense.xlsx "
        "using import row order (rows with both Item and Session)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default="erp_app/media/expense.xlsx",
            help="Path to the source Excel file.",
        )

    @staticmethod
    def _to_date(value):
        if value in (None, ""):
            return None
        try:
            import datetime as _dt

            if isinstance(value, _dt.datetime):
                return value.date()
            if isinstance(value, _dt.date):
                return value

            text = str(value).strip()
            if not text:
                return None

            # Strict ISO first.
            try:
                return _dt.date.fromisoformat(text[:10])
            except ValueError:
                pass

            # Common manual Excel/text formats.
            for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y", "%d %b %Y"):
                try:
                    return _dt.datetime.strptime(text, fmt).date()
                except ValueError:
                    continue

            return None
        except Exception:
            return None

    def handle(self, *args, **options):
        source_path = options["file"]

        try:
            from openpyxl import load_workbook
        except ImportError as exc:
            raise CommandError("openpyxl is required. Install it with: pip install openpyxl") from exc

        try:
            wb = load_workbook(source_path, data_only=True)
        except FileNotFoundError as exc:
            raise CommandError(f"File not found: {source_path}") from exc
        except Exception as exc:
            raise CommandError(f"Could not open workbook: {exc}") from exc

        ws = wb.active

        excel_dates = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            item = normalize_text(row[1] if len(row) > 1 else "")
            session = normalize_text(row[2] if len(row) > 2 else "")
            if not item or not session:
                continue

            expense_date = self._to_date(row[0] if len(row) > 0 else None)
            # Ignore source rows that do not have a usable expense date.
            if not expense_date:
                continue

            excel_dates.append(expense_date)

        expense_rows = list(CDCTeamExpense.objects.order_by("id"))

        updated = 0
        for index, obj in enumerate(expense_rows):
            if index >= len(excel_dates):
                break
            next_date = excel_dates[index]
            if obj.expense_date == next_date:
                continue
            obj.expense_date = next_date
            obj.save(update_fields=["expense_date"])
            updated += 1

        without_source = max(len(expense_rows) - len(excel_dates), 0)
        extra_excel_rows = max(len(excel_dates) - len(expense_rows), 0)
        null_dates_after = CDCTeamExpense.objects.filter(expense_date__isnull=True).count()

        self.stdout.write(self.style.SUCCESS("CDC Team Expence date backfill completed."))
        self.stdout.write(f"Excel source rows (item+session): {len(excel_dates)}")
        self.stdout.write(f"Expense rows in database         : {len(expense_rows)}")
        self.stdout.write(f"Rows updated                     : {updated}")
        self.stdout.write(f"Rows without source date         : {without_source}")
        self.stdout.write(f"Extra excel source rows          : {extra_excel_rows}")
        self.stdout.write(f"Rows still with NULL date        : {null_dates_after}")

