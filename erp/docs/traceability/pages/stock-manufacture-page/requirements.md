# Requirements - StockManufacturePage

## Page purpose and business requirement
Create, list, edit, and delete in-house manufacturing rows on the same page without navigating to a separate add/edit route.

- Dropdown dependency order is strictly `Item Category → Item Name → Item Code`.
- `Item Name` options are filtered by the selected `Item Category` from `LabFurnitureItem`.
- `Item Code` is derived from the selected `Item Name` and displayed read-only.
- Existing `StockManufactureItem` rows must render category, name, and code consistently from the API.
- Action column uses icon-based Edit/Save controls.
- Desktop shows icon + label with tooltips; mobile shows compact icon-only buttons.
- Before save, validate `item_name`, `item_type`, and `uom`; block duplicate `item_code` rows.

Source file: `frontend/src/pages/StockManufacturePage.jsx`

## Functions / views used
- `list_stock_manufacture_items_api_view`
- `create_stock_manufacture_item_api_view`
- `stock_manufacture_item_detail_api_view`

## Serializers
- `StockManufactureItemSerializer`

## Database tables / columns
- `StockManufactureItem(item_category_id, item_code_id, item_name, item_type_id, uom_id, quantity, unit_price, total_price, length, width, height, volume)`
- `ItemCategory(id, name)`
- `LabFurnitureItem(id, item_code, item_name, item_category_id, item_type_id, uom_id, length, width, height, volume)`
- `ItemType_info(id, it_name)`
- `UOM(id, name, symbol)`

## UI components / hooks
- `StockManufacturePage.jsx`
- `useEffect`
- `useRef`
- `useState`
- `BsPencilSquare`
- `BsCheckCircleFill`
- `BsPlusCircleFill`
- `BsTrashFill`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/stock-manufacture/`
- `/api/stock-manufacture/create/`
- `/api/stock-manufacture/<int:pk>/`

