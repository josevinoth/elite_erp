# Requirements - ProjectsAddPage

## Page purpose and business requirement
Create and edit project records.

Source file: `frontend/src/pages/ProjectsAddPage.jsx`

## Functions / views used
- `list_projects_api_view`
- `list_project_lifecycle_meta_api_view`
- `create_project_api_view`
- `project_detail_api_view`
- `create_project_lifecycle_status_option_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `Project(id, project_id, project_name)`
- `ProjectLifecycleStatusOption(id, name)`

## UI components / hooks
- `ProjectsPage.jsx`
- `ProjectsAddPage.jsx`
- `useEffect`
- `useState`
- `useNavigate`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/projects/`
- `/api/projects/meta/`
- `/api/projects/create/`
- `/api/projects/<int:project_id>/`
- `/api/projects/status-options/add/`
