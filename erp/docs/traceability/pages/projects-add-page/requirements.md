# Requirements - ProjectsAddPage

## Page purpose and business requirement
Create and edit project records.

- Include a quotation list section inside the project screen.
- Quotation section uses an accordion layout and is collapsed by default.
- In edit mode, users can add/edit/delete quotation items directly in the project screen.
- In add mode, users are prompted to save the project first before adding quotation items.
- Embedded quotation item pricing follows shared `calculate_costs` logic from backend.

Source file: `frontend/src/pages/ProjectsAddPage.jsx`

## Functions / views used
- `list_projects_api_view`
- `list_project_lifecycle_meta_api_view`
- `create_project_api_view`
- `project_detail_api_view`
- `create_project_lifecycle_status_option_api_view`
- `list_project_quotations_api_view`
- `create_project_quotation_item_api_view`
- `project_quotation_item_detail_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `Project(id, project_id, project_name)`
- `ProjectLifecycleStatusOption(id, name)`
- `ProjectQuotationItemInfo(project_id, quotation_number, item_code_id, max_cost, min_cost, actual_cost, total_cost)`

## UI components / hooks
- `ProjectsPage.jsx`
- `ProjectsAddPage.jsx`
- `ProjectQuotationPage.jsx`
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
- `/api/project-quotations/`
- `/api/project-quotations/create/`
- `/api/project-quotations/<int:pk>/`
