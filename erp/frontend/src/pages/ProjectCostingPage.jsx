import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BsArrowCounterclockwise,
  BsBoxes,
  BsCashCoin,
  BsCheckCircleFill,
  BsClipboardData,
  BsPencilSquare,
  BsPlusCircleFill,
  BsTrashFill,
} from "react-icons/bs";
import {
  addRoom,
  createProjectCosting,
  createProjectCostingItem,
  deleteProjectCosting,
  deleteProjectCostingItem,
  downloadCostingItemsImportTemplate,
  generateProjectCosting,
  getItemCostPreview,
  getProjectCosting,
  importCostingItemsExcel,
  listCompletedQuotationSummaries,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listProjects,
  listPurchaseItemGRNs,
  listProjectCostings,
  listRooms,
  updateProjectCosting,
  updateProjectCostingStatus,
  updateProjectCostingItem,
} from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import AlertMessage from "../components/AlertMessage";
import ConfirmPopupModal from "../components/ConfirmPopupModal";
import { Card, CardHeader, CardBody } from "../components/Card";
import CostingItemModal from "./CostingItemModal";
import "../styles/ProjectCostingSummary.css";
import "../styles/ProjectQuotation.css";

const STATUS_ITEM_ACCEPTED = "Item Accepted";
const STATUS_NO_ACTION = "No Action";
const STATUS_ITEM_REQUESTED = "Item Requested";
const STATUS_ITEM_RETURN = "Item Return";
const STATUS_ITEM_RETURN_ACCEPTED = "Item Return Accepted";
const MATERIAL_NAME = "MATERIAL";

const COSTING_STATUS_OPTIONS = ["Work in Progress", "Completed", "Hold", "Cancelled"];

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toMoney = (value, decimals = 2) => (
  (Math.round((toNumber(value) + Number.EPSILON) * (10 ** decimals)) / (10 ** decimals)).toFixed(decimals)
);

const normalizeText = (value) => String(value || "").trim();

const sumAllocatedQty = (allocations = []) => (
  allocations.reduce((sum, row) => sum + toNumber(row?.allocated_qty), 0)
);

const getAllocatedQtyValue = (row) => {
  const allocations = Array.isArray(row?.grn_allocations) ? row.grn_allocations : [];
  if (allocations.length) return sumAllocatedQty(allocations);
  return toNumber(row?.accepted_qty);
};

const getStockStatusName = (row) => row?.stock_status?.status_name || row?.stock_status_name || "In-Stock";
const getRetrievalStatusName = (row) => row?.retrieval_status?.status_name || row?.retrieval_status_name || STATUS_NO_ACTION;

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
  status: "Work in Progress",
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
    status: String(c.status_name || c.status || "Work in Progress"),
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

const asPercent = (value) => {
  const numeric = toNumber(value);
  return numeric > 1 ? numeric / 100 : numeric;
};

const recalculateCostingSummary = (summary) => {
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

function ProjectCostingPage({ projectId = null, projectCode = "", embedded = false, onStatusChange = null }) {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getSessionUser(), []);
  const roleName = String(currentUser?.role || "").trim().toLowerCase();
  const teamName = String(currentUser?.team || "").trim().toLowerCase();
  const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";
  const canEditRetrievalStatus =
    isAdmin || ["engineering team", "engineering", "engg team"].includes(teamName);
  const normalizeStatusName = useCallback((value) => String(value || "").trim().toLowerCase(), []);

  // List view states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [costings, setCostings] = useState([]);
  const [listColumnFilters, setListColumnFilters] = useState({});
  const [quotationOptions, setQuotationOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [roomOptions, setRoomOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [costTypes, setCostTypes] = useState([]);
  const [materialCostTypeId, setMaterialCostTypeId] = useState("");
  const [itemMasterList, setItemMasterList] = useState([]);

  // Detail / edit view states
  const [editingCosting, setEditingCosting] = useState(null);
  const [editingItems, setEditingItems] = useState([]);

  // Summary form
  const [summaryForm, setSummaryForm] = useState(EMPTY_SUMMARY_FORM);
  const [summarySaving, setSummarySaving] = useState(false);
  const [summaryAlert, setSummaryAlert] = useState({ type: "", message: "" });
  const [itemAlert, setItemAlert] = useState({ type: "", message: "" });
  const [statusConfirmation, setStatusConfirmation] = useState({
    open: false,
    nextStatus: "",
    previousStatus: "Work in Progress",
    message: "",
    type: "warning",
    allowCompletedWithoutItems: false,
  });

  // Return quantity modal state
  const [returnItemTarget, setReturnItemTarget] = useState(null);
  const [returnQtyModal, setReturnQtyModal] = useState({
    open: false,
    maxQty: 0,
    value: "",
    error: "",
  });

  // Modal Item Add/Edit
  const [costingItemModalOpen, setCostingItemModalOpen] = useState(false);
  const [costingItemModalMode, setCostingItemModalMode] = useState("add");
  const [costingItemToEdit, setCostingItemToEdit] = useState(null);

  const [itemSaving, setItemSaving] = useState(false);
  const [importingItems, setImportingItems] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importReports, setImportReports] = useState([]);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);
  const [roomPopup, setRoomPopup] = useState({ type: "", message: "" });
  const [itemColumnFilters, setItemColumnFilters] = useState({});

  // Computed values
  const isCostingReadOnly = editingCosting && normalizeStatusName(editingCosting?.status_name || editingCosting?.status) === "completed" && !isAdmin;
  const isStatusDropdownDisabled = isCostingReadOnly;

  useEffect(() => {
    if (!onStatusChange) return;
    onStatusChange(status || { type: "", message: "" });
  }, [onStatusChange, status]);

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

  // Combined item dropdown options: { item_code } - { item_name } ({ item_category })
  const combinedItemOptions = useMemo(() => {
    return (itemMasterList || []).map((item) => {
      const text = `${item.item_code || ""} - ${item.item_name || ""}${item.item_category_name || item.item_category ? ` (${item.item_category_name || item.item_category})` : ""}`;
      return {
        ...item,
        id: item.id,
        item_code: item.item_code,
        item_name: item.item_name,
        item_category: item.item_category_name || item.item_category || "",
        item_category_id: item.item_category_id || "",
        item_type: item.item_type || "",
        available_qty: item.available_qty ?? 0,
        displayText: text,
        label: text,
      };
    });
  }, [itemMasterList]);

  const getItemColumnValue = useCallback((item, key) => {
    if (key === "room_name") return item?.room_name?.room_name || "";
    if (key === "cost_type") return item?.cost_type?.name || item?.cost_type_name || item?.cost_type || "";
    if (key === "item_code") {
      return `${item?.item_code || ""} ${item?.item_name || ""} ${item?.item_category || ""}`.trim();
    }
    if (key === "stock_status") return getStockStatusName(item);
    if (key === "retrieval_status") return item?.retrieval_status?.status_name || item?.retrieval_status_name || "";
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

  // Real-time calculated totals for the summary form
  const summaryPreviewValues = useMemo(() => {
    return recalculateCostingSummary(summaryForm);
  }, [summaryForm]);

  const scopedQuotationOptions = useMemo(() => {
    if (!embedded || !projectId) return quotationOptions;
    const pid = String(projectId);
    return quotationOptions.filter((row) => String(row?.project_id ?? row?.project?.id ?? "") === pid);
  }, [embedded, projectId, quotationOptions]);

  const scopedProjectOptions = useMemo(() => {
    if (!embedded || !projectId) return projectOptions;
    const pid = String(projectId);
    return projectOptions.filter((row) => String(row?.id ?? "") === pid);
  }, [embedded, projectId, projectOptions]);

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

  const selectedProjectSelectionId = embedded && projectId ? String(projectId) : String(selectedProjectId || "").trim();

  const selectedProjectHasCosting = useMemo(() => {
    if (!selectedProjectSelectionId) return false;
    return costings.some((row) => String(row?.project_id ?? row?.project?.id ?? row?.project_ref_id ?? "") === selectedProjectSelectionId);
  }, [costings, selectedProjectSelectionId]);

  const filteredCostings = useMemo(() => {
    const activeFilters = Object.entries(listColumnFilters).filter(([, value]) => String(value || "").trim());
    if (!activeFilters.length) return scopedCostings;
    return scopedCostings.filter((row) => (
      activeFilters.every(([key, filterValue]) => (
        String(row?.[key] ?? "").toLowerCase().includes(String(filterValue).trim().toLowerCase())
      ))
    ));
  }, [listColumnFilters, scopedCostings]);

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
    setItemMasterList(Array.isArray(itemData?.lab_furniture_items) ? itemData.lab_furniture_items : []);
    setRoomOptions(Array.isArray(roomData?.rooms) ? roomData.rooms : []);
  }, []);

  const loadList = useCallback(async () => {
    const activeProjectId = embedded && projectId ? projectId : null;
    const [costingData, quotationData] = await Promise.all([
      listProjectCostings(),
      listCompletedQuotationSummaries(activeProjectId),
    ]);

    let projectData = { projects: [] };
    try {
      projectData = await listProjects();
    } catch (_error) {
      projectData = { projects: [] };
    }

    setCostings(Array.isArray(costingData?.costings) ? costingData.costings : []);
    const quotations = Array.isArray(quotationData) ? quotationData : [];
    setQuotationOptions(quotations);
    setProjectOptions(Array.isArray(projectData?.projects) ? projectData.projects : []);
  }, [embedded, projectId]);

  useEffect(() => {
    if (embedded && projectId) {
      setSelectedProjectId(String(projectId));
    }
  }, [embedded, projectId]);

  useEffect(() => {
    if (!selectedProjectId || embedded) return;
    const exists = scopedProjectOptions.some((row) => String(row?.id) === String(selectedProjectId));
    if (!exists) setSelectedProjectId("");
  }, [embedded, scopedProjectOptions, selectedProjectId]);

  useEffect(() => {
    if (!selectedQuotationId) return;
    const selectedQuotation = scopedQuotationOptions.find((row) => String(row?.id) === String(selectedQuotationId));
    if (!selectedQuotation) {
      setSelectedQuotationId("");
      return;
    }
    if (!embedded) {
      const quotationProjectId = selectedQuotation?.project_id ?? selectedQuotation?.project?.id;
      if (quotationProjectId) setSelectedProjectId(String(quotationProjectId));
    }
  }, [embedded, scopedQuotationOptions, selectedQuotationId]);

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

  // Keep summaryForm.total_material_cost synced with editingCosting.total_material_cost
  useEffect(() => {
    if (!editingCosting) return;
    setSummaryForm((prev) => ({
      ...prev,
      total_material_cost: String(editingCosting.total_material_cost ?? "0"),
    }));
  }, [editingCosting]);

  const openCosting = useCallback(async (costingId) => {
    setStatus({ type: "", message: "" });
    setSummaryAlert({ type: "", message: "" });
    setItemAlert({ type: "", message: "" });
    setImportSummary(null);
    setImportReports([]);
    try {
      const data = await getProjectCosting(costingId);
      const c = data?.costing || null;
      setEditingCosting(c);
      setEditingItems(Array.isArray(data?.items) ? data.items : []);
      setSummaryForm(summaryFormFromCosting(c));
      setSummaryAlert(
        normalizeStatusName(c?.status_name || c?.status) === "completed" && !isAdmin
          ? { type: "warning", message: "Status is Completed. Only admin can edit this form." }
          : { type: "", message: "" }
      );
      setCostTypes(Array.isArray(data?.cost_types) ? data.cost_types : []);
      setMaterialCostTypeId(data?.material_cost_type_id ? String(data.material_cost_type_id) : "");
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to load costing detail." });
    }
  }, [isAdmin, normalizeStatusName]);

  const closeCosting = useCallback(() => {
    setEditingCosting(null);
    setEditingItems([]);
    setSummaryForm(EMPTY_SUMMARY_FORM);
    setSummaryAlert({ type: "", message: "" });
    setItemAlert({ type: "", message: "" });
    setImportSummary(null);
    setImportReports([]);
    setRoomModalOpen(false);
    setNewRoomName("");
    setRoomPopup({ type: "", message: "" });
    setStatus({ type: "", message: "" });
    setCostingItemModalOpen(false);
    setCostingItemToEdit(null);
    setReturnItemTarget(null);
    setStatusConfirmation({
      open: false,
      nextStatus: "",
      previousStatus: "Work in Progress",
      message: "",
      type: "warning",
      allowCompletedWithoutItems: false,
    });
  }, []);

  const handleCreateCosting = useCallback(async () => {
    const resolvedProjectId = selectedProjectSelectionId;

    if (!resolvedProjectId) {
      setStatus({ type: "warning", message: "Please select a project before adding project costing." });
      return;
    }

    if (selectedProjectHasCosting) {
      setStatus({ type: "warning", message: "A project costing already exists for the selected project." });
      return;
    }

    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const response = await createProjectCosting({ project_id: resolvedProjectId });
      setStatus({ type: "success", message: response.message || "Project costing added." });
      await loadList();
      if (response?.costing?.id) {
        await openCosting(response.costing.id);
      }
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to add project costing." });
    } finally {
      setSaving(false);
    }
  }, [loadList, openCosting, selectedProjectHasCosting, selectedProjectSelectionId]);

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
  const openStatusConfirmation = useCallback((nextStatus) => {
    if (!editingCosting) return;
    const previousStatus = String(summaryForm.status || "Work in Progress");
    const normalizedNext = String(nextStatus || "").trim();
    const hasItems = editingItems.length > 0;
    const allowCompletedWithoutItems = normalizedNext === "Completed" && !hasItems;
    const message = normalizedNext === "Completed"
      ? (allowCompletedWithoutItems
        ? "⚠ No costing items added. Do you still want to save as Completed? Only admin can edit after completion."
        : "Status changed to Completed. Only admin can edit. Shall I proceed?")
      : "Revert status to Work in Progress? This will unlock editing for all users.";

    setStatusConfirmation({
      open: true,
      nextStatus: normalizedNext,
      previousStatus,
      message,
      type: "warning",
      allowCompletedWithoutItems,
    });
  }, [editingCosting, editingItems.length, summaryForm.status]);

  const handleSummaryStatusSelect = useCallback((event) => {
    const nextStatus = String(event.target.value || "Work in Progress");
    const currentStatus = String(summaryForm.status || "Work in Progress");
    if (nextStatus === currentStatus) return;

    setStatus({ type: "", message: "" });

    const normalizedNext = normalizeStatusName(nextStatus);
    const normalizedCurrent = normalizeStatusName(currentStatus);
    if (normalizedNext === "completed" || (normalizedCurrent === "completed" && normalizedNext === "work in progress")) {
      openStatusConfirmation(nextStatus);
      return;
    }

    setSummaryAlert({ type: "", message: "" });
  }, [normalizeStatusName, openStatusConfirmation, summaryForm.status]);

  const updateCostingInList = useCallback((updatedCosting) => {
    setCostings((prev) =>
      prev.map((c) => (String(c.id) === String(updatedCosting.id) ? updatedCosting : c))
    );
  }, []);

  const handleSaveSummary = useCallback(async () => {
    if (!editingCosting) return;
    setSummarySaving(true);
    setStatus({ type: "", message: "" });
    try {
      const response = await updateProjectCosting(editingCosting.id, {
        ...summaryForm,
        status: summaryForm.status,
        total_material_cost: summaryForm.total_material_cost,
      });
      const updated = response?.costing || null;
      if (updated) {
        setEditingCosting(updated);
        updateCostingInList(updated);
        setSummaryForm(summaryFormFromCosting(updated));
        setSummaryAlert(
          normalizeStatusName(updated?.status_name || updated?.status) === "completed" && !isAdmin
            ? { type: "warning", message: "Status is Completed. Only admin can edit this form." }
            : { type: "", message: "" }
        );
      }
      setStatus({ type: "success", message: "Costing summary saved." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to save summary." });
    } finally {
      setSummarySaving(false);
    }
  }, [editingCosting, isAdmin, normalizeStatusName, summaryForm, updateCostingInList]);

  const cancelStatusConfirmation = useCallback(() => {
    setStatusConfirmation({
      open: false,
      nextStatus: "",
      previousStatus: summaryForm.status || "Work in Progress",
      message: "",
      type: "warning",
      allowCompletedWithoutItems: false,
    });
    setSummaryForm((prev) => ({ ...prev, status: statusConfirmation.previousStatus || "Work in Progress" }));
  }, [statusConfirmation.previousStatus, summaryForm.status]);

  const confirmStatusChange = useCallback(async () => {
    if (!editingCosting) return;
    const nextStatus = statusConfirmation.nextStatus || "Work in Progress";
    setSummarySaving(true);
    setStatus({ type: "", message: "" });
    try {
      const response = await updateProjectCostingStatus(editingCosting.id, {
        status: nextStatus,
        confirm_completed_without_items: statusConfirmation.allowCompletedWithoutItems,
      });
      const updated = response?.costing || response?.quotation || response?.summary || null;
      if (updated) {
        setEditingCosting(updated);
        updateCostingInList(updated);
        setEditingItems(Array.isArray(response?.items) ? response.items : editingItems);
        setSummaryForm(summaryFormFromCosting(updated));
        setSummaryAlert(
          normalizeStatusName(updated?.status_name || updated?.status) === "completed" && !isAdmin
            ? { type: "warning", message: "Status is Completed. Only admin can edit this form." }
            : { type: "", message: "" }
        );
        setStatus({ type: response?.status || "success", message: response?.message || "Costing status updated." });
      }
      setStatusConfirmation({
        open: false,
        nextStatus: "",
        previousStatus: nextStatus,
        message: "",
        type: "warning",
        allowCompletedWithoutItems: false,
      });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to update costing status." });
      setSummaryForm((prev) => ({ ...prev, status: statusConfirmation.previousStatus || "Work in Progress" }));
    } finally {
      setSummarySaving(false);
    }
  }, [editingCosting, editingItems, isAdmin, normalizeStatusName, statusConfirmation.allowCompletedWithoutItems, statusConfirmation.nextStatus, statusConfirmation.previousStatus, updateCostingInList]);

  // ── Modal item add / edit ────────────────────────────────
  const openAddItemModal = () => {
    if (isCostingReadOnly) return;
    setCostingItemModalMode("add");
    setCostingItemToEdit(null);
    setCostingItemModalOpen(true);
  };

  const openEditItemModal = (item) => {
    setCostingItemModalMode("edit");
    setCostingItemToEdit(item);
    setCostingItemModalOpen(true);
  };

  const handleSaveModalItem = async (payload, editItemId) => {
    if (!editingCosting?.id) return;
    if (editItemId) {
      await updateProjectCostingItem(editingCosting.id, editItemId, payload);
    } else {
      await createProjectCostingItem(editingCosting.id, payload);
    }

    // Refresh costing details to get updated items and summary
    const freshData = await getProjectCosting(editingCosting.id);
    if (freshData?.costing) {
      setEditingCosting(freshData.costing);
      updateCostingInList(freshData.costing);
      setSummaryForm(summaryFormFromCosting(freshData.costing));
    }
    setEditingItems(Array.isArray(freshData?.items) ? freshData.items : []);
    setItemAlert({ type: "success", message: editItemId ? "Item updated successfully." : "Item added successfully." });
    setStatus({ type: "success", message: editItemId ? "Item updated successfully." : "Item added successfully." });
  };

  const handleDeleteItem = useCallback(async (itemId) => {
    if (!editingCosting) return;
    if (!window.confirm("Delete this costing item?")) return;
    setItemSaving(true);
    try {
      await deleteProjectCostingItem(editingCosting.id, itemId);
      const freshData = await getProjectCosting(editingCosting.id);
      if (freshData?.costing) {
        setEditingCosting(freshData.costing);
        updateCostingInList(freshData.costing);
        setSummaryForm(summaryFormFromCosting(freshData.costing));
      }
      setEditingItems(Array.isArray(freshData?.items) ? freshData.items : []);
      setItemAlert({ type: "success", message: "Item deleted." });
      setStatus({ type: "success", message: "Item deleted." });
    } catch (err) {
      setItemAlert({ type: "error", message: err.message || "Failed to delete item." });
      setStatus({ type: "error", message: err.message || "Failed to delete item." });
    } finally {
      setItemSaving(false);
    }
  }, [editingCosting, updateCostingInList]);

  // ── Return Process (FIFO) ────────────────────────────────
  const handleOpenReturnModal = (item) => {
    const max = Math.max(toNumber(item.accepted_qty), getAllocatedQtyValue(item));
    setReturnItemTarget(item);
    setReturnQtyModal({
      open: true,
      maxQty: max,
      value: "",
      error: "",
    });
  };

  const closeReturnQtyModal = useCallback(() => {
    setReturnQtyModal({ open: false, maxQty: 0, value: "", error: "" });
    setReturnItemTarget(null);
  }, []);

  const confirmReturnQtyModal = useCallback(async () => {
    const trimmedValue = normalizeText(returnQtyModal.value);
    const numericValue = toNumber(trimmedValue);
    const maxQty = toNumber(returnQtyModal.maxQty);

    if (!trimmedValue || numericValue <= 0) {
      setReturnQtyModal((prev) => ({ ...prev, error: "Enter a valid return quantity greater than 0." }));
      return;
    }
    if (numericValue - maxQty > 0.0001) {
      setReturnQtyModal((prev) => ({ ...prev, error: `Return Qty cannot exceed accepted quantity ${toMoney(maxQty)}.` }));
      return;
    }
    if (!returnItemTarget || !editingCosting) return;

    setItemSaving(true);
    try {
      await updateProjectCostingItem(editingCosting.id, returnItemTarget.id, {
        retrieval_status_name: STATUS_ITEM_RETURN,
        return_qty: trimmedValue,
      });
      const freshData = await getProjectCosting(editingCosting.id);
      if (freshData?.costing) {
        setEditingCosting(freshData.costing);
        updateCostingInList(freshData.costing);
        setSummaryForm(summaryFormFromCosting(freshData.costing));
      }
      setEditingItems(Array.isArray(freshData?.items) ? freshData.items : []);
      setItemAlert({ type: "success", message: `FIFO return request created for ${trimmedValue} quantity.` });
      setStatus({ type: "success", message: `FIFO return request created for ${trimmedValue} quantity.` });
      closeReturnQtyModal();
    } catch (err) {
      setReturnQtyModal((prev) => ({ ...prev, error: err.message || "Failed to create return request." }));
    } finally {
      setItemSaving(false);
    }
  }, [closeReturnQtyModal, editingCosting, returnItemTarget, returnQtyModal.maxQty, returnQtyModal.value, updateCostingInList]);

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
      const freshData = await getProjectCosting(editingCosting.id);
      if (freshData?.costing) {
        setEditingCosting(freshData.costing);
        updateCostingInList(freshData.costing);
        setSummaryForm(summaryFormFromCosting(freshData.costing));
      }
      setEditingItems(Array.isArray(freshData?.items) ? freshData.items : (Array.isArray(response.items) ? response.items : []));
      setStatus({ type: response.status || "success", message: response.message || "Costing items imported successfully." });
    } catch (error) {
      setImportSummary(null);
      setImportReports([]);
      setStatus({ type: "error", message: error.message || "Failed to import costing items." });
    } finally {
      setImportingItems(false);
      if (event.target) event.target.value = "";
    }
  }, [editingCosting?.id, updateCostingInList]);

  // ─── Edit view ──────────────────────────────────────────────────────────────
  if (editingCosting) {
    const c = editingCosting;
    return (
      <section className="module-page project-costing-page">
        <div className="crud-page__header pq-header project-costing-toolbar">
          <div>
            <h1 className="module-page__title project-costing-title">
              <span className="project-costing-title__icon" aria-hidden="true"><BsCashCoin /></span>
              <span className="project-costing-title__text">Project Costing - {c.costing_id}</span>
            </h1>
          </div>
        </div>

        {status.message ? (
          <p className={getPopupClass(status.type)}>{status.message}</p>
        ) : null}

        {summaryAlert.message ? (
          <AlertMessage type={summaryAlert.type} message={summaryAlert.message} />
        ) : null}

        {/* ── CARD 1: Costing Summary ────────────────────────── */}
        <Card className="lca-card mb-3 pq-card">
          <CardHeader className="pq-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <BsClipboardData aria-hidden="true" />
                Costing Summary
              </h2>
              {c.id ? (
                <span className="vendor-card__badge" style={{ marginLeft: "0.5rem" }}>
                  <BsPencilSquare aria-hidden="true" /> Costing #{c.id} ({c.costing_id || "—"})
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardBody className="pq-card-body">
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
              <label className="project-costing-form-label project-costing-field">
                <span className="project-costing-field__label">Status</span>
                <select
                  className="project-costing-select"
                  value={summaryForm.status || "Work in Progress"}
                  onChange={handleSummaryStatusSelect}
                  disabled={isStatusDropdownDisabled || summarySaving}
                >
                  {COSTING_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
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
                      title="Auto-calculated from items in the backend based on LCE cost."
                      aria-label="Auto-calculated from items in the backend based on LCE cost."
                    >
                      ?
                    </span>
                  </span>
                  <input
                    className="project-costing-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={summaryForm.total_material_cost}
                    readOnly
                    disabled
                  />
                  <small className="project-costing-form-help">Auto-calculated from items based on LCE cost.</small>
                </label>
                <label className="project-costing-form-label">
                  Markup %
                  <input
                    className="project-costing-input"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={summaryForm.markup}
                    onChange={sfld("markup")}
                    disabled={summarySaving || isCostingReadOnly}
                  />
                </label>
                <label className="project-costing-form-label">
                  Contingency %
                  <input
                    className="project-costing-input"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={summaryForm.contingency}
                    onChange={sfld("contingency")}
                    disabled={summarySaving || isCostingReadOnly}
                  />
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
                  <input className="project-costing-input" type="number" min="0" value={summaryForm.petrol_expenses} onChange={sfld("petrol_expenses")} disabled={summarySaving || isCostingReadOnly} />
                </label>
                <label className="project-costing-form-label">
                  Transport / Install Team
                  <input className="project-costing-input" type="number" min="0" value={summaryForm.transport_installation_team} onChange={sfld("transport_installation_team")} disabled={summarySaving || isCostingReadOnly} />
                </label>
                <label className="project-costing-form-label">
                  Transportation
                  <input className="project-costing-input" type="number" min="0" value={summaryForm.transportation} onChange={sfld("transportation")} disabled={summarySaving || isCostingReadOnly} />
                </label>
                <label className="project-costing-form-label">
                  Food / Accommodation
                  <input className="project-costing-input" type="number" min="0" value={summaryForm.food_accomodation} onChange={sfld("food_accomodation")} disabled={summarySaving || isCostingReadOnly} />
                </label>
                <label className="project-costing-form-label">
                  Loading
                  <input className="project-costing-input" type="number" min="0" value={summaryForm.loading} onChange={sfld("loading")} disabled={summarySaving || isCostingReadOnly} />
                </label>
                <label className="project-costing-form-label">
                  Unloading
                  <input className="project-costing-input" type="number" min="0" value={summaryForm.unloading} onChange={sfld("unloading")} disabled={summarySaving || isCostingReadOnly} />
                </label>
                <label className="project-costing-form-label">
                  Installation
                  <input className="project-costing-input" type="number" min="0" value={summaryForm.installation} onChange={sfld("installation")} disabled={summarySaving || isCostingReadOnly} />
                </label>
                <label className="project-costing-form-label">
                  Business Development
                  <input className="project-costing-input" type="number" min="0" value={summaryForm.business_development} onChange={sfld("business_development")} disabled={summarySaving || isCostingReadOnly} />
                </label>
              </div>
            </div>

            {/* Calculated / derived display */}
            <div className="project-costing-form-section">
              <h3 className="project-costing-form-section__title project-costing-form-section__title--calculated">
                <span className="project-costing-form-section__title-icon" aria-hidden="true"><BsCheckCircleFill /></span>
                <span>Calculated Totals</span>
              </h3>
              <div className="project-costing-summary-grid">
                {[
                  ["Final Material Cost", summaryPreviewValues.final_material_cost],
                  ["Total Cost to Elite", summaryPreviewValues.total_cost_to_elite],
                  ["Total Markup", summaryPreviewValues.total_markup],
                  ["Planned Order Value", summaryPreviewValues.planned_order_value],
                  ["Discount", summaryPreviewValues.discount],
                  ["Undiscounted Quote Value", summaryPreviewValues.undiscounted_quote_value],
                  ["Factor", summaryPreviewValues.factor],
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

            {/* Bottom-right Cancel & Save Summary buttons */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "0.75rem",
                marginTop: "1.5rem",
                paddingTop: "1rem",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                className="modal-btn modal-btn--cancel"
                onClick={closeCosting}
                disabled={summarySaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="crud-add-btn"
                onClick={handleSaveSummary}
                disabled={summarySaving || isCostingReadOnly}
              >
                {summarySaving ? "Saving…" : "Save Summary"}
              </button>
            </div>
          </CardBody>
        </Card>

        {/* ── CARD 2: Costing Items ──────────────────────────── */}
        <Card className="lca-card mb-3 pq-card">
          <CardHeader className="pq-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <BsBoxes aria-hidden="true" />
                Costing Items
              </h2>
              <span className="vendor-card__badge" style={{ marginLeft: "0.5rem" }}>
                {editingItems.length} {editingItems.length === 1 ? "Item" : "Items"}
              </span>
            </div>
            <div className="project-costing-items-header-actions" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <input ref={importFileInputRef} className="project-costing-hidden-file-input" type="file" accept=".xlsx,.xls" onChange={handleImportItemsFile} />
              <button type="button" className="crud-add-btn" onClick={handleDownloadImportTemplate} disabled={downloadingTemplate || importingItems || itemSaving || summarySaving || isCostingReadOnly}>
                {downloadingTemplate ? "Downloading..." : "Download Template"}
              </button>
              <button type="button" className="crud-add-btn" onClick={openImportFilePicker} disabled={importingItems || itemSaving || summarySaving || isCostingReadOnly}>
                {importingItems ? "Importing..." : "Import Excel"}
              </button>
              <button type="button" className="crud-add-btn" onClick={openRoomModal} disabled={savingRoom || isCostingReadOnly}>
                <BsPlusCircleFill aria-hidden="true" /> Add New Room
              </button>
              <button type="button" className="crud-add-btn" onClick={openAddItemModal} disabled={isCostingReadOnly}>
                <BsPlusCircleFill aria-hidden="true" /> Add Item
              </button>
            </div>
          </CardHeader>
          <CardBody className="pq-card-body">
            {itemAlert.message ? (
              <AlertMessage type={itemAlert.type} message={itemAlert.message} />
            ) : null}

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

            <div className="users-table-wrap users-table-wrap--fit pq-table-wrap-items project-costing-table-wrap project-costing-table-wrap--items">
              <table className="users-table users-table--quotation project-costing-table project-costing-table--quotation project-costing-items-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Cost Type</th>
                    <th>Item Code</th>
                    <th>Item Type</th>
                    <th className="project-costing-table__right">Purchase Qty</th>
                    <th className="project-costing-table__right">Requested Qty</th>
                    <th>Stock Status</th>
                    <th>Retrieval Status</th>
                    <th>Rejection Comments</th>
                    <th className="project-costing-table__center">Actions</th>
                  </tr>
                  <tr>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.room_name ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, room_name: event.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.cost_type ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, cost_type: event.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.item_code ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, item_code: event.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.item_type ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, item_type: event.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.purchase_qty ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, purchase_qty: event.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.requested_qty ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, requested_qty: event.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.stock_status ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, stock_status: event.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.retrieval_status ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, retrieval_status: event.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.rejection_comment ?? ""} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, rejection_comment: event.target.value }))} /></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEditingItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="project-costing-empty">No costing items found.</td>
                    </tr>
                  ) : filteredEditingItems.map((item) => {
                    const rowCostType = item.cost_type?.name || item.cost_type_name || item.cost_type || "-";
                    const retrievalName = item?.retrieval_status?.status_name || item?.retrieval_status_name || STATUS_NO_ACTION;
                    const isAccepted = String(retrievalName).trim().toLowerCase() === STATUS_ITEM_ACCEPTED.toLowerCase();
                    const concatenatedItemCode = item.item_code
                      ? `${item.item_code}${item.item_name ? ` - ${item.item_name}` : ""}${item.item_category ? ` (${item.item_category})` : ""}`
                      : (item.item_name || "-");

                    return (
                      <tr
                        key={item.id}
                        className="pq-clickable-row"
                        onClick={() => openEditItemModal(item)}
                        title={isCostingReadOnly ? "View item" : "Click row to edit item"}
                      >
                        <td>{item.room_name?.room_name || "-"}</td>
                        <td>{rowCostType}</td>
                        <td title={concatenatedItemCode}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>
                            {concatenatedItemCode}
                          </span>
                        </td>
                        <td>{item.item_type || "-"}</td>
                        <td className="project-costing-table__right">{item.purchase_qty}</td>
                        <td className="project-costing-table__right">{item.requested_qty}</td>
                        <td>
                          <span className={`project-costing-stock-badge ${getStockStatusBadgeClass(getStockStatusName(item))}`}>
                            {getStockStatusName(item)}
                          </span>
                        </td>
                        <td>
                          <span className={getRetrievalBadgeClass(retrievalName)}>{retrievalName}</span>
                        </td>
                        <td className="project-costing-comment-cell">{item.rejection_comment || "-"}</td>
                        <td className="project-costing-table__center" onClick={(e) => e.stopPropagation()}>
                          <div className="project-costing-inline-actions">
                            <button
                              type="button"
                              className="users-action users-action--edit"
                              title="Edit item"
                              disabled={isCostingReadOnly}
                              onClick={() => openEditItemModal(item)}
                            >
                              <BsPencilSquare aria-hidden="true" />
                            </button>
                            {isAccepted ? (
                              <button
                                type="button"
                                className="users-action users-action--edit"
                                title="Return item (FIFO)"
                                style={{ color: "#d97706" }}
                                disabled={isCostingReadOnly}
                                onClick={() => handleOpenReturnModal(item)}
                              >
                                <BsArrowCounterclockwise aria-hidden="true" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="users-action users-action--delete"
                              title="Delete item"
                              disabled={isCostingReadOnly || isAccepted || String(retrievalName).trim().toLowerCase() !== STATUS_NO_ACTION.toLowerCase()}
                              onClick={() => handleDeleteItem(item.id)}
                            >
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
          </CardBody>
        </Card>

        {/* ── Costing Item Modal ─────────────────────────────── */}
        <CostingItemModal
          isOpen={costingItemModalOpen}
          onClose={() => setCostingItemModalOpen(false)}
          isEditMode={costingItemModalMode === "edit"}
          itemToEdit={costingItemToEdit}
          combinedItemOptions={combinedItemOptions}
          roomOptions={roomOptions}
          costTypes={costTypes}
          materialCostTypeId={materialCostTypeId}
          getItemCostPreview={getItemCostPreview}
          listPurchaseItemGRNs={listPurchaseItemGRNs}
          onSaveItem={handleSaveModalItem}
        />

        {/* ── Status Confirmation Modal ──────────────────────── */}
        <ConfirmPopupModal
          open={statusConfirmation.open}
          type={statusConfirmation.type}
          title="Confirm Costing Status"
          message={statusConfirmation.message}
          confirmLabel="OK"
          cancelLabel="Cancel"
          onConfirm={confirmStatusChange}
          onCancel={cancelStatusConfirmation}
          confirmDisabled={summarySaving}
          cancelDisabled={summarySaving}
        />

        {/* ── Return Quantity Confirmation Modal ─────────────── */}
        <ConfirmPopupModal
          open={returnQtyModal.open}
          className="pq-confirm-modal--return-qty"
          type={returnQtyModal.error ? "warning" : "info"}
          title="Set Return Quantity"
          message={`Enter return quantity (max ${toMoney(returnQtyModal.maxQty)}). Stock will be returned to GRNs using FIFO order.`}
          confirmLabel="Confirm Return"
          cancelLabel="Cancel"
          onConfirm={confirmReturnQtyModal}
          onCancel={closeReturnQtyModal}
          confirmDisabled={itemSaving}
          cancelDisabled={itemSaving}
        >
          <div className="project-costing-modal-content">
            <label className="project-costing-form-label">
              Return Qty
              <input
                type="number"
                min="0.01"
                step="any"
                className="project-costing-input project-costing-input--numeric"
                value={returnQtyModal.value}
                onChange={(event) => setReturnQtyModal((prev) => ({ ...prev, value: event.target.value, error: "" }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirmReturnQtyModal();
                  }
                }}
              />
            </label>
            {returnQtyModal.error ? <p className="project-costing-text--error">{returnQtyModal.error}</p> : null}
          </div>
        </ConfirmPopupModal>

        {/* ── Add Room Modal ─────────────────────────────────── */}
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
      <div className="crud-page__header pq-header project-costing-toolbar">
        <div>
          <h1 className="module-page__title project-costing-title">
            <span className="project-costing-title__icon" aria-hidden="true"><BsCashCoin /></span>
            <span className="project-costing-title__text">Project Costing</span>
          </h1>
        </div>
        {!embedded && (
          <div className="pq-header-actions">
            <button
              type="button"
              className="crud-add-btn"
              onClick={() => navigate("/projects")}
            >
              Back to Projects
            </button>
          </div>
        )}
      </div>

      {status.message ? (
        <p className={getPopupClass(status.type)}>{status.message}</p>
      ) : null}

      <div className="project-costing-card project-costing-actions">
        <select
          className="auth-input"
          value={selectedProjectSelectionId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          disabled={saving || loading || (embedded && !!projectId)}
        >
          <option value="">Select project</option>
          {scopedProjectOptions.map((row) => (
            <option key={row.id} value={String(row.id)}>
              {row.project_id || "Project"} — {row.project_name || "Unnamed"}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="crud-add-btn"
          onClick={handleCreateCosting}
          disabled={saving || loading || !selectedProjectSelectionId || selectedProjectHasCosting}
        >
          {saving ? "Processing…" : "Add Project Costing"}
        </button>
        {selectedProjectSelectionId && selectedProjectHasCosting ? (
          <p className="project-costing-popup project-costing-popup--warning" style={{ margin: "0.5rem 0 0" }}>
            A project costing already exists for the selected project.
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="project-costing-popup project-costing-popup--warning">Loading project costing data…</p>
      ) : null}

      {!loading ? (
        <div className="users-table-wrap pq-table-wrap-list project-costing-table-wrap">
          <table className="users-table project-costing-table">
            <thead>
              <tr>
                <th>Costing ID</th>
                <th>Quotation Number</th>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Status</th>
                <th>Updated On</th>
                <th>Updated By</th>
                <th className="project-costing-table__right">Material Cost</th>
                <th className="project-costing-table__right">Planned Order Value</th>
                <th className="project-costing-table__center">Actions</th>
              </tr>
              <tr>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.costing_id ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, costing_id: event.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.quotation_number ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, quotation_number: event.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.project_code ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, project_code: event.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.project_name ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, project_name: event.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.status_name ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, status_name: event.target.value }))} /></th>
                <th></th>
                <th></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.total_material_cost ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, total_material_cost: event.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={listColumnFilters.planned_order_value ?? ""} onChange={(event) => setListColumnFilters((prev) => ({ ...prev, planned_order_value: event.target.value }))} /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredCostings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="project-costing-empty">No project costing records found.</td>
                </tr>
              ) : filteredCostings.map((row) => {
                const statusName = row.status_name || row.status || "—";
                const updatedOn = row.updated_at ? new Date(row.updated_at).toLocaleString() : "—";
                const updatedBy = row.updated_by || "—";
                return (
                  <tr
                    key={row.id}
                    className="pq-clickable-row"
                    onClick={() => openCosting(row.id)}
                    title="Click row to open costing"
                  >
                    <td className="pq-cell-link">{row.costing_id || "—"}</td>
                    <td>{row.quotation_number || "—"}</td>
                    <td>{row.project_code || "—"}</td>
                    <td>{row.project_name || "—"}</td>
                    <td>
                      <span className={`project-costing-status-badge project-costing-status-badge--${String(statusName).toLowerCase().replace(/\s+/g, '-')}`}>
                        {statusName}
                      </span>
                    </td>
                    <td>{updatedOn}</td>
                    <td>{updatedBy}</td>
                    <td className="project-costing-table__right">{row.total_material_cost ?? "—"}</td>
                    <td className="project-costing-table__right">{row.planned_order_value ?? "—"}</td>
                    <td className="project-costing-table__center" onClick={(e) => e.stopPropagation()}>
                      <div className="project-costing-row-actions">
                        <button
                          type="button"
                          className="users-action users-action--edit"
                          title="Edit costing"
                          disabled={saving}
                          onClick={() => openCosting(row.id)}
                        >
                          <BsPencilSquare aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="users-action users-action--delete"
                          title="Delete costing"
                          disabled={saving}
                          onClick={() => handleDeleteCosting(row.id)}
                        >
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
      ) : null}
    </section>
  );
}

export default ProjectCostingPage;
