from django.contrib.auth import authenticate, login
from django.urls import reverse_lazy

from ..sub_forms import LoginForm
from .base_auth_form_view import BaseAuthFormView


class LoginPageView(BaseAuthFormView):
    form_class = LoginForm
    page_title = "Welcome back"
    submit_label = "Log in"
    alternate_text = "Need an account? Register"
    alternate_url_name = "register"
    success_url = reverse_lazy("login")
    success_message = "You are logged in."

    def process_valid_form(self, form):
        user = authenticate(
            self.request,
            username=form.cleaned_data["username"],
            password=form.cleaned_data["password"],
        )

        if user is None:
            form.add_error(None, "Invalid username or password.")
            return self.form_invalid(form)

        login(self.request, user)
        return super().process_valid_form(form)

