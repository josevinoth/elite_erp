import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BsCheckCircleFill,
  BsPencilSquare,
  BsPlusCircleFill,
  BsTrashFill,
  BsXCircleFill,
} from "react-icons/bs";
import {
  addRoom,
  createQuotationItem,
  createQuotationSummary,
  downloadQuotationItemsImportTemplate,
  deleteQuotationItem,
  deleteQuotationSummary,
  getItemCostPreview,
  importQuotationItemsExcel,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listQuotationItems,
  listQuotationSummaries,
  listRooms,
  updateQuotationItem,
  updateQuotationSummary,
} from "../services/crudApi";
import "../styles/ProjectQuotation.css";

const MATERIAL_NAME = "MATERIAL";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toMoney = (value, decimals = 2) => (
  (Math.round((toNumber(value) + Number.EPSILON) * (10 ** decimals)) / (10 ** decimals)).toFixed(decimals)
);

const normalizeText = (value) => String(value || "").trim();

const asPercent = (value) => {
  const numeric = toNumber(value);
  return numeric > 1 ? numeric / 100 : numeric;
};

const recalculateSummary = (summary) => {
  const totalMaterialCost = toNumber(summary?.total_material_cost);
  const contingencyRatio = asPercent(summary?.contingency);
  const markupRatio = asPercent(summary?.markup);

  const finalMaterialCost = totalMaterialCost * contingencyRatio;
  const totalCostToElite = finalMaterialCost
    + toNumber(summary?.transportation)
    + toNumber(summary?.food_accomodation)
    + toNumber(summary?.loading)
    + toNumber(summary?.unloading)
    + toNumber(summary?.installation)
    + toNumber(summary?.business_development);
  const totalMarkup = markupRatio * totalMaterialCost;
  const plannedOrderValue = totalCostToElite + totalMarkup;
  const denominator = (1 - markupRatio) - plannedOrderValue;
  const discount = denominator === 0 ? 0 : plannedOrderValue / denominator;
  const undiscountedQuoteValue = plannedOrderValue + discount;
  const factor = totalMaterialCost === 0 ? 0 : undiscountedQuoteValue / totalMaterialCost;

  return {
    final_material_cost: toMoney(finalMaterialCost),
    total_cost_to_elite: toMoney(totalCostToElite),
    total_markup: toMoney(totalMarkup),
    planned_order_value: toMoney(plannedOrderValue),
    discount: toMoney(discount),
    undiscounted_quote_value: toMoney(undiscountedQuoteValue),
    factor: toMoney(factor, 4),
  };
};

const emptyDimensions = {
  length: "0",
  width: "0",
  height: "0",
  volume: "0",
};

const buildDraftItem = (materialCostTypeId) => ({
  cost_type_id: materialCostTypeId ? String(materialCostTypeId) : "",
  item_category_id: "",
  item_name: "",
  item_code_id: "",
  item_type: "",
  room_name_id: "",
  stock_status_name: "In-Stock",
  requested_qty: "0",
  purchase_qty: "0",
  max_cost: "0",
  min_cost: "0",
  actual_cost: "0",
  total_cost: "0",
  ...emptyDimensions,
});

const SUMMARY_EDITABLE_FIELDS = [
  "petrol_expenses",
  "transport_installation_team",
  "contingency",
  "transportation",
  "food_accomodation",
  "loading",
  "unloading",
  "installation",
  "business_development",
  "markup",
];

const SUMMARY_PRIMARY_FIELDS = [
  "quotation_number",
  "project_id",
  "project_name",
  "planned_order_value",
];

const SUMMARY_CALCULATED_FIELDS = [
  "total_material_cost",
  "final_material_cost",
  "total_cost_to_elite",
  "total_markup",
  "discount",
  "undiscounted_quote_value",
  "factor",
];

const SUMMARY_FIELD_LABELS = {
  project_id: "project id",
  food_accomodation: "food accomodation",
};

const getStatusClassName = (type) => {
  if (type === "error") return "users-status users-status--error";
  if (type === "warning") return "users-status users-status--warning";
  return "users-status users-status--success";
};

const getPopupClassName = (type) => {
  if (type === "error") return "popup-error";
  if (type === "warning") return "popup-warning";
  return "popup-success";
};

const getStockStatusName = (row) => (
  row?.stock_status?.status_name || row?.stock_status_name || "In-Stock"
);

const getStockStatusBadgeClassName = (statusName) => {
  const normalized = String(statusName || "").trim().toLowerCase();
  if (normalized === "in-stock") {
    return "pq-stock-badge--in-stock";
  }
  if (normalized === "partial stock") {
    return "pq-stock-badge--partial";
  }
  if (normalized === "no stock" || normalized === "not purchased") {
    return "pq-stock-badge--no-stock";
  }
  return "pq-stock-badge--no-stock";
};

const normalizeValidationMessages = (messages) => {
  if (!Array.isArray(messages)) return [];

  const seen = new Set();
  return messages
    .map((entry) => ({
      type: String(entry?.status || "success").trim().toLowerCase() || "success",
      message: String(entry?.message || "").trim(),
    }))
    .filter((entry) => entry.message)
    .filter((entry) => {
      const key = `${entry.type}::${entry.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const isSummaryRelatedMessage = (message) => {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized) return false;
  const summaryHints = [
    "quotation summary",
    "summary",
    "planned order value",
    "total material cost",
    "final material cost",
    "total cost to elite",
    "total markup",
    "undiscounted quote value",
    "discount",
    "factor",
    "contingency",
    "transportation",
    "food accomodation",
    "loading",
    "unloading",
    "installation",
    "business development",
    "petrol expenses",
    "markup",
  ];
  return summaryHints.some((hint) => normalized.includes(hint));
};

function ProjectQuotationPage({ projectId = null, embedded = false, onSummaryStatusChange = null }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryQuotationId = searchParams.get("quotationId");

  const [quotations, setQuotations] = useState([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState(() => queryQuotationId || "");
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [costTypes, setCostTypes] = useState([]);
  const [materialCostTypeId, setMaterialCostTypeId] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [roomOptions, setRoomOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [validationMessages, setValidationMessages] = useState([]);

  const [draftRow, setDraftRow] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [savingSummary, setSavingSummary] = useState(false);
  const [savingRow, setSavingRow] = useState(false);
  const [importingItems, setImportingItems] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importReports, setImportReports] = useState([]);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);
  const [roomPopup, setRoomPopup] = useState({ type: "", message: "" });
  const [summarySaveFeedback, setSummarySaveFeedback] = useState({ type: "", message: "" });

  const itemMasterRef = useRef([]);
  const importFileInputRef = useRef(null);

  const showStatus = useCallback((message, type = "success") => {
    setStatus({ type, message });
  }, []);

  const clearStatus = useCallback(() => {
    setStatus({ type: "", message: "" });
  }, []);

  const costTypeMap = useMemo(() => {
    const lookup = new Map();
    costTypes.forEach((row) => lookup.set(String(row.id), row));
    return lookup;
  }, [costTypes]);

  const isMaterialCostType = useCallback((costTypeId) => {
    const normalized = String(costTypeId || "").trim();
    if (!normalized) return false;
    if (materialCostTypeId && normalized === String(materialCostTypeId)) return true;
    const option = costTypeMap.get(normalized);
    return String(option?.name || "").trim().toUpperCase() === MATERIAL_NAME;
  }, [costTypeMap, materialCostTypeId]);

  const getMasterById = useCallback((itemId) => (
    itemMasterRef.current.find((item) => String(item.id) === String(itemId || "")) || null
  ), []);

  const getNamesForCategory = useCallback((categoryId) => {
    const names = itemMasterRef.current
      .filter((item) => String(item.item_category_id || "") === String(categoryId || ""))
      .map((item) => item.item_name)
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, []);

  const getCodesForSelection = useCallback((categoryId, itemName) => (
    itemMasterRef.current
      .filter((item) => String(item.item_category_id || "") === String(categoryId || ""))
      .filter((item) => String(item.item_name || "").trim().toLowerCase() === String(itemName || "").trim().toLowerCase())
      .sort((a, b) => String(a.item_code || "").localeCompare(String(b.item_code || "")))
  ), []);

  const loadItemsForSummary = useCallback(async (quotationId) => {
    if (!quotationId) {
      setItems([]);
      setValidationMessages([]);
      return;
    }

    const data = await listQuotationItems(quotationId);
    setItems(Array.isArray(data.items) ? data.items : []);
    setValidationMessages(normalizeValidationMessages(data.validation_messages));
  }, []);

  const loadRoomOptions = useCallback(async () => {
    const data = await listRooms();
    setRoomOptions(Array.isArray(data.rooms) ? data.rooms : []);
  }, []);

  const getRowValidationState = useCallback((row) => {
    if (!row || !isMaterialCostType(row.cost_type_id)) {
      return { type: "", message: "" };
    }

    if (!normalizeText(row.item_code_id)) {
      return { type: "error", message: "Select a valid item code." };
    }

    if (toNumber(row.purchase_qty) <= 0) {
      return { type: "warning", message: "No stock available. You can enter custom cost." };
    }

    if (toNumber(row.requested_qty) > toNumber(row.purchase_qty)) {
      return { type: "warning", message: "Requested Qty is greater than Purchase Qty." };
    }

    return { type: "success", message: "Requested Qty is within Purchase Qty." };
  }, [isMaterialCostType]);

  const summaryStatus = useMemo(() => {
    if (!status.message) return null;
    return isSummaryRelatedMessage(status.message) ? status : null;
  }, [status]);

  const summaryValidationMessages = useMemo(
    () => validationMessages.filter((entry) => isSummaryRelatedMessage(entry.message)),
    [validationMessages]
  );

  const itemValidationMessages = useMemo(
    () => validationMessages.filter((entry) => !isSummaryRelatedMessage(entry.message)),
    [validationMessages]
  );

  const summaryPreviewValues = useMemo(() => recalculateSummary(summary), [summary]);

  const ensureEmbeddedSummary = useCallback(async (summaryRows) => {
    if (!embedded || !projectId) return "";

    const matching = (summaryRows || []).find((row) => String(row.project_id) === String(projectId));
    if (matching) {
      return String(matching.id);
    }

    const created = await createQuotationSummary({ project_id: projectId });
    return String(created?.quotation?.id || "");
  }, [embedded, projectId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const activeProjectId = embedded && projectId ? projectId : null;
      const [summaryData, categoryData, itemData, roomData] = await Promise.all([
        listQuotationSummaries(activeProjectId),
        listLabFurnitureItemCategories(),
        listLabFurnitureItems(),
        listRooms(),
      ]);

      const summaryRows = Array.isArray(summaryData.quotations) ? summaryData.quotations : [];
      const summaryIdFromEmbedded = await ensureEmbeddedSummary(summaryRows);
      const refreshedSummaryRows = summaryIdFromEmbedded && !summaryRows.some((row) => String(row.id) === summaryIdFromEmbedded)
        ? (await listQuotationSummaries(activeProjectId)).quotations || []
        : summaryRows;

      setQuotations(refreshedSummaryRows);
      setCostTypes(Array.isArray(summaryData.cost_types) ? summaryData.cost_types : []);
      setMaterialCostTypeId(summaryData.material_cost_type_id || null);
      setCategoryOptions(Array.isArray(categoryData.item_categories) ? categoryData.item_categories : []);
      setRoomOptions(Array.isArray(roomData.rooms) ? roomData.rooms : []);
      itemMasterRef.current = Array.isArray(itemData.lab_furniture_items) ? itemData.lab_furniture_items : [];

      let nextSelectedId = "";
      if (embedded && projectId) {
        nextSelectedId = summaryIdFromEmbedded || String(refreshedSummaryRows[0]?.id || "");
      } else if (selectedQuotationId) {
        nextSelectedId = String(selectedQuotationId);
      } else if (queryQuotationId) {
        nextSelectedId = String(queryQuotationId);
      }

      if (nextSelectedId) {
        const selected = refreshedSummaryRows.find((row) => String(row.id) === String(nextSelectedId));
        setSelectedQuotationId(String(nextSelectedId));
        setSummary(selected || null);
        if (selected) {
          await loadItemsForSummary(selected.id);
        } else {
          setItems([]);
          setValidationMessages([]);
        }
      } else {
        setSummary(null);
        setItems([]);
        setValidationMessages([]);
      }
    } catch (error) {
      showStatus(error.message || "Failed to load quotations.", "error");
      setQuotations([]);
      setSummary(null);
      setItems([]);
      setValidationMessages([]);
      setCostTypes([]);
      setCategoryOptions([]);
      setRoomOptions([]);
      itemMasterRef.current = [];
    } finally {
      setLoading(false);
    }
  }, [embedded, ensureEmbeddedSummary, loadItemsForSummary, projectId, queryQuotationId, selectedQuotationId, showStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!embedded) {
      setSelectedQuotationId(queryQuotationId || "");
    }
  }, [embedded, queryQuotationId]);

  const refreshSelectedSummary = useCallback(async (quotationId) => {
    const listData = await listQuotationSummaries(embedded && projectId ? projectId : null);
    const rows = Array.isArray(listData.quotations) ? listData.quotations : [];
    setQuotations(rows);
    const selected = rows.find((row) => String(row.id) === String(quotationId || "")) || null;
    setSummary(selected);
    if (selected) {
      await loadItemsForSummary(selected.id);
    } else {
      setItems([]);
      setValidationMessages([]);
    }
  }, [embedded, loadItemsForSummary, projectId]);

  const openRoomModal = useCallback(() => {
    setRoomModalOpen(true);
    setNewRoomName("");
    setRoomPopup({ type: "", message: "" });
  }, []);

  const closeRoomModal = useCallback(() => {
    if (savingRoom) return;
    setRoomModalOpen(false);
    setNewRoomName("");
    setRoomPopup({ type: "", message: "" });
  }, [savingRoom]);

  const saveRoom = useCallback(async () => {
    const trimmedRoomName = normalizeText(newRoomName);
    if (!trimmedRoomName) {
      setRoomPopup({ type: "warning", message: "Room name is required." });
      return;
    }

    setSavingRoom(true);
    try {
      const response = await addRoom({ room_name: trimmedRoomName });
      setRoomPopup({ type: response.status || "success", message: response.message || "Room added successfully." });
      await loadRoomOptions();
      setNewRoomName("");
    } catch (error) {
      setRoomPopup({ type: "error", message: error.message || "Failed to add room." });
    } finally {
      setSavingRoom(false);
    }
  }, [loadRoomOptions, newRoomName]);

  const openImportFilePicker = useCallback(() => {
    if (!summary?.id || importingItems) return;
    if (importFileInputRef.current) {
      importFileInputRef.current.click();
    }
  }, [importingItems, summary?.id]);

  const handleDownloadImportTemplate = useCallback(async () => {
    setDownloadingTemplate(true);
    try {
      await downloadQuotationItemsImportTemplate();
    } catch (error) {
      showStatus(error.message || "Failed to download import template.", "error");
      window.alert(error.message || "Failed to download import template.");
    } finally {
      setDownloadingTemplate(false);
    }
  }, [showStatus]);

  const handleImportItemsFile = useCallback(async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file || !summary?.id) {
      if (event.target) event.target.value = "";
      return;
    }

    setImportingItems(true);
    clearStatus();
    try {
      const response = await importQuotationItemsExcel(summary.id, file);
      setImportSummary(response.summary || null);
      setImportReports(Array.isArray(response.row_reports) ? response.row_reports : []);
      setValidationMessages(normalizeValidationMessages(response.validation_messages));
      if (Array.isArray(response.items)) {
        setItems(response.items);
      } else {
        await loadItemsForSummary(summary.id);
      }
      if (response.quotation) {
        setSummary(response.quotation);
      }
      showStatus(response.message || "Quotation item import completed.", response.status || "success");
    } catch (error) {
      setImportSummary(null);
      setImportReports([]);
      showStatus(error.message || "Failed to import quotation items.", "error");
      window.alert(error.message || "Failed to import quotation items.");
    } finally {
      setImportingItems(false);
      if (event.target) event.target.value = "";
    }
  }, [clearStatus, loadItemsForSummary, showStatus, summary?.id]);

  const patchSummary = useCallback((field, value) => {
    setSummary((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      return { ...next, ...recalculateSummary(next) };
    });
    setSummarySaveFeedback({ type: "", message: "" });
    if (onSummaryStatusChange) onSummaryStatusChange({ type: "", message: "" });
  }, [onSummaryStatusChange]);

  const goBackToQuotationList = useCallback(() => {
    if (selectedQuotationId) {
      setSelectedQuotationId("");
      setSummary(null);
      setItems([]);
      setValidationMessages([]);
      setImportSummary(null);
      setImportReports([]);
      clearStatus();
      setSearchParams({});
      return;
    }
    navigate("/projects");
  }, [clearStatus, navigate, selectedQuotationId, setSearchParams]);

  const saveSummary = useCallback(async () => {
    if (!summary?.id) return;
    setSavingSummary(true);
    clearStatus();
    setSummarySaveFeedback({ type: "", message: "" });
    try {
      const payload = {};
      SUMMARY_EDITABLE_FIELDS.forEach((field) => {
        payload[field] = summary[field] ?? 0;
      });
      const response = await updateQuotationSummary(summary.id, payload);
      setSummary(response.quotation || summary);
      setValidationMessages(normalizeValidationMessages(response.validation_messages));
      setSummarySaveFeedback({
        type: response.status || "success",
        message: response.message || "Quotation summary updated successfully.",
      });
      if (onSummaryStatusChange) {
        onSummaryStatusChange({
          type: response.status || "success",
          message: response.message || "Quotation summary updated successfully.",
        });
      }
      showStatus(response.message || "Quotation summary updated successfully.", response.status || "success");
      await refreshSelectedSummary(summary.id);
    } catch (error) {
      setSummarySaveFeedback({
        type: error.payload?.status || "error",
        message: error.message || "Failed to update quotation summary.",
      });
      if (onSummaryStatusChange) {
        onSummaryStatusChange({
          type: error.payload?.status || "error",
          message: error.message || "Failed to update quotation summary.",
        });
      }
      showStatus(error.message || "Failed to update quotation summary.", error.payload?.status || "error");
      window.alert(error.message || "Failed to update quotation summary.");
    } finally {
      setSavingSummary(false);
    }
  }, [clearStatus, refreshSelectedSummary, showStatus, summary]);

  const removeSummary = useCallback(async (quotationId) => {
    if (!quotationId) return;
    if (!window.confirm("Delete this quotation and all linked items?")) return;

    clearStatus();
    try {
      await deleteQuotationSummary(quotationId);
      if (!embedded) {
        setSelectedQuotationId("");
        setSearchParams({});
      }
      setSummary(null);
      setItems([]);
      await loadData();
      showStatus("Quotation deleted successfully.");
    } catch (error) {
      const message = error.message || "Failed to delete quotation.";
      showStatus(message, "error");
      window.alert(message);
    }
  }, [clearStatus, embedded, loadData, setSearchParams, showStatus]);

  const openSummary = useCallback(async (quotationId) => {
    const selected = quotations.find((row) => String(row.id) === String(quotationId));
    if (!selected) return;

    setSelectedQuotationId(String(selected.id));
    setSummary(selected);
    setImportSummary(null);
    setImportReports([]);
    clearStatus();
    if (!embedded) {
      setSearchParams({ quotationId: String(selected.id) });
    }
    await loadItemsForSummary(selected.id);
  }, [clearStatus, embedded, loadItemsForSummary, quotations, setSearchParams]);

  const applyMaterialSelection = useCallback(async (itemCodeId, applyPatch) => {
    const master = getMasterById(itemCodeId);
    if (!master) {
      applyPatch({
        item_code_id: "",
        item_type: "",
        stock_status_name: "No Stock",
        purchase_qty: "0",
        requested_qty: "0",
        max_cost: "0",
        min_cost: "0",
        actual_cost: "0",
        total_cost: "0",
        ...emptyDimensions,
      });
      showStatus("Invalid item code selected.", "error");
      return;
    }

    const quantity = String(master.available_qty ?? "0");
    const hasNoPurchaseData = toNumber(quantity) <= 0;

    applyPatch({
      item_category_id: String(master.item_category_id || ""),
      item_name: master.item_name || "",
      item_code_id: String(master.id),
      item_type: master.item_type || "",
      stock_status_name: hasNoPurchaseData ? "No Stock" : (toNumber(quantity) <= 0 ? "No Stock" : "In-Stock"),
      purchase_qty: quantity,
      requested_qty: "0",
      max_cost: "0",
      min_cost: "0",
      actual_cost: "0", // User must enter cost manually if purchase data is missing
      total_cost: "0",
      length: String(master.length ?? "0"),
      width: String(master.width ?? "0"),
      height: String(master.height ?? "0"),
      volume: String(master.volume ?? "0"),
    });

    if (hasNoPurchaseData) {
      showStatus("No stock available. Please enter Actual Cost manually.", "warning");
    } else {
      showStatus("Requested Qty is within Purchase Qty.", "success");
    }

    if (!hasNoPurchaseData) {
      try {
        const preview = await getItemCostPreview(master.item_code, 1);
        const previewCost = String(preview?.cost ?? "0");
        applyPatch({ max_cost: previewCost, min_cost: previewCost, actual_cost: previewCost });
      } catch (_error) {
        applyPatch({ max_cost: "0", min_cost: "0", actual_cost: "0" });
      }
    }
  }, [getMasterById, showStatus]);

  const patchDraftRow = useCallback((patch) => {
    setDraftRow((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      next.total_cost = toMoney(toNumber(next.requested_qty) * toNumber(next.actual_cost));
      return next;
    });
  }, []);

  const patchEditingRow = useCallback((patch) => {
    setEditingRow((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      next.total_cost = toMoney(toNumber(next.requested_qty) * toNumber(next.actual_cost));
      return next;
    });
  }, []);

  const startAdd = useCallback(() => {
    setEditingItemId(null);
    setEditingRow(null);
    setDraftRow(buildDraftItem(materialCostTypeId));
    clearStatus();
  }, [clearStatus, materialCostTypeId]);

  const cancelAdd = useCallback(() => {
    setDraftRow(null);
  }, []);

  const startEdit = useCallback((row) => {
    setDraftRow(null);
    setEditingItemId(row.id);
    setEditingRow({
      ...row,
      cost_type_id: String(row.cost_type_id || ""),
      item_category_id: String(row.item_category_id || ""),
      item_code_id: String(row.item_code_id || ""),
      room_name_id: String(row.room_name?.id || row.room_name_id || ""),
      item_type: row.item_type || "",
      stock_status_name: getStockStatusName(row),
      requested_qty: String(row.requested_qty ?? "0"),
      purchase_qty: String(row.purchase_qty ?? "0"),
      actual_cost: String(row.actual_cost ?? "0"),
      max_cost: String(row.max_cost ?? "0"),
      min_cost: String(row.min_cost ?? "0"),
      total_cost: String(row.total_cost ?? "0"),
      length: String(row.length ?? "0"),
      width: String(row.width ?? "0"),
      height: String(row.height ?? "0"),
      volume: String(row.volume ?? "0"),
    });
    clearStatus();
  }, [clearStatus]);

  const cancelEdit = useCallback(() => {
    setEditingItemId(null);
    setEditingRow(null);
  }, []);

  const validateItemRow = useCallback((row) => {
    if (!normalizeText(row.cost_type_id)) return { type: "error", message: "Cost type is required." };
    if (toNumber(row.requested_qty) < 0) return { type: "error", message: "Requested Qty must be 0 or greater." };
    if (toNumber(row.purchase_qty) < 0) return { type: "error", message: "Purchase Qty must be 0 or greater." };
    if (toNumber(row.actual_cost) < 0) return { type: "error", message: "Actual cost must be 0 or greater." };

    if (isMaterialCostType(row.cost_type_id)) {
      if (!normalizeText(row.item_category_id)) return { type: "error", message: "Item category is required for MATERIAL." };
      if (!normalizeText(row.item_name)) return { type: "error", message: "Item name is required for MATERIAL." };
      if (!normalizeText(row.item_code_id)) return { type: "error", message: "Item code is required for MATERIAL." };
      if (!normalizeText(row.room_name_id)) return { type: "error", message: "Room name is required." };

      const duplicate = items.some(
        (candidate) => String(candidate.item_code_id || "") === String(row.item_code_id || "")
          && String(candidate.id || "") !== String(row.id || editingItemId || "")
      );
      if (duplicate) {
        return { type: "error", message: "Duplicate item code is not allowed for this quotation." };
      }

    }

    return getRowValidationState(row);
  }, [editingItemId, getRowValidationState, isMaterialCostType, items]);

  const buildItemPayload = useCallback((row, confirmRequestedQtyOverride = false) => ({
    cost_type_id: row.cost_type_id,
    item_category_id: isMaterialCostType(row.cost_type_id) ? row.item_category_id || null : null,
    item_name: isMaterialCostType(row.cost_type_id) ? row.item_name : "",
    item_code_id: isMaterialCostType(row.cost_type_id) ? row.item_code_id || null : null,
    room_name_id: row.room_name_id || null,
    requested_qty: row.requested_qty || "0",
    actual_cost: row.actual_cost || "0",
    confirm_requested_qty_override: confirmRequestedQtyOverride,
  }), [isMaterialCostType]);

  const saveDraftItem = useCallback(async () => {
    if (!summary?.id || !draftRow) return;
    const validation = validateItemRow(draftRow);
    if (validation.type === "error") {
      showStatus(validation.message, validation.type);
      return;
    }

    let confirmRequestedQtyOverride = false;
    if (validation.type === "warning") {
      const warningMsg = validation.message || "Continue with this item?";
      confirmRequestedQtyOverride = window.confirm(
        `${warningMsg}\n\nDo you want to proceed?`
      );
      if (!confirmRequestedQtyOverride) {
        showStatus("Save cancelled by user.", "warning");
        return;
      }
    }

    setSavingRow(true);
    clearStatus();
    try {
      const saveWithOverride = async (overrideFlag) => createQuotationItem(
        summary.id,
        buildItemPayload(draftRow, overrideFlag)
      );

      let response;
      try {
        response = await saveWithOverride(confirmRequestedQtyOverride);
      } catch (error) {
        if (error.payload?.status === "warning" && error.payload?.requires_confirmation) {
          const proceed = window.confirm("Requested Qty is higher than Purchase Qty. Do you want to proceed?");
          if (!proceed) {
            showStatus("Save cancelled by user.", "warning");
            return;
          }
          response = await saveWithOverride(true);
        } else {
          throw error;
        }
      }

      setDraftRow(null);
      setValidationMessages(normalizeValidationMessages(response.validation_messages));
      await refreshSelectedSummary(summary.id);
      showStatus(response.message || "Quotation item added successfully.", response.status || "success");
    } catch (error) {
      const text = error.message || "Failed to add quotation item.";
      showStatus(text, error.payload?.status || "error");
      window.alert(text);
    } finally {
      setSavingRow(false);
    }
  }, [buildItemPayload, clearStatus, draftRow, refreshSelectedSummary, showStatus, summary, validateItemRow]);

  const saveEditedItem = useCallback(async () => {
    if (!summary?.id || !editingItemId || !editingRow) return;
    const validation = validateItemRow(editingRow);
    if (validation.type === "error") {
      showStatus(validation.message, validation.type);
      return;
    }

    let confirmRequestedQtyOverride = false;
    if (validation.type === "warning") {
      const warningMsg = validation.message || "Continue with this item?";
      confirmRequestedQtyOverride = window.confirm(
        `${warningMsg}\n\nDo you want to proceed?`
      );
      if (!confirmRequestedQtyOverride) {
        showStatus("Save cancelled by user.", "warning");
        return;
      }
    }

    setSavingRow(true);
    clearStatus();
    try {
      const saveWithOverride = async (overrideFlag) => updateQuotationItem(
        summary.id,
        editingItemId,
        buildItemPayload(editingRow, overrideFlag)
      );

      let response;
      try {
        response = await saveWithOverride(confirmRequestedQtyOverride);
      } catch (error) {
        if (error.payload?.status === "warning" && error.payload?.requires_confirmation) {
          const proceed = window.confirm("Requested Qty is higher than Purchase Qty. Do you want to proceed?");
          if (!proceed) {
            showStatus("Save cancelled by user.", "warning");
            return;
          }
          response = await saveWithOverride(true);
        } else {
          throw error;
        }
      }

      setEditingItemId(null);
      setEditingRow(null);
      setValidationMessages(normalizeValidationMessages(response.validation_messages));
      await refreshSelectedSummary(summary.id);
      showStatus(response.message || "Quotation item updated successfully.", response.status || "success");
    } catch (error) {
      const text = error.message || "Failed to update quotation item.";
      showStatus(text, error.payload?.status || "error");
      window.alert(text);
    } finally {
      setSavingRow(false);
    }
  }, [buildItemPayload, clearStatus, editingItemId, editingRow, refreshSelectedSummary, showStatus, summary, validateItemRow]);

  const removeItem = useCallback(async (itemId) => {
    if (!summary?.id) return;
    if (!window.confirm("Delete this quotation item?")) return;

    clearStatus();
    try {
      await deleteQuotationItem(summary.id, itemId);
      await refreshSelectedSummary(summary.id);
      showStatus("Quotation item deleted.");
    } catch (error) {
      const text = error.message || "Failed to delete quotation item.";
      showStatus(text, "error");
      window.alert(text);
    }
  }, [clearStatus, refreshSelectedSummary, showStatus, summary]);

  const renderSummaryGrid = () => {
    if (!summary) return null;

    const orderedFields = [
      ...SUMMARY_PRIMARY_FIELDS,
      ...SUMMARY_EDITABLE_FIELDS,
      ...SUMMARY_CALCULATED_FIELDS,
    ];

    const readOnlyFields = new Set([...SUMMARY_PRIMARY_FIELDS, ...SUMMARY_CALCULATED_FIELDS]);

    return (
      <div className="pq-summary-grid">
        {orderedFields.map((field) => {
          const readOnly = readOnlyFields.has(field);
          const displayValue = field === "project_id"
            ? (summary.project_code || summary.project_id || "")
            : (readOnly ? (summaryPreviewValues[field] ?? summary[field] ?? "") : (summary[field] ?? ""));

          return (
            <label key={field} className="pq-summary-field">
              <span className="pq-summary-field__label">
                {(SUMMARY_FIELD_LABELS[field] || field.replaceAll("_", " "))}
              </span>
              <input
                className={`auth-input${readOnly ? " auth-input--readonly" : ""}`}
                value={displayValue}
                onChange={(event) => patchSummary(field, event.target.value)}
                readOnly={readOnly}
                disabled={readOnly || savingSummary}
              />
            </label>
          );
        })}
      </div>
    );
  };

  const renderItemEditorCells = (row, patchFn, disabled) => {
    const material = isMaterialCostType(row.cost_type_id);
    const itemNames = material ? getNamesForCategory(row.item_category_id) : [];
    const itemCodes = material ? getCodesForSelection(row.item_category_id, row.item_name) : [];

    return (
      <>
        <td>
          <select
            className="auth-input"
            value={row.room_name_id || ""}
            disabled={disabled}
            onChange={(event) => patchFn({ room_name_id: event.target.value })}
          >
            <option value="">Select room</option>
            {roomOptions.map((option) => (
              <option key={option.id} value={String(option.id)}>{option.room_name}</option>
            ))}
          </select>
        </td>
        <td>
          <select
            className="auth-input"
            value={row.item_category_id}
            disabled={disabled || !material}
            onChange={(event) => patchFn({ item_category_id: event.target.value, item_name: "", item_code_id: "", item_type: "", purchase_qty: "0", requested_qty: "0", max_cost: "0", min_cost: "0", actual_cost: "0", total_cost: "0", ...emptyDimensions })}
          >
            <option value="">Select category</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={String(option.id)}>{option.name}</option>
            ))}
          </select>
        </td>
        <td>
          <select
            className="auth-input"
            value={row.item_name}
            disabled={disabled || !material || !row.item_category_id}
            onChange={(event) => patchFn({ item_name: event.target.value, item_code_id: "", item_type: "", purchase_qty: "0", requested_qty: "0", max_cost: "0", min_cost: "0", actual_cost: "0", total_cost: "0", ...emptyDimensions })}
          >
            <option value="">Select item name</option>
            {itemNames.map((name) => (
              <option key={`${row.item_category_id}-${name}`} value={name}>{name}</option>
            ))}
          </select>
        </td>
        <td>
          <select
            className="auth-input"
            value={row.item_code_id}
            disabled={disabled || !material || !row.item_name}
            onChange={async (event) => applyMaterialSelection(event.target.value, patchFn)}
          >
            <option value="">Select item code</option>
            {itemCodes.map((option) => (
              <option key={option.id} value={String(option.id)}>{option.item_code}</option>
            ))}
          </select>
        </td>
        <td><input className="auth-input auth-input--readonly" value={row.item_type || ""} readOnly disabled /></td>
        <td><input className="auth-input auth-input--readonly" value={row.purchase_qty} readOnly disabled /></td>
        <td><input className="auth-input" type="number" min="0" step="any" value={row.requested_qty} disabled={disabled} onChange={(event) => patchFn({ requested_qty: event.target.value })} /></td>
        <td>
          <span className={`pq-stock-badge ${getStockStatusBadgeClassName(getStockStatusName(row))}`}>
            {getStockStatusName(row)}
          </span>
        </td>
        <td><input className="auth-input auth-input--readonly" value={row.length} readOnly disabled /></td>
        <td><input className="auth-input auth-input--readonly" value={row.width} readOnly disabled /></td>
        <td><input className="auth-input auth-input--readonly" value={row.height} readOnly disabled /></td>
        <td><input className="auth-input auth-input--readonly" value={row.volume} readOnly disabled /></td>
      </>
    );
  };

  return (
    <section className="module-page">
      <div className="crud-page__header pq-header">
        <div>
          <h1 className="module-page__title pq-title">{embedded ? "Quotation" : "Project Quotation"}</h1>
        </div>
        {!embedded ? (
          <div className="pq-header-actions">
            <button
              type="button"
              className="crud-add-btn"
              onClick={goBackToQuotationList}
            >
              {selectedQuotationId ? "Back to Quotation List" : "Back to Projects"}
            </button>
          </div>
        ) : null}
      </div>

      {roomPopup.message ? (
        <p className={`users-status ${getPopupClassName(roomPopup.type)} pq-room-popup`}>
          {roomPopup.message}
        </p>
      ) : null}

      {status.message && (!summary || (!embedded && !selectedQuotationId)) ? (
        <p className={getStatusClassName(status.type)}>
          {status.message}
        </p>
      ) : null}

      {loading ? <p className="users-status">Loading quotations...</p> : null}

      {!loading && !embedded && !selectedQuotationId ? (
        <div className="users-table-wrap pq-table-wrap-list">
          <table className="users-table">
            <thead>
              <tr>
                <th>Quotation Number</th>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Total Quotation Cost</th>
                <th className="pq-text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="pq-empty-cell">
                    No quotations found.
                  </td>
                </tr>
              ) : quotations.map((row) => (
                <tr key={row.id}>
                  <td className="pq-cell-link" onClick={() => openSummary(row.id)}>{row.quotation_number || "Auto"}</td>
                  <td>{row.project_code || row.project_id}</td>
                  <td>{row.project_name || "-"}</td>
                  <td className="pq-text-right">{row.total_quotation_cost}</td>
                  <td className="pq-text-center">
                    <div className="pq-inline-actions">
                      <button type="button" className="users-action users-action--edit" onClick={() => openSummary(row.id)} title="Edit">
                        <BsPencilSquare aria-hidden="true" />
                      </button>
                      <button type="button" className="users-action users-action--delete" onClick={() => removeSummary(row.id)} title="Delete">
                        <BsTrashFill aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && (embedded || selectedQuotationId) && summary ? (
        <details open className="costing-selector-details pq-details-card">
          <summary className="auth-input costing-selector-summary pq-details-summary">
            <span className="pq-details-title">{summary.quotation_number || "Auto"} - {summary.project_name || "Project"}</span>
            <span className="pq-details-total">Total OMR {toMoney(summaryPreviewValues.planned_order_value || summary.total_quotation_cost || summary.total_cost_to_elite)}</span>
          </summary>

          <div className="pq-details-content">
            {summaryStatus ? (
              <p className={`${getStatusClassName(summaryStatus.type)} pq-status-block`}>
                {summaryStatus.message}
              </p>
            ) : null}

            {summaryValidationMessages.length ? (
              <div className="pq-status-list">
                {summaryValidationMessages.map((entry) => (
                  <p key={`summary-${entry.type}-${entry.message}`} className={`${getStatusClassName(entry.type)} pq-status-line`}>
                    {entry.message}
                  </p>
                ))}
              </div>
            ) : null}

            {renderSummaryGrid()}
            <div className="pq-summary-actions">
              <button type="button" className="crud-add-btn" onClick={saveSummary} disabled={savingSummary}>
                {savingSummary ? "Saving..." : "Save Summary"}
              </button>
            </div>

            {!embedded && summarySaveFeedback.message ? (
              <p className={`${getStatusClassName(summarySaveFeedback.type)} pq-status-block`}>
                {summarySaveFeedback.message}
              </p>
            ) : null}

            <div aria-hidden="true" className="pq-divider" />

            <div className="pq-items-header">
              <strong>Quotation Items</strong>
              <div className="pq-items-header-actions">
                <input ref={importFileInputRef} className="pq-hidden-file-input" type="file" accept=".xlsx,.xls" onChange={handleImportItemsFile} />
                <button type="button" className="crud-add-btn" onClick={handleDownloadImportTemplate} disabled={downloadingTemplate || importingItems || savingRow}>
                  {downloadingTemplate ? "Downloading..." : "Download Template"}
                </button>
                <button type="button" className="crud-add-btn" onClick={openImportFilePicker} disabled={importingItems || savingRow}>
                  {importingItems ? "Importing..." : "Import Excel"}
                </button>
                <button type="button" className="crud-add-btn" onClick={openRoomModal}>
                 <BsPlusCircleFill aria-hidden="true" /> Add New Room
                </button>
                {!draftRow ? (
                  <button type="button" className="crud-add-btn" onClick={startAdd}>
                    <BsPlusCircleFill aria-hidden="true" /> Add Item
                  </button>
                ) : null}
              </div>
            </div>

            {importSummary ? (
              <div className="pq-import-summary">
                <p className="pq-import-summary__title">Import Summary</p>
                <p className="pq-import-summary__line">
                  Created: {importSummary.created || 0} | Updated: {importSummary.updated || 0} | Failed: {importSummary.failed || 0} | Blank Rows: {importSummary.blank_rows || 0}
                </p>
                {importReports.length ? (
                  <div className="pq-import-report-wrap">
                    <table className="users-table pq-import-report-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Item Code</th>
                          <th>Status</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importReports.slice(0, 20).map((report) => (
                          <tr key={`import-${report.row}-${report.item_code_input}-${report.status}`}>
                            <td>{report.row}</td>
                            <td>{report.item_code_input || "-"}</td>
                            <td>{report.status || "-"}</td>
                            <td>{report.message || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}

            {itemValidationMessages.length ? (
              <div className="pq-status-list">
                {itemValidationMessages.map((entry) => (
                  <p key={`item-${entry.type}-${entry.message}`} className={`${getStatusClassName(entry.type)} pq-status-line`}>
                    {entry.message}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="users-table-wrap users-table-wrap--fit pq-table-wrap-items">
              <table className="users-table users-table--quotation pq-table-quotation">
                <thead>
                  <tr>
                    <th>Room Name</th>
                    <th>Item Category</th>
                    <th>Item Name</th>
                    <th>Item Code</th>
                    <th>Item Type</th>
                    <th>Purchase Qty</th>
                    <th>Requested Qty</th>
                    <th>Stock Status</th>
                    <th>Length</th>
                    <th>Width</th>
                    <th>Height</th>
                    <th>Volume</th>
                    <th className="pq-text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {draftRow ? (
                    <tr>
                      {renderItemEditorCells(draftRow, patchDraftRow, savingRow)}
                      <td className="pq-text-center">
                        <div className="pq-inline-actions">
                          <button type="button" className="modal-btn modal-btn--save" onClick={saveDraftItem} disabled={savingRow}>
                            <BsCheckCircleFill aria-hidden="true" />
                          </button>
                          <button type="button" className="modal-btn modal-btn--cancel" onClick={cancelAdd} disabled={savingRow}>
                            <BsXCircleFill aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}

                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="pq-empty-cell">No quotation items yet.</td>
                    </tr>
                  ) : items.map((row) => {
                    const inEditMode = editingItemId === row.id && editingRow;
                    return (
                      <tr key={row.id}>
                        {inEditMode ? (
                          <>
                            {renderItemEditorCells(editingRow, patchEditingRow, savingRow)}
                            <td className="pq-text-center">
                              <div className="pq-inline-actions">
                                <button type="button" className="modal-btn modal-btn--save" onClick={saveEditedItem} disabled={savingRow}>
                                  <BsCheckCircleFill aria-hidden="true" />
                                </button>
                                <button type="button" className="modal-btn modal-btn--cancel" onClick={cancelEdit} disabled={savingRow}>
                                  <BsXCircleFill aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{row.room_name?.room_name || "-"}</td>
                            <td>{row.item_category || "-"}</td>
                            <td>{row.item_name || "-"}</td>
                            <td>{row.item_code || "-"}</td>
                            <td>{row.item_type || "-"}</td>
                            <td className="pq-text-right">{row.purchase_qty}</td>
                            <td className="pq-text-right">{row.requested_qty}</td>
                            <td>
                              <span className={`pq-stock-badge ${getStockStatusBadgeClassName(getStockStatusName(row))}`}>
                                {getStockStatusName(row)}
                              </span>
                            </td>
                            <td className="pq-text-right">{row.length}</td>
                            <td className="pq-text-right">{row.width}</td>
                            <td className="pq-text-right">{row.height}</td>
                            <td className="pq-text-right">{row.volume}</td>
                            <td className="pq-text-center">
                              <div className="pq-inline-actions">
                                <button type="button" className="users-action users-action--edit" onClick={() => startEdit(row)} title="Edit">
                                  <BsPencilSquare aria-hidden="true" />
                                </button>
                                <button type="button" className="users-action users-action--delete" onClick={() => removeItem(row.id)} title="Delete">
                                  <BsTrashFill aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </details>
      ) : null}

      {roomModalOpen ? (
        <div className="pq-room-modal-backdrop" role="presentation" onClick={closeRoomModal}>
          <div className="pq-room-modal" role="dialog" aria-modal="true" aria-label="Add new room" onClick={(event) => event.stopPropagation()}>
            <h3 className="pq-room-modal-title">Add New Room</h3>
            <label className="pq-room-modal-field" htmlFor="room-name-input">
              Room Name
            </label>
            <input
              id="room-name-input"
              className="auth-input"
              value={newRoomName}
              onChange={(event) => setNewRoomName(event.target.value)}
              disabled={savingRoom}
              placeholder="Enter room name"
            />

            {roomPopup.message ? (
              <p className={`users-status ${getPopupClassName(roomPopup.type)} pq-room-popup-modal`}>
                {roomPopup.message}
              </p>
            ) : null}

            <div className="pq-room-modal-actions">
              <button type="button" className="modal-btn modal-btn--save" onClick={saveRoom} disabled={savingRoom}>
                {savingRoom ? "Saving..." : "Save"}
              </button>
              <button type="button" className="modal-btn modal-btn--cancel" onClick={closeRoomModal} disabled={savingRoom}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ProjectQuotationPage;
