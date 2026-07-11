import { useCallback } from "react";
import StandardListPage from "../components/StandardListPage";
import {
  deleteStockPurchase,
  listStockPurchases,
} from "../services/crudApi";

const COLUMNS = [
  { key: "purchase_id", label: "Purchase ID" },
  { key: "vendor", label: "Vendor" },
  { key: "invoice_number", label: "Invoice #" },
  { key: "invoice_date", label: "Invoice Date" },
  { key: "items_count", label: "Items" },
  { key: "purchase_total", label: "Purchase Total" },
];

function StockPurchasePage() {
  const fetchRows = useCallback(async () => {
    const data = await listStockPurchases();
    return data.stock_purchases || [];
  }, []);

  const deleteDisabledPredicate = useCallback((row) => {
    return Number(row.lce_linked_count) > 0;
  }, []);

  const deleteDisabledTitle = useCallback((row) => {
    const count = Number(row.lce_linked_count) || 0;
    if (count > 0) {
      return `Cannot delete: ${count} item(s) in this purchase are linked to an LCE estimate. Please unlink them from LCE first.`;
    }
    return "Delete";
  }, []);

  return (
    <StandardListPage
      title="Stock Purchase"
      columns={COLUMNS}
      fetchRows={fetchRows}
      deleteFn={deleteStockPurchase}
      deleteDisabledPredicate={deleteDisabledPredicate}
      deleteDisabledTitle={deleteDisabledTitle}
      showAddButton
      addButtonTo="/stock-purchase/add"
      editButtonTo={(row) => `/stock-purchase/record/${row.id}`}
      showDefaultEdit
      showDefaultDelete
      includeAuditColumns={false}
    />
  );
}

export default StockPurchasePage;
