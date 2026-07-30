# Requirements - notifications_api

## Module purpose and business requirement
Expose notification lists and mark-read endpoints.

Source file: `erp_app/sub_views/notifications_api.py`

## Functions / views used
- `list_header_notifications_api_view`
- `list_unread_task_notifications_api_view`
- `list_unread_message_notifications_api_view`
- `mark_task_notifications_read_api_view`
- `mark_message_notifications_read_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `Notification(id)`
- `TaskNotification(id)`
- `MessageNotification(id)`

## UI components / hooks
- `HomeLayout.jsx`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/notifications/header/`
- `/api/notifications/tasks/unread/`
- `/api/notifications/messages/unread/`
- `/api/notifications/tasks/mark-read/`
- `/api/notifications/messages/mark-read/`
