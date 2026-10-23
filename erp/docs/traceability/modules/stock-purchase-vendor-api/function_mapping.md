# Function Mapping - stock_purchase_vendor_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | stock_purchase_vendor_api | `erp_app/sub_views/stock_purchase_vendor_api.py` |
| Functions / Views | `create_stock_purchase_vendor_detail_api_view`, `stock_purchase_vendor_detail_api_view` | `erp_app/sub_views/stock_purchase_vendor_api.py` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `StockPurchaseVendorDetail(vendor_id, invoice_number, invoice_date, tax, total_value)`, `Vendor(id, name)` | `erp_app/sub_models` |
| UI | `StockPurchaseAddPage.jsx` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/stock-purchase-vendors/create/`, `/api/stock-purchase-vendors/<int:pk>/` | `erp/erp_app/urls.py` |
