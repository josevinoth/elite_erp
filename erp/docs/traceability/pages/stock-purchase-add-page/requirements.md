# Requirements - StockPurchaseAddPage

## Page purpose and business requirement
Create and edit purchase vendor details and purchase item rows.

- Item selection dependency chain: `Item Category -> Item Name -> Item Code`.
- Item Name options are filtered by selected category from Item Master.
- Item Code is auto-populated after Item Name selection.

Source file: `frontend/src/pages/StockPurchaseAddPage.jsx`

## Functions / views used
- `list_stock_purchases_api_view`
- `create_stock_purchase_api_view`
- `stock_purchase_detail_api_view`
- `stock_purchase_item_trace_api_view`
- `list_stock_purchase_status_options_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `StockPurchaseVendorDetail(purchase_id, vendor_id, invoice_number, invoice_date, tax, total_value, notes, status_id)`
- `StockPurchaseItem(grn_number, item_category_id, item_code_id, item_type, quantity, unit_price, total_price, lce_cost, uom_id, lce_estimate_id)`
- `Vendor(id, name)`
- `ItemCategory(id, name)`
- `LabFurnitureItem(id, item_code, item_name, item_category_id, uom_id, length, width, height, volume)`
- `LCEEstimate(id)`

## Dependency and mapping notes
- Existing rows are normalized against Item Master to keep category/name/code consistent.
- If `item_code` is missing in legacy data, backend attempts deterministic resolution using category + item name.

## UI components / hooks
- `StockPurchasePage.jsx`
- `StockPurchaseAddPage.jsx`
- `StockPurchaseItemTracePage.jsx`
- `useEffect`
- `useMemo`
- `useState`
- `useNavigate`
- `useParams`
- `BsBoxArrowUpRight`
- `BsPlusCircleFill`
- `BsTrashFill`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/stock-purchases/`
- `/api/stock-purchases/create/`
- `/api/stock-purchases/<int:pk>/`
- `/api/stock-purchase-items/<int:item_id>/trace/`
- `/api/stock-purchase/status-options/`
- `/api/stock-purchase-vendors/create/`
- `/api/stock-purchase-vendors/<int:pk>/`
