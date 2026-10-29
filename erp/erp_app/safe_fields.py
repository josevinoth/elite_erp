from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers


class SafeSourceCharField(serializers.CharField):
    """Read-only CharField that tolerates missing/null source chains.

    This keeps serializer output stable when a nested relation is absent
    (for example `source="user.profile.name"` when profile is null).
    """

    def get_attribute(self, instance):
        try:
            return super().get_attribute(instance)
        except (AttributeError, KeyError, ObjectDoesNotExist):
            return None

    def to_representation(self, value):
        if value is None:
            return ""
        return super().to_representation(value)

