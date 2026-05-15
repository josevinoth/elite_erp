import { useCallback } from "react";
import CrudPage from "../components/CrudPage";
import {
  createStockPurchase,
  deleteStockPurchase,
  listStockPurchases,
  updateStockPurchase,
} from "../services/crudApi";

const COLUMNS = [
  { key: "id", label: "Purchase ID" },
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

  return (
    <CrudPage
      title="Stock Purchase"
      columns={COLUMNS}
      fields={fields}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteStockPurchase}
      addButtonTo="/stock-purchase/add"
      editButtonTo={(row) => `/stock-purchase/record/${row.id}`}
    />
  );
}

export default StockPurchasePage;

