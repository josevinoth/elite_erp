# Requirements - CdcTeamExpencePage

## Page purpose and business requirement
Manage CDC team expense records.

Source file: `frontend/src/pages/CdcTeamExpencePage.jsx`

## Functions / views used
- `list_cdc_team_expense_meta_api_view`
- `list_cdc_team_expenses_api_view`
- `create_cdc_team_expense_api_view`
- `cdc_team_expense_detail_api_view`
- `cdc_team_expense_bulk_update_api_view`
- `create_expense_item_option_api_view`
- `create_expense_status_option_api_view`
- `create_expense_session_option_api_view`
- `import_cdc_team_expenses_excel_api_view`
- `download_cdc_team_expense_template_api_view`

## Serializers
- `N/A`

## Database tables / columns
- `CDCTeamExpense(id)`
- `ExpenseItem(id, name)`
- `ExpenseStatusOption(id, name)`
- `ExpenseSessionOption(id, name)`

## UI components / hooks
- `CdcTeamExpencePage.jsx`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/cdc-team-expence/meta/`
- `/api/cdc-team-expence/`
- `/api/cdc-team-expence/create/`
- `/api/cdc-team-expence/import/`
- `/api/cdc-team-expence/template/`
- `/api/cdc-team-expence/bulk-update/`
- `/api/cdc-team-expence/<int:pk>/`
- `/api/cdc-team-expence/item-options/add/`
- `/api/cdc-team-expence/status-options/add/`
- `/api/cdc-team-expence/session-options/add/`
