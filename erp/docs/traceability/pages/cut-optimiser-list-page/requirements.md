# Requirements - CutOptimiserListPage

## Page purpose and business requirement
List cut optimiser records.

Source file: `frontend/src/pages/CutOptimiserListPage.jsx`

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
