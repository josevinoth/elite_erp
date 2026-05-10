import { useCallback, useEffect, useState } from "react";
import CrudPage from "../components/CrudPage";
import {
  createLabFurnitureItemCategory,
  createLabFurnitureItem,
  deleteLabFurnitureItem,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  updateLabFurnitureItem,
} from "../services/crudApi";

const COLUMNS = [
  { key: "item_category", label: "Item Category" },
  { key: "item_name", label: "Item Name" },
  { key: "item_code", label: "Item Code" },
];

const FIELDS = [
  { key: "item_name", label: "Item Name", required: true },
  { key: "item_category", label: "Item Category", required: true },
];

function StockItemsPage() {
  const [categoryOptions, setCategoryOptions] = useState([]);

  const normalizeCategoryName = (value) => String(value || "").replace(/\s+/g, " ").trim();

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

  useEffect(() => {
    loadCategories().catch(() => setCategoryOptions([]));
  }, [loadCategories]);

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

  const appendCategory = async (name) => {
    const normalizedName = normalizeCategoryName(name);
    const existing = categoryOptions.find(
      (option) => normalizeCategoryName(option.label).toLowerCase() === normalizedName.toLowerCase()
    );

    if (existing) {
      window.alert(`Warning: Item Category \"${existing.label}\" already exists.`);
      return String(existing.value);
    }

    try {
      const data = await createLabFurnitureItemCategory({ name: normalizedName });
      await loadCategories();
      return String(data.item_category.id);
    } catch (err) {
      // Duplicate can still happen if another user creates the category concurrently.
      if (String(err?.message || "").toLowerCase().includes("already exists")) {
        window.alert(`Warning: Item Category \"${normalizedName}\" already exists.`);
        const latestCategories = await loadCategories();
        const matched = latestCategories.find(
          (option) => normalizeCategoryName(option.label).toLowerCase() === normalizedName.toLowerCase()
        );
        if (matched) {
          return String(matched.value);
        }
      }
      throw err;
    }
  };

  const fields = [
    FIELDS[0],
    {
      ...FIELDS[1],
      options: categoryOptions,
      onAppend: appendCategory,
      default: categoryOptions[0]?.value || "",
    },
  ];

  return (
    <CrudPage
      title="Item Master"
      columns={COLUMNS}
      fields={fields}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteLabFurnitureItem}
      tableMaxHeight="58vh"
      stickyHeader
    />
  );
}

export default StockItemsPage;

