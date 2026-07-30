# Function Mapping - lce_costing_api

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | lce_costing_api | `erp_app/sub_views/lce_costing_api.py` |
| Functions / Views | `list_lce_estimates_api_view`, `lce_estimate_meta_api_view`, `create_lce_estimate_api_view`, `lce_estimate_record_api_view`, `lce_purchase_items_api_view`, `list_lce_cost_details_api_view`, `list_lce_cost_details_by_project_api_view`, `create_lce_cost_detail_api_view`, `lce_cost_detail_api_view`, `bulk_save_lce_cost_details_api_view`, `calculate_lce_cost_index_api_view`, `create_lce_charge_type_option_api_view`, `download_lce_costing_template_api_view`, `import_lce_costing_excel_api_view`, `export_lce_costing_excel_api_view` | `erp_app/sub_views/lce_costing_api.py` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `LCEEstimate(id)`, `LCECostDetail(id)`, `Project(id, project_id, project_name)`, `StockPurchaseItem(id, item_code_id, total_price, lce_cost)` | `erp_app/sub_models` |
| UI | `LceListPage.jsx`, `CostingPage.jsx`, `useEffect`, `useMemo`, `useState` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/lce-estimates/`, `/api/lce-estimates/meta/`, `/api/lce-estimates/charge-types/add/`, `/api/lce-estimates/create/`, `/api/lce-estimates/record/<int:lce_id>/`, `/api/lce-estimates/purchase-items/<int:purchase_id>/`, `/api/lce-costing/meta/`, `/api/lce-costing/`, `/api/lce-costing/create/`, `/api/lce-costing/template/`, `/api/lce-costing/import/`, `/api/lce-costing/export/`, `/api/lce-costing/bulk-save/`, `/api/lce-costing/by-project/<int:project_id>/`, `/api/lce-costing/cost-index/calculate/`, `/api/lce-costing/<int:pk>/` | `erp/erp_app/urls.py` |
