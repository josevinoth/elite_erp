import { useCallback, useEffect, useState } from "react";
import CrudPage from "../components/CrudPage";
import {
  createLabFurnitureItem,
  deleteLabFurnitureItem,
  listItemCodeNames,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listUoms,
  listItemTypes,
  updateLabFurnitureItem,
} from "../services/crudApi";

const COLUMNS = [
  { key: "item_category", label: "Item Category" },
  { key: "item_name", label: "Item Name" },
  { key: "item_code", label: "Item Code" },
  { key: "item_type", label: "Item Type" },
  { key: "uom", label: "UOM" },
  { key: "length", label: "Length/Size" },
  { key: "width", label: "Width" },
  { key: "height", label: "Height/Thk" },
  { key: "volume", label: "Volume" },
  { key: "recommended_free_stock_qty", label: "Recommended Free Stock Qty" },
  { key: "warning_alert_qty", label: "Warning Alert Qty" },
  { key: "to_order_qty", label: "To Order Qty" },
  { key: "physical_plus_ordered_qty", label: "Physical + Ordered Qty" },
  { key: "physical_qty", label: "Physical Qty" },
  { key: "ordered_qty", label: "Ordered Qty" },
  { key: "total_reqd", label: "Total Reqd" },
];

const FIELDS = [
  { key: "item_category_id", label: "Item Category", required: true },
  { key: "item_code_ref_id", label: "Item Code", required: true },
  { key: "item_code", label: "Item Code", readOnly: true },
  { key: "item_name", label: "Item Name", readOnly: true },
  { key: "item_type_id", label: "Item Type", required: false },
  { key: "uom_id", label: "UOM", required: false },
  { key: "length", label: "Length/Size", type: "number", min: 0, step: "any", default: "0" },
  { key: "width", label: "Width", type: "number", min: 0, step: "any", default: "0" },
  { key: "height", label: "Height/Thk", type: "number", min: 0, step: "any", default: "0" },
  { key: "volume", label: "Volume", type: "number", readOnly: true, default: "0" },
  { key: "recommended_free_stock_qty", label: "Recommended Free Stock Qty", type: "number", min: 0, step: 1, default: "0" },
  { key: "warning_alert_qty", label: "Warning Alert Qty", type: "number", min: 0, step: 1, default: "0" },
  { key: "to_order_qty", label: "To Order Qty", type: "number", min: 0, step: 1, default: "0" },
  { key: "physical_plus_ordered_qty", label: "Physical + Ordered Qty", type: "number", min: 0, step: 1, default: "0" },
  { key: "physical_qty", label: "Physical Qty", type: "number", min: 0, step: 1, default: "0" },
  { key: "ordered_qty", label: "Ordered Qty", type: "number", min: 0, step: 1, default: "0" },
  { key: "total_reqd", label: "Total Reqd", type: "number", min: 0, step: 1, default: "0" },
];

const QUANTITY_KEYS = [
  "recommended_free_stock_qty",
  "warning_alert_qty",
  "to_order_qty",
  "physical_plus_ordered_qty",
  "physical_qty",
  "ordered_qty",
  "total_reqd",
];

function withQuantityDefaults(row = {}) {
  const next = { ...row };
  QUANTITY_KEYS.forEach((key) => {
    next[key] = row[key] === "" || row[key] == null ? 0 : row[key];
  });
  return next;
}

function StockItemsPage() {
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [itemCodeOptions, setItemCodeOptions] = useState([]);
  const [uomOptions, setUomOptions] = useState([]);
  const [itemTypeOptions, setItemTypeOptions] = useState([]);

  const loadCategories = useCallback(async () => {
    const data = await listLabFurnitureItemCategories();
    const categories = Array.isArray(data.item_categories)
      ? data.item_categories.map((category) => ({
          value: String(category.id),
          label: category.name,
        }))
      : [];
    setCategoryOptions(categories);
    return categories;
  }, []);

  const loadItemCodeNames = useCallback(async () => {
    const data = await listItemCodeNames();
    const rows = Array.isArray(data.item_code_names) ? data.item_code_names : [];
    const options = rows.map((itemCodeName) => ({
      value: String(itemCodeName.id),
      label: itemCodeName.label,
      itemCode: itemCodeName.item_code,
      itemName: itemCodeName.item_name,
    }));
    setItemCodeOptions(options);
    return options;
  }, []);

  const loadUoms = useCallback(async () => {
    const data = await listUoms();
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.uoms) ? data.uoms : []);
    const options = rows.map((uom) => ({
      value: String(uom.id),
      label: `${uom.name} (${uom.symbol})`,
    }));
    setUomOptions(options);
    return options;
  }, []);

  const loadItemTypes = useCallback(async () => {
    const data = await listItemTypes();
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.item_types) ? data.item_types : []);
    const options = rows.map((itemType) => ({
      value: String(itemType.id),
      label: itemType.it_name,
    }));
    setItemTypeOptions(options);
    return options;
  }, []);

  useEffect(() => {
    Promise.all([loadCategories(), loadItemCodeNames(), loadUoms(), loadItemTypes()]).catch(() => {
      setCategoryOptions([]);
      setItemCodeOptions([]);
      setUomOptions([]);
      setItemTypeOptions([]);
    });
  }, [loadCategories, loadItemCodeNames, loadUoms, loadItemTypes]);

  const fetchFn = useCallback(async () => {
    const data = await listLabFurnitureItems();
    const rows = Array.isArray(data.lab_furniture_items) ? data.lab_furniture_items : [];
    return rows.map(withQuantityDefaults);
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createLabFurnitureItem(withQuantityDefaults(payload));
    return withQuantityDefaults(data.lab_furniture_item);
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateLabFurnitureItem(id, withQuantityDefaults(payload));
    return withQuantityDefaults(data.lab_furniture_item);
  }, []);

  const fields = [
    {
      ...FIELDS[0],
      options: categoryOptions,
      isClearable: false,
    },
    {
      ...FIELDS[1],
      options: itemCodeOptions,
      isClearable: false,
    },
    FIELDS[2],
    FIELDS[3],
    {
      ...FIELDS[4],
      options: itemTypeOptions,
    },
    {
      ...FIELDS[5],
      options: uomOptions,
    },
    FIELDS[6],
    FIELDS[7],
    FIELDS[8],
    FIELDS[9],
    FIELDS[10],
    FIELDS[11],
    FIELDS[12],
    FIELDS[13],
    FIELDS[14],
    FIELDS[15],
    FIELDS[16],
  ];

  const computeValues = useCallback((changedKey, _changedValue, allValues) => {
    if (changedKey === "item_code_ref_id") {
      const selected = itemCodeOptions.find(
        (option) => String(option.value) === String(allValues.item_code_ref_id || "")
      );
      return {
        item_name_ref_id: selected ? selected.value : "",
        item_code: selected?.itemCode || "",
        item_name: selected?.itemName || "",
      };
    }

    if (!["length", "width", "height"].includes(changedKey)) {
      return {};
    }

    const length = Number(allValues.length || 0);
    const width = Number(allValues.width || 0);
    const height = Number(allValues.height || 0);
    const volume = (Number.isFinite(length) ? length : 0)
      * (Number.isFinite(width) ? width : 0)
      * (Number.isFinite(height) ? height : 0);
    return { volume: volume.toFixed(3) };
  }, [itemCodeOptions]);

  return (
    <CrudPage
      title="Item Master"
      columns={COLUMNS}
      fields={fields}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteLabFurnitureItem}
      computeValues={computeValues}
      tableMaxHeight="58vh"
      tableWrapClassName="users-table-wrap--item-master"
      modalCardClassName="modal-card--item-master"
      stickyHeader
    />
  );
}

export default StockItemsPage;
