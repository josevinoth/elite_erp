# Requirements - vendors_api

## Module purpose and business requirement
Expose vendor list/create/detail endpoints.

Source file: `erp_app/sub_views/vendors_api.py`

## Functions / views used
- `list_vendors_api_view`
- `create_vendor_api_view`
- `vendor_detail_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `Vendor(id, name)`

## UI components / hooks
- `StockPurchaseAddPage.jsx`
- `ProjectsAddPage.jsx`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/vendors/`
- `/api/vendors/create/`
- `/api/vendors/<int:vendor_id>/`
