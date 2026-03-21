from django.db import models
from datetime import timedelta
from ..utils import normalize_text, to_title_case
from .project import Project


class Task(models.Model):
    project = models.ForeignKey(
        Project, null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks"
    )
    project_id_name = models.CharField(max_length=255, blank=True)
    proposal_date = models.DateField(null=True, blank=True)
    activity = models.CharField(max_length=255, blank=True)
    revision = models.CharField(max_length=50, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    no_of_days = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    drawn_by = models.CharField(max_length=255, blank=True)
    approved_by = models.CharField(max_length=255, blank=True)
    approved_date = models.DateField(null=True, blank=True)
    task_status = models.CharField(max_length=100, blank=True)
    project_owner = models.CharField(max_length=150, blank=True)
    remarks = models.TextField(blank=True)
    drawn_by_month = models.CharField(max_length=120, blank=True)
    approved_by_month = models.CharField(max_length=120, blank=True)
    updated_by = models.CharField(max_length=255, blank=True)
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
        self.activity = normalize_text(self.activity)
        self.revision = normalize_text(self.revision)
        self.drawn_by = to_title_case(self.drawn_by)
        self.approved_by = to_title_case(self.approved_by)
        self.task_status = to_title_case(self.task_status)
        self.project_owner = to_title_case(self.project_owner)
        self.remarks = normalize_text(self.remarks)
        self.drawn_by_month = normalize_text(self.drawn_by_month)
        self.approved_by_month = normalize_text(self.approved_by_month)
        self.updated_by = to_title_case(self.updated_by)

        if self.project_id:
            proj = self.project
            self.project_id_name = f"{proj.project_id}_{proj.project_name}"

        if self.start_date and self.end_date:
            self.no_of_days = self._calc_days_excluding_sunday(self.start_date, self.end_date)

        if self.end_date:
            self.drawn_by_month = self._format_month_week(self.end_date)

        if self.approved_date:
            self.approved_by_month = self._format_month_week(self.approved_date)

        super().save(*args, **kwargs)

