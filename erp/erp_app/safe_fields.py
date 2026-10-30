from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers


class SafeSourceCharField(serializers.CharField):
    """Read-only CharField that tolerates broken/null nested relations."""

    def get_attribute(self, instance):
        try:
            value = super().get_attribute(instance)
        except (ObjectDoesNotExist, AttributeError, KeyError, TypeError, ValueError):
            return ""
        return "" if value is None else value

    def to_representation(self, value):
        if value is None:
            return ""
        return super().to_representation(value)
