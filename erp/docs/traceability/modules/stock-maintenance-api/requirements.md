# Requirements - stock_maintenance_api

## Module purpose and business requirement
Expose stock maintenance list, create, detail, meta, and type option endpoints.

Source file: `erp_app/sub_views/stock_maintenance_api.py`

## Functions / views used
- `list_stock_maintenance_api_view`
- `list_stock_maintenance_meta_api_view`
- `create_stock_maintenance_api_view`
- `stock_maintenance_detail_api_view`
- `create_stock_maintenance_type_option_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `StockMaintenance(id)`
- `StockMaintenanceTypeOption(id, name)`

## UI components / hooks
- `N/A (no direct page file in current workspace list)`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/stock-maintenance/`
- `/api/stock-maintenance/meta/`
- `/api/stock-maintenance/create/`
- `/api/stock-maintenance/<int:pk>/`
- `/api/stock-maintenance/type-options/add/`
