# Requirements - ProjectQuotationPage

## Page purpose and business requirement
Create, list, edit, and delete project quotation rows inside a project-wise accordion while preserving BOM level hierarchy.

- Accordion cards are collapsed by default and grouped per project.
- Add flow inserts quotation items one by one on the same page.
- BOM display uses `level` indentation so parent/child relationships are visible.
- Item dependency order is strictly `Item Category → Item Name → Item Code` when `cost_type = MATERIAL`.
- `Item Category`, `Item Name`, and `Item Code` must stay disabled when `cost_type != MATERIAL`.
- `cost_per_qty` is auto-fetched from stock/item costing preview after choosing an item code.
- `total_cost` is calculated client-side as `requested_qty × cost_per_qty` and revalidated on the backend.
- If `requested_qty < purchase_qty`, show a confirmation prompt before save.
- BOM hierarchy validation errors from the backend must be surfaced to the user.

Source file: `frontend/src/pages/ProjectQuotationPage.jsx`

## Functions / views used
- `list_project_quotations_api_view`
- `create_project_quotation_item_api_view`
- `project_quotation_item_detail_api_view`
- `item_costing_cost_preview_api_view`
- `list_lab_furniture_item_categories_api_view`
- `list_lab_furniture_items_api_view`

## Serializers
- `project_quotation_serializer.py`
- `ProjectQuotationSerializer`

## Database tables / columns
- `Project(id, project_id, project_name, description)`
- `CostTypeInfo(id, name, description)`
- `ProjectQuotationItemInfo(project_id, cost_type_id, level, item_category_id, item_name, item_code_id, requested_qty, purchase_qty, cost_per_qty, total_cost)`
- `ItemCategory(id, name)`
- `LabFurnitureItem(id, item_category_id, item_name, item_code)`

## UI components / hooks
- `ProjectQuotationPage.jsx`
- `useCallback`
- `useEffect`
- `useMemo`
- `useRef`
- `useState`
- `details/summary`
- `BsPencilSquare`
- `BsCheckCircleFill`
- `BsPlusCircleFill`
- `BsTrashFill`
- `BsXCircleFill`

## CSS / JS files linked
- `frontend/src/services/crudApi.js`
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/project-quotations/`
- `/api/project-quotations/create/`
- `/api/project-quotations/<int:pk>/`
- `/api/lab-furniture-item-categories/`
- `/api/lab-furniture-items/`
- `/api/itemcosting/cost-preview/`

