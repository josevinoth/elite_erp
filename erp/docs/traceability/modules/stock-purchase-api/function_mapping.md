# Function Mapping - stock_purchase_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | stock_purchase_api | `erp_app/sub_views/stock_purchase_api.py` |
| Functions / Views | `list_stock_purchases_api_view`, `create_stock_purchase_api_view`, `stock_purchase_detail_api_view`, `stock_purchase_item_trace_api_view`, `list_stock_purchase_status_options_api_view` | `erp_app/sub_views/stock_purchase_api.py` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `StockPurchaseVendorDetail(purchase_id, vendor_id, invoice_number, invoice_date, tax, total_value, notes, status_id)`, `StockPurchaseItem(grn_number, item_category_id, item_code_id, item_type, quantity, unit_price, total_price, lce_cost, uom_id, lce_estimate_id)`, `Vendor(id, name)`, `ItemCategory(id, name)`, `LabFurnitureItem(id, item_code, item_name, item_category_id, uom_id, length, width, height, volume)`, `LCEEstimate(id)` | `erp_app/sub_models` |
| UI | `StockPurchasePage.jsx`, `StockPurchaseAddPage.jsx`, `StockPurchaseItemTracePage.jsx`, `useEffect`, `useMemo`, `useState`, `useNavigate`, `useParams`, `BsBoxArrowUpRight`, `BsPlusCircleFill`, `BsTrashFill` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/stock-purchases/`, `/api/stock-purchases/create/`, `/api/stock-purchases/<int:pk>/`, `/api/stock-purchase-items/<int:item_id>/trace/`, `/api/stock-purchase/status-options/`, `/api/stock-purchase-vendors/create/`, `/api/stock-purchase-vendors/<int:pk>/` | `erp/erp_app/urls.py` |

Row reference resolution supports: `item_category_id` + `item_name` -> `item_code_id` (deterministic Item Master match).

