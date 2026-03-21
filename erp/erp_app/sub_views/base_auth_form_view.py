from django.contrib import messages
from django.views.generic.edit import FormView


class BaseAuthFormView(FormView):
    """Reusable auth page behavior: shared template and context structure."""

    template_name = "erp_app/auth/auth_form.html"
    page_title = ""
    submit_label = "Submit"
    alternate_text = ""
    alternate_url_name = ""
    success_message = ""

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(
            {
                "page_title": self.page_title,
                "submit_label": self.submit_label,
                "alternate_text": self.alternate_text,
                "alternate_url_name": self.alternate_url_name,
            }
        )
        return context

    def form_valid(self, form):
        response = self.process_valid_form(form)

        if self.success_message:
            messages.success(self.request, self.success_message)

        return response

    def process_valid_form(self, form):
        return super().form_valid(form)

