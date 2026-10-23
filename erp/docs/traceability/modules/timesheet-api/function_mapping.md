# Function Mapping - timesheet_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | timesheet_api | `erp_app/sub_views/timesheet_api.py` |
| Functions / Views | `list_timesheet_meta_api_view`, `list_timesheets_api_view`, `create_timesheet_api_view`, `timesheet_detail_api_view`, `import_timesheets_excel_api_view`, `download_timesheet_template_api_view` | `erp_app/sub_views/timesheet_api.py` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `Timesheet(id)`, `Project(id, project_id)`, `User(id, username)` | `erp_app/sub_models` |
| UI | `N/A (no direct page file in current workspace list)` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/timesheets/meta/`, `/api/timesheets/`, `/api/timesheets/create/`, `/api/timesheets/import/`, `/api/timesheets/template/`, `/api/timesheets/<int:pk>/` | `erp/erp_app/urls.py` |
