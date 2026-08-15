# Function Mapping - ProjectQuotationPage

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Page | `ProjectQuotationPage` | `frontend/src/pages/ProjectQuotationPage.jsx` |
| Dependency chain | `Item Category → Item Name → Item Code` via `LabFurnitureItem` lookup | `frontend/src/pages/ProjectQuotationPage.jsx`, `erp_app/sub_views/lab_furniture_item_api.py`, `erp_app/project_quotation_serializer.py` |
| Functions / Views | `list_project_quotations_api_view`, `create_project_quotation_item_api_view`, `project_quotation_item_detail_api_view`, `item_costing_cost_preview_api_view`, `list_lab_furniture_item_categories_api_view`, `list_lab_furniture_items_api_view` | `erp_app/sub_views/project_quotation_api.py`, `erp_app/sub_views/item_costing_api.py`, `erp_app/sub_views/lab_furniture_item_api.py` |
| Serializers | `ProjectQuotationSerializer` | `erp_app/project_quotation_serializer.py` |
| Database | `Project(id, project_id, project_name, description)`, `CostTypeInfo(id, name, description)`, `ProjectQuotationItemInfo(quotation_number, project_id, cost_type_id, level, item_category_id, item_name, item_code_id, requested_qty, purchase_qty, cost_per_qty, max_cost, min_cost, actual_cost, total_cost, length, width, height, volume)`, `ItemCategory(id, name)`, `LabFurnitureItem(id, item_category_id, item_name, item_code, length, width, height, volume)` | `erp_app/sub_models` |
| UI | `details/summary`, `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`, `BsPencilSquare`, `BsCheckCircleFill`, `BsPlusCircleFill`, `BsTrashFill`, `BsXCircleFill` | `frontend/src/pages/ProjectQuotationPage.jsx` |
| CSS / JS | `frontend/src/services/crudApi.js`, `frontend/src/styles/auth_common.css` | `frontend/src/services`, `frontend/src/styles` |
| API | `/api/project-quotations/`, `/api/project-quotations/create/`, `/api/project-quotations/<int:pk>/`, `/api/lab-furniture-item-categories/`, `/api/lab-furniture-items/`, `/api/itemcosting/cost-preview/` | `erp/erp_app/urls.py` |

