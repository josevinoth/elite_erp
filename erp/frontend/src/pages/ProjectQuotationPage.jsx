import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BsBoxes,
  BsCashCoin,
  BsCheckCircleFill,
  BsClipboardData,
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
  getProjectQuotationSummary,
  getItemCostPreview,
  importQuotationItemsExcel,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listProjects,
  listProjectQuotationItems,
  listQuotationSummaries,
  listRooms,
  saveQuotationSummary,
  updateQuotationItem,
  updateQuotationStatus,
} from "../services/crudApi";
import AlertMessage from "../components/AlertMessage";
import ConfirmPopupModal from "../components/ConfirmPopupModal";
import { Card, CardHeader, CardBody } from "../components/Card";
import QuotationItemModal from "./QuotationItemModal";
import { getSessionUser } from "../services/sessionUser";
import "../styles/ProjectCostingSummary.css";
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

const getQuotationStatus = (payload) => {
  const quotationStatus = normalizeText(payload?.quotation_status);
  if (quotationStatus) return quotationStatus;

  const legacyStatus = normalizeText(payload?.status);
  const normalizedLegacyStatus = legacyStatus.toLowerCase();
  if (["work in progress", "completed", "hold", "cancelled"].includes(normalizedLegacyStatus)) {
    return legacyStatus;
  }

  return "Work In Progress";
};

const getNormalizedQuotationStatus = (payload) => getQuotationStatus(payload).toLowerCase();

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
  cost_per_qty: "0",
  max_cost: "0",
  min_cost: "0",
  actual_cost: "0",
  total_cost: "0",
  ...emptyDimensions,
});

const SUMMARY_EDITABLE_FIELDS = [
  "quotation_status",
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

const QUOTATION_STATUS_OPTIONS = [
  "Work In Progress",
  "Completed",
  "Hold",
  "Cancelled",
];

const EMPTY_ITEM_FILTERS = {
  room_name: "",
  cost_type: "",
  item_category: "",
  item_name: "",
  item_code: "",
  item_type: "",
  purchase_qty: "",
  requested_qty: "",
  stock_status: "",
};

const EMPTY_QUOTATION_LIST_FILTERS = {
  quotation_number: "",
  project_id: "",
  project_name: "",
  revision_code: "",
  total_quotation_cost: "",
  status: "",
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
    return "project-costing-stock-badge--in-stock";
  }
  if (normalized === "partial stock") {
    return "project-costing-stock-badge--partial";
  }
  if (normalized === "no stock" || normalized === "not purchased") {
    return "project-costing-stock-badge--no-stock";
  }
  return "project-costing-stock-badge--no-stock";
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
  const [projectOptions, setProjectOptions] = useState([]);
  const [projectSelectionInput, setProjectSelectionInput] = useState("");
  const [selectedProjectIdForCreate, setSelectedProjectIdForCreate] = useState(() => (
    embedded && projectId ? String(projectId) : ""
  ));
  const [selectedQuotationId, setSelectedQuotationId] = useState(() => queryQuotationId || "");
  const [summary, setSummary] = useState(null);
  const [savedSummaryStatus, setSavedSummaryStatus] = useState("");
  const [items, setItems] = useState([]);
  const [itemColumnFilters, setItemColumnFilters] = useState(EMPTY_ITEM_FILTERS);
  const [quotationColumnFilters, setQuotationColumnFilters] = useState(EMPTY_QUOTATION_LIST_FILTERS);
  const [costTypes, setCostTypes] = useState([]);
  const [materialCostTypeId, setMaterialCostTypeId] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [roomOptions, setRoomOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [validationMessages, setValidationMessages] = useState([]);
  const [labFurnitureItems, setLabFurnitureItems] = useState([]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalMode, setItemModalMode] = useState("add");
  const [itemToEdit, setItemToEdit] = useState(null);

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
  const [statusConfirmation, setStatusConfirmation] = useState({
    open: false,
    previousStatus: "",
    nextStatus: "",
    type: "warning",
    message: "",
    allowCompletedWithoutItems: false,
  });
  const [saveNoItemsConfirmationOpen, setSaveNoItemsConfirmationOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [creatingQuotation, setCreatingQuotation] = useState(false);
  const [revisionCreateConfirmation, setRevisionCreateConfirmation] = useState({
    open: false,
    message: "",
    projectId: "",
    nextRevisionCode: "",
  });

  const sessionUser = useMemo(() => getSessionUser(), []);
  const isAdminUser = useMemo(() => {
    const roleName = String(sessionUser?.role || "").trim().toLowerCase();
    const normalizedRoleName = roleName.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    return ["admin", "super admin", "superadmin", "staff"].includes(normalizedRoleName);
  }, [sessionUser]);

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

  const combinedItemOptions = useMemo(() => {
    return (labFurnitureItems || []).map((item) => {
      const code = item.item_code || "";
      const name = item.item_name || "";
      const cat = item.item_category || item.item_category_name || "";
      let label = code;
      if (name) label += ` - ${name}`;
      if (cat) label += ` (${cat})`;
      return {
        ...item,
        id: item.id,
        item_code: code,
        item_name: name,
        item_category_id: item.item_category_id || "",
        item_category: cat,
        label,
      };
    });
  }, [labFurnitureItems]);

  const projectOptionLabel = useCallback(
    (project) => `${project.project_id || "Project"} — ${project.project_name || "Unnamed"}`,
    []
  );

  const handleProjectSelectionInput = useCallback((value) => {
    const nextValue = String(value || "");
    setProjectSelectionInput(nextValue);

    const normalized = nextValue.trim().toLowerCase();
    if (!normalized) {
      setSelectedProjectIdForCreate("");
      return;
    }

    const matched = projectOptions.find((project) => {
      const label = projectOptionLabel(project).toLowerCase();
      const projectCode = String(project.project_id || "").trim().toLowerCase();
      return label === normalized || projectCode === normalized;
    });
    setSelectedProjectIdForCreate(matched ? String(matched.id) : "");
  }, [projectOptionLabel, projectOptions]);

  useEffect(() => {
    if (!selectedProjectIdForCreate) return;
    const selectedProject = projectOptions.find((row) => String(row.id) === String(selectedProjectIdForCreate));
    if (!selectedProject) return;
    const label = projectOptionLabel(selectedProject);
    if (projectSelectionInput !== label) {
      setProjectSelectionInput(label);
    }
  }, [projectOptionLabel, projectOptions, projectSelectionInput, selectedProjectIdForCreate]);

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

  const getNamesForCategory = useCallback((categoryId) => (
    itemMasterRef.current
      .filter((item) => String(item.item_category_id || "") === String(categoryId || ""))
      .filter((item) => String(item.item_name || "").trim())
      .sort((a, b) => String(a.item_name || "").localeCompare(String(b.item_name || "")))
  ), []);

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

    const data = await listProjectQuotationItems(quotationId);
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

  const isAdminReadonlyWarning = useCallback((message) => {
    if (!isAdminUser) return false;
    const normalized = String(message || "").trim().toLowerCase();
    return normalized.includes("completed quotation is read-only for non-admin users");
  }, [isAdminUser]);

  const summaryStatus = useMemo(() => {
    if (!status.message) return null;
    if (isAdminReadonlyWarning(status.message)) return null;
    return isSummaryRelatedMessage(status.message) ? status : null;
  }, [isAdminReadonlyWarning, status]);

  const summaryValidationMessages = useMemo(
    () => validationMessages
      .filter((entry) => isSummaryRelatedMessage(entry.message))
      .filter((entry) => !isAdminReadonlyWarning(entry.message)),
    [isAdminReadonlyWarning, validationMessages]
  );

  const itemValidationMessages = useMemo(
    () => validationMessages
      .filter((entry) => !isSummaryRelatedMessage(entry.message))
      .filter((entry) => !isAdminReadonlyWarning(entry.message)),
    [isAdminReadonlyWarning, validationMessages]
  );

  const itemStatus = useMemo(() => {
    if (!status.message) return null;
    if (isAdminReadonlyWarning(status.message)) return null;
    return isSummaryRelatedMessage(status.message) ? null : status;
  }, [isAdminReadonlyWarning, status]);

  const summaryPreviewValues = useMemo(() => recalculateSummary(summary), [summary]);

  const filteredQuotations = useMemo(() => {
    const normalizedFilters = Object.entries(quotationColumnFilters).reduce(
      (accumulator, [key, value]) => ({
        ...accumulator,
        [key]: String(value || "").trim().toLowerCase(),
      }),
      {}
    );

    const hasActiveFilters = Object.values(normalizedFilters).some(Boolean);
    if (!hasActiveFilters) return quotations;

    return quotations.filter((row) => {
      const rowValues = {
        quotation_number: String(row.quotation_number || "Auto"),
        project_id: String(row.project_code || row.project_id || ""),
        project_name: String(row.project_name || "-"),
        revision_code: String(row.revision_code || `R${row.revision_number || 1}`),
        total_quotation_cost: String(row.total_quotation_cost ?? ""),
        status: String(getQuotationStatus(row)),
      };

      return Object.entries(normalizedFilters).every(([key, filterValue]) => {
        if (!filterValue) return true;
        return (rowValues[key] || "").toLowerCase().includes(filterValue);
      });
    });
  }, [quotationColumnFilters, quotations]);

  const filteredItems = useMemo(() => {
    const normalizedFilters = Object.entries(itemColumnFilters).reduce((accumulator, [key, value]) => ({
      ...accumulator,
      [key]: String(value || "").trim().toLowerCase(),
    }), {});

    return items.filter((row) => {
      const rowValues = {
        room_name: row.room_name?.room_name || "",
        cost_type: row.cost_type?.name || row.cost_type_name || row.cost_type || "",
        item_category: row.item_category || "",
        item_name: row.item_name || "",
        item_code: row.item_code || "",
        item_type: row.item_type || "",
        purchase_qty: row.purchase_qty ?? "",
        requested_qty: row.requested_qty ?? "",
        stock_status: getStockStatusName(row),
      };

      return Object.entries(normalizedFilters).every(([key, filterValue]) => {
        if (!filterValue) return true;
        return String(rowValues[key] ?? "").toLowerCase().includes(filterValue);
      });
    });
  }, [itemColumnFilters, items]);

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
      const [summaryData, categoryData, itemData, roomData, projectsData] = await Promise.all([
        listQuotationSummaries(activeProjectId),
        listLabFurnitureItemCategories(),
        listLabFurnitureItems(),
        listRooms(),
        listProjects(),
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
      const projects = Array.isArray(projectsData.projects) ? projectsData.projects : [];
      setProjectOptions(projects);
      setSelectedProjectIdForCreate((prev) => {
        if (embedded && projectId) return String(projectId);
        const normalizedPrev = String(prev || "");
        return projects.some((row) => String(row.id) === normalizedPrev) ? normalizedPrev : "";
      });
      if (!(embedded && projectId) && selectedProjectIdForCreate) {
        const selectedProject = projects.find((row) => String(row.id) === String(selectedProjectIdForCreate));
        if (!selectedProject) {
          setProjectSelectionInput("");
        }
      }
      const labItems = Array.isArray(itemData.lab_furniture_items) ? itemData.lab_furniture_items : [];
      itemMasterRef.current = labItems;
      setLabFurnitureItems(labItems);

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
        let summaryPayload = selected || null;
        if (selected) {
          const detailPayload = await getProjectQuotationSummary(selected.id);
          summaryPayload = detailPayload?.quotation || selected;
        }
        setSummary(summaryPayload);
        setSavedSummaryStatus(getNormalizedQuotationStatus(summaryPayload));
        if (selected) {
          await loadItemsForSummary(selected.id);
        } else {
          setItems([]);
          setValidationMessages([]);
        }
      } else {
        setSummary(null);
        setSavedSummaryStatus("");
        setItems([]);
        setValidationMessages([]);
      }
    } catch (error) {
      showStatus(error.message || "Failed to load quotations.", "error");
      setQuotations([]);
      setSummary(null);
      setSavedSummaryStatus("");
      setItems([]);
      setValidationMessages([]);
      setCostTypes([]);
      setCategoryOptions([]);
      setRoomOptions([]);
      setProjectOptions([]);
      itemMasterRef.current = [];
      setLabFurnitureItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    embedded,
    ensureEmbeddedSummary,
    loadItemsForSummary,
    projectId,
    queryQuotationId,
    selectedProjectIdForCreate,
    selectedQuotationId,
    showStatus,
  ]);

  const closeRevisionCreateConfirmation = useCallback(() => {
    setRevisionCreateConfirmation({
      open: false,
      message: "",
      projectId: "",
      nextRevisionCode: "",
    });
  }, []);

  const refreshSelectedSummary = useCallback(async (quotationId) => {
    const listData = await listQuotationSummaries(embedded && projectId ? projectId : null);
    const rows = Array.isArray(listData.quotations) ? listData.quotations : [];
    setQuotations(rows);
    const selected = rows.find((row) => String(row.id) === String(quotationId || "")) || null;
    let summaryPayload = selected;
    if (selected) {
      const detailPayload = await getProjectQuotationSummary(selected.id);
      summaryPayload = detailPayload?.quotation || selected;
    }
    setSummary(summaryPayload);
    setSavedSummaryStatus(getNormalizedQuotationStatus(summaryPayload));
    if (selected) {
      await loadItemsForSummary(selected.id);
    } else {
      setItems([]);
      setValidationMessages([]);
    }
  }, [embedded, loadItemsForSummary, projectId]);

  const createQuotationForProject = useCallback(async (projectIdValue, confirmNewRevision = false) => {
    const normalizedProjectId = String(projectIdValue || "").trim();
    if (!normalizedProjectId) {
      showStatus("Select a project before adding quotation.", "warning");
      return;
    }

    setCreatingQuotation(true);
    clearStatus();
    try {
      const response = await createQuotationSummary(
        { project_id: normalizedProjectId },
        { confirmNewRevision }
      );

      if (response?.requires_confirmation) {
        setRevisionCreateConfirmation({
          open: true,
          message: response.message || "Create a new revision?",
          projectId: normalizedProjectId,
          nextRevisionCode: String(response.next_revision_code || ""),
        });
        return;
      }

      closeRevisionCreateConfirmation();
      const nextSummaryId = String(response?.quotation?.id || "");
      if (!nextSummaryId) {
        throw new Error(response?.message || "Failed to open quotation.");
      }

      setSelectedQuotationId(nextSummaryId);
      if (!embedded) {
        setSearchParams({ quotationId: nextSummaryId });
      }
      await refreshSelectedSummary(nextSummaryId);
      showStatus(response.message || "Quotation opened successfully.", response.status || "success");
    } catch (error) {
      showStatus(error.message || "Failed to create quotation.", "error");
      window.alert(error.message || "Failed to create quotation.");
    } finally {
      setCreatingQuotation(false);
    }
  }, [clearStatus, closeRevisionCreateConfirmation, embedded, refreshSelectedSummary, setSearchParams, showStatus]);

  const handleAddQuotation = useCallback(async () => {
    await createQuotationForProject(selectedProjectIdForCreate, false);
  }, [createQuotationForProject, selectedProjectIdForCreate]);

  const confirmCreateRevision = useCallback(async () => {
    await createQuotationForProject(revisionCreateConfirmation.projectId, true);
  }, [createQuotationForProject, revisionCreateConfirmation.projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!embedded) {
      setSelectedQuotationId(queryQuotationId || "");
    }
  }, [embedded, queryQuotationId]);

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
        setSavedSummaryStatus(getNormalizedQuotationStatus(response.quotation));
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

  const handleSummaryStatusChange = useCallback((nextStatus) => {
    const normalizedNextStatus = String(nextStatus || "").trim().toLowerCase();
    const currentStatus = getQuotationStatus(summary);
    const normalizedCurrentStatus = currentStatus.toLowerCase();

    if (normalizedCurrentStatus === "work in progress" && normalizedNextStatus === "completed") {
      const hasItems = Array.isArray(items) && items.length > 0;
      setStatusConfirmation({
        open: true,
        previousStatus: currentStatus,
        nextStatus: "Completed",
        type: "warning",
        message: hasItems
          ? "Status changed to Completed. Only admin can edit. Shall I proceed?"
          : "⚠ No quotation items added. Do you still want to save as Completed? Only admin can edit after completion.",
        allowCompletedWithoutItems: !hasItems,
      });
      return;
    }

    if (
      isAdminUser
      && normalizedCurrentStatus === "completed"
      && normalizedNextStatus === "work in progress"
    ) {
      setStatusConfirmation({
        open: true,
        previousStatus: currentStatus,
        nextStatus: "Work In Progress",
        type: "warning",
        message: "Revert status to Work in Progress? This will unlock editing for all users.",
        allowCompletedWithoutItems: false,
      });
      return;
    }

    patchSummary("quotation_status", nextStatus);
  }, [isAdminUser, items, patchSummary, summary]);

  const closeStatusConfirmation = useCallback(() => {
    setStatusConfirmation({
      open: false,
      previousStatus: "",
      nextStatus: "",
      type: "warning",
      message: "",
      allowCompletedWithoutItems: false,
    });
  }, []);

  const cancelStatusConfirmation = useCallback(() => {
    patchSummary("quotation_status", statusConfirmation.previousStatus || "Work In Progress");
    closeStatusConfirmation();
  }, [closeStatusConfirmation, patchSummary, statusConfirmation.previousStatus]);

  const confirmStatusChange = useCallback(async () => {
    if (!summary?.id || !statusConfirmation.nextStatus) {
      closeStatusConfirmation();
      return;
    }

    setUpdatingStatus(true);
    try {
      const nextStatus = String(statusConfirmation.nextStatus || "").trim();
      const normalizedNextStatus = nextStatus.toLowerCase();
      const isTransitioningToCompleted = normalizedNextStatus === "completed";
      const statusPayload = normalizedNextStatus === "work in progress"
        ? { status: "Work In Progress" }
        : {
          quotation_status: nextStatus,
          confirm_completed_without_items: isTransitioningToCompleted && statusConfirmation.allowCompletedWithoutItems,
        };
      const response = await updateQuotationStatus(summary.id, statusPayload);
      const updatedSummary = response?.quotation || summary;
      setSummary(updatedSummary);
      setSavedSummaryStatus(getNormalizedQuotationStatus(updatedSummary));
      setValidationMessages(normalizeValidationMessages(response.validation_messages));
      setSummarySaveFeedback({
        type: response.result_status || response.status || "success",
        message: response.message || "Quotation status updated successfully.",
      });
      if (onSummaryStatusChange) {
        onSummaryStatusChange({
          type: response.result_status || response.status || "success",
          message: response.message || "Quotation status updated successfully.",
        });
      }
      closeStatusConfirmation();
      await refreshSelectedSummary(summary.id);
    } catch (error) {
      setSummarySaveFeedback({
        type: error.payload?.status || "error",
        message: error.message || "Failed to update quotation status.",
      });
      if (onSummaryStatusChange) {
        onSummaryStatusChange({
          type: error.payload?.status || "error",
          message: error.message || "Failed to update quotation status.",
        });
      }
      patchSummary("quotation_status", statusConfirmation.previousStatus || "Work In Progress");
      closeStatusConfirmation();
    } finally {
      setUpdatingStatus(false);
    }
  }, [
    closeStatusConfirmation,
    onSummaryStatusChange,
    patchSummary,
    refreshSelectedSummary,
    statusConfirmation.nextStatus,
    statusConfirmation.previousStatus,
    statusConfirmation.allowCompletedWithoutItems,
    summary,
  ]);

  const goBackToQuotationList = useCallback(() => {
    if (selectedQuotationId) {
      setSelectedQuotationId("");
      setSummary(null);
      setSavedSummaryStatus("");
      setItems([]);
      setValidationMessages([]);
      setImportSummary(null);
      setImportReports([]);
      closeStatusConfirmation();
      setSaveNoItemsConfirmationOpen(false);
      clearStatus();
      setSearchParams({});
      return;
    }
    navigate("/projects");
  }, [clearStatus, closeStatusConfirmation, navigate, selectedQuotationId, setSearchParams]);

  const isSavedCompletedQuotation = savedSummaryStatus === "completed";
  const isQuotationReadOnly = isSavedCompletedQuotation && !isAdminUser;
  const isSummaryBusy = savingSummary || updatingStatus;

  function ensureEditableQuotation(actionLabel = "edit values") {
    if (!isSavedCompletedQuotation || isAdminUser) return true;
    showStatus(`Completed quotation is read-only for non-admin users. You cannot ${actionLabel}.`, "warning");
    return false;
  }

  const executeSummarySave = useCallback(async (allowCompletedWithoutItems = false) => {
    if (!summary?.id || !ensureEditableQuotation("save summary")) return;
    setSavingSummary(true);
    clearStatus();
    setSummarySaveFeedback({ type: "", message: "" });
    try {
      const payload = {
        quotation_status: getQuotationStatus(summary),
        confirm_completed_without_items: allowCompletedWithoutItems,
      };
      SUMMARY_EDITABLE_FIELDS.forEach((field) => {
        payload[field] = summary[field] ?? 0;
      });
      const response = await saveQuotationSummary(summary.id, payload);
      if (response?.requires_confirmation) {
        setSaveNoItemsConfirmationOpen(true);
        return;
      }
      setSummary(response.quotation || summary);
      setSavedSummaryStatus(getNormalizedQuotationStatus(response.quotation || summary));
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
      try {
        await refreshSelectedSummary(summary.id);
      } catch (_refreshError) {
        // Keep save successful even if the follow-up refresh request intermittently fails.
      }
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
  }, [clearStatus, ensureEditableQuotation, onSummaryStatusChange, refreshSelectedSummary, showStatus, summary]);

  const saveSummary = useCallback(async () => {
    if (!summary?.id || !ensureEditableQuotation("save summary")) return;
    const selectedStatus = getNormalizedQuotationStatus(summary);
    if (selectedStatus === "completed" && (!Array.isArray(items) || items.length === 0)) {
      setSaveNoItemsConfirmationOpen(true);
      return;
    }
    await executeSummarySave(false);
  }, [ensureEditableQuotation, executeSummarySave, items, summary]);

  const cancelSaveNoItemsConfirmation = useCallback(() => {
    setSaveNoItemsConfirmationOpen(false);
    patchSummary("quotation_status", "Work In Progress");
  }, [patchSummary]);

  const confirmSaveNoItems = useCallback(async () => {
    setSaveNoItemsConfirmationOpen(false);
    await executeSummarySave(true);
  }, [executeSummarySave]);

  const removeSummary = useCallback(async (summaryRow) => {
    const quotationId = summaryRow?.id;
    if (!quotationId) return;
    if (getNormalizedQuotationStatus(summaryRow) === "completed") {
      showStatus("Completed quotation cannot be deleted.", "warning");
      return;
    }
    if (!window.confirm("Delete this quotation and all linked items?")) return;

    clearStatus();
    try {
      await deleteQuotationSummary(quotationId);
      if (!embedded) {
        setSelectedQuotationId("");
        setSearchParams({});
      }
      setSummary(null);
      setSavedSummaryStatus("");
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
    const detailPayload = await getProjectQuotationSummary(selected.id);
    const summaryPayload = detailPayload?.quotation || selected;
    setSummary(summaryPayload);
    setSavedSummaryStatus(getNormalizedQuotationStatus(summaryPayload));
    closeStatusConfirmation();
    setSaveNoItemsConfirmationOpen(false);
    setImportSummary(null);
    setImportReports([]);
    clearStatus();
    if (!embedded) {
      setSearchParams({ quotationId: String(selected.id) });
    }
    await loadItemsForSummary(selected.id);
  }, [clearStatus, closeStatusConfirmation, embedded, loadItemsForSummary, quotations, setSearchParams]);

  const quotationTitle = summary?.quotation_number
    ? `Project Quotation - ${summary.quotation_number}`
    : (embedded ? "Quotation" : "Project Quotation");

  const applyMaterialSelection = useCallback(async (itemCodeId, applyPatch) => {
    const master = getMasterById(itemCodeId);
    if (!master) {
      applyPatch({
        item_code_id: "",
        item_type: "",
        stock_status_name: "No Stock",
        purchase_qty: "0",
        requested_qty: "0",
        cost_per_qty: "0",
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
      cost_per_qty: "0",
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
        applyPatch({ cost_per_qty: previewCost, max_cost: previewCost, min_cost: previewCost, actual_cost: previewCost });
      } catch (_error) {
        applyPatch({ cost_per_qty: "0", max_cost: "0", min_cost: "0", actual_cost: "0" });
      }
    }
  }, [getMasterById, showStatus]);

  const openAddItemModal = useCallback(() => {
    if (!ensureEditableQuotation("add items")) return;
    setItemModalMode("add");
    setItemToEdit(null);
    setItemModalOpen(true);
    clearStatus();
  }, [clearStatus, ensureEditableQuotation]);

  const openEditItemModal = useCallback((row) => {
    if (!ensureEditableQuotation("edit items")) return;
    setItemModalMode("edit");
    setItemToEdit(row);
    setItemModalOpen(true);
    clearStatus();
  }, [clearStatus, ensureEditableQuotation]);

  const handleSaveModalItem = useCallback(async (payload, editItemId) => {
    if (!summary?.id || !ensureEditableQuotation("save item")) return;
    setSavingRow(true);
    clearStatus();
    try {
      const saveWithOverride = async (overrideFlag) => {
        const body = {
          ...payload,
          confirm_requested_qty_override: overrideFlag,
        };
        return editItemId
          ? updateQuotationItem(summary.id, editItemId, body)
          : createQuotationItem(summary.id, body);
      };

      let response;
      try {
        response = await saveWithOverride(false);
      } catch (error) {
        if (error.payload?.status === "warning" && error.payload?.requires_confirmation) {
          const proceed = window.confirm(
            error.message || "Requested Qty is higher than Purchase Qty. Do you want to proceed?"
          );
          if (!proceed) {
            showStatus("Save cancelled by user.", "warning");
            return;
          }
          response = await saveWithOverride(true);
        } else {
          throw error;
        }
      }

      setValidationMessages(normalizeValidationMessages(response?.validation_messages));
      await refreshSelectedSummary(summary.id);
      showStatus(
        response?.message || (editItemId ? "Quotation item updated successfully." : "Quotation item added successfully."),
        response?.status || "success"
      );
    } catch (error) {
      const text = error.message || "Failed to save quotation item.";
      showStatus(text, error.payload?.status || "error");
      window.alert(text);
      throw error;
    } finally {
      setSavingRow(false);
    }
  }, [clearStatus, ensureEditableQuotation, refreshSelectedSummary, showStatus, summary]);

  const removeItem = useCallback(async (itemId) => {
    if (!summary?.id || !ensureEditableQuotation("delete items")) return;
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
  }, [clearStatus, ensureEditableQuotation, refreshSelectedSummary, showStatus, summary]);

  const renderSummaryGrid = () => {
    if (!summary) return null;

    return (
      <>
        <h2 className="project-costing-section-title">
          <span className="project-costing-section-title__icon" aria-hidden="true"><BsClipboardData /></span>
          <span className="project-costing-section-title__text">Quotation Summary</span>
        </h2>

        <div className="project-costing-summary-grid">
          <div className="project-costing-field">
            <span className="project-costing-field__label">Quotation ID</span>
            <span className="project-costing-field__value">{summary.id || "—"}</span>
          </div>
          <div className="project-costing-field">
            <span className="project-costing-field__label">Quotation Number</span>
            <span className="project-costing-field__value">{summary.quotation_number || "—"}</span>
          </div>
          <div className="project-costing-field">
            <span className="project-costing-field__label">Project ID</span>
            <span className="project-costing-field__value">{summary.project_code || summary.project_id || "—"}</span>
          </div>
          <div className="project-costing-field">
            <span className="project-costing-field__label">Project Name</span>
            <span className="project-costing-field__value">{summary.project_name || "—"}</span>
          </div>
          <label className="project-costing-form-label project-costing-field">
            <span className="project-costing-field__label">Status</span>
            <select
              className="project-costing-select"
              value={getQuotationStatus(summary)}
              onChange={(event) => handleSummaryStatusChange(event.target.value)}
              disabled={isSummaryBusy || isQuotationReadOnly}
            >
              {QUOTATION_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

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
                  title="Auto-calculated from quotation items."
                  aria-label="Auto-calculated from quotation items."
                >
                  ?
                </span>
              </span>
              <input
                className="project-costing-input"
                type="number"
                min="0"
                step="0.01"
                value={summaryPreviewValues.total_material_cost ?? summary.total_material_cost ?? 0}
                readOnly
                disabled
              />
              <small className="project-costing-form-help">Auto-calculated from quotation items.</small>
            </label>
            <label className="project-costing-form-label">
              Markup %
              <input
                className="project-costing-input"
                type="number"
                min="0"
                step="0.0001"
                value={summary.markup ?? 0}
                onChange={(event) => patchSummary("markup", event.target.value)}
                disabled={isSummaryBusy || isQuotationReadOnly}
              />
            </label>
            <label className="project-costing-form-label">
              Contingency %
              <input
                className="project-costing-input"
                type="number"
                min="0"
                step="0.0001"
                value={summary.contingency ?? 0}
                onChange={(event) => patchSummary("contingency", event.target.value)}
                disabled={isSummaryBusy || isQuotationReadOnly}
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
              <input className="project-costing-input" type="number" min="0" value={summary.petrol_expenses ?? 0} onChange={(event) => patchSummary("petrol_expenses", event.target.value)} disabled={isSummaryBusy || isQuotationReadOnly} />
            </label>
            <label className="project-costing-form-label">
              Transport / Install Team
              <input className="project-costing-input" type="number" min="0" value={summary.transport_installation_team ?? 0} onChange={(event) => patchSummary("transport_installation_team", event.target.value)} disabled={isSummaryBusy || isQuotationReadOnly} />
            </label>
            <label className="project-costing-form-label">
              Transportation
              <input className="project-costing-input" type="number" min="0" value={summary.transportation ?? 0} onChange={(event) => patchSummary("transportation", event.target.value)} disabled={isSummaryBusy || isQuotationReadOnly} />
            </label>
            <label className="project-costing-form-label">
              Food / Accommodation
              <input className="project-costing-input" type="number" min="0" value={summary.food_accomodation ?? 0} onChange={(event) => patchSummary("food_accomodation", event.target.value)} disabled={isSummaryBusy || isQuotationReadOnly} />
            </label>
            <label className="project-costing-form-label">
              Loading
              <input className="project-costing-input" type="number" min="0" value={summary.loading ?? 0} onChange={(event) => patchSummary("loading", event.target.value)} disabled={isSummaryBusy || isQuotationReadOnly} />
            </label>
            <label className="project-costing-form-label">
              Unloading
              <input className="project-costing-input" type="number" min="0" value={summary.unloading ?? 0} onChange={(event) => patchSummary("unloading", event.target.value)} disabled={isSummaryBusy || isQuotationReadOnly} />
            </label>
            <label className="project-costing-form-label">
              Installation
              <input className="project-costing-input" type="number" min="0" value={summary.installation ?? 0} onChange={(event) => patchSummary("installation", event.target.value)} disabled={isSummaryBusy || isQuotationReadOnly} />
            </label>
            <label className="project-costing-form-label">
              Business Development
              <input className="project-costing-input" type="number" min="0" value={summary.business_development ?? 0} onChange={(event) => patchSummary("business_development", event.target.value)} disabled={isSummaryBusy || isQuotationReadOnly} />
            </label>
          </div>
        </div>

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
            ].map(([label, value]) => (
              <div key={label} className="project-costing-field">
                <span className="project-costing-field__label">{label}</span>
                <span className="project-costing-field__value project-costing-field__value--calc">{value ?? "-"}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  return (
    <section className="module-page project-costing-page">
      <div className="crud-page__header pq-header project-costing-toolbar">
        <div>
          <h1 className="module-page__title project-costing-title">
            <span className="project-costing-title__icon" aria-hidden="true"><BsCashCoin /></span>
            <span className="project-costing-title__text">{quotationTitle}</span>
          </h1>
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

      {status.message && !isAdminReadonlyWarning(status.message) && (!summary || (!embedded && !selectedQuotationId)) ? (
        <p className={getStatusClassName(status.type)}>
          {status.message}
        </p>
      ) : null}

      {loading ? <p className="users-status">Loading quotations...</p> : null}

      {!loading && !embedded && !selectedQuotationId ? (
        <>
          <div className="project-costing-card project-costing-actions">
            <input
              type="search"
              list="quotation-project-options"
              className="auth-input"
              placeholder="Select project"
              value={projectSelectionInput}
              onChange={(event) => handleProjectSelectionInput(event.target.value)}
              disabled={creatingQuotation}
            />
            <datalist id="quotation-project-options">
              {projectOptions.map((project) => (
                <option key={project.id} value={projectOptionLabel(project)} />
              ))}
            </datalist>
            <button
              type="button"
              className="crud-add-btn"
              onClick={handleAddQuotation}
              disabled={!selectedProjectIdForCreate || creatingQuotation}
            >
              {creatingQuotation ? "Opening..." : "Add Quotation"}
            </button>
          </div>

          <div className="users-table-wrap pq-table-wrap-list project-costing-table-wrap">
          <table className="users-table project-costing-table">
            <thead>
              <tr>
                <th>Quotation Number</th>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Revision Code</th>
                <th>Total Quotation Cost</th>
                <th>Status</th>
                <th className="pq-text-center">Actions</th>
              </tr>
              <tr>
                <th>
                  <input
                    className="users-table__filter-input"
                    type="text"
                    placeholder="Filter"
                    value={quotationColumnFilters.quotation_number}
                    onChange={(event) =>
                      setQuotationColumnFilters((prev) => ({
                        ...prev,
                        quotation_number: event.target.value,
                      }))
                    }
                  />
                </th>
                <th>
                  <input
                    className="users-table__filter-input"
                    type="text"
                    placeholder="Filter"
                    value={quotationColumnFilters.project_id}
                    onChange={(event) =>
                      setQuotationColumnFilters((prev) => ({
                        ...prev,
                        project_id: event.target.value,
                      }))
                    }
                  />
                </th>
                <th>
                  <input
                    className="users-table__filter-input"
                    type="text"
                    placeholder="Filter"
                    value={quotationColumnFilters.project_name}
                    onChange={(event) =>
                      setQuotationColumnFilters((prev) => ({
                        ...prev,
                        project_name: event.target.value,
                      }))
                    }
                  />
                </th>
                <th>
                  <input
                    className="users-table__filter-input"
                    type="text"
                    placeholder="Filter"
                    value={quotationColumnFilters.revision_code}
                    onChange={(event) =>
                      setQuotationColumnFilters((prev) => ({
                        ...prev,
                        revision_code: event.target.value,
                      }))
                    }
                  />
                </th>
                <th>
                  <input
                    className="users-table__filter-input"
                    type="text"
                    placeholder="Filter"
                    value={quotationColumnFilters.total_quotation_cost}
                    onChange={(event) =>
                      setQuotationColumnFilters((prev) => ({
                        ...prev,
                        total_quotation_cost: event.target.value,
                      }))
                    }
                  />
                </th>
                <th>
                  <input
                    className="users-table__filter-input"
                    type="text"
                    placeholder="Filter"
                    value={quotationColumnFilters.status}
                    onChange={(event) =>
                      setQuotationColumnFilters((prev) => ({
                        ...prev,
                        status: event.target.value,
                      }))
                    }
                  />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="pq-empty-cell">
                    No quotations found.
                  </td>
                </tr>
              ) : filteredQuotations.map((row) => (
                <tr key={row.id}>
                  <td className="pq-cell-link" onClick={() => openSummary(row.id)}>{row.quotation_number || "Auto"}</td>
                  <td>{row.project_code || row.project_id}</td>
                  <td>{row.project_name || "-"}</td>
                  <td>{row.revision_code || `R${row.revision_number || 1}`}</td>
                  <td className="pq-text-right">{row.total_quotation_cost}</td>
                  <td>{getQuotationStatus(row)}</td>
                  <td className="pq-text-center">
                    <div className="pq-inline-actions">
                      <button type="button" className="users-action users-action--edit" onClick={() => openSummary(row.id)} title="Edit">
                        <BsPencilSquare aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="users-action users-action--delete"
                        onClick={() => removeSummary(row)}
                        disabled={getNormalizedQuotationStatus(row) === "completed"}
                        title={getNormalizedQuotationStatus(row) === "completed" ? "Completed quotations cannot be deleted" : "Delete"}
                      >
                        <BsTrashFill aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : null}

      {!loading && (embedded || selectedQuotationId) && summary ? (
        <>
          {/* ========= CARD 1: Quotation Summary ========= */}
          <Card className="lca-card mb-3 pq-card">
            <CardHeader className="pq-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <BsClipboardData aria-hidden="true" />
                  Quotation Summary
                </h2>
                {summary?.id ? (
                  <span className="vendor-card__badge" style={{ marginLeft: "0.5rem" }}>
                    <BsPencilSquare aria-hidden="true" /> Quotation #{summary.id} ({summary.quotation_number || "—"})
                  </span>
                ) : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="crud-add-btn"
                  onClick={saveSummary}
                  disabled={isSummaryBusy || isQuotationReadOnly || statusConfirmation.open || saveNoItemsConfirmationOpen}
                >
                  {savingSummary ? "Saving..." : "Save Summary"}
                </button>
              </div>
            </CardHeader>
            <CardBody className="pq-card-body">
              {isQuotationReadOnly ? (
                <AlertMessage
                  type="warning"
                  message="Status is Completed. Only admin can edit this form."
                />
              ) : null}

              {summaryStatus ? (
                <AlertMessage
                  type={summaryStatus.type === "error" ? "danger" : (summaryStatus.type === "warning" ? "warning" : "info")}
                  message={summaryStatus.message}
                />
              ) : null}

              {summaryValidationMessages.length ? (
                <div className="pq-status-list">
                  {summaryValidationMessages.map((entry) => (
                    <AlertMessage
                      key={`summary-${entry.type}-${entry.message}`}
                      type={entry.type === "error" ? "danger" : (entry.type === "warning" ? "warning" : "info")}
                      message={entry.message}
                    />
                  ))}
                </div>
              ) : null}

              {summarySaveFeedback.message && !isAdminReadonlyWarning(summarySaveFeedback.message) ? (
                <AlertMessage
                  type={summarySaveFeedback.type === "error" ? "danger" : (summarySaveFeedback.type === "warning" ? "warning" : "info")}
                  message={summarySaveFeedback.message}
                />
              ) : null}

              {renderSummaryGrid()}
            </CardBody>
          </Card>

          {/* ========= CARD 2: Quotation Items ========= */}
          <Card className="lca-card mb-3 pq-card">
            <CardHeader className="pq-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <BsBoxes aria-hidden="true" />
                  Quotation Items
                </h2>
                <span className="vendor-card__badge" style={{ marginLeft: "0.5rem" }}>
                  {items.length} {items.length === 1 ? "Item" : "Items"}
                </span>
              </div>
              <div className="project-costing-items-header-actions" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <input ref={importFileInputRef} className="project-costing-hidden-file-input" type="file" accept=".xlsx,.xls" onChange={handleImportItemsFile} />
                <button type="button" className="crud-add-btn" onClick={handleDownloadImportTemplate} disabled={downloadingTemplate || importingItems || savingRow || isQuotationReadOnly || isSummaryBusy}>
                  {downloadingTemplate ? "Downloading..." : "Download Template"}
                </button>
                <button type="button" className="crud-add-btn" onClick={openImportFilePicker} disabled={importingItems || savingRow || isQuotationReadOnly || isSummaryBusy}>
                  {importingItems ? "Importing..." : "Import Excel"}
                </button>
                <button type="button" className="crud-add-btn" onClick={openRoomModal} disabled={isQuotationReadOnly}>
                  <BsPlusCircleFill aria-hidden="true" /> Add New Room
                </button>
                <button type="button" className="crud-add-btn" onClick={openAddItemModal} disabled={isQuotationReadOnly}>
                  <BsPlusCircleFill aria-hidden="true" /> Add Item
                </button>
              </div>
            </CardHeader>
            <CardBody className="pq-card-body">
              {itemStatus ? (
                <AlertMessage
                  type={itemStatus.type === "error" ? "danger" : (itemStatus.type === "warning" ? "warning" : "info")}
                  message={itemStatus.message}
                />
              ) : null}

              {itemValidationMessages.length ? (
                <div className="pq-status-list">
                  {itemValidationMessages.map((entry) => (
                    <AlertMessage
                      key={`item-${entry.type}-${entry.message}`}
                      type={entry.type === "error" ? "danger" : "warning"}
                      message={entry.message}
                    />
                  ))}
                </div>
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

              <div className="users-table-wrap users-table-wrap--fit pq-table-wrap-items project-costing-table-wrap project-costing-table-wrap--items">
                <table className="users-table users-table--quotation project-costing-table project-costing-table--quotation project-costing-items-table">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>Cost Type</th>
                      <th>Item Category</th>
                      <th>Item Name</th>
                      <th>Item Code</th>
                      <th>Item Type</th>
                      <th className="project-costing-table__right">Purchase Qty</th>
                      <th className="project-costing-table__right">Requested Qty</th>
                      <th>Stock Status</th>
                      <th className="project-costing-table__center">Actions</th>
                    </tr>
                    <tr>
                      <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.room_name} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, room_name: event.target.value }))} /></th>
                      <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.cost_type} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, cost_type: event.target.value }))} /></th>
                      <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.item_category} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, item_category: event.target.value }))} /></th>
                      <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.item_name} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, item_name: event.target.value }))} /></th>
                      <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.item_code} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, item_code: event.target.value }))} /></th>
                      <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.item_type} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, item_type: event.target.value }))} /></th>
                      <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.purchase_qty} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, purchase_qty: event.target.value }))} /></th>
                      <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.requested_qty} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, requested_qty: event.target.value }))} /></th>
                      <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={itemColumnFilters.stock_status} onChange={(event) => setItemColumnFilters((prev) => ({ ...prev, stock_status: event.target.value }))} /></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="project-costing-empty">No quotation items found.</td>
                      </tr>
                    ) : filteredItems.map((row) => {
                      const rowCostType = row.cost_type?.name || row.cost_type_name || row.cost_type || "-";
                      return (
                        <tr key={row.id}>
                          <td>{row.room_name?.room_name || "-"}</td>
                          <td>{rowCostType}</td>
                          <td>{row.item_category || "-"}</td>
                          <td>{row.item_name || "-"}</td>
                          <td>{row.item_code || "-"}</td>
                          <td>{row.item_type || "-"}</td>
                          <td className="project-costing-table__right">{row.purchase_qty}</td>
                          <td className="project-costing-table__right">{row.requested_qty}</td>
                          <td>
                            <span className={`project-costing-stock-badge ${getStockStatusBadgeClassName(getStockStatusName(row))}`}>
                              {getStockStatusName(row)}
                            </span>
                          </td>
                          <td className="project-costing-table__center">
                            <div className="project-costing-inline-actions">
                              <button
                                type="button"
                                className="users-action users-action--edit"
                                onClick={() => openEditItemModal(row)}
                                disabled={isQuotationReadOnly}
                                title={isQuotationReadOnly ? "Completed quotation is read-only for non-admin users" : "Edit"}
                              >
                                <BsPencilSquare aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="users-action users-action--delete"
                                onClick={() => removeItem(row.id)}
                                disabled={isQuotationReadOnly}
                                title={isQuotationReadOnly ? "Completed quotation is read-only for non-admin users" : "Delete"}
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
        </>
      ) : null}

      <ConfirmPopupModal
        open={statusConfirmation.open}
        title="Status Confirmation"
        type={statusConfirmation.type || "warning"}
        message={statusConfirmation.message || "Status confirmation required."}
        confirmLabel={updatingStatus ? "Updating..." : "OK"}
        cancelLabel="Cancel"
        confirmDisabled={updatingStatus}
        cancelDisabled={updatingStatus}
        onConfirm={confirmStatusChange}
        onCancel={cancelStatusConfirmation}
      />

      <ConfirmPopupModal
        open={saveNoItemsConfirmationOpen}
        title="Save Confirmation"
        type="warning"
        message="⚠ No quotation items added. Do you still want to save as Completed?"
        confirmLabel={savingSummary ? "Saving..." : "OK"}
        cancelLabel="Cancel"
        confirmDisabled={savingSummary}
        cancelDisabled={savingSummary}
        onConfirm={confirmSaveNoItems}
        onCancel={cancelSaveNoItemsConfirmation}
      />

      <ConfirmPopupModal
        open={revisionCreateConfirmation.open}
        title="Create Quotation Revision"
        type="warning"
        message={revisionCreateConfirmation.message || "Create a new quotation revision?"}
        confirmLabel={creatingQuotation
          ? "Creating..."
          : `Create ${revisionCreateConfirmation.nextRevisionCode || "Revision"}`}
        cancelLabel="Cancel"
        confirmDisabled={creatingQuotation}
        cancelDisabled={creatingQuotation}
        onConfirm={confirmCreateRevision}
        onCancel={closeRevisionCreateConfirmation}
      />

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

      <QuotationItemModal
        isOpen={itemModalOpen}
        onClose={() => {
          setItemModalOpen(false);
          setItemToEdit(null);
        }}
        isEditMode={itemModalMode === "edit"}
        itemToEdit={itemToEdit}
        combinedItemOptions={combinedItemOptions}
        roomOptions={roomOptions}
        costTypes={costTypes}
        materialCostTypeId={materialCostTypeId}
        getItemCostPreview={getItemCostPreview}
        openRoomModal={openRoomModal}
        onSaveItem={handleSaveModalItem}
      />
    </section>
  );
}

export default ProjectQuotationPage;
