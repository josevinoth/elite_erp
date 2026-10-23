# Function Mapping - CutSheetOptimiser

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Page | CutSheetOptimiser | `frontend/src/pages/CutSheetOptimiser.jsx` |
| Functions / Views | `list_cut_optimiser`, `create_cut_optimiser`, `cut_optimiser_detail`, `list_cut_sizes`, `cut_size_detail` | `frontend/src/pages/CutSheetOptimiser.jsx` |
| Serializers | `N/A` | `erp_app/serializers` |
| Database | `CutOptimiser(id)`, `CutSize(id)` | `erp_app/sub_models` |
| UI | `CutOptimiserListPage.jsx`, `CutOptimiserPage.jsx`, `CutSheetOptimiser.jsx` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/cut-optimiser/`, `/api/cut-optimiser/create/`, `/api/cut-optimiser/<int:pk>/`, `/api/cut-optimiser/<int:cut_optimiser_id>/cut-sizes/`, `/api/cut-optimiser/<int:cut_optimiser_id>/cut-sizes/<int:cut_size_id>/` | `erp/erp_app/urls.py` |
