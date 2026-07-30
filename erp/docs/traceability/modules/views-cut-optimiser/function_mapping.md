# Function Mapping - views_cut_optimiser

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | views_cut_optimiser | `erp_app/sub_views/views_cut_optimiser.py` |
| Functions / Views | `list_cut_optimiser`, `create_cut_optimiser`, `cut_optimiser_detail`, `list_cut_sizes`, `cut_size_detail` | `erp_app/sub_views/views_cut_optimiser.py` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `CutOptimiser(id)`, `CutSize(id)` | `erp_app/sub_models` |
| UI | `CutOptimiserListPage.jsx`, `CutOptimiserPage.jsx`, `CutSheetOptimiser.jsx` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/cut-optimiser/`, `/api/cut-optimiser/create/`, `/api/cut-optimiser/<int:pk>/`, `/api/cut-optimiser/<int:cut_optimiser_id>/cut-sizes/`, `/api/cut-optimiser/<int:cut_optimiser_id>/cut-sizes/<int:cut_size_id>/` | `erp/erp_app/urls.py` |
