from rest_framework import serializers

from .sub_models.vendor import Vendor


class VendorSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="name")
    phone_number = serializers.CharField(source="phone", allow_blank=True, required=False)
    email_id = serializers.CharField(source="email", allow_blank=True, required=False)
    name = serializers.CharField(read_only=True)
    phone = serializers.CharField(read_only=True)
    email = serializers.CharField(read_only=True)

    class Meta:
        model = Vendor
        fields = [
            "id",
            "vendor_code",
            "vendor_name",
            "name",
            "address",
            "phone_number",
            "phone",
            "email_id",
            "email",
            "contact_person",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "vendor_code", "created_at", "updated_at"]

    def validate_vendor_name(self, value):
        normalized = str(value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Vendor name is required.")

        queryset = Vendor.objects.filter(name__iexact=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Vendor name already exists.")
        return normalized

    def validate_email_id(self, value):
        normalized = str(value or "").strip()
        if normalized and "@" not in normalized:
            raise serializers.ValidationError("Email must contain '@'.")
        return normalized

    def create(self, validated_data):
        return Vendor.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        return instance

