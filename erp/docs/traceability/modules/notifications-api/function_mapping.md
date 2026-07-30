# Function Mapping - notifications_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | notifications_api | `erp_app/sub_views/notifications_api.py` |
| Functions / Views | `list_header_notifications_api_view`, `list_unread_task_notifications_api_view`, `list_unread_message_notifications_api_view`, `mark_task_notifications_read_api_view`, `mark_message_notifications_read_api_view` | `erp_app/sub_views/notifications_api.py` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `Notification(id)`, `TaskNotification(id)`, `MessageNotification(id)` | `erp_app/sub_models` |
| UI | `HomeLayout.jsx` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/notifications/header/`, `/api/notifications/tasks/unread/`, `/api/notifications/messages/unread/`, `/api/notifications/tasks/mark-read/`, `/api/notifications/messages/mark-read/` | `erp/erp_app/urls.py` |
