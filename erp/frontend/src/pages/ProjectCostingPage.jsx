import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BsArrowLeft,
  BsCashCoin,
  BsCheckCircleFill,
  BsClipboardData,
  BsBoxes,
  BsPencilSquare,
  BsPlusCircleFill,
  BsTrashFill,
  BsXCircleFill,
} from "react-icons/bs";
import {
  addRoom,
  createProjectCostingItem,
  deleteProjectCosting,
  deleteProjectCostingItem,
  downloadCostingItemsImportTemplate,
  generateProjectCosting,
  getItemCostPreview,
  getProjectCosting,
  importCostingItemsExcel,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listProjectCostings,
  listQuotationSummaries,
  listRooms,
  updateProjectCosting,
  updateProjectCostingItem,
} from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import "../styles/ProjectCosting.css";

const STATUS_ITEM_ACCEPTED = "Item Accepted";
const STATUS_NO_ACTION = "No Action";
const STATUS_ITEM_REQUESTED = "Item Requested";
const STATUS_ITEM_SUPPLIED = "Item Supplied";
const STATUS_ITEM_RETURN = "Item Return";
const STATUS_ITEM_RETURN_ACCEPTED = "Item Return Accepted";
const MATERIAL_NAME = "MATERIAL";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toMoney = (value, decimals = 2) => (
  (Math.round((toNumber(value) + Number.EPSILON) * (10 ** decimals)) / (10 ** decimals)).toFixed(decimals)
);

const normalizeText = (value) => String(value || "").trim();

const emptyDimensions = {
  length: "0",
  width: "0",
  height: "0",
  volume: "0",
};

const getStockStatusName = (row) => row?.stock_status?.status_name || row?.stock_status_name || "In-Stock";
const getRetrievalStatusName = (row) => row?.retrieval_status?.status_name || row?.retrieval_status_name || STATUS_NO_ACTION;

const buildDraftItem = (materialCostTypeId) => ({
  cost_type_id: materialCostTypeId ? String(materialCostTypeId) : "",
  item_category_id: "",
  item_name: "",
  item_code_id: "",
  item_type: "",
  room_name_id: "",
  retrieval_status_name: STATUS_NO_ACTION,
  stock_status_name: "In-Stock",
  requested_qty: "0",
  purchase_qty: "0",
  cost_per_qty: "0",
  max_cost: "0",
  min_cost: "0",
  actual_cost: "0",
  total_cost: "0",
  ...emptyDimensions,
});

const getPopupClass = (type) => {
  if (type === "error") return "project-costing-popup project-costing-popup--error";
  if (type === "warning") return "project-costing-popup project-costing-popup--warning";
  return "project-costing-popup project-costing-popup--success";
};

const getRetrievalBadgeClass = (statusName) => {
  const n = String(statusName || "").trim().toLowerCase();
  if (n.includes("accepted")) return "project-costing-badge project-costing-badge--success";
  if (n.includes("return")) return "project-costing-badge project-costing-badge--error";
  if (n === "no action") return "project-costing-badge project-costing-badge--neutral";
  return "project-costing-badge project-costing-badge--warning";
};

const getStockStatusBadgeClass = (statusName) => {
  const normalized = String(statusName || "").trim().toLowerCase();
  if (normalized === "in-stock") return "project-costing-stock-badge--in-stock";
  if (normalized === "partial stock") return "project-costing-stock-badge--partial";
  if (normalized === "no stock" || normalized === "not purchased") return "project-costing-stock-badge--no-stock";
  return "project-costing-stock-badge--no-stock";
};

const EMPTY_SUMMARY_FORM = {
  total_material_cost: "0",
  petrol_expenses: "0",
  transport_installation_team: "0",
  contingency: "0",
  transportation: "0",
  food_accomodation: "0",
  loading: "0",
  unloading: "0",
  installation: "0",
  business_development: "0",
  markup: "0",
};

function summaryFormFromCosting(c) {
  if (!c) return EMPTY_SUMMARY_FORM;
  return {
    total_material_cost: String(c.total_material_cost ?? "0"),
    petrol_expenses: String(c.petrol_expenses ?? "0"),
    transport_installation_team: String(c.transport_installation_team ?? "0"),
    contingency: String(c.contingency ?? "0"),
    transportation: String(c.transportation ?? "0"),
    food_accomodation: String(c.food_accomodation ?? "0"),
    loading: String(c.loading ?? "0"),
    unloading: String(c.unloading ?? "0"),
    installation: String(c.installation ?? "0"),
    business_development: String(c.business_development ?? "0"),
    markup: String(c.markup ?? "0"),
  };
}

function ProjectCostingPage({ projectId = null, projectCode = "", embedded = false, onStatusChange = null }) {
  const currentUser = useMemo(() => getSessionUser(), []);
  const roleName = String(currentUser?.role || "").trim().toLowerCase();
  const teamName = String(currentUser?.team || "").trim().toLowerCase();
  const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";
  const canEditRetrievalStatus =
    isAdmin || ["engineering team", "engineering", "engg team"].includes(teamName);

  // list
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [costings, setCostings] = useState([]);
  const [listColumnFilters, setListColumnFilters] = useState({});
  const [quotationOptions, setQuotationOptions] = useState([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [retrievalStatuses, setRetrievalStatuses] = useState([]);
  const [roomOptions, setRoomOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [costTypes, setCostTypes] = useState([]);
  const [materialCostTypeId, setMaterialCostTypeId] = useState("");

  // edit view
  const [editingCosting, setEditingCosting] = useState(null);
  const [editingItems, setEditingItems] = useState([]);

  // summary form
  const [summaryForm, setSummaryForm] = useState(EMPTY_SUMMARY_FORM);
  const [summarySaving, setSummarySaving] = useState(false);

  // per-item edit
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [draftRow, setDraftRow] = useState(null);
  const [importingItems, setImportingItems] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importReports, setImportReports] = useState([]);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);
  const [roomPopup, setRoomPopup] = useState({ type: "", message: "" });
  const [itemColumnFilters, setItemColumnFilters] = useState({});
  useEffect(() => {
    if (!onStatusChange) return;
    onStatusChange(status || { type: "", message: "" });
  }, [onStatusChange, status]);


  const itemMasterRef = useRef([]);
  const importFileInputRef = useRef(null);

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

  const getItemColumnValue = useCallback((item, key) => {
    if (key === "room_name") return item?.room_name?.room_name || "";
    if (key === "stock_status") return getStockStatusName(item);
    if (key === "retrieval_status") return item?.retrieval_status?.status_name || "";
    return item?.[key] ?? "";
  }, []);

  const filteredEditingItems = useMemo(() => {
    const activeFilters = Object.entries(itemColumnFilters).filter(([, value]) => String(value || "").trim());
    if (!activeFilters.length) return editingItems;
    return editingItems.filter((item) => (
      activeFilters.every(([key, filterValue]) => (
        String(getItemColumnValue(item, key)).toLowerCase().includes(String(filterValue).trim().toLowerCase())
      ))
    ));
  }, [editingItems, getItemColumnValue, itemColumnFilters]);

  const acceptedMaterialCost = useMemo(() => {
    const total = editingItems.reduce((sum, item) => {
      const statusName = String(getRetrievalStatusName(item)).trim().toLowerCase();
      if (statusName !== STATUS_ITEM_ACCEPTED.toLowerCase()) return sum;
      return sum + toNumber(item?.total_cost);
    }, 0);
    return toMoney(total);
  }, [editingItems]);

  const getEditableRetrievalOptions = useCallback((currentStatusName) => {
    const current = String(currentStatusName || "").trim().toLowerCase();
    if (!current || current === STATUS_NO_ACTION.toLowerCase()) return [STATUS_ITEM_REQUESTED];
    if (current === STATUS_ITEM_SUPPLIED.toLowerCase()) return [STATUS_ITEM_RETURN];
    if (current === STATUS_ITEM_RETURN_ACCEPTED.toLowerCase()) return [STATUS_ITEM_RETURN_ACCEPTED];
    return [String(currentStatusName || STATUS_NO_ACTION)];
  }, []);

  const getDraftRetrievalOptions = useCallback(() => ([STATUS_NO_ACTION, STATUS_ITEM_REQUESTED]), []);

  const canDeleteItem = useCallback((item) => (
    String(getRetrievalStatusName(item)).trim().toLowerCase() === STATUS_NO_ACTION.toLowerCase()
  ), []);

  const canEditItem = useCallback((item) => (
    String(getRetrievalStatusName(item)).trim().toLowerCase() === STATUS_NO_ACTION.toLowerCase()
  ), []);

  const scopedQuotationOptions = useMemo(() => {
    if (!embedded || !projectId) return quotationOptions;
    const pid = String(projectId);
    return quotationOptions.filter((row) => String(row?.project_id ?? row?.project?.id ?? "") === pid);
  }, [embedded, projectId, quotationOptions]);

  const scopedCostings = useMemo(() => {
    if (!embedded || !projectId) return costings;
    const pid = String(projectId);
    const normalizedProjectCode = String(projectCode || "").trim().toLowerCase();
    const allowedQuotationNumbers = new Set(
      scopedQuotationOptions
        .map((row) => String(row?.quotation_number || "").trim())
        .filter(Boolean)
    );
    return costings.filter((row) => {
      const rowProjectId = row?.project_id ?? row?.project?.id ?? row?.project_ref_id;
      if (String(rowProjectId || "") === pid) return true;
      if (normalizedProjectCode && String(row?.project_code || "").trim().toLowerCase() === normalizedProjectCode) {
        return true;
      }
      const quotationNumber = String(row?.quotation_number || "").trim();
      return Boolean(quotationNumber) && allowedQuotationNumbers.has(quotationNumber);
    });
  }, [costings, embedded, projectCode, projectId, scopedQuotationOptions]);

  const filteredCostings = useMemo(() => {
    const activeFilters = Object.entries(listColumnFilters).filter(([, value]) => String(value || "").trim());
    if (!activeFilters.length) return scopedCostings;
    return scopedCostings.filter((row) => (
      activeFilters.every(([key, filterValue]) => (
        String(row?.[key] ?? "").toLowerCase().includes(String(filterValue).trim().toLowerCase())
      ))
    ));
  }, [listColumnFilters, scopedCostings]);

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

  const loadRoomOptions = useCallback(async () => {
    const data = await listRooms();
    setRoomOptions(Array.isArray(data?.rooms) ? data.rooms : []);
  }, []);

  const loadItemMeta = useCallback(async () => {
    const [categoryData, itemData, roomData] = await Promise.all([
      listLabFurnitureItemCategories(),
      listLabFurnitureItems(),
      listRooms(),
    ]);
    setCategoryOptions(Array.isArray(categoryData?.item_categories) ? categoryData.item_categories : []);
    itemMasterRef.current = Array.isArray(itemData?.lab_furniture_items) ? itemData.lab_furniture_items : [];
    setRoomOptions(Array.isArray(roomData?.rooms) ? roomData.rooms : []);
  }, []);

  const loadList = useCallback(async () => {
    const activeProjectId = embedded && projectId ? projectId : null;
    const [costingData, quotationData] = await Promise.all([
      listProjectCostings(),
      listQuotationSummaries(activeProjectId),
    ]);
    setCostings(Array.isArray(costingData?.costings) ? costingData.costings : []);
    setQuotationOptions(Array.isArray(quotationData?.quotations) ? quotationData.quotations : []);
    setRetrievalStatuses(
      Array.isArray(costingData?.retrieval_statuses) ? costingData.retrieval_statuses : []
    );
  }, [embedded, projectId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([loadList(), loadItemMeta()])
      .catch((err) => {
        if (!alive) return;
        setStatus({ type: "error", message: err.message || "Failed to load project costings." });
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadItemMeta, loadList]);

  useEffect(() => {
    if (!editingCosting) return;
    setSummaryForm((prev) => ({
      ...prev,
      total_material_cost: acceptedMaterialCost,
    }));
  }, [acceptedMaterialCost, editingCosting]);

  const openCosting = useCallback(async (costingId) => {
    setStatus({ type: "", message: "" });
    setEditingItemId(null);
    setEditingRow(null);
    setDraftRow(null);
    setImportSummary(null);
    setImportReports([]);
    try {
      const data = await getProjectCosting(costingId);
      const c = data?.costing || null;
      setEditingCosting(c);
      setEditingItems(Array.isArray(data?.items) ? data.items : []);
      setSummaryForm(summaryFormFromCosting(c));
       setCostTypes(Array.isArray(data?.cost_types) ? data.cost_types : []);
       setMaterialCostTypeId(data?.material_cost_type_id ? String(data.material_cost_type_id) : "");
      if (Array.isArray(data?.retrieval_statuses) && data.retrieval_statuses.length) {
        setRetrievalStatuses(data.retrieval_statuses);
      }
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to load costing detail." });
    }
  }, []);

  const closeCosting = useCallback(() => {
    setEditingCosting(null);
    setEditingItems([]);
    setEditingItemId(null);
    setEditingRow(null);
    setDraftRow(null);
    setSummaryForm(EMPTY_SUMMARY_FORM);
    setImportSummary(null);
    setImportReports([]);
    setRoomModalOpen(false);
    setNewRoomName("");
    setRoomPopup({ type: "", message: "" });
    setStatus({ type: "", message: "" });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedQuotationId) {
      setStatus({ type: "warning", message: "Select a quotation before generating." });
      return;
    }
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const response = await generateProjectCosting(selectedQuotationId);
      setStatus({ type: "success", message: response.message || "Project costing generated." });
      await loadList();
      if (response?.costing?.id) {
        await openCosting(response.costing.id);
      }
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to generate project costing." });
    } finally {
      setSaving(false);
    }
  }, [loadList, openCosting, selectedQuotationId]);

  const handleDeleteCosting = useCallback(async (costingId) => {
    if (!window.confirm("Delete this project costing and all linked items?")) return;
    setSaving(true);
    try {
      await deleteProjectCosting(costingId);
      await loadList();
      if (editingCosting && String(editingCosting.id) === String(costingId)) closeCosting();
      setStatus({ type: "success", message: "Project costing deleted." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to delete project costing." });
    } finally {
      setSaving(false);
    }
  }, [loadList, editingCosting, closeCosting]);

  // ── Summary save ─────────────────────────────────────────
  const handleSaveSummary = useCallback(async () => {
    if (!editingCosting) return;
    setSummarySaving(true);
    setStatus({ type: "", message: "" });
    try {
      const response = await updateProjectCosting(editingCosting.id, {
        ...summaryForm,
        total_material_cost: acceptedMaterialCost,
      });
      const updated = response?.costing || null;
      if (updated) {
        setEditingCosting(updated);
        setSummaryForm(summaryFormFromCosting(updated));
      }
      setStatus({ type: "success", message: "Costing summary saved." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to save summary." });
    } finally {
      setSummarySaving(false);
    }
  }, [acceptedMaterialCost, editingCosting, summaryForm]);

  // ── Item edit ────────────────────────────────────────────
  const startEditItem = useCallback((item) => {
    if (!canEditItem(item)) {
      setStatus({ type: "warning", message: "Editing is allowed only when retrieval status is No Action." });
      return;
    }
    const currentRetrievalStatus = getRetrievalStatusName(item);
    const editableStatusOptions = getEditableRetrievalOptions(currentRetrievalStatus);
    setDraftRow(null);
    setEditingItemId(item.id);
    setEditingRow({
      ...item,
      cost_type_id: String(item.cost_type_id || ""),
      item_category_id: String(item.item_category_id || ""),
      item_code_id: String(item.item_code_id || ""),
      room_name_id: String(item.room_name?.id || item.room_name_id || ""),
      item_type: item.item_type || "",
      stock_status_name: getStockStatusName(item),
      purchase_qty: String(item.purchase_qty ?? "0"),
      requested_qty: String(item.requested_qty ?? ""),
      cost_per_qty: String(item.cost_per_qty ?? "0"),
      max_cost: String(item.max_cost ?? "0"),
      min_cost: String(item.min_cost ?? "0"),
      actual_cost: String(item.actual_cost ?? "0"),
      total_cost: String(item.total_cost ?? "0"),
      retrieval_status_name: editableStatusOptions[0] || currentRetrievalStatus || STATUS_NO_ACTION,
      length: String(item.length ?? "0"),
      width: String(item.width ?? "0"),
      height: String(item.height ?? "0"),
      volume: String(item.volume ?? "0"),
    });
  }, [canEditItem, getEditableRetrievalOptions]);

  const cancelEditItem = useCallback(() => {
    setEditingItemId(null);
    setEditingRow(null);
  }, []);

  const buildItemPayload = useCallback((row) => ({
    cost_type_id: row.cost_type_id,
    item_category_id: isMaterialCostType(row.cost_type_id) ? row.item_category_id || null : null,
    item_name: row.item_name || "",
    item_code_id: isMaterialCostType(row.cost_type_id) ? row.item_code_id || null : null,
    room_name_id: row.room_name_id || null,
    requested_qty: row.requested_qty || "0",
    purchase_qty: row.purchase_qty || "0",
    actual_cost: row.actual_cost || "0",
    retrieval_status_name: row.retrieval_status_name || STATUS_NO_ACTION,
  }), [isMaterialCostType]);

  const validateItemRow = useCallback((row) => {
    if (!normalizeText(row?.cost_type_id)) return { type: "error", message: "Cost type is required." };
    if (!normalizeText(row?.room_name_id)) return { type: "error", message: "Room name is required." };
    if (toNumber(row?.requested_qty) < 0) return { type: "error", message: "Requested Qty must be 0 or greater." };
    if (toNumber(row?.actual_cost) < 0) return { type: "error", message: "Actual Cost must be 0 or greater." };

    if (isMaterialCostType(row.cost_type_id)) {
      if (!normalizeText(row.item_category_id)) return { type: "error", message: "Item category is required for MATERIAL." };
      if (!normalizeText(row.item_name)) return { type: "error", message: "Item name is required for MATERIAL." };
      if (!normalizeText(row.item_code_id)) return { type: "error", message: "Item code is required for MATERIAL." };

      const duplicate = editingItems.some(
        (candidate) => String(candidate.item_code_id || "") === String(row.item_code_id || "")
          && String(candidate.id || "") !== String(row.id || editingItemId || "")
      );
      if (duplicate) {
        return { type: "error", message: "Duplicate item code is not allowed for this project costing." };
      }

      if (toNumber(row.requested_qty) > toNumber(row.purchase_qty) && toNumber(row.purchase_qty) > 0) {
        return { type: "warning", message: "Requested Qty is greater than Purchase Qty." };
      }

      if (toNumber(row.purchase_qty) <= 0) {
        return { type: "warning", message: "Purchase data is missing. Please confirm Actual Cost manually." };
      }
    } else if (!normalizeText(row.item_name)) {
      return { type: "error", message: "Item name is required." };
    }

    return { type: "success", message: "Costing item is ready to save." };
  }, [editingItemId, editingItems, isMaterialCostType]);

  const handleSaveItem = useCallback(async () => {
    if (!editingCosting || !editingItemId || !editingRow) return;
    const validation = validateItemRow(editingRow);
    if (validation.type === "error") {
      setStatus(validation);
      return;
    }
    if (validation.type === "warning") {
      const proceed = window.confirm(`${validation.message}\n\nDo you want to proceed?`);
      if (!proceed) {
        setStatus({ type: "warning", message: "Save cancelled by user." });
        return;
      }
    }

    setItemSaving(true);
    try {
      const response = await updateProjectCostingItem(editingCosting.id, editingItemId, {
        ...buildItemPayload(editingRow),
        retrieval_status_name: editingRow.retrieval_status_name,
      });
      setEditingItems(Array.isArray(response?.items) ? response.items : []);
      cancelEditItem();
      setStatus({ type: "success", message: "Item updated." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to update item." });
    } finally {
      setItemSaving(false);
    }
  }, [buildItemPayload, cancelEditItem, editingCosting, editingItemId, editingRow, validateItemRow]);

  const handleDeleteItem = useCallback(async (itemId) => {
    if (!editingCosting) return;
    if (!window.confirm("Delete this costing item?")) return;
    setItemSaving(true);
    try {
      const response = await deleteProjectCostingItem(editingCosting.id, itemId);
      setEditingItems(Array.isArray(response?.items) ? response.items : []);
      setStatus({ type: "success", message: "Item deleted." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to delete item." });
    } finally {
      setItemSaving(false);
    }
  }, [editingCosting]);

  const isFrozen = (item) =>
    item?.retrieval_status?.status_name === STATUS_ITEM_ACCEPTED && !isAdmin;

  const sfld = (key) => (e) => setSummaryForm((f) => ({ ...f, [key]: e.target.value }));

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
    if (!editingCosting?.id || importingItems || itemSaving) return;
    if (importFileInputRef.current) {
      importFileInputRef.current.click();
    }
  }, [editingCosting?.id, importingItems, itemSaving]);

  const handleDownloadImportTemplate = useCallback(async () => {
    setDownloadingTemplate(true);
    try {
      await downloadCostingItemsImportTemplate();
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Failed to download import template." });
      window.alert(error.message || "Failed to download import template.");
    } finally {
      setDownloadingTemplate(false);
    }
  }, []);

  const handleImportItemsFile = useCallback(async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file || !editingCosting?.id) {
      if (event.target) event.target.value = "";
      return;
    }

    setImportingItems(true);
    setStatus({ type: "", message: "" });
    try {
      const response = await importCostingItemsExcel(editingCosting.id, file);
      setImportSummary(response.summary || null);
      setImportReports(Array.isArray(response.row_reports) ? response.row_reports : []);
      setEditingItems(Array.isArray(response.items) ? response.items : []);
      if (response.costing) {
        setEditingCosting(response.costing);
        setSummaryForm(summaryFormFromCosting(response.costing));
      }
      if (Array.isArray(response.cost_types)) {
        setCostTypes(response.cost_types);
      }
      if (response.material_cost_type_id) {
        setMaterialCostTypeId(String(response.material_cost_type_id));
      }
      setStatus({ type: response.status || "success", message: response.message || "Costing item import completed." });
    } catch (error) {
      setImportSummary(null);
      setImportReports([]);
      setStatus({ type: "error", message: error.message || "Failed to import costing items." });
      window.alert(error.message || "Failed to import costing items.");
    } finally {
      setImportingItems(false);
      if (event.target) event.target.value = "";
    }
  }, [editingCosting?.id]);

  const resolveDraftStockStatus = useCallback((row) => {
    const current = String(row?.stock_status_name || "In-Stock").trim();
    const purchaseQty = toNumber(row?.purchase_qty);
    const requestedQty = toNumber(row?.requested_qty);
    if (purchaseQty <= 0) return current || "No Stock";
    if (requestedQty > purchaseQty) return "Partial Stock";
    return "In-Stock";
  }, []);

  const applyMaterialSelection = useCallback(async (itemCodeId, applyPatch) => {
    const master = getMasterById(itemCodeId);
    if (!master) {
      applyPatch({
        item_code_id: "",
        item_type: "",
        stock_status_name: "No Stock",
        purchase_qty: "0",
        cost_per_qty: "0",
        max_cost: "0",
        min_cost: "0",
        actual_cost: "0",
        ...emptyDimensions,
      });
      setStatus({ type: "error", message: "Invalid item code selected." });
      return;
    }

    const quantity = String(master.available_qty ?? "0");
    const hasNoPurchaseData = toNumber(quantity) <= 0;

    applyPatch({
      item_category_id: String(master.item_category_id || ""),
      item_name: master.item_name || "",
      item_code_id: String(master.id),
      item_type: master.item_type || "",
      stock_status_name: hasNoPurchaseData ? "No Stock" : "In-Stock",
      purchase_qty: quantity,
      length: String(master.length ?? "0"),
      width: String(master.width ?? "0"),
      height: String(master.height ?? "0"),
      volume: String(master.volume ?? "0"),
    });

    if (hasNoPurchaseData) {
      setStatus({ type: "warning", message: "No stock available. Please enter Actual Cost manually." });
      return;
    }

    try {
      const preview = await getItemCostPreview(master.item_code, 1);
      const previewCost = String(preview?.cost ?? "0");
      applyPatch({
        cost_per_qty: previewCost,
        max_cost: previewCost,
        min_cost: previewCost,
        actual_cost: previewCost,
      });
      setStatus({ type: "success", message: "Requested Qty is within Purchase Qty." });
    } catch (_error) {
      applyPatch({ cost_per_qty: "0", max_cost: "0", min_cost: "0", actual_cost: "0" });
    }
  }, [getMasterById]);

  const patchDraftRow = useCallback((patch) => {
    setDraftRow((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      next.total_cost = toMoney(toNumber(next.requested_qty) * toNumber(next.actual_cost));
      next.stock_status_name = resolveDraftStockStatus(next);
      return next;
    });
  }, [resolveDraftStockStatus]);

  const patchEditingRow = useCallback((patch) => {
    setEditingRow((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      next.total_cost = toMoney(toNumber(next.requested_qty) * toNumber(next.actual_cost));
      next.stock_status_name = resolveDraftStockStatus(next);
      return next;
    });
  }, [resolveDraftStockStatus]);

  const startAdd = useCallback(() => {
    if (!editingCosting) return;
    setEditingItemId(null);
    setEditingRow(null);
    setDraftRow(buildDraftItem(materialCostTypeId));
    setStatus({ type: "", message: "" });
  }, [editingCosting, materialCostTypeId]);

  const cancelAdd = useCallback(() => {
    setDraftRow(null);
  }, []);

  const saveDraftItem = useCallback(async () => {
    if (!editingCosting?.id || !draftRow) return;
    const validation = validateItemRow(draftRow);
    if (validation.type === "error") {
      setStatus(validation);
      return;
    }
    if (validation.type === "warning") {
      const proceed = window.confirm(`${validation.message}\n\nDo you want to proceed?`);
      if (!proceed) {
        setStatus({ type: "warning", message: "Save cancelled by user." });
        return;
      }
    }

    setItemSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const response = await createProjectCostingItem(editingCosting.id, buildItemPayload(draftRow));
      setEditingItems(Array.isArray(response?.items) ? response.items : []);
      setDraftRow(null);
      setStatus({ type: response.status || "success", message: response.message || "Costing item added successfully." });
    } catch (error) {
      setStatus({ type: error.payload?.status || "error", message: error.message || "Failed to add costing item." });
      window.alert(error.message || "Failed to add costing item.");
    } finally {
      setItemSaving(false);
    }
  }, [buildItemPayload, draftRow, editingCosting?.id, validateItemRow]);

  const renderItemEditorCells = (row, patchFn, disabled) => {
            const retrievalOptions = row?.id ? getEditableRetrievalOptions(row.retrieval_status_name) : getDraftRetrievalOptions();
    const material = isMaterialCostType(row.cost_type_id);
    const itemNames = material ? getNamesForCategory(row.item_category_id) : [];
    const itemCodes = material ? getCodesForSelection(row.item_category_id, row.item_name) : [];

    return (
      <>
        <td>
          <select
            className="project-costing-select"
            value={row.cost_type_id || ""}
            disabled={disabled}
            onChange={(event) => patchFn({
              cost_type_id: event.target.value,
              item_category_id: "",
              item_name: "",
              item_code_id: "",
              item_type: "",
              room_name_id: row.room_name_id || "",
              purchase_qty: "0",
              cost_per_qty: "0",
              max_cost: "0",
              min_cost: "0",
              actual_cost: "0",
              stock_status_name: "In-Stock",
              ...emptyDimensions,
            })}
          >
            <option value="">Select cost type</option>
            {costTypes.map((option) => (
              <option key={option.id} value={String(option.id)}>{option.name}</option>
            ))}
          </select>
        </td>
        <td>
          <select
            className="project-costing-select"
            value={row.item_category_id || ""}
            disabled={disabled || !material}
            onChange={(event) => patchFn({
              item_category_id: event.target.value,
              item_name: "",
              item_code_id: "",
              item_type: "",
              purchase_qty: "0",
              cost_per_qty: "0",
              max_cost: "0",
              min_cost: "0",
              actual_cost: "0",
              stock_status_name: "In-Stock",
              ...emptyDimensions,
            })}
          >
            <option value="">Select category</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={String(option.id)}>{option.name}</option>
            ))}
          </select>
        </td>
        <td>
          {material ? (
            <select
              className="project-costing-select"
              value={row.item_name || ""}
              disabled={disabled || !row.item_category_id}
              onChange={(event) => patchFn({
                item_name: event.target.value,
                item_code_id: "",
                item_type: "",
                purchase_qty: "0",
                cost_per_qty: "0",
                max_cost: "0",
                min_cost: "0",
                actual_cost: "0",
                stock_status_name: "In-Stock",
                ...emptyDimensions,
              })}
            >
              <option value="">Select item name</option>
              {itemNames.map((name) => (
                <option key={`${row.item_category_id}-${name}`} value={name}>{name}</option>
              ))}
            </select>
          ) : (
            <input
              className="project-costing-input"
              value={row.item_name || ""}
              disabled={disabled}
              onChange={(event) => patchFn({ item_name: event.target.value })}
            />
          )}
        </td>
        <td>
          {material ? (
            <select
              className="project-costing-select"
              value={row.item_code_id || ""}
              disabled={disabled || !row.item_name}
              onChange={(event) => applyMaterialSelection(event.target.value, patchFn)}
            >
              <option value="">Select item code</option>
              {itemCodes.map((option) => (
                <option key={option.id} value={String(option.id)}>{option.item_code}</option>
              ))}
            </select>
          ) : (
            <span className="project-costing-muted">—</span>
          )}
        </td>
        <td><input className="project-costing-input" value={row.item_type || ""} readOnly disabled /></td>
        <td>
          <select
            className="project-costing-select"
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
        <td><input className="project-costing-input project-costing-input--numeric" value={row.length || "0"} readOnly disabled /></td>
        <td><input className="project-costing-input project-costing-input--numeric" value={row.width || "0"} readOnly disabled /></td>
        <td><input className="project-costing-input project-costing-input--numeric" value={row.height || "0"} readOnly disabled /></td>
        <td><input className="project-costing-input project-costing-input--numeric" value={row.volume || "0"} readOnly disabled /></td>
        <td><input className="project-costing-input project-costing-input--numeric" value={row.purchase_qty || "0"} readOnly disabled /></td>
        <td><input className="project-costing-input project-costing-input--numeric" type="number" min="0" step="0.01" value={row.requested_qty || "0"} disabled={disabled} onChange={(event) => patchFn({ requested_qty: event.target.value })} /></td>
        <td><input className="project-costing-input project-costing-input--numeric" value={row.cost_per_qty || "0"} readOnly disabled /></td>
        <td><input className="project-costing-input project-costing-input--numeric" value={row.max_cost || "0"} readOnly disabled /></td>
        <td><input className="project-costing-input project-costing-input--numeric" value={row.min_cost || "0"} readOnly disabled /></td>
        <td><input className="project-costing-input project-costing-input--numeric" type="number" min="0" step="0.01" value={row.actual_cost || "0"} disabled={disabled} onChange={(event) => patchFn({ actual_cost: event.target.value })} /></td>
        <td><input className="project-costing-input project-costing-input--numeric" value={row.total_cost || "0"} readOnly disabled /></td>
        <td>{getStockStatusName(row)}</td>
        <td>
          {canEditRetrievalStatus ? (
            <select
              className="project-costing-select"
              value={row.retrieval_status_name || STATUS_NO_ACTION}
              onChange={(event) => patchFn({ retrieval_status_name: event.target.value })}
              disabled={disabled}
            >
              {retrievalOptions.map((statusName) => (
                <option key={statusName} value={statusName}>{statusName}</option>
              ))}
            </select>
          ) : (
            <span className={getRetrievalBadgeClass(row.retrieval_status_name || STATUS_NO_ACTION)}>{row.retrieval_status_name || STATUS_NO_ACTION}</span>
          )}
        </td>
        <td className="project-costing-comment-cell">{row.rejection_comment || "-"}</td>
      </>
    );
  };

  // ─── Edit view ──────────────────────────────────────────────────────────────
  if (editingCosting) {
    const c = editingCosting;
    return (
      <section className="module-page project-costing-page">
        <div className="crud-page__header project-costing-toolbar">
          <h1 className="module-page__title project-costing-title">
            <span className="project-costing-title__icon" aria-hidden="true"><BsCashCoin /></span>
            <span className="project-costing-title__text">Project Costing - {c.costing_id}</span>
          </h1>
          <button type="button" className="crud-add-btn" onClick={closeCosting}>
            <BsArrowLeft aria-hidden="true" /> Back to List
          </button>
        </div>

        {status.message ? (
          <p className={getPopupClass(status.type)}>{status.message}</p>
        ) : null}

        {/* ── Costing Summary Card ────────────────────────────── */}
        <div className="project-costing-card">
          <h2 className="project-costing-section-title">
            <span className="project-costing-section-title__icon" aria-hidden="true"><BsClipboardData /></span>
            <span className="project-costing-section-title__text">Costing Summary</span>
          </h2>

          {/* Read-only identifiers */}
          <div className="project-costing-summary-grid">
            <div className="project-costing-field">
              <span className="project-costing-field__label">Costing ID</span>
              <span className="project-costing-field__value">{c.costing_id || "—"}</span>
            </div>
            <div className="project-costing-field">
              <span className="project-costing-field__label">Quotation Number</span>
              <span className="project-costing-field__value">{c.quotation_number || "—"}</span>
            </div>
            <div className="project-costing-field">
              <span className="project-costing-field__label">Project ID</span>
              <span className="project-costing-field__value">{c.project_code || "—"}</span>
            </div>
            <div className="project-costing-field">
              <span className="project-costing-field__label">Project Name</span>
              <span className="project-costing-field__value">{c.project_name || "—"}</span>
            </div>
          </div>

          {/* Editable financial inputs */}
          <div className="project-costing-form-section">
            <h3 className="project-costing-form-section__title project-costing-form-section__title--material">
              <span className="project-costing-form-section__title-icon" aria-hidden="true"><BsCashCoin /></span>
              <span>Material & Markup</span>
            </h3>
            <div className="project-costing-form-grid">
              <label className="project-costing-form-label">
                <span className="project-costing-label-with-help">
                  Total Material Cost
                  <span
                    className="project-costing-help-tooltip"
                    title="Auto-calculated from Item Accepted rows only."
                    aria-label="Auto-calculated from Item Accepted rows only."
                  >
                    ?
                  </span>
                </span>
                <input className="project-costing-input" type="number" min="0" step="0.01"
                  value={summaryForm.total_material_cost} readOnly disabled />
                <small className="project-costing-form-help">Auto-calculated from Item Accepted rows only.</small>
              </label>
              <label className="project-costing-form-label">
                Markup %
                <input className="project-costing-input" type="number" min="0" step="0.0001"
                  value={summaryForm.markup} onChange={sfld("markup")} disabled={summarySaving} />
              </label>
              <label className="project-costing-form-label">
                Contingency %
                <input className="project-costing-input" type="number" min="0"
                  value={summaryForm.contingency} onChange={sfld("contingency")} disabled={summarySaving} />
              </label>
            </div>
          </div>

          <div className="project-costing-form-section">
            <h3 className="project-costing-form-section__title project-costing-form-section__title--expenses">
              <span className="project-costing-form-section__title-icon" aria-hidden="true"><BsBoxes /></span>
              <span>Expenses</span>
            </h3>
            <div className="project-costing-form-grid">
              <label className="project-costing-form-label">
                Petrol Expenses
                <input className="project-costing-input" type="number" min="0"
                  value={summaryForm.petrol_expenses} onChange={sfld("petrol_expenses")} disabled={summarySaving} />
              </label>
              <label className="project-costing-form-label">
                Transport / Install Team
                <input className="project-costing-input" type="number" min="0"
                  value={summaryForm.transport_installation_team} onChange={sfld("transport_installation_team")} disabled={summarySaving} />
              </label>
              <label className="project-costing-form-label">
                Transportation
                <input className="project-costing-input" type="number" min="0"
                  value={summaryForm.transportation} onChange={sfld("transportation")} disabled={summarySaving} />
              </label>
              <label className="project-costing-form-label">
                Food / Accommodation
                <input className="project-costing-input" type="number" min="0"
                  value={summaryForm.food_accomodation} onChange={sfld("food_accomodation")} disabled={summarySaving} />
              </label>
              <label className="project-costing-form-label">
                Loading
                <input className="project-costing-input" type="number" min="0"
                  value={summaryForm.loading} onChange={sfld("loading")} disabled={summarySaving} />
              </label>
              <label className="project-costing-form-label">
                Unloading
                <input className="project-costing-input" type="number" min="0"
                  value={summaryForm.unloading} onChange={sfld("unloading")} disabled={summarySaving} />
              </label>
              <label className="project-costing-form-label">
                Installation
                <input className="project-costing-input" type="number" min="0"
                  value={summaryForm.installation} onChange={sfld("installation")} disabled={summarySaving} />
              </label>
              <label className="project-costing-form-label">
                Business Development
                <input className="project-costing-input" type="number" min="0"
                  value={summaryForm.business_development} onChange={sfld("business_development")} disabled={summarySaving} />
              </label>
            </div>
          </div>

          {/* Calculated / derived — read-only display */}
          <div className="project-costing-form-section">
            <h3 className="project-costing-form-section__title project-costing-form-section__title--calculated">
              <span className="project-costing-form-section__title-icon" aria-hidden="true"><BsCheckCircleFill /></span>
              <span>Calculated Totals</span>
            </h3>
            <div className="project-costing-summary-grid">
              {[
                ["Final Material Cost", c.final_material_cost],
                ["Total Cost to Elite", c.total_cost_to_elite],
                ["Total Markup", c.total_markup],
                ["Planned Order Value", c.planned_order_value],
                ["Discount", c.discount],
                ["Undiscounted Quote Value", c.undiscounted_quote_value],
                ["Factor", c.factor],
              ].map(([label, val]) => (
                <div key={label} className="project-costing-field">
                  <span className="project-costing-field__label">{label}</span>
                  <span className="project-costing-field__value project-costing-field__value--calc">
                    {val ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="project-costing-form-actions">
            <button
              type="button"
              className="crud-add-btn"
              onClick={handleSaveSummary}
              disabled={summarySaving || itemSaving}
            >
              {summarySaving ? "Saving…" : "Save Summary"}
            </button>
          </div>
        </div>

        {/* ── Items Table ──────────────────────────────────────── */}
        <div className="project-costing-card">
          <div className="project-costing-items-header">
            <strong className="project-costing-items-header__title">Costing Items</strong>
            <div className="project-costing-items-header-actions">
              <input ref={importFileInputRef} className="project-costing-hidden-file-input" type="file" accept=".xlsx,.xls" onChange={handleImportItemsFile} />
              <button type="button" className="crud-add-btn" onClick={handleDownloadImportTemplate} disabled={downloadingTemplate || importingItems || itemSaving || summarySaving}>
                {downloadingTemplate ? "Downloading..." : "Download Template"}
              </button>
              <button type="button" className="crud-add-btn" onClick={openImportFilePicker} disabled={importingItems || itemSaving || summarySaving}>
                {importingItems ? "Importing..." : "Import Excel"}
              </button>
              <button type="button" className="crud-add-btn" onClick={openRoomModal} disabled={savingRoom}>
                <BsPlusCircleFill aria-hidden="true" /> Add New Room
              </button>
              {!draftRow ? (
                <button type="button" className="crud-add-btn" onClick={startAdd} disabled={!!editingItemId || itemSaving || importingItems || summarySaving}>
                  <BsPlusCircleFill aria-hidden="true" /> Add Item
                </button>
              ) : null}
            </div>
          </div>

          {importSummary ? (
            <div className="project-costing-import-summary">
              <p className="project-costing-import-summary__title">Import Summary</p>
              <p className="project-costing-import-summary__line">
                Created: {importSummary.created || 0} | Updated: {importSummary.updated || 0} | Failed: {importSummary.failed || 0} | Blank Rows: {importSummary.blank_rows || 0}
              </p>
              {importReports.length ? (
                <div className="project-costing-import-report-wrap">
                  <table className="users-table project-costing-import-report-table">
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
                        <tr key={`costing-import-${report.row}-${report.item_code_input}-${report.status}`}>
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

          <div className="users-table-wrap users-table-wrap--fit project-costing-table-wrap project-costing-table-wrap--items">
            <table className="users-table users-table--quotation project-costing-table project-costing-table--quotation project-costing-items-table">
              <thead>
                <tr>
                  <th>Cost Type</th>
                  <th>Item Category</th>
                  <th>Item Name</th>
                  <th>Item Code</th>
                  <th>Item Type</th>
                  <th>Room</th>
                  <th className="project-costing-table__right">L</th>
                  <th className="project-costing-table__right">W</th>
                  <th className="project-costing-table__right">H</th>
                  <th className="project-costing-table__right">Vol</th>
                  <th className="project-costing-table__right">Purchase Qty</th>
                  <th className="project-costing-table__right">Requested Qty</th>
                  <th className="project-costing-table__right">Cost/Qty</th>
                  <th className="project-costing-table__right">Max Cost</th>
                  <th className="project-costing-table__right">Min Cost</th>
                  <th className="project-costing-table__right">Actual Cost</th>
                  <th className="project-costing-table__right">Total Cost</th>
                  <th>Stock Status</th>
                  <th>Retrieval Status</th>
                  <th>Rejection Comments</th>
                  <th className="project-costing-table__center">Actions</th>
                </tr>
                <tr>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.cost_type ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, cost_type: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.item_category ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, item_category: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.item_name ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, item_name: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.item_code ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, item_code: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.item_type ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, item_type: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.room_name ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, room_name: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.length ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, length: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.width ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, width: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.height ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, height: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.volume ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, volume: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.purchase_qty ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, purchase_qty: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.requested_qty ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, requested_qty: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.cost_per_qty ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, cost_per_qty: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.max_cost ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, max_cost: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.min_cost ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, min_cost: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.actual_cost ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, actual_cost: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.total_cost ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, total_cost: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.stock_status ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, stock_status: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.retrieval_status ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, retrieval_status: event.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.rejection_comment ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, rejection_comment: event.target.value }))} /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {draftRow ? (
                  <tr className="project-costing-row--editing">
                    {renderItemEditorCells(draftRow, patchDraftRow, itemSaving)}
                    <td className="project-costing-table__center">
                      <div className="project-costing-inline-actions">
                        <button type="button" className="modal-btn modal-btn--save" title="Save item" onClick={saveDraftItem} disabled={itemSaving}>
                          <BsCheckCircleFill aria-hidden="true" />
                        </button>
                        <button type="button" className="modal-btn modal-btn--cancel" title="Cancel add" onClick={cancelAdd} disabled={itemSaving}>
                          <BsXCircleFill aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}

                {filteredEditingItems.length === 0 ? (
                  <tr>
                    <td colSpan={21} className="project-costing-empty">No costing items found.</td>
                  </tr>
                ) : filteredEditingItems.map((item) => {
                  const frozen = isFrozen(item);
                  const isEditing = editingItemId === item.id && editingRow;
                  const retrievalName = item?.retrieval_status?.status_name || "—";

                  if (isEditing) {
                    return (
                      <tr key={item.id} className="project-costing-row--editing">
                        {renderItemEditorCells(editingRow, patchEditingRow, itemSaving)}
                        <td className="project-costing-table__center">
                          <div className="project-costing-inline-actions">
                            <button type="button" className="modal-btn modal-btn--save" title="Save"
                              onClick={handleSaveItem} disabled={itemSaving}>
                              <BsCheckCircleFill aria-hidden="true" />
                            </button>
                            <button type="button" className="modal-btn modal-btn--cancel" title="Cancel"
                              onClick={cancelEditItem} disabled={itemSaving}>
                              <BsXCircleFill aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={item.id} className={frozen ? "project-costing-frozen" : ""}>
                      <td>{item.cost_type || "—"}</td>
                      <td>{item.item_category || "—"}</td>
                      <td>{item.item_name || "—"}</td>
                      <td>{item.item_code || "—"}</td>
                      <td>{item.item_type || "—"}</td>
                      <td>{item.room_name?.room_name || "—"}</td>
                      <td className="project-costing-table__right">{item.length}</td>
                      <td className="project-costing-table__right">{item.width}</td>
                      <td className="project-costing-table__right">{item.height}</td>
                      <td className="project-costing-table__right">{item.volume}</td>
                      <td className="project-costing-table__right">{item.purchase_qty}</td>
                      <td className="project-costing-table__right">{item.requested_qty}</td>
                      <td className="project-costing-table__right">{item.cost_per_qty}</td>
                      <td className="project-costing-table__right">{item.max_cost}</td>
                      <td className="project-costing-table__right">{item.min_cost}</td>
                      <td className="project-costing-table__right">{item.actual_cost}</td>
                      <td className="project-costing-table__right">{item.total_cost}</td>
                      <td>
                        <span className={`project-costing-stock-badge ${getStockStatusBadgeClass(getStockStatusName(item))}`}>
                          {getStockStatusName(item)}
                        </span>
                      </td>
                      <td>
                        <span className={getRetrievalBadgeClass(retrievalName)}>{retrievalName}</span>
                      </td>
                      <td className="project-costing-comment-cell">{item.rejection_comment || "-"}</td>
                      <td className="project-costing-table__center">
                        <div className="project-costing-inline-actions">
                          <button type="button" className="users-action users-action--edit" title="Edit item"
                            disabled={
                              frozen
                              || !canEditItem(item)
                              || itemSaving
                              || !!editingItemId
                              || !!draftRow
                              || importingItems
                              || summarySaving
                            }
                            onClick={() => startEditItem(item)}>
                            <BsPencilSquare aria-hidden="true" />
                          </button>
                          <button type="button" className="users-action users-action--delete" title="Delete item"
                            disabled={
                              frozen
                              || !canDeleteItem(item)
                              || itemSaving
                              || !!editingItemId
                              || !!draftRow
                              || importingItems
                              || summarySaving
                            }
                            onClick={() => handleDeleteItem(item.id)}>
                            <BsTrashFill aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {roomModalOpen ? (
          <div className="project-costing-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) closeRoomModal(); }}>
            <div className="project-costing-modal" role="dialog" aria-modal="true" aria-labelledby="project-costing-room-modal-title">
              <h3 id="project-costing-room-modal-title" className="project-costing-modal__title">Add New Room</h3>
              {roomPopup.message ? (
                <p className={getPopupClass(roomPopup.type)}>{roomPopup.message}</p>
              ) : null}
              <label className="project-costing-form-label">
                Room Name
                <input
                  className="project-costing-input"
                  value={newRoomName}
                  disabled={savingRoom}
                  onChange={(event) => setNewRoomName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveRoom();
                    }
                  }}
                />
              </label>
              <div className="project-costing-modal-actions">
                <button type="button" className="modal-btn modal-btn--cancel" onClick={closeRoomModal} disabled={savingRoom}>Cancel</button>
                <button type="button" className="modal-btn modal-btn--save" onClick={saveRoom} disabled={savingRoom}>
                  {savingRoom ? "Saving..." : "Save Room"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  // ─── List view ──────────────────────────────────────────────────────────────
  return (
    <section className="module-page project-costing-page">
      <div className="crud-page__header project-costing-toolbar">
        <h1 className="module-page__title project-costing-title">
          <span className="project-costing-title__icon" aria-hidden="true"><BsCashCoin /></span>
          <span className="project-costing-title__text">Project Costing</span>
        </h1>
      </div>

      {status.message ? (
        <p className={getPopupClass(status.type)}>{status.message}</p>
      ) : null}

      <div className="project-costing-card project-costing-actions">
        <select className="auth-input" value={selectedQuotationId}
          onChange={(e) => setSelectedQuotationId(e.target.value)} disabled={saving || loading}>
          <option value="">Select quotation for generation</option>
          {scopedQuotationOptions.map((row) => (
            <option key={row.id} value={String(row.id)}>
              {row.quotation_number || "Auto"} — {row.project_name || "Project"}
            </option>
          ))}
        </select>
        <button type="button" className="crud-add-btn" onClick={handleGenerate}
          disabled={saving || loading || !selectedQuotationId}>
          {saving ? "Processing…" : "Generate Project Costing"}
        </button>
      </div>

      {loading ? (
        <p className="project-costing-popup project-costing-popup--warning">Loading project costing data…</p>
      ) : null}

      {!loading ? (
        <div className="project-costing-table-wrap">
          <table className="users-table project-costing-table">
            <thead>
              <tr>
                <th>Costing ID</th>
                <th>Quotation Number</th>
                <th>Project ID</th>
                <th>Project Name</th>
                <th className="project-costing-table__right">Material Cost</th>
                <th className="project-costing-table__right">Planned Order Value</th>
                <th className="project-costing-table__center">Actions</th>
              </tr>
              <tr>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.costing_id ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, costing_id: event.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.quotation_number ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, quotation_number: event.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.project_code ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, project_code: event.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.project_name ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, project_name: event.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.total_material_cost ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, total_material_cost: event.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.planned_order_value ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, planned_order_value: event.target.value }))} /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredCostings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="project-costing-empty">No project costing records found.</td>
                </tr>
              ) : filteredCostings.map((row) => (
                <tr key={row.id}>
                  <td>{row.costing_id || "—"}</td>
                  <td>{row.quotation_number || "—"}</td>
                  <td>{row.project_code || "—"}</td>
                  <td>{row.project_name || "—"}</td>
                  <td className="project-costing-table__right">{row.total_material_cost ?? "—"}</td>
                  <td className="project-costing-table__right">{row.planned_order_value ?? "—"}</td>
                  <td className="project-costing-table__center">
                    <div className="project-costing-row-actions">
                      <button type="button" className="users-action users-action--edit" title="Edit costing"
                        disabled={saving} onClick={() => openCosting(row.id)}>
                        <BsPencilSquare aria-hidden="true" />
                      </button>
                      <button type="button" className="users-action users-action--delete" title="Delete costing"
                        disabled={saving} onClick={() => handleDeleteCosting(row.id)}>
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
    </section>
  );
}

export default ProjectCostingPage;
