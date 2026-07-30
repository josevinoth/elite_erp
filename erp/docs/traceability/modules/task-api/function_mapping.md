# Function Mapping - task_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | task_api | `erp_app/sub_views/task_api.py` |
| Functions / Views | `list_tasks_api_view`, `list_task_meta_api_view`, `create_task_api_view`, `task_detail_api_view`, `import_tasks_excel_api_view`, `download_task_template_api_view`, `create_task_status_option_api_view`, `create_activity_option_api_view`, `create_project_status_option_api_view` | `erp_app/sub_views/task_api.py` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `Task(id)`, `TaskStatusOption(id, name)`, `ActivityOption(id, name)`, `ProjectStatusOption(id, name)` | `erp_app/sub_models` |
| UI | `N/A (no direct page file in current workspace list)` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/tasks/`, `/api/tasks/meta/`, `/api/tasks/create/`, `/api/tasks/template/`, `/api/tasks/import/`, `/api/tasks/<int:pk>/`, `/api/tasks/status-options/add/`, `/api/tasks/activity-options/add/`, `/api/tasks/project-status-options/add/` | `erp/erp_app/urls.py` |
