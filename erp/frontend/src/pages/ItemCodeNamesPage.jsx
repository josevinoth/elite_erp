import { useCallback, useEffect, useMemo, useState } from "react";
import CrudPage from "../components/CrudPage";
import {
  createItemCodeName,
  deleteItemCodeName,
  listItemCodeNames,
  listLabFurnitureItemCategories,
  updateItemCodeName,
} from "../services/crudApi";

const COLUMNS = [
  { key: "item_category", label: "Item Category" },
  { key: "item_name", label: "Item Name" },
  { key: "item_code", label: "Item Code" },
];

const FIELDS = [
  { key: "item_category_id", label: "Item Category", required: true },
  { key: "item_name", label: "Item Name", required: true },
  { key: "item_code", label: "Item Code", required: true },
];

function ItemCodeNamesPage() {
  const [categoryOptions, setCategoryOptions] = useState([]);

  const loadCategories = useCallback(async () => {
    const data = await listLabFurnitureItemCategories();
    const options = Array.isArray(data.item_categories)
      ? data.item_categories.map((category) => ({
          value: String(category.id),
          label: category.name,
        }))
      : [];
    setCategoryOptions(options);
    return options;
  }, []);

  useEffect(() => {
    loadCategories().catch(() => setCategoryOptions([]));
  }, [loadCategories]);

  const fetchFn = useCallback(async () => {
    const data = await listItemCodeNames();
    return Array.isArray(data.item_code_names) ? data.item_code_names : [];
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createItemCodeName(payload);
    return data.item_code_name;
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateItemCodeName(id, payload);
    return data.item_code_name;
  }, []);

  const fields = useMemo(() => [
    {
      ...FIELDS[0],
      options: categoryOptions,
      placeholder: "Select Item Category",
      isClearable: false,
    },
    {
      ...FIELDS[1],
      type: "text",
    },
    {
      ...FIELDS[2],
      type: "text",
    },
  ], [categoryOptions]);

  const computeValues = useCallback((changedKey, changedValue) => {
    if (changedKey === "item_code") {
      return { item_code: String(changedValue || "").toUpperCase().trimStart() };
    }
    if (changedKey === "item_category_id") {
      return {};
    }
    return {};
  }, []);

  return (
    <CrudPage
      title="Item Code"
      columns={COLUMNS}
      fields={fields}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteItemCodeName}
      computeValues={computeValues}
      includeAuditColumns={false}
      tableMaxHeight="60vh"
      tableWrapClassName="users-table-wrap--item-master"
      modalCardClassName="modal-card--item-master"
      stickyHeader
      defaultPageSize={20}
    />
  );
}

export default ItemCodeNamesPage;




