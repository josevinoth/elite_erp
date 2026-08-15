# Function Mapping - project_quotation_view

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | `project_quotation_view.py` | `erp_app/sub_views/project_quotation_view.py` |
| Functions / Views | `ProjectQuotationView.get_serializer_context`, `ProjectQuotationView.list_payload`, `ProjectQuotationView.detail_payload`, `ProjectQuotationListView.list_payload` | `erp_app/sub_views/project_quotation_view.py` |
| Shared helper | `calculate_costs(item_code, requested_qty)` | `erp_app/utils/project_quotation_costs.py` |
| Serializers | `project_quotation_serializer.py`, `ProjectQuotationSerializer` | `erp_app/project_quotation_serializer.py` |
| Database | `Project(id, project_id, project_name, description)`, `ProjectQuotationItemInfo(quotation_number, project_id, cost_type_id, level, max_cost, min_cost, actual_cost, total_cost, length, width, height, volume)`, `CostTypeInfo(id, name, description)` | `erp_app/sub_models` |
| UI | `ProjectQuotationPage.jsx`, `details/summary` accordion rendering | `frontend/src/pages/ProjectQuotationPage.jsx` |
| CSS / JS | `frontend/src/pages/ProjectQuotationPage.jsx` | `frontend/src/pages` |
| API | `/api/project-quotations/`, `/api/project-quotations/<int:pk>/` | `erp/erp_app/urls.py` |

