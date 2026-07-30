# Function Mapping - project_layout_drawing_view

| Layer | Functions/Components | Linked Files/Modules |
|---|---|---|
| Module | project_layout_drawing_view | `erp_app/sub_views/project_layout_drawing_view.py` |
| Functions / Views | `list_layout_drawing_approvals_api_view`, `list_project_layout_drawings_api_view`, `save_project_layout_drawings_api_view`, `project_layout_drawing_view` | `erp_app/sub_views/project_layout_drawing_view.py` |
| Serializers | `ProjectLayoutDrawingSerializer.py` | `erp_app/serializers` |
| Database | `Project(id, project_id, project_name)`, `ProjectLayoutDrawing(id)`, `ProjectLayoutDrawingAttachment(id)` | `erp_app/sub_models` |
| UI | `ProjectLayoutDrawingSection.jsx`, `LayoutDrawingApprovalPage.jsx`, `PendingApprovalsPage.jsx` | `frontend/src/pages` |
| CSS / JS | `frontend/src/styles/auth_common.css` | `frontend/src/styles` |
| API | `/api/projects/layout-drawing-approvals/`, `/api/projects/<int:project_id>/layout-drawings/`, `/api/projects/<int:project_id>/layout-drawings/save/` | `erp/erp_app/urls.py` |
