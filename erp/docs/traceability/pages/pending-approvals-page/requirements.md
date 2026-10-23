# Requirements - PendingApprovalsPage

## Page purpose and business requirement
Show pending approval items for project layout drawings.

Source file: `frontend/src/pages/PendingApprovalsPage.jsx`

## Functions / views used
- `list_layout_drawing_approvals_api_view`
- `list_project_layout_drawings_api_view`
- `save_project_layout_drawings_api_view`
- `project_layout_drawing_view`

## Serializers
- `ProjectLayoutDrawingSerializer.py`

## Database tables / columns
- `Project(id, project_id, project_name)`
- `ProjectLayoutDrawing(id)`
- `ProjectLayoutDrawingAttachment(id)`

## UI components / hooks
- `ProjectLayoutDrawingSection.jsx`
- `LayoutDrawingApprovalPage.jsx`
- `PendingApprovalsPage.jsx`

## CSS / JS files linked
- `frontend/src/styles/auth_common.css`

## API endpoints
- `/api/projects/layout-drawing-approvals/`
- `/api/projects/<int:project_id>/layout-drawings/`
- `/api/projects/<int:project_id>/layout-drawings/save/`
