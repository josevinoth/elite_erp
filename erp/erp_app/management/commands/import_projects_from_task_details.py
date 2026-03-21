import re
from datetime import date, datetime

from django.core.management.base import BaseCommand, CommandError

from ...sub_models import Project, ProjectStatusOption
from ...utils import normalize_text, to_title_case


class Command(BaseCommand):
    help = (
        "Import unique projects from task_details.xlsx using column B (Project No) "
        "and column C (Project Name), with status from column Q."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default="erp_app/media/task_details.xlsx",
            help="Path to the source Excel file.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and preview import without writing to database.",
        )

    @staticmethod
    def _clean_text(value):
        if value in (None, ""):
            return ""
        text = str(value)
        text = text.strip()
        text = re.sub(r"\s+", " ", text)
        text = re.sub(r"\s*-\s*", "-", text)
        return text

    def _normalize_for_store(self, value):
        return normalize_text(self._clean_text(value))

    @staticmethod
    def _parse_excel_date(value):
        if value in (None, ""):
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        text = str(value).strip()
        if not text:
            return None

        # Try strict ISO first.
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            pass

        # Common fallback formats found in manual Excel entries.
        for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y", "%d %b %Y"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue
        return None

    def handle(self, *args, **options):
        source_path = options["file"]
        dry_run = options["dry_run"]

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

        existing_keys = set()
        for p in Project.objects.all():
            key = (
                self._normalize_for_store(p.project_id).casefold(),
                self._normalize_for_store(p.project_name).casefold(),
            )
            existing_keys.add(key)

        # Cache status options by normalized name to avoid repeated DB hits.
        status_cache = {
            opt.name.casefold(): opt for opt in ProjectStatusOption.objects.all()
        }

        seen_in_file = set()
        to_create = []
        skipped_empty_project_id = 0
        skipped_duplicate = 0

        # Data rows start at 2; B=2 (project_id), C=3 (project_name), M=13 (approved date), Q=17 (status)
        for row in range(2, ws.max_row + 1):
            raw_project_id = ws.cell(row=row, column=2).value
            raw_project_name = ws.cell(row=row, column=3).value
            raw_approved_date = ws.cell(row=row, column=13).value
            raw_status = ws.cell(row=row, column=17).value

            project_id = self._normalize_for_store(raw_project_id)
            project_name = self._normalize_for_store(raw_project_name)
            approved_date = self._parse_excel_date(raw_approved_date)
            status_name = to_title_case(raw_status)

            status_obj = None
            if status_name:
                status_key = status_name.casefold()
                status_obj = status_cache.get(status_key)
                if status_obj is None:
                    status_obj, _ = ProjectStatusOption.objects.get_or_create(name=status_name)
                    status_cache[status_key] = status_obj

            if not project_id:
                skipped_empty_project_id += 1
                continue

            key = (project_id.casefold(), project_name.casefold())
            if key in seen_in_file or key in existing_keys:
                skipped_duplicate += 1
                continue

            seen_in_file.add(key)
            to_create.append(
                Project(
                    project_id=project_id,
                    project_name=project_name,
                    expected_customer_need_date=approved_date,
                    description="",
                    status=status_obj,
                )
            )

        created = 0
        if to_create and not dry_run:
            Project.objects.bulk_create(to_create)
            created = len(to_create)

        self.stdout.write(self.style.SUCCESS("Project import completed."))
        self.stdout.write(f"Source file: {source_path}")
        self.stdout.write(f"Rows scanned: {max(ws.max_row - 1, 0)}")
        self.stdout.write(f"Prepared unique rows: {len(to_create)}")
        self.stdout.write(f"Skipped (empty Project ID): {skipped_empty_project_id}")
        self.stdout.write(f"Skipped (duplicate, case-insensitive): {skipped_duplicate}")
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run only. No database changes were made."))
        else:
            self.stdout.write(f"Created projects: {created}")

