# Function Mapping - CdcTeamExpencePage

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Page | CdcTeamExpencePage | `frontend/src/pages/CdcTeamExpencePage.jsx` |
| Functions / Views | `list_cdc_team_expense_meta_api_view`, `list_cdc_team_expenses_api_view`, `create_cdc_team_expense_api_view`, `cdc_team_expense_detail_api_view`, `cdc_team_expense_bulk_update_api_view`, `create_expense_item_option_api_view`, `create_expense_status_option_api_view`, `create_expense_session_option_api_view`, `import_cdc_team_expenses_excel_api_view`, `download_cdc_team_expense_template_api_view` | `frontend/src/pages/CdcTeamExpencePage.jsx` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `CDCTeamExpense(id)`, `ExpenseItem(id, name)`, `ExpenseStatusOption(id, name)`, `ExpenseSessionOption(id, name)` | `erp_app/sub_models` |
| UI | `CdcTeamExpencePage.jsx` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/cdc-team-expence/meta/`, `/api/cdc-team-expence/`, `/api/cdc-team-expence/create/`, `/api/cdc-team-expence/import/`, `/api/cdc-team-expence/template/`, `/api/cdc-team-expence/bulk-update/`, `/api/cdc-team-expence/<int:pk>/`, `/api/cdc-team-expence/item-options/add/`, `/api/cdc-team-expence/status-options/add/`, `/api/cdc-team-expence/session-options/add/` | `erp/erp_app/urls.py` |
