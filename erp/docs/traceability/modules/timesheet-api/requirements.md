# Requirements - timesheet_api

## Module purpose and business requirement
Expose timesheet list, create, detail, import, and template endpoints.

Source file: `erp_app/sub_views/timesheet_api.py`

## Functions / views used
- `list_timesheet_meta_api_view`
- `list_timesheets_api_view`
- `create_timesheet_api_view`
- `timesheet_detail_api_view`
- `import_timesheets_excel_api_view`
- `download_timesheet_template_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `Timesheet(id)`
- `Project(id, project_id)`
- `User(id, username)`

## UI components / hooks
- `N/A (no direct page file in current workspace list)`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/timesheets/meta/`
- `/api/timesheets/`
- `/api/timesheets/create/`
- `/api/timesheets/import/`
- `/api/timesheets/template/`
- `/api/timesheets/<int:pk>/`
