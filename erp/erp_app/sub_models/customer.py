from django.db import models
from ..utils import normalize_text


class Customer(models.Model):
    customer_code = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True)
    name = models.CharField(max_length=200, unique=True)
    contact_number = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    email = models.CharField(max_length=254, blank=True)
    updated_by = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.customer_code or '-'} - {self.name}"

    @property
    def customer_name(self):
        return self.name

    @customer_name.setter
    def customer_name(self, value):
        self.name = value

    @property
    def phone(self):
        return self.contact_number

    @phone.setter
    def phone(self, value):
        self.contact_number = value

    @property
    def phone_number(self):
        return self.contact_number

    @phone_number.setter
    def phone_number(self, value):
        self.contact_number = value

    def save(self, *args, **kwargs):
        for field in ["name", "contact_number", "address", "email", "customer_code", "updated_by"]:
            setattr(self, field, normalize_text(getattr(self, field)))
        if self.customer_code == "":
            self.customer_code = None
        super().save(*args, **kwargs)

        if not self.customer_code and self.pk:
            generated_code = f"CUST_{10000 + int(self.pk)}"
            if Customer.objects.filter(customer_code=generated_code).exclude(pk=self.pk).exists():
                generated_code = f"CUST_{10000 + int(self.pk)}_{self.pk}"
            self.customer_code = generated_code
            super().save(update_fields=["customer_code"])

