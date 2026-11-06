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
  { key: "item_type", label: "Item Type" },
  { key: "uom", label: "UOM" },
  { key: "length", label: "Length/Size" },
  { key: "width", label: "Width" },
  { key: "height", label: "Height/Thk" },
  { key: "volume", label: "Volume" },
  { key: "total_reqd", label: "Total Reqd" },
  { key: "recommended_free_stock_qty", label: "Recommended Free Stock Qty" },
  { key: "warning_alert_qty", label: "Warning Alert Qty" },
  { key: "physical_qty", label: "Physical Qty" },
  { key: "ordered_qty", label: "Ordered Qty" },
  { key: "physical_plus_ordered_qty", label: "Physical + Ordered Qty" },
  { key: "to_order_qty_including_free_stock", label: "To Order Qty (Including Recommended Free Stk Qty)" },
  { key: "to_order_qty", label: "To Order Qty (Excluding Recommended Free Stk Qty)" },
];

const FIELDS = [
  { key: "item_category_id", label: "Item Category", required: true },
  { key: "item_code_ref_id", label: "Item Code & Name", required: true },
  { key: "item_code", label: "Item Code", readOnly: true },
  { key: "item_name", label: "Item Name", readOnly: true },
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
  { key: "item_type_id", label: "Item Type", required: true },
  { key: "uom_id", label: "UOM", required: true },
  { key: "length", label: "Length/Size", type: "number", min: 0, step: "any", default: "0" },
  { key: "width", label: "Width", type: "number", min: 0, step: "any", default: "0" },
  { key: "height", label: "Height/Thk", type: "number", min: 0, step: "any", default: "0" },
  { key: "volume", label: "Volume", type: "number", readOnly: true, default: "0" },
  { key: "total_reqd", label: "Total Reqd", type: "number", min: 0, step: "any", default: "0" },
  { key: "recommended_free_stock_qty", label: "Recommended Free Stock Qty", type: "number", min: 0, step: "any", default: "0" },
  { key: "warning_alert_qty", label: "Warning Alert Qty", type: "number", min: 0, step: "any", default: "0" },
  { key: "physical_qty", label: "Physical Qty", type: "number", min: 0, step: "any", default: "0" },
  { key: "ordered_qty", label: "Ordered Qty", type: "number", min: 0, step: "any", default: "0" },
  { key: "physical_plus_ordered_qty", label: "Physical + Ordered Qty", type: "number", readOnly: true, default: "0" },
  { key: "to_order_qty_including_free_stock", label: "To Order Qty (Including Recommended Free Stk Qty)", type: "number", readOnly: true, default: "0" },
  { key: "to_order_qty", label: "To Order Qty (Excluding Recommended Free Stk Qty)", type: "number", readOnly: true, default: "0" },
];

const QUANTITY_KEYS = [
  "recommended_free_stock_qty",
  "warning_alert_qty",
  "to_order_qty",
  "to_order_qty_including_free_stock",
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
  const phy = Number(next.physical_qty || 0);
  const ord = Number(next.ordered_qty || 0);
  next.physical_plus_ordered_qty = (Number.isFinite(phy) ? phy : 0) + (Number.isFinite(ord) ? ord : 0);
  const tot = Number(next.total_reqd || 0);
  const rec = Number(next.recommended_free_stock_qty || 0);
  next.to_order_qty = (Number.isFinite(tot) ? tot : 0) - next.physical_plus_ordered_qty;
  next.to_order_qty_including_free_stock =
    (Number.isFinite(tot) ? tot : 0) + (Number.isFinite(rec) ? rec : 0) - next.physical_plus_ordered_qty;
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
      itemCategoryId: itemCodeName.item_category_id == null ? "" : String(itemCodeName.item_category_id),
      procurementClassification: itemCodeName.procurement_classification || "",
      businessCriticality: itemCodeName.business_criticality || "",
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
      placeholder: "Select Item Category",
      isClearable: false,
    },
    {
      ...FIELDS[1],
      options: (formValues) => {
        const selectedCategoryId = String(formValues?.item_category_id ?? "").trim();
        if (!selectedCategoryId) {
          return itemCodeOptions;
        }
        return itemCodeOptions.filter((option) => String(option.itemCategoryId || "") === selectedCategoryId);
      },
      placeholder: (formValues) => {
        const selectedCategoryId = String(formValues?.item_category_id ?? "").trim();
        return selectedCategoryId ? "Select Item Code & Name" : "Select Item Category first";
      },
      isClearable: false,
    },
    FIELDS[2],
    FIELDS[3],
    FIELDS[4],
    FIELDS[5],
    {
      ...FIELDS[6],
      options: itemTypeOptions,
      isClearable: false,
    },
    {
      ...FIELDS[7],
      options: uomOptions,
      isClearable: false,
    },
    ...FIELDS.slice(8),
  ];

  const computeValues = useCallback((changedKey, _changedValue, allValues) => {
    if (changedKey === "item_category_id") {
      const selectedCategoryId = String(allValues.item_category_id || "").trim();
      const selectedCodeId = String(allValues.item_code_ref_id || "").trim();
      if (!selectedCategoryId || !selectedCodeId) {
        return {};
      }

      const selected = itemCodeOptions.find((option) => String(option.value) === selectedCodeId);
      if (selected && String(selected.itemCategoryId || "") !== selectedCategoryId) {
        return {
          item_code_ref_id: "",
          item_name_ref_id: "",
          item_code: "",
          item_name: "",
        };
      }
      return {};
    }

    if (changedKey === "item_code_ref_id") {
      const selected = itemCodeOptions.find(
        (option) => String(option.value) === String(allValues.item_code_ref_id || "")
      );
      return {
        item_name_ref_id: selected ? selected.value : "",
        item_code: selected?.itemCode || "",
        item_name: selected?.itemName || "",
        procurement_classification: selected?.procurementClassification || allValues.procurement_classification || "",
        business_criticality: selected?.businessCriticality || allValues.business_criticality || "",
      };
    }

    if (["physical_qty", "ordered_qty", "total_reqd", "recommended_free_stock_qty"].includes(changedKey)) {
      const physicalQty = Number(allValues.physical_qty || 0);
      const orderedQty = Number(allValues.ordered_qty || 0);
      const physicalPlusOrdered =
        (Number.isFinite(physicalQty) ? physicalQty : 0) +
        (Number.isFinite(orderedQty) ? orderedQty : 0);
      const totalReqd = Number(allValues.total_reqd || 0);
      const recommendedFreeStock = Number(allValues.recommended_free_stock_qty || 0);
      const toOrderExc = (Number.isFinite(totalReqd) ? totalReqd : 0) - physicalPlusOrdered;
      const toOrderInc =
        (Number.isFinite(totalReqd) ? totalReqd : 0) +
        (Number.isFinite(recommendedFreeStock) ? recommendedFreeStock : 0) -
        physicalPlusOrdered;

      return {
        physical_plus_ordered_qty: physicalPlusOrdered,
        to_order_qty: toOrderExc,
        to_order_qty_including_free_stock: toOrderInc,
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
