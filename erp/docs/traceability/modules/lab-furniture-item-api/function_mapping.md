# Function Mapping - lab_furniture_item_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | lab_furniture_item_api | `erp_app/sub_views/lab_furniture_item_api.py` |
| Functions / Views | `list_lab_furniture_items_api_view`, `list_lab_furniture_item_categories_api_view`, `create_lab_furniture_item_category_api_view`, `create_lab_furniture_item_api_view`, `lab_furniture_item_detail_api_view` | `erp_app/sub_views/lab_furniture_item_api.py` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `LabFurnitureItem(item_name, item_code, item_category_id, uom_id, length, width, height, volume)`, `ItemCategory(id, name)`, `UOM(id, name, symbol)` | `erp_app/sub_models` |
| UI | `StockItemsPage.jsx`, `CrudPage.jsx`, `Select`, `useCallback`, `useEffect`, `useState` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css`, `frontend/src/components/CrudPage.jsx`, `frontend/src/components/PaginationControls.jsx` | `frontend/src/styles` |
| API | `/api/lab-furniture-items/`, `/api/lab-furniture-item-categories/`, `/api/lab-furniture-item-categories/create/`, `/api/lab-furniture-items/create/`, `/api/lab-furniture-items/<int:pk>/`, `/api/uoms/` | `erp/erp_app/urls.py` |
