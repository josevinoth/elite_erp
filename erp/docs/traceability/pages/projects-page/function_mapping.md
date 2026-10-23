# Function Mapping - ProjectsPage

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Page | ProjectsPage | `frontend/src/pages/ProjectsPage.jsx` |
| Functions / Views | `list_projects_api_view`, `list_project_lifecycle_meta_api_view`, `create_project_api_view`, `project_detail_api_view`, `create_project_lifecycle_status_option_api_view` | `frontend/src/pages/ProjectsPage.jsx` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `Project(id, project_id, project_name)`, `ProjectLifecycleStatusOption(id, name)` | `erp_app/sub_models` |
| UI | `ProjectsPage.jsx`, `ProjectsAddPage.jsx`, `useEffect`, `useState`, `useNavigate` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/projects/`, `/api/projects/meta/`, `/api/projects/create/`, `/api/projects/<int:project_id>/`, `/api/projects/status-options/add/` | `erp/erp_app/urls.py` |
