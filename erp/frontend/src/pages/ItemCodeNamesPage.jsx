import { useCallback, useEffect, useMemo, useState } from "react";
import CrudPage from "../components/CrudPage";
import {
  createItemCodeName,
  deleteItemCodeName,
  listItemCodeNames,
  listLabFurnitureItemCategories,
  updateItemCodeName,
} from "../services/crudApi";

const PROCUREMENT_CLASSIFICATION_OPTIONS = [
  { value: "OMAN", label: "OMAN" },
  { value: "UAE", label: "UAE" },
  { value: "IMP", label: "IMP" },
];

const BUSINESS_CRITICALITY_OPTIONS = [
  { value: "VIP", label: "VIP" },
  { value: "CRITICAL", label: "CRITICAL" },
  { value: "NON CRITICAL", label: "NON CRITICAL" },
  { value: "UNDESIRED", label: "UNDESIRED" },
];

const COLUMNS = [
  { key: "item_category", label: "Item Category" },
  { key: "item_name", label: "Item Name" },
  { key: "item_code", label: "Item Code" },
  { key: "procurement_classification", label: "Procurement Classification" },
  { key: "business_criticality", label: "Business Criticality" },
];

const FIELDS = [
  { key: "item_category_id", label: "Item Category", required: true },
  { key: "item_name", label: "Item Name", required: true },
  { key: "item_code", label: "Item Code", required: true },
  {
    key: "procurement_classification",
    label: "Procurement Classification",
    options: PROCUREMENT_CLASSIFICATION_OPTIONS,
    placeholder: "Select Procurement Classification",
    isClearable: true,
  },
  {
    key: "business_criticality",
    label: "Business Criticality",
    options: BUSINESS_CRITICALITY_OPTIONS,
    placeholder: "Select Business Criticality",
    isClearable: true,
  },
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
    FIELDS[3],
    FIELDS[4],
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
      includeAuditColumns={true}
      tableMaxHeight="60vh"
      tableWrapClassName="users-table-wrap--item-master"
      modalCardClassName="modal-card--item-master"
      stickyHeader
      defaultPageSize={20}
    />
  );
}

export default ItemCodeNamesPage;




