# SOP: Creating New Pages in Elite ERP Frontend (React)

This SOP ensures all new pages follow the UI/UX and code standards as seen in the LCE List and Add (Costing) pages.

## 1. **Page Structure**
- Use a top-level `<section className="module-page">` for the main container.
- Use a header div with class `crud-page__header` for the page title and main action button (e.g., Add button).
- Use `<h1 className="module-page__title">` for the main title.
- Add a short description below the header using `<p className="module-page__description">`.

## 2. **Table/List Pages**
- Use a table with class `users-table` inside a div with class `users-table-wrap`.
- Show loading and error states with `users-status` and `users-status--error` classes.
- Use action buttons (edit/delete) with `users-action`, `users-action--edit`, and `users-action--delete` classes.
- Always show a message if no records are found.

## 3. **Form/Add/Edit Pages**
- Use a form inside the main section.
- Group related fields with clear headings (e.g., `<h2>` for sections).
- Use consistent input styling, e.g., `auth-input` class or similar.
- Use dropdowns/searchable selects for foreign keys or large option sets.
- Place Save/Submit buttons at the bottom, styled as primary actions.
- Show validation errors and loading states clearly.

## 4. **Buttons & Actions**
- Use `crud-add-btn` for main add/create actions.
- Use `users-action` for row actions (edit/delete).
- Use clear, descriptive button text and tooltips.

## 5. **Styling**
- Use the color palette and spacing from `auth_common.css` and existing modules.
- Use card-like backgrounds (`card-bg`, `card-bg-elev`) for form sections.
- Use consistent margin and padding (see LCE/Costing pages for reference).

## 6. **Navigation**
- Add new pages to `homeNavigation.js` with appropriate label, route, and icon.
- Add a `<Route>` in `App.jsx` for the new page, using a secure route wrapper if needed.

## 7. **Code Practices**
- Use functional components and React hooks.
- Keep API calls in `services/`.
- Use state for form and table data, and handle loading/error states.
- Use utility functions for formatting and calculations.

## 8. **Accessibility & UX**
- Use labels for all inputs.
- Use aria-labels for icon buttons.
- Ensure keyboard navigation is possible.

## 9. **Testing**
- Test for empty, loading, error, and normal states.
- Validate all form fields and edge cases.

## 10. **Dropdowns/Foreign Keys**
- All dropdown fields should be linked to a primary key from another table (foreign key relationship).
- Always try to reuse existing tables for dropdown options before creating new tables.
- Dropdowns must fetch their options from the backend (API) or a shared service, not hardcoded in the component.
- Use searchable/selectable dropdowns for large datasets.

## 11. **Dialog/Popup Pages**
- For any page or form requested as a popup/dialog, use the Task Add/Edit modal (from `CrudPage.jsx` as used in `TaskPage.jsx`) as the standard.
- The modal should have:
  - Overlay background and centered card (`modal-overlay`, `modal-card` classes)
  - Title, close button, and form fields styled as in Task Add/Edit
  - Save/Cancel actions at the bottom
  - All dropdowns in the modal must follow the foreign key standard above
- Reference: `src/components/CrudPage.jsx` and `src/pages/TaskPage.jsx`

---

**Reference:**
- LCE List: `src/pages/LceListPage.jsx`
- LCE Add/Edit: `src/pages/CostingPage.jsx`

**Always review these files for the latest standards before starting a new page.**
