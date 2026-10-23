# Function Mapping - ProjectsAddPage

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Page | ProjectsAddPage | `frontend/src/pages/ProjectsAddPage.jsx` |
| Functions / Views | `list_projects_api_view`, `list_project_lifecycle_meta_api_view`, `create_project_api_view`, `project_detail_api_view`, `create_project_lifecycle_status_option_api_view`, `list_project_quotations_api_view`, `create_project_quotation_item_api_view`, `project_quotation_item_detail_api_view` | `frontend/src/pages/ProjectsAddPage.jsx`, `frontend/src/pages/ProjectQuotationPage.jsx` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `Project(id, project_id, project_name)`, `ProjectLifecycleStatusOption(id, name)`, `ProjectQuotationItemInfo(project_id, quotation_number, item_code_id, max_cost, min_cost, actual_cost, total_cost)` | `erp_app/sub_models` |
| UI | `ProjectsPage.jsx`, `ProjectsAddPage.jsx`, `ProjectQuotationPage.jsx`, `details/summary`, `useEffect`, `useState`, `useNavigate` | `frontend/src/pages` |
| Shared helper | `calculate_costs(item_code, requested_qty)` | `erp_app/utils/project_quotation_costs.py` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/projects/`, `/api/projects/meta/`, `/api/projects/create/`, `/api/projects/<int:project_id>/`, `/api/projects/status-options/add/`, `/api/project-quotations/`, `/api/project-quotations/create/`, `/api/project-quotations/<int:pk>/` | `erp/erp_app/urls.py` |
