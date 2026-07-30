# Requirements - StockItemsPage

## Page purpose and business requirement
Maintain Item Master records, item categories, UOM, and dimensions.

Source file: `frontend/src/pages/StockItemsPage.jsx`

## Functions / views used
- `list_lab_furniture_items_api_view`
- `list_lab_furniture_item_categories_api_view`
- `create_lab_furniture_item_category_api_view`
- `create_lab_furniture_item_api_view`
- `lab_furniture_item_detail_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `LabFurnitureItem(item_name, item_code, item_category_id, uom_id, length, width, height, volume)`
- `ItemCategory(id, name)`
- `UOM(id, name, symbol)`

## UI components / hooks
- `StockItemsPage.jsx`
- `CrudPage.jsx`
- `Select`
- `useCallback`
- `useEffect`
- `useState`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`
- `frontend/src/components/CrudPage.jsx`
- `frontend/src/components/PaginationControls.jsx`

## API endpoints
- `/api/lab-furniture-items/`
- `/api/lab-furniture-item-categories/`
- `/api/lab-furniture-item-categories/create/`
- `/api/lab-furniture-items/create/`
- `/api/lab-furniture-items/<int:pk>/`
- `/api/uoms/`
