# Function Mapping - stock_maintenance_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | stock_maintenance_api | `erp_app/sub_views/stock_maintenance_api.py` |
| Functions / Views | `list_stock_maintenance_api_view`, `list_stock_maintenance_meta_api_view`, `create_stock_maintenance_api_view`, `stock_maintenance_detail_api_view`, `create_stock_maintenance_type_option_api_view` | `erp_app/sub_views/stock_maintenance_api.py` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `StockMaintenance(id)`, `StockMaintenanceTypeOption(id, name)` | `erp_app/sub_models` |
| UI | `N/A (no direct page file in current workspace list)` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/stock-maintenance/`, `/api/stock-maintenance/meta/`, `/api/stock-maintenance/create/`, `/api/stock-maintenance/<int:pk>/`, `/api/stock-maintenance/type-options/add/` | `erp/erp_app/urls.py` |
