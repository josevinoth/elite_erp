# Requirements - views_cut_optimiser

## Module purpose and business requirement
Expose cut optimiser list, create, detail, and cut size endpoints.

Source file: `erp_app/sub_views/views_cut_optimiser.py`

## Functions / views used
- `list_cut_optimiser`
- `create_cut_optimiser`
- `cut_optimiser_detail`
- `list_cut_sizes`
- `cut_size_detail`

## Serializers
- `N/A`

## Database tables / columns
- `CutOptimiser(id)`
- `CutSize(id)`

## UI components / hooks
- `CutOptimiserListPage.jsx`
- `CutOptimiserPage.jsx`
- `CutSheetOptimiser.jsx`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/cut-optimiser/`
- `/api/cut-optimiser/create/`
- `/api/cut-optimiser/<int:pk>/`
- `/api/cut-optimiser/<int:cut_optimiser_id>/cut-sizes/`
- `/api/cut-optimiser/<int:cut_optimiser_id>/cut-sizes/<int:cut_size_id>/`
