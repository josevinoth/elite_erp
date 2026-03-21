from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import Group, User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from ..sub_forms import LoginForm, RegistrationForm
from ..sub_models import UserProfile, UserStatusOption


@require_GET
@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({"detail": "CSRF cookie set."})


@require_GET
def register_meta_api_view(_request):
    """Returns only status options – role is fixed to User on registration."""
    status_options = list(UserStatusOption.objects.order_by("name").values_list("name", flat=True))
    if not status_options:
        status_options = ["New Registration", "Active", "Inactive"]
    return JsonResponse({"status_options": status_options})


@require_POST
@csrf_protect
def register_api_view(request):
    form = RegistrationForm(request.POST)

    if not form.is_valid():
        return JsonResponse({"success": False, "errors": form.errors}, status=400)

    user = form.save()

    # Always assign role=User and status=New Registration; account is inactive until approved.
    user_group, _ = Group.objects.get_or_create(name="User")
    user.groups.set([user_group])
    user.is_active = False
    user.save(update_fields=["is_active"])

    new_reg_status, _ = UserStatusOption.objects.get_or_create(name="New Registration")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.status = new_reg_status
    profile.save(update_fields=["status"])

    return JsonResponse(
        {
            "success": True,
            "message": "Registration successful. Your account is pending approval by an administrator.",
            "user": {"username": user.username, "email": user.email},
        },
        status=201,
    )


@require_POST
@csrf_protect
def login_api_view(request):
    form = LoginForm(request.POST)

    if not form.is_valid():
        return JsonResponse({"success": False, "errors": form.errors}, status=400)

    username = form.cleaned_data["username"]
    password = form.cleaned_data["password"]

    user = authenticate(request, username=username, password=password)

    if user is None:
        # Check if a matching (inactive) account exists and give a specific message.
        candidate = User.objects.filter(username__iexact=username).first()
        if candidate and candidate.check_password(password):
            try:
                profile = UserProfile.objects.select_related("status").get(user=candidate)
                status_name = profile.status.name if profile.status else ""
            except UserProfile.DoesNotExist:
                status_name = ""

            if status_name.lower() == "new registration":
                msg = "Your registration is yet to be approved. Please connect with admin."
            elif status_name.lower() == "inactive":
                msg = "User inactive. Please contact administrator."
            else:
                msg = "User not active. Contact administrator."

            return JsonResponse({"success": False, "errors": {"__all__": [msg]}}, status=403)

        return JsonResponse(
            {"success": False, "errors": {"__all__": ["Invalid username or password."]}},
            status=400,
        )

    login(request, user)
    return JsonResponse(
        {
            "success": True,
            "message": "Logged in successfully.",
            "user": {"username": user.username, "email": user.email},
        }
    )


@require_POST
@csrf_protect
def logout_api_view(request):
    logout(request)
    return JsonResponse({"success": True, "message": "Logged out successfully."})
