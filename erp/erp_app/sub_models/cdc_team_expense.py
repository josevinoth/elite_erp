from django.contrib.auth.models import User
from django.db import models

from ..utils import normalize_text
from .expense_item import ExpenseItem
from .expense_session import ExpenseSession
from .expense_status_option import ExpenseStatusOption


class CDCTeamExpense(models.Model):
    expense_date = models.DateField(null=True, blank=True)
    item = models.ForeignKey(
        ExpenseItem,
        on_delete=models.PROTECT,
        related_name="cdc_team_expenses",
    )
    session = models.ForeignKey(
        ExpenseSession,
        on_delete=models.PROTECT,
        related_name="cdc_team_expenses",
    )
    qty = models.PositiveIntegerField(default=0)
    price = models.PositiveIntegerField(default=0)
    total_cost = models.PositiveIntegerField(default=0)
    status = models.ForeignKey(
        ExpenseStatusOption,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cdc_team_expenses",
    )
    paid_by = models.CharField(max_length=255, blank=True)
    settled_on = models.DateField(null=True, blank=True)
    settled_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cdc_team_expenses_settled",
    )
    updated_by = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-expense_date", "-created_at"]

    def __str__(self):
        return f"{self.item} - {self.expense_date or 'No Date'}"

    def save(self, *args, **kwargs):
        self.paid_by = normalize_text(self.paid_by)
        self.updated_by = normalize_text(self.updated_by)
        self.qty = max(int(self.qty or 0), 0)
        self.price = max(int(self.price or 0), 0)
        self.total_cost = self.qty * self.price
        super().save(*args, **kwargs)

