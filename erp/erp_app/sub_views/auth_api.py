import logging

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.models import Group, User
from django.core.mail import send_mail
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from ..sub_forms import LoginForm, RegistrationForm
from ..sub_models import Team, UserProfile, UserStatusOption

logger = logging.getLogger(__name__)


def _mask_email(email: str) -> str:
    """Mask local-part to reduce PII exposure in logs."""
    if "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}"
    return f"{masked_local}@{domain}"


def _resolve_user_role(user):
    first_group = user.groups.order_by("name").first()
    if first_group:
        return first_group.name
    if user.is_superuser:
        return "Super Admin"
    if user.is_staff:
        return "Staff"
    return "User"


def _resolve_user_team(user):
    try:
        profile = UserProfile.objects.select_related("team").get(user=user)
    except UserProfile.DoesNotExist:
        return ""
    return profile.team.name if profile.team else ""


@require_GET
@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({"detail": "CSRF cookie set."})


@require_GET
def register_meta_api_view(_request):
    """Returns registration dropdown metadata."""
    role_options = list(Group.objects.filter(name__in=["User", "Admin"]).order_by("name").values_list("name", flat=True))
    if not role_options:
        role_options = ["User", "Admin"]

    status_options = list(UserStatusOption.objects.order_by("name").values_list("name", flat=True))
    if not status_options:
        status_options = ["New Registration", "Active", "Inactive"]

    team_options = list(Team.objects.order_by("name").values_list("name", flat=True))
    if not team_options:
        team_options = ["CDC Team", "Oman Team"]

    return JsonResponse({"role_options": role_options, "status_options": status_options, "team_options": team_options})


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

    team_name = str(request.POST.get("team", "")).strip()
    if team_name:
        team_obj, _ = Team.objects.get_or_create(name=team_name)
        profile.team = team_obj

    profile.save()

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
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": _resolve_user_role(user),
                "team": _resolve_user_team(user),
            },
        }
    )


@require_POST
@csrf_protect
def logout_api_view(request):
    logout(request)
    return JsonResponse({"success": True, "message": "Logged out successfully."})


@require_POST
@csrf_protect
def forgot_password_api_view(request):
    email = str(request.POST.get("email", "")).strip().lower()
    if not email:
        return JsonResponse({"success": False, "message": "Registered email is required."}, status=400)

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return JsonResponse({"success": False, "message": "Email is not registered."}, status=404)

    token_generator = PasswordResetTokenGenerator()
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = token_generator.make_token(user)

    reset_url = request.build_absolute_uri(f"/reset-password?uid={uid}&token={token}")
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "no-reply@eliteone.local"

    subject = "EliteOne Password Reset"
    body = (
        "Hello,\n\n"
        "We received a request to reset your password.\n"
        f"Use the link below to set a new password:\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )

    try:
        send_mail(subject, body, from_email, [user.email], fail_silently=False)
    except Exception:
        logger.exception(
            "Password reset email send failed",
            extra={
                "user_id": user.id,
                "email": _mask_email(user.email),
                "smtp_host": getattr(settings, "EMAIL_HOST", ""),
                "smtp_port": getattr(settings, "EMAIL_PORT", ""),
                "smtp_tls": getattr(settings, "EMAIL_USE_TLS", ""),
                "from_email": _mask_email(from_email),
            },
        )
        return JsonResponse(
            {
                "success": False,
                "message": "Email validated, but unable to send reset email right now. Please contact administrator.",
            },
            status=500,
        )

    return JsonResponse(
        {
            "success": True,
            "message": "Email validated successfully. Password reset link has been sent.",
        }
    )


@require_POST
@csrf_protect
def reset_password_api_view(request):
    uid = str(request.POST.get("uid", "")).strip()
    token = str(request.POST.get("token", "")).strip()
    new_password = str(request.POST.get("new_password", ""))
    confirm_password = str(request.POST.get("confirm_password", ""))

    if not uid or not token:
        return JsonResponse({"success": False, "message": "Invalid reset link."}, status=400)

    if not new_password or not confirm_password:
        return JsonResponse({"success": False, "message": "Both password fields are required."}, status=400)

    if new_password != confirm_password:
        return JsonResponse({"success": False, "message": "Passwords do not match."}, status=400)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return JsonResponse({"success": False, "message": "Invalid reset link."}, status=400)

    token_generator = PasswordResetTokenGenerator()
    if not token_generator.check_token(user, token):
        return JsonResponse({"success": False, "message": "Reset link expired or invalid."}, status=400)

    try:
        validate_password(new_password, user=user)
    except ValidationError as exc:
        message = exc.messages[0] if exc.messages else "Invalid password."
        return JsonResponse({"success": False, "message": message}, status=400)

    user.set_password(new_password)
    user.save(update_fields=["password"])

    return JsonResponse({"success": True, "message": "Password reset successful. Please login."})
