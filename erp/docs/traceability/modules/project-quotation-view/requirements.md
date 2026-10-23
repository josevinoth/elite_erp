# Requirements - project_quotation_view

## Module purpose and business requirement
Shape project-wise quotation responses for accordion rendering and nested BOM hierarchy display.

Source file: `erp_app/sub_views/project_quotation_view.py`

## Functions / views used
- `ProjectQuotationView.get_serializer_context`
- `ProjectQuotationView.list_payload`
- `ProjectQuotationView.detail_payload`
- `ProjectQuotationListView.list_payload`
- `calculate_costs`

## Serializers
- `project_quotation_serializer.py`
- `ProjectQuotationSerializer`

## Database tables / columns
- `Project(id, project_id, project_name, description)`
- `ProjectQuotationItemInfo(quotation_number, project_id, cost_type_id, level, max_cost, min_cost, actual_cost, total_cost, length, width, height, volume)`
- `CostTypeInfo(id, name, description)`

## UI components / hooks
- `ProjectQuotationPage.jsx`
- `details/summary` accordion rendering

## CSS / JS files linked
- `frontend/src/pages/ProjectQuotationPage.jsx`

## Shared helpers
- `erp_app/utils/project_quotation_costs.py`

## API endpoints
- `/api/project-quotations/`
- `/api/project-quotations/<int:pk>/`



