from django.db import models
from django.conf import settings
from datetime import date as _date, timedelta
from ..utils import normalize_text
from .activity import Activity
from .project import Project
from .task_status_option import TaskStatusOption


def _coerce_date(value):
    """Return a datetime.date or None; accepts date objects and ISO strings."""
    if not value:
        return None
    if isinstance(value, _date):
        return value
    try:
        return _date.fromisoformat(str(value).split(" ")[0])
    except (ValueError, AttributeError):
        return None


class Task(models.Model):
    project = models.ForeignKey(
        Project, null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks"
    )
    project_id_name = models.CharField(max_length=255, blank=True)
    activity = models.ForeignKey(
        Activity,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tasks",
    )
    revision = models.CharField(max_length=50, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    no_of_days = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    drawn_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tasks_drawn",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tasks_approved",
    )
    approved_date = models.DateField(null=True, blank=True)
    task_status = models.ForeignKey(
        TaskStatusOption,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tasks",
    )
    project_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tasks_owned",
    )
    remarks = models.TextField(blank=True)
    drawn_by_month = models.CharField(max_length=120, blank=True)
    approved_by_month = models.CharField(max_length=120, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tasks_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]

    def __str__(self):
        return self.project_id_name or f"Task {self.pk}"

    @staticmethod
    def _format_month_week(value):
        week = value.isocalendar()[1]
        return f"{value.strftime('%b %y')} - Wk {week}"

    @staticmethod
    def _calc_days_excluding_sunday(start_date, end_date):
        if start_date == end_date:
            return 1

        if end_date < start_date:
            start_date, end_date = end_date, start_date

        current = start_date
        days = 0
        while current <= end_date:
            if current.weekday() != 6:
                days += 1
            current += timedelta(days=1)

        return max(days, 1)

    def save(self, *args, **kwargs):
        self.project_id_name = normalize_text(self.project_id_name)
        self.revision = normalize_text(self.revision)
        self.remarks = normalize_text(self.remarks)
        self.drawn_by_month = normalize_text(self.drawn_by_month)
        self.approved_by_month = normalize_text(self.approved_by_month)

        if self.project_id:
            proj = self.project
            self.project_id_name = f"{proj.project_id}_{proj.project_name}"

        # Normalise date fields so they are always datetime.date or None
        start = _coerce_date(self.start_date)
        end = _coerce_date(self.end_date)
        approved = _coerce_date(self.approved_date)
        self.start_date = start
        self.end_date = end
        self.approved_date = approved

        if start and end:
            self.no_of_days = self._calc_days_excluding_sunday(start, end)

        if end:
            self.drawn_by_month = self._format_month_week(end)

        if approved:
            self.approved_by_month = self._format_month_week(approved)

        super().save(*args, **kwargs)

