# Requirements - stock_manufacture_api

## Module purpose and business requirement
Expose dedicated StockManufactureItem list/create/update/delete APIs and keep item master derived fields (`item_name`, `item_type`, `uom`, and dimensions) in sync.

- Validate required item-master derived fields before save.
- Enforce uniqueness for manufacturing records by `item_code`.

Source file: `erp_app/sub_views/stock_manufacture_api.py`

## Functions / views used
- `list_stock_manufacture_items_api_view`
- `create_stock_manufacture_item_api_view`
- `stock_manufacture_item_detail_api_view`

## Serializers
- `StockManufactureItemSerializer`

## Database tables / columns
- `StockManufactureItem(item_category_id, item_code_id, item_name, item_type_id, uom_id, quantity, unit_price, total_price, length, width, height, volume)`
- `LabFurnitureItem(id, item_code, item_name, item_category_id, item_type_id, uom_id, length, width, height, volume)`

## UI components / hooks
- `StockManufacturePage.jsx`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/stock-manufacture/`
- `/api/stock-manufacture/create/`
- `/api/stock-manufacture/<int:pk>/`

