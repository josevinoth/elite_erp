import { useCallback } from "react";
import StandardListPage from "../components/StandardListPage";
import { deleteLceEstimateById, listLceEstimates } from "../services/crudApi";

const COLUMNS = [
  { key: "lce_id", label: "LCE ID", align: "center", headerAlign: "center" },
  { key: "total_supplier_price", label: "Supplier Price", align: "center", headerAlign: "center" },
  { key: "total_supplier_price_omr", label: "Supplier Price (OMR)", align: "center", headerAlign: "center" },
  { key: "total", label: "Total", align: "center", headerAlign: "center" },
  { key: "updated_by", label: "Updated By", align: "center", headerAlign: "center" },
  { key: "updated_on", label: "Updated On", align: "center", headerAlign: "center" },
];

function LceListPage() {
  const fetchRows = useCallback(async () => {
    const data = await listLceEstimates();
    const rows = Array.isArray(data?.lce_estimates) ? data.lce_estimates : [];
    return rows.map((row) => ({
      ...row,
      lce_id: row.lce_id || `LCE_${String(row.id).padStart(3, "0")}`,
    }));
  }, []);

  return (
    <StandardListPage
      title="Landing Cost Estimate (LCE) List"
      columns={COLUMNS}
      fetchRows={fetchRows}
      rowKey="id"
      showAddButton
      addButtonTo="/projects/costing/add"
      addButtonLabel="Add LCE"
      editButtonTo={(row) => `/projects/costing/record/${row.id}`}
      deleteFn={deleteLceEstimateById}
      deleteConfirmFn={(row) => `Are you sure you want to delete LCE_${String(row.id).padStart(3, "0")}?`}
      showDefaultDelete
      includeAuditColumns={true}
      exportFileName="Landing Cost Estimate (LCE) List"
      defaultPageSize={20}
      pageSizeOptions={[10, 20, 50, 100]}
      tableMaxHeight="62vh"
    />
  );
}

export default LceListPage;
