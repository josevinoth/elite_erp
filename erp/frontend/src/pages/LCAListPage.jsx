import { useCallback } from "react";
import StandardListPage from "../components/StandardListPage";
import { deleteLcaActualsById, listLcaActuals } from "../services/crudApi";

const COLUMNS = [
  { key: "lca_id", label: "LCA ID", align: "center", headerAlign: "center" },
  { key: "total_supplier_price", label: "Supplier Price", align: "center", headerAlign: "center" },
  { key: "total_supplier_price_omr", label: "Supplier Price (OMR)", align: "center", headerAlign: "center" },
  { key: "total", label: "Total", align: "center", headerAlign: "center" },
  { key: "updated_by", label: "Updated By", align: "center", headerAlign: "center" },
  { key: "updated_on", label: "Updated On", align: "center", headerAlign: "center" },
];

function LCAListPage() {
  const fetchRows = useCallback(async () => {
    const data = await listLcaActuals();
    const rows = Array.isArray(data?.lca_actuals) ? data.lca_actuals : [];
    return rows.map((row) => ({
      ...row,
      lca_id: row.lca_id || `LCA_${String(row.id).padStart(3, "0")}`,
    }));
  }, []);

  return (
    <StandardListPage
      title="Landing Cost Actuals (LCA) List"
      columns={COLUMNS}
      fetchRows={fetchRows}
      rowKey="id"
      showAddButton
      addButtonTo="/projects/lca/add"
      addButtonLabel="Add LCA"
      editButtonTo={(row) => `/projects/lca/record/${row.id}`}
      deleteFn={deleteLcaActualsById}
      deleteConfirmFn={(row) => `Are you sure you want to delete LCA_${String(row.id).padStart(3, "0")}?`}
      showDefaultDelete
      includeAuditColumns={true}
      exportFileName="Landing Cost Actuals (LCA) List"
      defaultPageSize={20}
      pageSizeOptions={[10, 20, 50, 100]}
      tableMaxHeight="62vh"
    />
  );
}

export default LCAListPage;
