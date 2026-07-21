import { useCallback, useEffect, useState } from "react";
import CrudPage from "../components/CrudPage";
import {
  createLabFurnitureItem,
  deleteLabFurnitureItem,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listUoms,
  updateLabFurnitureItem,
} from "../services/crudApi";

const COLUMNS = [
  { key: "item_category", label: "Item Category" },
  { key: "item_name", label: "Item Name" },
  { key: "item_code", label: "Item Code" },
  { key: "uom", label: "UOM" },
  { key: "length", label: "Length/Size" },
  { key: "width", label: "Width" },
  { key: "height", label: "Height/Thk" },
  { key: "volume", label: "Volume" },
];

const FIELDS = [
  { key: "item_category_id", label: "Item Category", required: true },
  { key: "item_name", label: "Item Name", required: true },
  { key: "uom_id", label: "UOM", required: false },
  { key: "length", label: "Length/Size", type: "number", min: 0, step: "any", default: "0" },
  { key: "width", label: "Width", type: "number", min: 0, step: "any", default: "0" },
  { key: "height", label: "Height/Thk", type: "number", min: 0, step: "any", default: "0" },
  { key: "volume", label: "Volume", type: "number", readOnly: true, default: "0" },
];

function StockItemsPage() {
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [uomOptions, setUomOptions] = useState([]);

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

  useEffect(() => {
    Promise.all([loadCategories(), loadUoms()]).catch(() => {
      setCategoryOptions([]);
      setUomOptions([]);
    });
  }, [loadCategories, loadUoms]);

  const fetchFn = useCallback(async () => {
    const data = await listLabFurnitureItems();
    return data.lab_furniture_items || [];
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createLabFurnitureItem(payload);
    return data.lab_furniture_item;
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateLabFurnitureItem(id, payload);
    return data.lab_furniture_item;
  }, []);

  const fields = [
    {
      ...FIELDS[0],
      options: categoryOptions,
      isClearable: false,
    },
    FIELDS[1],
    {
      ...FIELDS[2],
      options: uomOptions,
    },
    FIELDS[3],
    FIELDS[4],
    FIELDS[5],
    FIELDS[6],
  ];

  const computeValues = useCallback((changedKey, _changedValue, allValues) => {
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
  }, []);

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
          stickyHeader
      />
  );
}

export default StockItemsPage;

