# Requirements - task_api

## Module purpose and business requirement
Expose task list, create, detail, import, and template endpoints.

Source file: `erp_app/sub_views/task_api.py`

## Functions / views used
- `list_tasks_api_view`
- `list_task_meta_api_view`
- `create_task_api_view`
- `task_detail_api_view`
- `import_tasks_excel_api_view`
- `download_task_template_api_view`
- `create_task_status_option_api_view`
- `create_activity_option_api_view`
- `create_project_status_option_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `Task(id)`
- `TaskStatusOption(id, name)`
- `ActivityOption(id, name)`
- `ProjectStatusOption(id, name)`

## UI components / hooks
- `N/A (no direct page file in current workspace list)`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/tasks/`
- `/api/tasks/meta/`
- `/api/tasks/create/`
- `/api/tasks/template/`
- `/api/tasks/import/`
- `/api/tasks/<int:pk>/`
- `/api/tasks/status-options/add/`
- `/api/tasks/activity-options/add/`
- `/api/tasks/project-status-options/add/`
