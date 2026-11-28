import { useCallback } from "react";
import StandardListPage from "../components/StandardListPage";
import {
  checkStockPurchaseDownstream,
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

  const checkDeleteAllowedFn = useCallback(async (row) => {
    try {
      const data = await checkStockPurchaseDownstream(row.id);
      if (data?.has_downstream) {
        return {
          allowed: false,
          title: "Cannot Delete Stock Purchase",
          type: "warning",
          message: `Stock Purchase "${row.purchase_id || row.id}" cannot be deleted because purchased item(s) are referenced downstream:`,
          details: data.details || [],
          cancelLabel: "Close",
        };
      }
    } catch (err) {
      if (err?.data?.has_downstream) {
        return {
          allowed: false,
          title: "Cannot Delete Stock Purchase",
          type: "warning",
          message: err.data.message || `Stock Purchase "${row.purchase_id || row.id}" cannot be deleted because purchased item(s) are referenced downstream.`,
          details: err.data.details || [],
          cancelLabel: "Close",
        };
      }
    }
    return {
      allowed: true,
      title: "Confirm Delete Stock Purchase",
      type: "danger",
      message: `Are you sure you want to permanently delete Stock Purchase "${row.purchase_id || row.id}"? This action cannot be undone.`,
      confirmLabel: "Delete Stock Purchase",
      cancelLabel: "Cancel",
    };
  }, []);

  return (
    <StandardListPage
      title="Received Goods"
      columns={COLUMNS}
      fetchRows={fetchRows}
      deleteFn={deleteStockPurchase}
      checkDeleteAllowedFn={checkDeleteAllowedFn}
      showAddButton
      addButtonTo="/stock-purchase/add"
      editButtonTo={(row) => `/stock-purchase/record/${row.id}`}
      showDefaultDelete
      includeAuditColumns={true}
    />
  );
}

export default StockPurchasePage;
