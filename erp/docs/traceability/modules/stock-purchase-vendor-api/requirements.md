# Requirements - stock_purchase_vendor_api

## Module purpose and business requirement
Expose purchase vendor detail create, patch, and delete endpoints.

Source file: `erp_app/sub_views/stock_purchase_vendor_api.py`

## Functions / views used
- `create_stock_purchase_vendor_detail_api_view`
- `stock_purchase_vendor_detail_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `StockPurchaseVendorDetail(vendor_id, invoice_number, invoice_date, tax, total_value)`
- `Vendor(id, name)`

## UI components / hooks
- `StockPurchaseAddPage.jsx`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/stock-purchase-vendors/create/`
- `/api/stock-purchase-vendors/<int:pk>/`
