# Function Mapping - ItemCostingListPage

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Page | ItemCostingListPage | `frontend/src/pages/ItemCostingListPage.jsx` |
| Functions / Views | `list_item_costing_api_view`, `item_costing_meta_api_view`, `item_costing_cost_preview_api_view`, `create_item_costing_api_view`, `item_costing_detail_api_view` | `frontend/src/pages/ItemCostingListPage.jsx` |
| Serializers | `item_costing_serializer.py` | `erp_app/serializers` |
| Database | `ItemCostingInfo(ic_project_ref, ic_item_category_id, ic_cost_max, ic_cost_min, ic_cost, ic_total_price, ic_updated_by)`, `StockPurchaseItem(item_code_id, item_category_id, quantity, lce_cost, uom_id, length, width, height)`, `LabFurnitureItem(id, item_code, item_name, item_category_id, uom_id, length, width, height, volume)`, `ItemCategory(id, name)`, `UOM(id, name, symbol)` | `erp_app/sub_models` |
| UI | `ItemCostingListPage.jsx`, `ItemCostingFormPage.jsx`, `useEffect`, `useMemo`, `useState`, `useNavigate` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/itemcosting/`, `/api/itemcosting/meta/`, `/api/itemcosting/cost-preview/`, `/api/itemcosting/create/`, `/api/itemcosting/<int:pk>/` | `erp/erp_app/urls.py` |
