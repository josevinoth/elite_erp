# Function Mapping - project_quotation_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | `project_quotation_api.py` | `erp_app/sub_views/project_quotation_api.py` |
| Functions / Views | `list_project_quotations_api_view`, `create_project_quotation_item_api_view`, `project_quotation_item_detail_api_view` | `erp_app/sub_views/project_quotation_api.py` |
| Serializers | `project_quotation_serializer.py`, `ProjectQuotationSerializer` | `erp_app/project_quotation_serializer.py` |
| Shared helper | `calculate_costs(item_code, requested_qty)` | `erp_app/utils/project_quotation_costs.py` |
| Database | `CostTypeInfo(id, name, description)`, `ProjectQuotationItemInfo(quotation_number, project_id, cost_type_id, level, item_category_id, item_name, item_code_id, requested_qty, purchase_qty, cost_per_qty, max_cost, min_cost, actual_cost, total_cost, length, width, height, volume)`, `Project(id, project_id, project_name)`, `ItemCategory(id, name)`, `LabFurnitureItem(id, item_category_id, item_name, item_code, length, width, height, volume)`, `ItemCostingInfo(ic_item_code, ic_cost, ic_updated_at)`, `StockPurchaseItem(item_code_id, unit_price, lce_cost, updated_at)` | `erp_app/sub_models` |
| UI | `ProjectQuotationPage.jsx`, `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState` | `frontend/src/pages/ProjectQuotationPage.jsx` |
| CSS / JS | `frontend/src/services/crudApi.js`, `frontend/src/styles/auth_common.css` | `frontend/src/services`, `frontend/src/styles` |
| API | `/api/project-quotations/`, `/api/project-quotations/create/`, `/api/project-quotations/<int:pk>/`, `/api/itemcosting/cost-preview/` | `erp/erp_app/urls.py` |




