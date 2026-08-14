# Requirements - project_quotation_view

## Module purpose and business requirement
Shape project-wise quotation responses for accordion rendering and nested BOM hierarchy display.

Source file: `erp_app/sub_views/project_quotation_view.py`

## Functions / views used
- `ProjectQuotationView.get_serializer_context`
- `ProjectQuotationView.list_payload`
- `ProjectQuotationView.detail_payload`

## Serializers
- `project_quotation_serializer.py`
- `ProjectQuotationSerializer`

## Database tables / columns
- `Project(id, project_id, project_name, description)`
- `ProjectQuotationItemInfo(project_id, cost_type_id, level, total_cost)`
- `CostTypeInfo(id, name, description)`

## UI components / hooks
- `ProjectQuotationPage.jsx`
- `details/summary` accordion rendering

## CSS / JS files linked
- `frontend/src/pages/ProjectQuotationPage.jsx`

## API endpoints
- `/api/project-quotations/`
- `/api/project-quotations/<int:pk>/`

