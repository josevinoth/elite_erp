from .auth_api import csrf_token_view, login_api_view, logout_api_view, register_api_view, register_meta_api_view
from .base_auth_form_view import BaseAuthFormView
from .login_page_view import LoginPageView
from .projects_api import (
    create_project_api_view,
    create_project_lifecycle_status_option_api_view,
    list_projects_api_view,
    list_project_lifecycle_meta_api_view,
    project_detail_api_view,
)
from .register_view import RegisterView
from .stock_maintenance_api import (
    create_stock_maintenance_type_option_api_view,
    create_stock_maintenance_api_view,
    list_stock_maintenance_meta_api_view,
    list_stock_maintenance_api_view,
    stock_maintenance_detail_api_view,
)
from .stock_purchase_api import (
    create_stock_purchase_api_view,
    list_stock_purchases_api_view,
    stock_purchase_detail_api_view,
)
from .task_api import create_task_api_view, list_tasks_api_view, task_detail_api_view
from .task_meta_api import (
    create_project_status_option_api_view,
    create_task_status_option_api_view,
    list_task_meta_api_view,
)
from .user_management_api import (
    approve_registration_api_view,
    list_pending_registrations_api_view,
    list_users_api_view,
    user_detail_api_view,
)
from .vendors_api import create_vendor_api_view, list_vendors_api_view, vendor_detail_api_view

__all__ = [
    "BaseAuthFormView", "RegisterView", "LoginPageView",
    "csrf_token_view", "register_meta_api_view", "register_api_view", "login_api_view", "logout_api_view",
    "list_users_api_view", "user_detail_api_view",
    "list_pending_registrations_api_view", "approve_registration_api_view",
    "list_vendors_api_view", "create_vendor_api_view", "vendor_detail_api_view",
    "list_projects_api_view", "list_project_lifecycle_meta_api_view",
    "create_project_api_view", "project_detail_api_view",
    "create_project_lifecycle_status_option_api_view",
    "list_stock_purchases_api_view", "create_stock_purchase_api_view", "stock_purchase_detail_api_view",
    "list_stock_maintenance_api_view", "list_stock_maintenance_meta_api_view",
    "create_stock_maintenance_api_view", "stock_maintenance_detail_api_view",
    "create_stock_maintenance_type_option_api_view",
    "list_tasks_api_view", "create_task_api_view", "task_detail_api_view",
    "list_task_meta_api_view", "create_task_status_option_api_view", "create_project_status_option_api_view",
]

