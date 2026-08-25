from django.db import models
from ..utils import normalize_text


class Vendor(models.Model):
    vendor_code = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True)
    name = models.CharField(max_length=200, unique=True)
    contact_person = models.CharField(max_length=150, blank=True)
    email = models.CharField(max_length=254, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.vendor_code or '-'} - {self.name}"

    @property
    def vendor_name(self):
        return self.name

    @vendor_name.setter
    def vendor_name(self, value):
        self.name = value

    @property
    def phone_number(self):
        return self.phone

    @phone_number.setter
    def phone_number(self, value):
        self.phone = value

    @property
    def email_id(self):
        return self.email

    @email_id.setter
    def email_id(self, value):
        self.email = value

    def clean(self):
        normalized_email = normalize_text(self.email)
        if normalized_email and "@" not in normalized_email:
            from django.core.exceptions import ValidationError

            raise ValidationError({"email": "Email must contain '@'."})

    def save(self, *args, **kwargs):
        for field in ["name", "contact_person", "email", "phone", "address", "vendor_code"]:
            setattr(self, field, normalize_text(getattr(self, field)))
        if self.vendor_code == "":
            self.vendor_code = None
        self.full_clean()
        super().save(*args, **kwargs)

        if not self.vendor_code and self.pk:
            generated_code = f"VC_{10000 + int(self.pk)}"
            if Vendor.objects.filter(vendor_code=generated_code).exclude(pk=self.pk).exists():
                generated_code = f"VC_{10000 + int(self.pk)}_{self.pk}"
            self.vendor_code = generated_code
            super().save(update_fields=["vendor_code"])

