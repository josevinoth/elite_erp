from django import forms

from .common_field_style import CommonFieldStyleMixin


class LoginForm(forms.Form, CommonFieldStyleMixin):
    username = forms.CharField(max_length=150)
    password = forms.CharField(widget=forms.PasswordInput)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._apply_common_styles()

