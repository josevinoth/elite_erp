import { useCallback } from "react";
import CrudPage from "../components/CrudPage";
import {
  createStockPurchase,
  deleteStockPurchase,
  listStockPurchases,
  updateStockPurchase,
} from "../services/crudApi";

const COLUMNS = [
  { key: "item_name", label: "Item Name" },
  { key: "category", label: "Category" },
  { key: "vendor", label: "Vendor" },
  { key: "quantity", label: "Qty" },
  { key: "unit", label: "Unit" },
  { key: "unit_price", label: "Unit Price" },
  { key: "total_price", label: "Total" },
  { key: "purchase_date", label: "Date" },
  { key: "invoice_number", label: "Invoice #" },
];

const FIELDS = [
  { key: "item_name", label: "Item Name", required: true },
  { key: "category", label: "Category" },
  { key: "vendor", label: "Vendor" },
  { key: "quantity", label: "Quantity", type: "number" },
  { key: "unit", label: "Unit" },
  { key: "unit_price", label: "Unit Price", type: "number" },
  { key: "total_price", label: "Total Price", type: "number" },
  { key: "purchase_date", label: "Purchase Date", type: "date" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "notes", label: "Notes", type: "textarea" },
];

function StockPurchasePage() {
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
      fields={FIELDS}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteStockPurchase}
    />
  );
}

export default StockPurchasePage;

