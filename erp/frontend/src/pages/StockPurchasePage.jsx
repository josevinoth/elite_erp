import { useCallback } from "react";
import CrudPage from "../components/CrudPage";
import {
  createStockPurchase,
  deleteStockPurchase,
  listStockPurchases,
  updateStockPurchase,
} from "../services/crudApi";

const COLUMNS = [
  { key: "purchase_number", label: "Purchase ID" },
  { key: "vendor", label: "Vendor" },
  { key: "invoice_number", label: "Invoice #" },
  { key: "purchase_date", label: "Invoice Date" },
  { key: "items_count", label: "Items" },
  { key: "purchase_total", label: "Purchase Total" },
];

function StockPurchasePage() {
  const fields = [
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const fetchFn = useCallback(async () => {
    const data = await listStockPurchases();
    return data.stock_purchases || [];
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createStockPurchase(payload);
    return data.stock_purchase;
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateStockPurchase(id, payload);
    return data.stock_purchase;
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
    <CrudPage
      title="Stock Purchase"
      columns={COLUMNS}
      fields={fields}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteStockPurchase}
      deleteDisabledPredicate={deleteDisabledPredicate}
      deleteDisabledTitle={deleteDisabledTitle}
      addButtonTo="/stock-purchase/add"
      editButtonTo={(row) => `/stock-purchase/record/${row.id}`}
    />
  );
}

export default StockPurchasePage;

