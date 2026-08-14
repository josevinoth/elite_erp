# Function Mapping - project_quotation_view

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | `project_quotation_view.py` | `erp_app/sub_views/project_quotation_view.py` |
| Functions / Views | `ProjectQuotationView.get_serializer_context`, `ProjectQuotationView.list_payload`, `ProjectQuotationView.detail_payload` | `erp_app/sub_views/project_quotation_view.py` |
| Serializers | `project_quotation_serializer.py`, `ProjectQuotationSerializer` | `erp_app/project_quotation_serializer.py` |
| Database | `Project(id, project_id, project_name, description)`, `ProjectQuotationItemInfo(project_id, cost_type_id, level, total_cost)`, `CostTypeInfo(id, name, description)` | `erp_app/sub_models` |
| UI | `ProjectQuotationPage.jsx`, `details/summary` accordion rendering | `frontend/src/pages/ProjectQuotationPage.jsx` |
| CSS / JS | `frontend/src/pages/ProjectQuotationPage.jsx` | `frontend/src/pages` |
| API | `/api/project-quotations/`, `/api/project-quotations/<int:pk>/` | `erp/erp_app/urls.py` |

