# Function Mapping - vendors_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | vendors_api | `erp_app/sub_views/vendors_api.py` |
| Functions / Views | `list_vendors_api_view`, `create_vendor_api_view`, `vendor_detail_api_view` | `erp_app/sub_views/vendors_api.py` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `Vendor(id, name)` | `erp_app/sub_models` |
| UI | `StockPurchaseAddPage.jsx`, `ProjectsAddPage.jsx` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/vendors/`, `/api/vendors/create/`, `/api/vendors/<int:vendor_id>/` | `erp/erp_app/urls.py` |
