# Requirements - item_costing_api

## Module purpose and business requirement
Expose item costing list, preview, create, and detail endpoints.

Source file: `erp_app/sub_views/item_costing_api.py`

## Functions / views used
- `list_item_costing_api_view`
- `item_costing_meta_api_view`
- `item_costing_cost_preview_api_view`
- `create_item_costing_api_view`
- `item_costing_detail_api_view`

## Serializers
- `item_costing_serializer.py`

## Database tables / columns
- `ItemCostingInfo(ic_project_ref, ic_item_category_id, ic_cost_max, ic_cost_min, ic_cost, ic_total_price, ic_updated_by)`
- `StockPurchaseItem(item_code_id, item_category_id, quantity, lce_cost, uom_id, length, width, height)`
- `LabFurnitureItem(id, item_code, item_name, item_category_id, uom_id, length, width, height, volume)`
- `ItemCategory(id, name)`
- `UOM(id, name, symbol)`

## UI components / hooks
- `ItemCostingListPage.jsx`
- `ItemCostingFormPage.jsx`
- `useEffect`
- `useMemo`
- `useState`
- `useNavigate`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/itemcosting/`
- `/api/itemcosting/meta/`
- `/api/itemcosting/cost-preview/`
- `/api/itemcosting/create/`
- `/api/itemcosting/<int:pk>/`
