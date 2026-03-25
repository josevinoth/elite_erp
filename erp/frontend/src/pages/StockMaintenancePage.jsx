import { useCallback, useEffect, useMemo, useState } from "react";
import CrudPage from "../components/CrudPage";
import {
  addStockMaintenanceTypeOption,
  createStockMaintenance,
  deleteStockMaintenance,
  listStockMaintenanceMeta,
  listStockMaintenance,
  updateStockMaintenance,
} from "../services/crudApi";

const COLUMNS = [
  { key: "item_name", label: "Item Name" },
  { key: "category", label: "Category" },
  { key: "movement_type", label: "Type" },
  { key: "quantity", label: "Qty" },
  { key: "unit", label: "Unit" },
  { key: "location", label: "Location" },
  { key: "movement_date", label: "Date" },
];

function StockMaintenancePage() {
  const [movementTypes, setMovementTypes] = useState([]);

  const mapOptions = (values = []) => {
    const unique = Array.from(new Set(values.filter(Boolean).map((v) => String(v).trim())));
    return unique.map((v) => ({ value: v, label: v }));
  };

  const loadMeta = useCallback(async () => {
    const data = await listStockMaintenanceMeta();
    setMovementTypes(mapOptions(data.movement_types));
  }, []);

  useEffect(() => {
    loadMeta().catch(() => {
      setMovementTypes([]);
    });
  }, [loadMeta]);

  const appendMovementType = async (name) => {
    const data = await addStockMaintenanceTypeOption(name);
    await loadMeta();
    return data.name;
  };

  const fields = useMemo(
    () => [
      { key: "item_name", label: "Item Name", required: true },
      { key: "category", label: "Category" },
      {
        key: "movement_type",
        label: "Movement Type",
        options: movementTypes,
        onAppend: appendMovementType,
      },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "unit", label: "Unit" },
      { key: "location", label: "Location" },
      { key: "movement_date", label: "Movement Date", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    [movementTypes]
  );

  const fetchFn = useCallback(async () => {
    const data = await listStockMaintenance();
    return data.stock_maintenance || [];
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createStockMaintenance(payload);
    return data.stock_maintenance;
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateStockMaintenance(id, payload);
    return data.stock_maintenance;
  }, []);

  return (
    <CrudPage
      title="Stock Maintenance"
      columns={COLUMNS}
      fields={fields}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteStockMaintenance}
    />
  );
}

export default StockMaintenancePage;

