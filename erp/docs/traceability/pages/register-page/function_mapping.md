# Function Mapping - RegisterPage

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Page | RegisterPage | `frontend/src/pages/RegisterPage.jsx` |
| Functions / Views | `csrf_token_view`, `register_meta_api_view`, `register_api_view`, `login_api_view`, `logout_api_view`, `forgot_password_api_view`, `reset_password_api_view`, `list_users_api_view`, `list_pending_registrations_api_view`, `approve_registration_api_view`, `user_detail_api_view` | `frontend/src/pages/RegisterPage.jsx` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `auth_user(username, email, password, is_active)` | `erp_app/sub_models` |
| UI | `LoginPage.jsx`, `RegisterPage.jsx`, `HomeLayout.jsx` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/auth/csrf/`, `/api/auth/register/meta/`, `/api/auth/register/`, `/api/auth/login/`, `/api/auth/logout/`, `/api/auth/forgot-password/`, `/api/auth/reset-password/`, `/api/users/`, `/api/users/pending/`, `/api/users/<int:user_id>/approve/`, `/api/users/<int:user_id>/` | `erp/erp_app/urls.py` |
