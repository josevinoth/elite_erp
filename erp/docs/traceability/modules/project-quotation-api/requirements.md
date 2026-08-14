# Requirements - project_quotation_api

## Module purpose and business requirement
Expose project quotation CRUD endpoints with cost-type gating and BOM hierarchy validation.

Source file: `erp_app/sub_views/project_quotation_api.py`

## Functions / views used
- `list_project_quotations_api_view`
- `create_project_quotation_item_api_view`
- `project_quotation_item_detail_api_view`

## Serializers
- `project_quotation_serializer.py`
- `ProjectQuotationSerializer`

## Database tables / columns
- `CostTypeInfo(id, name, description)`
- `ProjectQuotationItemInfo(project_id, cost_type_id, level, item_category_id, item_name, item_code_id, requested_qty, purchase_qty, cost_per_qty, total_cost)`
- `Project(id, project_id, project_name)`
- `ItemCategory(id, name)`
- `LabFurnitureItem(id, item_category_id, item_name, item_code)`
- `ItemCostingInfo(ic_item_code, ic_cost, ic_updated_at)`
- `StockPurchaseItem(item_code_id, unit_price, lce_cost, updated_at)`

## UI components / hooks
- `ProjectQuotationPage.jsx`
- `useCallback`
- `useEffect`
- `useMemo`
- `useRef`
- `useState`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`
- `frontend/src/services/crudApi.js`

## API endpoints
- `/api/project-quotations/`
- `/api/project-quotations/create/`
- `/api/project-quotations/<int:pk>/`
- `/api/itemcosting/cost-preview/`

