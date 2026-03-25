from django.urls import reverse_lazy

from ..sub_forms import RegistrationForm
from .base_auth_form_view import BaseAuthFormView


class RegisterView(BaseAuthFormView):
    form_class = RegistrationForm
    page_title = "Create account"
    submit_label = "Register"
    alternate_text = "Already have an account? Log in"
    alternate_url_name = "login"
    success_url = reverse_lazy("login")
    success_message = "Registration successful. Please log in."

    def process_valid_form(self, form):
        form.save()
        return super().process_valid_form(form)

