import { useCallback } from "react";
import CrudPage from "./CrudPage";

async function noopCreate(payload) {
  return payload;
}

async function noopUpdate(_id, payload) {
  return payload;
}

async function noopDelete() {
  return;
}

function StandardListPage({
  title,
  columns,
  fetchRows,
  rowKey = "id",
  addButtonTo = null,
  showAddButton = false,
  showExportButton = true,
  exportFileName = null,
  includeAuditColumns = false,
  tableMaxHeight = "62vh",
  stickyHeader = true,
  defaultPageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  enablePagination = true,
  rowActions = [],
  renderHeaderActions = null,
  renderFooter = null,
  editButtonTo = null,
  deleteFn = null,
  deleteDisabledPredicate = null,
  deleteDisabledTitle = "Delete",
  deleteConfirmFn = null,
  showDefaultEdit = false,
  showDefaultDelete = false,
}) {
  const fetchFn = useCallback(async () => {
    const data = await fetchRows();
    return Array.isArray(data) ? data : [];
  }, [fetchRows]);

  return (
    <CrudPage
      title={title}
      columns={columns}
      fields={[]}
      fetchFn={fetchFn}
      createFn={noopCreate}
      updateFn={noopUpdate}
      deleteFn={deleteFn || noopDelete}
      rowKey={rowKey}
      addButtonTo={addButtonTo}
      showAddButton={showAddButton}
      showExportButton={showExportButton}
      exportFileName={exportFileName || title}
      includeAuditColumns={includeAuditColumns}
      tableMaxHeight={tableMaxHeight}
      stickyHeader={stickyHeader}
      defaultPageSize={defaultPageSize}
      pageSizeOptions={pageSizeOptions}
      enablePagination={enablePagination}
      rowActions={rowActions}
      renderHeaderActions={renderHeaderActions}
      renderFooter={renderFooter}
      editButtonTo={editButtonTo}
      deleteDisabledPredicate={deleteDisabledPredicate}
      deleteDisabledTitle={deleteDisabledTitle}
      deleteConfirmFn={deleteConfirmFn}
      showEditButton={showDefaultEdit}
      showDeleteButton={showDefaultDelete}
    />
  );
}

export default StandardListPage;

