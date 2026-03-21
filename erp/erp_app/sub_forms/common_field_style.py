class CommonFieldStyleMixin:
    """Apply one shared CSS class to all form fields for reusable styling."""

    field_css_class = "auth-input"

    def _apply_common_styles(self):
        for field in self.fields.values():
            current = field.widget.attrs.get("class", "").strip()
            field.widget.attrs["class"] = f"{current} {self.field_css_class}".strip()

