# Function Mapping - stock_manufacture_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | `stock_manufacture_api` | `erp_app/sub_views/stock_manufacture_api.py` |
| Dependency chain | `Item Category → Item Name → Item Code` resolved from `LabFurnitureItem` | `erp_app/serializers.py`, `erp_app/sub_views/stock_manufacture_api.py` |
| Functions / Views | `list_stock_manufacture_items_api_view`, `create_stock_manufacture_item_api_view`, `stock_manufacture_item_detail_api_view` | `erp_app/sub_views/stock_manufacture_api.py` |
| Serializers | `StockManufactureItemSerializer` | `erp_app/serializers.py` |
| Database | `StockManufactureItem(item_category_id, item_code_id, item_name, item_type_id, uom_id, quantity, unit_price, total_price, length, width, height, volume)`, `LabFurnitureItem(id, item_code, item_name, item_category_id, item_type_id, uom_id, length, width, height, volume)` | `erp_app/sub_models` |
| UI | `StockManufacturePage.jsx` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/stock-manufacture/`, `/api/stock-manufacture/create/`, `/api/stock-manufacture/<int:pk>/` | `erp/erp_app/urls.py` |

