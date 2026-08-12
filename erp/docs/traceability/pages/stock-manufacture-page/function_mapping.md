# Function Mapping - StockManufacturePage

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Page | `StockManufacturePage` | `frontend/src/pages/StockManufacturePage.jsx` |
| Dependency chain | `Item Category → Item Name → Item Code` via `LabFurnitureItem` lookup | `frontend/src/pages/StockManufacturePage.jsx`, `erp_app/serializers.py`, `erp_app/sub_views/stock_manufacture_api.py` |
| Functions / Views | `list_stock_manufacture_items_api_view`, `create_stock_manufacture_item_api_view`, `stock_manufacture_item_detail_api_view` | `erp_app/sub_views/stock_manufacture_api.py` |
| Serializers | `StockManufactureItemSerializer` | `erp_app/serializers.py` |
| Database | `StockManufactureItem(item_category_id, item_code_id, item_name, item_type_id, uom_id, quantity, unit_price, total_price, length, width, height, volume)`, `ItemCategory(id, name)`, `LabFurnitureItem(id, item_code, item_name, item_category_id, item_type_id, uom_id, length, width, height, volume)`, `ItemType_info(id, it_name)`, `UOM(id, name, symbol)` | `erp_app/sub_models` |
| UI | `StockManufacturePage.jsx`, `useEffect`, `useRef`, `useState`, `BsPencilSquare`, `BsCheckCircleFill`, `BsPlusCircleFill`, `BsTrashFill` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/stock-manufacture/`, `/api/stock-manufacture/create/`, `/api/stock-manufacture/<int:pk>/` | `erp/erp_app/urls.py` |

