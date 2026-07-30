# Requirements - login_page_view

## Module purpose and business requirement
Expose login page and login/logout helpers.

Source file: `erp_app/sub_views/login_page_view.py`

## Functions / views used
- `csrf_token_view`
- `register_meta_api_view`
- `register_api_view`
- `login_api_view`
- `logout_api_view`
- `forgot_password_api_view`
- `reset_password_api_view`
- `list_users_api_view`
- `list_pending_registrations_api_view`
- `approve_registration_api_view`
- `user_detail_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `auth_user(username, email, password, is_active)`

## UI components / hooks
- `LoginPage.jsx`
- `RegisterPage.jsx`
- `HomeLayout.jsx`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/auth/csrf/`
- `/api/auth/register/meta/`
- `/api/auth/register/`
- `/api/auth/login/`
- `/api/auth/logout/`
- `/api/auth/forgot-password/`
- `/api/auth/reset-password/`
- `/api/users/`
- `/api/users/pending/`
- `/api/users/<int:user_id>/approve/`
- `/api/users/<int:user_id>/`
