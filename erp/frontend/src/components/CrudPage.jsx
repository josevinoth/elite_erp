import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BsDownload,
  BsPencilSquare,
  BsPlusCircleFill,
  BsTrashFill,
  BsXCircle,
  BsSearch,
  BsTruck,
  BsBoxes,
  BsBuilding,
  BsPeople,
  BsFolder2,
  BsCartCheck,
  BsCartPlus,
  BsCheckCircle,
  BsClock,
  BsBoxSeam,
} from "react-icons/bs";
import Select from "react-select";
import { exportRowsToExcel } from "../utils/exportToExcel";
import PaginationControls from "./PaginationControls";
import ConfirmPopupModal from "./ConfirmPopupModal";

const AUDIT_COLUMN_KEYS = ["updated_by", "updated_on"];


function getTitleIcon(title, customIcon) {
  if (customIcon) return customIcon;
  const normalized = String(title || "").toLowerCase();
  if (normalized.includes("receive") || normalized.includes("purchase") || normalized.includes("goods") || normalized.includes("grn")) {
    return <BsTruck />;
  }
  if (normalized.includes("procurement") || normalized.includes("place stock order")) {
    return <BsCartCheck />;
  }
  if (normalized.includes("item to order") || normalized.includes("items to order")) {
    return <BsCartPlus />;
  }
  if (normalized.includes("user")) return <BsPeople />;
  if (normalized.includes("vendor")) return <BsBuilding />;
  if (
    normalized.includes("project") ||
    normalized.includes("lca") ||
    normalized.includes("lce") ||
    normalized.includes("landing") ||
    normalized.includes("quotation") ||
    normalized.includes("costing")
  ) {
    return <BsFolder2 />;
  }
  if (normalized.includes("stock") || normalized.includes("item")) return <BsBoxes />;
  if (normalized.includes("task")) return <BsCheckCircle />;
  if (normalized.includes("timesheet")) return <BsClock />;
  return <BsBoxSeam />;
}

function getTitleVariant(title) {
  const normalized = String(title || "").toLowerCase();
  if (normalized.includes("user")) return "users";
  if (normalized.includes("vendor")) return "vendors";
  if (normalized.includes("project") || normalized.includes("lca") || normalized.includes("lce") || normalized.includes("landing")) return "projects";
  if (normalized.includes("quotation")) return "quotation";
  if (normalized.includes("stock")) return "stock";
  if (normalized.includes("task")) return "tasks";
  if (normalized.includes("timesheet")) return "timesheet";
  if (normalized.includes("expense") || normalized.includes("cdc")) return "expenses";
  if (normalized.includes("approval")) return "approvals";
  return "default";
}

function normalizeUpdatedBy(row) {
  const labelValue =
    row?.updated_by_label ??
    row?.updatedByLabel ??
    row?.updated_by_username ??
    row?.updatedByUsername ??
    row?.modified_by_label ??
    row?.modifiedByLabel ??
    row?.created_by_label ??
    row?.createdByLabel ??
    "";

  if (labelValue != null && String(labelValue).trim()) {
    return String(labelValue).trim();
  }

  const value =
    row?.updated_by ??
    row?.updatedBy ??
    row?.modified_by ??
    row?.modifiedBy ??
    row?.created_by ??
    row?.createdBy ??
    "";

  if (value && typeof value === "object") {
    return String(value.username || value.name || value.label || value.email || value.id || "");
  }

  if (typeof value === "string" && value.trim().startsWith("{")) {
    const usernameMatch = value.match(/['"]username['"]\s*:\s*['"]([^'"]+)['"]/);
    if (usernameMatch) {
      return usernameMatch[1];
    }
    const nameMatch = value.match(/['"](?:name|label|email)['"]\s*:\s*['"]([^'"]+)['"]/);
    if (nameMatch) {
      return nameMatch[1];
    }
  }

  return value == null ? "" : String(value);
}

function normalizeUpdatedOn(row) {
  const raw =
    row?.updated_on ??
    row?.updatedOn ??
    row?.updated_at ??
    row?.updatedAt ??
    row?.modified_at ??
    row?.modifiedAt ??
    row?.last_updated ??
    row?.lastUpdated ??
    "";

  return raw == null ? "" : String(raw).trim();
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toLocalDateTimeText(dateObj) {
  return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())} ${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}:${pad2(dateObj.getSeconds())}`;
}

function formatDateTimeForTable(value) {
  if (value == null) {
    return "";
  }

  const text = String(value).trim();
  if (!text) {
    return "";
  }

  const isoLikePattern = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const hasTimezonePattern = /(Z|[+-]\d{2}:?\d{2})$/;

  if (isoLikePattern.test(text)) {
    const normalizedIso = text.includes("T") ? text : text.replace(" ", "T");

    if (hasTimezonePattern.test(normalizedIso)) {
      const parsed = new Date(normalizedIso);
      if (!Number.isNaN(parsed.getTime())) {
        return toLocalDateTimeText(parsed);
      }
    }

    const cleaned = normalizedIso
      .replace("T", " ")
      .replace(/([+-]\d{2}:?\d{2}|Z)$/i, "")
      .split(".")[0]
      .trim();
    return cleaned.slice(0, 19);
  }

  if (dateOnlyPattern.test(text)) {
    return text;
  }

  return text;
}

function withAuditFields(row) {
  return {
    ...row,
    updated_by: normalizeUpdatedBy(row),
    updated_on: normalizeUpdatedOn(row),
  };
}

/**
 * Reusable CRUD page with list table + add/edit modal.
 *
 * Props:
 *   title       - page heading
 *   columns     - [{ key, label }]
 *   fields      - [{ key, label, type?, required?, options? }]  (for form)
 *   fetchFn     - async () => rows array
 *   createFn    - async (payload) => row
 *   updateFn    - async (id, payload) => row
 *   deleteFn    - async (id) => void
 *   rowKey      - string key for unique id (default "id")
 */
function CrudPage({
  title,
  titleIcon = null,
  columns,
  fields,
  fetchFn,
  createFn,
  updateFn,
  deleteFn,
  rowKey = "id",
  tableMaxHeight = null,
  stickyHeader = true,
  tableWrapClassName = "",
  modalCardClassName = "",
  showAddButton = true,
  showExportButton = true,
  addButtonTo = null,
  exportFileName = null,
  openAddOnMount = false,
  openEditIdOnMount = null,
  rowActions = [],
  computeValues = null,   // (changedKey, changedValue, allValues) => extraValues
  editDisabledPredicate = null,  // (row) => boolean
  deleteDisabledPredicate = null,  // (row) => boolean
  checkDeleteAllowedFn = null,  // async (row) => ({ allowed: boolean, title?: string, message: string, details?: string[] })
  deleteConfirmFn = null,  // (row) => string — custom confirmation message per row
  editDisabledTitle = "Edit",
  deleteDisabledTitle = "Delete",
  saveDisabledPredicate = null,  // (editRow, formValues) => boolean
  saveDisabledTitle = "Save",
  bulkUpdateFn = null,  // async (selectedIds, payload) => result
  enableBulkSelect = false,  // boolean, enable row selection checkboxes
  onBulkModalOpen = null,  // (selectedIds, reloadRows) => void
  onRowsChange = null,     // (rows) => void – called whenever rows are updated
  renderFooter = null,     // () => ReactNode – rendered inside the section, below table
  renderHeaderActions = null, // ({ rows, loading, reloadRows }) => ReactNode
  renderFormExtension = null, // ({ editRow, formValues, setFormValues }) => ReactNode
  onEditOpen = null, // (row) => void | Promise<void>
  editButtonTo = null, // string | (row) => string
  includeAuditColumns = true,
  defaultPageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  enablePagination = true,
  showEditButton = false,
  showDeleteButton = true,
  description = null,
  addButtonLabel = null,
  enableRowClickEdit = true,
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filters, setFilters] = useState({});
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [globalSearch, setGlobalSearch] = useState("");
  const autoOpenedRef = useRef(false);
  const autoEditOpenedRef = useRef(false);
  const [deleteModalState, setDeleteModalState] = useState({
    open: false,
    id: null,
    title: "Confirm Delete",
    message: "",
    details: [],
    type: "danger",
    canDelete: true,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    deleting: false,
    loading: false,
  });

  const reloadRows = useCallback(() => setRefreshKey((k) => k + 1), []);

  const tableColumns = useMemo(() => {
    if (!includeAuditColumns) {
      return columns;
    }
    const updatedByCol = columns.find((c) => c.key === "updated_by");
    const updatedOnCol = columns.find((c) => c.key === "updated_on");
    const baseColumns = columns.filter((c) => !AUDIT_COLUMN_KEYS.includes(c.key));
    const defaultAuditAlign = columns[0]?.align;
    const defaultAuditHeaderAlign = columns[0]?.headerAlign || defaultAuditAlign;

    return [
      ...baseColumns,
      {
        key: "updated_by",
        label: updatedByCol?.label || "Updated By",
        align: updatedByCol?.align || defaultAuditAlign,
        headerAlign: updatedByCol?.headerAlign || defaultAuditHeaderAlign,
      },
      {
        key: "updated_on",
        label: updatedOnCol?.label || "Updated On",
        align: updatedOnCol?.align || defaultAuditAlign,
        headerAlign: updatedOnCol?.headerAlign || defaultAuditHeaderAlign,
      },
    ];
  }, [columns, includeAuditColumns]);

  const normalizedRows = useMemo(() => rows.map((row) => withAuditFields(row)), [rows]);

  const emptyForm = () =>
    Object.fromEntries(fields.map((f) => [f.key, f.default ?? ""]));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchFn()
      .then((data) => {
        if (alive) {
          const next = Array.isArray(data) ? data : [];
          setRows(next);
          if (onRowsChange) onRowsChange(next);
        }
      })
      .catch((e) => {
        if (alive) {
          const errorMsg = e.message || "Failed to load data.";
          console.error(`[${title}] Data fetch error:`, e);
          setError(errorMsg);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fetchFn, title, refreshKey, onRowsChange]);

  const openAdd = () => {
    setEditRow(null);
    setFormValues(emptyForm());
    setModalError("");
    setShowModal(true);
  };

  const handleAddClick = () => {
    if (addButtonTo) {
      navigate(addButtonTo);
      return;
    }
    openAdd();
  };

  const handleEditClick = (row) => {
    if (editButtonTo) {
      const target = typeof editButtonTo === "function" ? editButtonTo(row) : editButtonTo;
      if (target) {
        navigate(target);
        return;
      }
    }
    openEdit(row);
  };

  useEffect(() => {
    if (openAddOnMount && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setEditRow(null);
      setFormValues(emptyForm());
      setShowModal(true);
    }
  }, [openAddOnMount, fields]);

  useEffect(() => {
    if (!openEditIdOnMount || autoEditOpenedRef.current || loading || showModal) {
      return;
    }

    const match = rows.find((row) => String(row[rowKey]) === String(openEditIdOnMount));
    if (match) {
      autoEditOpenedRef.current = true;
      openEdit(match);
    }
  }, [openEditIdOnMount, rows, rowKey, loading, showModal]);

  const openEdit = (row) => {
    setEditRow(row);
    setFormValues(
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          // Disabled fields always use their default (e.g. updated_by = logged-in user)
          f.disabled ? (f.default ?? "") : (row[f.key] ?? ""),
        ])
      )
    );
    setModalError("");
    setShowModal(true);
    if (typeof onEditOpen === "function") {
      Promise.resolve(onEditOpen(row)).catch(() => {
        // Notification update failures should not block opening the edit modal.
      });
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditRow(null);
    setModalError("");
  };

  const handleFieldChange = (name, rawValue) => {
    const field = fields.find((f) => f.key === name);
    const isFreeTextField =
      field &&
      !field.options &&
      (!field.type || ["text", "textarea", "email", "tel", "search"].includes(field.type));

    const nextValue = isFreeTextField
      ? String(rawValue ?? "")
          .replace(/\s+/g, " ")
          .replace(/\s*([-_])\s*/g, "$1")
          .trimStart()
      : rawValue;

    setFormValues((prev) => {
      const nextValues = { ...prev, [name]: nextValue };
      const extras = computeValues ? computeValues(name, nextValue, nextValues) : {};
      return { ...nextValues, ...extras };
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    handleFieldChange(name, value);
  };

  const isFieldReadOnly = (field) =>
    typeof field.readOnly === "function" ? !!field.readOnly(formValues, editRow) : !!field.readOnly;

  const isFieldRequired = (field) =>
    typeof field.required === "function" ? !!field.required(formValues, editRow) : !!field.required;

  const selectStyles = useMemo(
    () => ({
      control: (base, state) => {
        return {
        ...base,
        minHeight: 40,
        backgroundColor: "#ffffff",
        borderColor: state.isFocused ? "#556ee6" : "#d9dce8",
        boxShadow: state.isFocused ? "0 0 0 2px rgba(85,110,230,0.2)" : "none",
        ":hover": { borderColor: "#556ee6" },
        };
      },
      singleValue: (base) => ({ ...base, color: "#495057", fontWeight: 400 }),
      input: (base) => ({ ...base, color: "#495057" }),
      placeholder: (base) => ({ ...base, color: "#74788d" }),
      menu: (base) => ({ ...base, backgroundColor: "#ffffff", zIndex: 2000, border: "1px solid #d9dce8" }),
      menuPortal: (base) => ({ ...base, zIndex: 3000 }),
      option: (base, state) => {
        return {
        ...base,
        backgroundColor: state.isSelected ? "#556ee6" : state.isFocused ? "#f1f3ff" : "#ffffff",
        color: state.isSelected ? "#ffffff" : "#495057",
        fontWeight: state.isSelected ? 500 : 400,
        };
      },
    }),
    []
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError("");

    const buildPayload = (fv) =>
      fields.reduce((acc, field) => {
        const rawValue = fv[field.key];
        if (
          typeof rawValue === "string" &&
          !field.options &&
          (!field.type || ["text", "textarea", "email", "tel", "search"].includes(field.type))
        ) {
          acc[field.key] = rawValue
            .replace(/\s+/g, " ")
            .replace(/\s*([-_])\s*/g, "$1")
            .trim();
        } else {
          acc[field.key] = rawValue;
        }
        return acc;
      }, {});

    try {
      let fv = { ...formValues };
      let savedRow;

      // Retry loop: on 409 with suggested_revision, confirm + retry automatically.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const payload = buildPayload(fv);
        try {
          if (editRow) {
            savedRow = await updateFn(editRow[rowKey], payload);
          } else {
            savedRow = await createFn(payload);
          }
          break; // success
        } catch (retryErr) {
          const suggested = retryErr.payload?.suggested_revision;
          if (suggested) {
            const confirmMessage =
              retryErr.payload?.confirm_message ||
              `${retryErr.message}\n\nUse revision "${suggested}" instead?`;
            const ok = window.confirm(
              confirmMessage
            );
            if (ok) {
              fv = { ...fv, revision: suggested };
              continue;
            }
          }
          throw retryErr; // re-throw to outer catch
        }
      }

      if (editRow) {
        setRows((prev) => {
          const next = prev.map((r) => (r[rowKey] === editRow[rowKey] ? savedRow : r));
          if (onRowsChange) onRowsChange(next);
          return next;
        });
      } else {
        setRows((prev) => {
          const next = [savedRow, ...prev];
          if (onRowsChange) onRowsChange(next);
          return next;
        });
      }
      closeModal();
    } catch (err) {
      setModalError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleAppendOption = async (field) => {
    if (!field.onAppend) {
      return;
    }

    const raw = window.prompt(`Add new value for ${field.label}`);
    const nextValue = raw ? raw.trim() : "";
    if (!nextValue) {
      return;
    }

    try {
      setError("");
      const normalized = await field.onAppend(nextValue);
      setFormValues((prev) => ({ ...prev, [field.key]: normalized || nextValue }));
    } catch (err) {
      setError(err.message || `Unable to add value for ${field.label}.`);
    }
  };

  const promptDelete = async (id) => {
    const row = rows.find((r) => r[rowKey] === id);
    if (!row) return;

    if (typeof checkDeleteAllowedFn === "function") {
      setDeleteModalState({
        open: true,
        id,
        title: "Checking Dependencies...",
        message: "Verifying connected downstream items...",
        details: [],
        type: "info",
        canDelete: false,
        confirmLabel: null,
        cancelLabel: "Cancel",
        deleting: false,
        loading: true,
      });

      try {
        const result = await checkDeleteAllowedFn(row);
        const allowed = result?.allowed !== false;
        setDeleteModalState({
          open: true,
          id,
          title: result?.title || (allowed ? "Confirm Delete" : "Cannot Delete Record"),
          message:
            result?.message ||
            (allowed
              ? "Are you sure you want to delete this record?"
              : "This record has connected downstream items."),
          details: Array.isArray(result?.details) ? result.details : [],
          type: result?.type || (allowed ? "danger" : "warning"),
          canDelete: allowed,
          confirmLabel: allowed ? (result?.confirmLabel || "Delete") : null,
          cancelLabel: result?.cancelLabel || (allowed ? "Cancel" : "Close"),
          deleting: false,
          loading: false,
        });
      } catch (err) {
        setDeleteModalState({
          open: true,
          id,
          title: "Delete Check Failed",
          message: err.message || "Failed to check downstream dependencies.",
          details: [],
          type: "warning",
          canDelete: false,
          confirmLabel: null,
          cancelLabel: "Close",
          deleting: false,
          loading: false,
        });
      }
      return;
    }

    const confirmMessage =
      typeof deleteConfirmFn === "function" && row
        ? deleteConfirmFn(row)
        : "Are you sure you want to delete this record?";

    setDeleteModalState({
      open: true,
      id,
      title: "Confirm Delete",
      message: confirmMessage,
      details: [],
      type: "danger",
      canDelete: true,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      deleting: false,
      loading: false,
    });
  };

  const handleExecuteDelete = async () => {
    const id = deleteModalState.id;
    if (id == null || !deleteModalState.canDelete) return;
    setDeleteModalState((prev) => ({ ...prev, deleting: true }));
    setError("");
    try {
      await deleteFn(id);
      setRows((prev) => {
        const next = prev.filter((r) => r[rowKey] !== id);
        if (onRowsChange) onRowsChange(next);
        return next;
      });
      setDeleteModalState({
        open: false,
        id: null,
        title: "Confirm Delete",
        message: "",
        details: [],
        type: "danger",
        canDelete: true,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        deleting: false,
        loading: false,
      });
    } catch (err) {
      setError(err.message || "Delete failed.");
      setDeleteModalState({
        open: false,
        id: null,
        title: "Confirm Delete",
        message: "",
        details: [],
        type: "danger",
        canDelete: true,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        deleting: false,
        loading: false,
      });
    }
  };

  const cancelDelete = () => {
    if (deleteModalState.deleting) return;
    setDeleteModalState({
      open: false,
      id: null,
      title: "Confirm Delete",
      message: "",
      details: [],
      type: "danger",
      canDelete: true,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      deleting: false,
      loading: false,
    });
  };

  const handleDelete = promptDelete;

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const displayedRows = useMemo(() => {
    const searchText = String(globalSearch || "").trim().toLowerCase();
    const searchedRows = searchText
      ? normalizedRows.filter((row) =>
          tableColumns.some((col) =>
            String(row[col.key] ?? "").toLowerCase().includes(searchText)
          )
        )
      : normalizedRows;

    const normalizedFilters = Object.entries(filters).filter(([, value]) =>
      String(value || "").trim()
    );

    const filtered = normalizedFilters.length
      ? searchedRows.filter((row) =>
          normalizedFilters.every(([key, value]) =>
            String(row[key] ?? "")
              .toLowerCase()
              .includes(String(value).trim().toLowerCase())
          )
        )
      : searchedRows;

    if (!sortConfig.key) {
      return filtered;
    }

    const toComparable = (value) => {
      if (value === null || value === undefined || value === "") return { t: "empty", v: "" };
      const text = String(value).trim();
      const number = Number(text.replace(/,/g, ""));
      if (!Number.isNaN(number) && text !== "") return { t: "num", v: number };
      const time = Date.parse(text);
      if (!Number.isNaN(time)) return { t: "date", v: time };
      return { t: "str", v: text.toLowerCase() };
    };

    return [...filtered].sort((a, b) => {
      const av = toComparable(a[sortConfig.key]);
      const bv = toComparable(b[sortConfig.key]);
      let cmp = 0;
      if (av.t === bv.t) {
        if (av.v < bv.v) cmp = -1;
        else if (av.v > bv.v) cmp = 1;
      } else {
        cmp = av.t < bv.t ? -1 : 1;
      }
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [normalizedRows, filters, globalSearch, sortConfig, tableColumns]);

  useEffect(() => {
    setPage(1);
  }, [filters, sortConfig]);

  const totalCount = displayedRows.length;
  useEffect(() => {
    if (!enablePagination) return;
    const safePageSize = Math.max(Number(pageSize || 1), 1);
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [enablePagination, page, pageSize, totalCount]);

  const pagedRows = useMemo(() => {
    if (!enablePagination) {
      return displayedRows;
    }
    const safePageSize = Math.max(Number(pageSize || 1), 1);
    const start = (page - 1) * safePageSize;
    return displayedRows.slice(start, start + safePageSize);
  }, [displayedRows, enablePagination, page, pageSize]);

  const handleRowSelection = (id) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRowIds(new Set(pagedRows.map((row) => row[rowKey])));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const allDisplayedSelected =
    pagedRows.length > 0 &&
    pagedRows.every((row) => selectedRowIds.has(row[rowKey]));
  const someDisplayedSelected =
    pagedRows.length > 0 &&
    pagedRows.some((row) => selectedRowIds.has(row[rowKey]));

  const handleExport = async () => {
    setError("");
    setExporting(true);
    try {
      await exportRowsToExcel({
        fileName: exportFileName || title,
        sheetName: title,
        columns: tableColumns,
        rows: pagedRows,
      });
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };


  const saveDisabled =
    typeof saveDisabledPredicate === "function"
      ? saveDisabledPredicate(editRow, formValues)
      : false;

  const hasActionsColumn =
    (rowActions && rowActions.length > 0) || showEditButton || showDeleteButton;

  const effectiveTableMaxHeight = tableMaxHeight || (stickyHeader ? "60vh" : null);
  const titleVariant = getTitleVariant(title);

  return (
    <section className="module-page crud-page">
      <div className="crud-page__header pq-header project-costing-toolbar">
        <div>
          <h1 className="module-page__title project-costing-title">
            <span className="project-costing-title__icon" aria-hidden="true">
              {getTitleIcon(title, titleIcon)}
            </span>
            <span className="project-costing-title__text">{title}</span>
          </h1>
          {description ? (
            <p className="module-page__description project-costing-description" style={{ margin: "0.25rem 0 0 0" }}>
              {description}
            </p>
          ) : null}
        </div>
        <div className="crud-page__header-tools">
          <div className="crud-search-wrap" style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <BsSearch style={{ position: "absolute", left: "0.75rem", color: "#94a3b8", fontSize: "0.82rem", pointerEvents: "none" }} aria-hidden="true" />
            <input
              type="search"
              className="crud-page__search-input"
              style={{ paddingLeft: "2.1rem" }}
              placeholder="Search all columns"
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search all columns"
            />
          </div>
          {renderHeaderActions
            ? renderHeaderActions({ rows, loading, reloadRows })
            : null}
          {enableBulkSelect && selectedRowIds.size > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "#cce8e5" }}>
                {selectedRowIds.size} selected
              </span>
              {onBulkModalOpen ? (
                <button
                  type="button"
                  className="crud-add-btn"
                  onClick={() => onBulkModalOpen(selectedRowIds, reloadRows)}
                  disabled={loading}
                >
                  <span>Bulk Update</span>
                </button>
              ) : null}
            </div>
          ) : null}
          {showExportButton ? (
            <button type="button" className="crud-add-btn" onClick={handleExport} disabled={exporting || loading}>
              <BsDownload aria-hidden="true" />
              <span>{exporting ? "Exporting..." : "Download Excel"}</span>
            </button>
          ) : null}
          {showAddButton ? (
            <button type="button" className="crud-add-btn" onClick={handleAddClick}>
              <BsPlusCircleFill aria-hidden="true" />
              <span>{addButtonLabel || "Add New"}</span>
            </button>
          ) : null}
        </div>
      </div>

      {!showModal && error ? <p className="users-status users-status--error">{error}</p> : null}
      {loading ? <p className="users-status">Loading...</p> : null}

      <div
        className={`users-table-wrap${stickyHeader ? " users-table-wrap--sticky" : ""}${tableWrapClassName ? ` ${tableWrapClassName}` : ""}`}
        style={effectiveTableMaxHeight ? { maxHeight: effectiveTableMaxHeight, overflow: "auto" } : { overflow: "auto" }}
      >
        <table className="users-table">
          <thead>
            <tr>
              {enableBulkSelect ? (
                <th className={stickyHeader ? "users-table__sticky-head" : undefined}>
                  <input
                    type="checkbox"
                    aria-label="Select all displayed rows"
                    checked={allDisplayedSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someDisplayedSelected && !allDisplayedSelected;
                    }}
                    onChange={handleSelectAll}
                  />
                </th>
              ) : null}
                {tableColumns.map((col) => {
                  const effectiveHeaderAlign = col.headerAlign || col.align;
                  return (
                    <th
                      key={col.key}
                      className={stickyHeader ? "users-table__sticky-head" : undefined}
                      style={{
                        textAlign: effectiveHeaderAlign || undefined,
                        ...(col.width ? { width: col.width, minWidth: col.width } : {}),
                      }}
                    >
                      <button
                        type="button"
                        className="users-table__sort-btn"
                        onClick={() => handleSort(col.key)}
                        style={{
                          justifyContent:
                            effectiveHeaderAlign === "center"
                              ? "center"
                              : effectiveHeaderAlign === "right"
                              ? "flex-end"
                              : "space-between",
                          gap: effectiveHeaderAlign === "center" ? "0.4rem" : undefined,
                          textAlign: effectiveHeaderAlign || undefined,
                          width: "100%",
                        }}
                      >
                        <span>{col.label}</span>
                        <span className="users-table__sort-icon">
                          {sortConfig.key === col.key
                            ? sortConfig.direction === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              {hasActionsColumn ? (
                <th
                  className={`${stickyHeader ? "users-table__sticky-head " : ""}users-table__actions-col`}
                  style={{ width: "50px", minWidth: "45px", maxWidth: "55px", textAlign: "center" }}
                >
                  Actions
                </th>
              ) : null}
            </tr>
            <tr>
              {enableBulkSelect ? <th className={stickyHeader ? "users-table__sticky-filter" : undefined} /> : null}
              {tableColumns.map((col) => {
                const effectiveHeaderAlign = col.headerAlign || col.align;
                return (
                  <th
                    key={`filter-${col.key}`}
                    className={stickyHeader ? "users-table__sticky-filter" : undefined}
                    style={{ textAlign: effectiveHeaderAlign || undefined }}
                  >
                    <input
                      className="users-table__filter-input"
                      type="text"
                      placeholder="Filter"
                      value={filters[col.key] ?? ""}
                      onChange={(e) => handleFilterChange(col.key, e.target.value)}
                      style={{ textAlign: effectiveHeaderAlign || undefined }}
                    />
                  </th>
                );
              })}
              {hasActionsColumn ? (
                <th
                  className={`${stickyHeader ? "users-table__sticky-filter " : ""}users-table__actions-col`}
                  style={{ width: "50px", minWidth: "45px", maxWidth: "55px", textAlign: "center" }}
                />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {!loading && pagedRows.length === 0 ? (
              <tr>
                <td colSpan={tableColumns.length + (enableBulkSelect ? 1 : 0) + (hasActionsColumn ? 1 : 0)}>No records found.</td>
              </tr>
            ) : null}
            {pagedRows.map((row) => {
              const editDisabled =
                typeof editDisabledPredicate === "function"
                  ? editDisabledPredicate(row)
                  : false;
              const isRowClickable = enableRowClickEdit && !editDisabled;

              return (
                <tr
                  key={row[rowKey]}
                  className={isRowClickable ? "users-table__row--clickable" : undefined}
                  style={isRowClickable ? { cursor: "pointer" } : undefined}
                  onClick={() => {
                    if (isRowClickable) {
                      handleEditClick(row);
                    }
                  }}
                >
                  {enableBulkSelect ? (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRowIds.has(row[rowKey])}
                        onChange={() => handleRowSelection(row[rowKey])}
                        aria-label={`Select row ${row[rowKey]}`}
                      />
                    </td>
                  ) : null}
                  {tableColumns.map((col) => (
                    <td key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                      {col.render ? col.render(row) : formatDateTimeForTable(row[col.key])}
                    </td>
                  ))}
                  {hasActionsColumn ? (
                    <td
                      className="users-table__actions-col"
                      style={{ width: "50px", minWidth: "45px", maxWidth: "55px", textAlign: "center" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="users-actions">
                        {rowActions.map((action) => {
                          const Icon = action.icon;
                          const isDisabled =
                            typeof action.disabled === "function"
                              ? action.disabled(row)
                              : !!action.disabled;
                          const actionTitle =
                            typeof action.title === "function"
                              ? action.title(row)
                              : (action.title || action.label);
                          return (
                            <button
                              key={action.key || action.label}
                              type="button"
                              className={`users-action ${action.className || ""}`.trim()}
                              aria-label={action.ariaLabel || action.label}
                              title={isDisabled ? (action.disabledTitle || actionTitle) : actionTitle}
                              disabled={isDisabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isDisabled) action.onClick?.(row);
                              }}
                            >
                              {Icon ? <Icon aria-hidden="true" /> : action.label}
                            </button>
                          );
                        })}
                        {showEditButton ? (() => {
                          return (
                            <button
                              type="button"
                              className="users-action users-action--edit"
                              aria-label="Edit"
                              title={editDisabled ? editDisabledTitle : "Edit"}
                              disabled={editDisabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!editDisabled) handleEditClick(row);
                              }}
                            >
                              <BsPencilSquare aria-hidden="true" />
                            </button>
                          );
                        })() : null}
                        {showDeleteButton ? (() => {
                          const deleteDisabled =
                            typeof deleteDisabledPredicate === "function"
                              ? deleteDisabledPredicate(row)
                              : false;
                          return (
                            <button
                              type="button"
                              className="users-action users-action--delete"
                              aria-label="Delete"
                              title={deleteDisabled ? deleteDisabledTitle : "Delete"}
                              disabled={deleteDisabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!deleteDisabled) promptDelete(row[rowKey]);
                              }}
                            >
                              <BsTrashFill aria-hidden="true" />
                            </button>
                          );
                        })() : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {enablePagination ? (
        <PaginationControls
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={pageSizeOptions}
        />
      ) : null}

      {showModal ? (
        <div className="modal-overlay" onClick={closeModal}>
          <div className={`modal-card${modalCardClassName ? ` ${modalCardClassName}` : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__head">
              <h2 className="modal-card__title">
                {editRow ? `Edit ${title}` : `Add ${title}`}
              </h2>
              <button
                type="button"
                className="modal-card__close"
                aria-label="Close"
                onClick={closeModal}
              >
                <BsXCircle aria-hidden="true" />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSave}>
              {modalError ? <p className="users-status users-status--error">{modalError}</p> : null}
              {fields.map((field) => (
                <div className="modal-form__row" key={field.key}>
                  <label className="modal-form__label" htmlFor={`mf-${field.key}`}>
                    {field.label}
                    {isFieldRequired(field) ? " *" : ""}
                  </label>

                  {(() => {
                    const resolvedOptions = typeof field.options === "function"
                      ? field.options(formValues)
                      : field.options;
                    const resolvedPlaceholder = typeof field.placeholder === "function"
                      ? field.placeholder(formValues)
                      : field.placeholder;

                  return resolvedOptions ? (
                    <div className="modal-select-row">
                      <Select
                        inputId={`mf-${field.key}`}
                        className="crud-select"
                        classNamePrefix="crud-select"
                        isSearchable
                        isClearable={field.isClearable !== false}
                        isDisabled={field.disabled}
                        filterOption={field.filterOption}
                        options={resolvedOptions}
                        placeholder={resolvedPlaceholder || `Select ${field.label}`}
                        value={(() => {
                          const current = String(formValues[field.key] ?? "").trim();
                          if (!current) return null;

                          // Support edit values coming as labels while options use IDs.
                          return (
                            resolvedOptions.find((opt) => String(opt.value) === current) ||
                            resolvedOptions.find(
                              (opt) => String(opt.label || "").trim().toLowerCase() === current.toLowerCase()
                            ) ||
                            null
                          );
                        })()}
                        onChange={(option) =>
                          field.disabled ? undefined : handleFieldChange(field.key, option ? option.value : "")
                        }
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        menuPosition="fixed"
                        styles={selectStyles}
                      />

                      {/* keep native required validation via hidden input */}
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={formValues[field.key] ?? ""}
                        onChange={() => {}}
                        required={isFieldRequired(field)}
                        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
                      />

                      {field.onAppend ? (
                        <button
                          type="button"
                          className="modal-add-option"
                          onClick={() => handleAppendOption(field)}
                        >
                          + Add
                        </button>
                      ) : null}
                    </div>
                  ) : field.type === "textarea" ? (
                    <textarea
                      id={`mf-${field.key}`}
                      name={field.key}
                      className="auth-input modal-form__textarea"
                      value={formValues[field.key] ?? ""}
                      onChange={handleChange}
                      required={isFieldRequired(field)}
                      readOnly={isFieldReadOnly(field)}
                    />
                  ) : (
                    <input
                      id={`mf-${field.key}`}
                      name={field.key}
                      type={field.type || "text"}
                      className={`auth-input${(isFieldReadOnly(field) || field.disabled) ? " auth-input--readonly" : ""}`}
                      value={formValues[field.key] ?? ""}
                      onChange={(!isFieldReadOnly(field) && !field.disabled) ? handleChange : undefined}
                      readOnly={isFieldReadOnly(field)}
                      disabled={field.disabled}
                      required={isFieldRequired(field)}
                      {...(field.min !== undefined ? { min: field.min } : {})}
                      {...(field.max !== undefined ? { max: field.max } : {})}
                      {...(field.step !== undefined ? { step: field.step } : {})}
                    />
                  );
                  })()}
                </div>
              ))}

              {renderFormExtension
                ? renderFormExtension({
                    editRow,
                    formValues,
                    setFormValues,
                  })
                : null}

              <div className="modal-form__actions">
                <button
                  type="button"
                  className="modal-btn modal-btn--cancel"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn modal-btn--save"
                  title={saveDisabled ? saveDisabledTitle : "Save"}
                  disabled={saving || saveDisabled}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {renderFooter ? renderFooter() : null}

      <ConfirmPopupModal
        open={deleteModalState.open}
        title={deleteModalState.title || "Confirm Delete"}
        type={deleteModalState.type || "danger"}
        message={deleteModalState.message}
        confirmLabel={
          deleteModalState.canDelete
            ? deleteModalState.deleting
              ? "Deleting..."
              : deleteModalState.confirmLabel || "Delete"
            : null
        }
        cancelLabel={deleteModalState.cancelLabel || (deleteModalState.canDelete ? "Cancel" : "Close")}
        confirmDisabled={deleteModalState.deleting || !deleteModalState.canDelete || deleteModalState.loading}
        cancelDisabled={deleteModalState.deleting}
        onConfirm={handleExecuteDelete}
        onCancel={cancelDelete}
      >
        {deleteModalState.details && deleteModalState.details.length > 0 ? (
          <div
            style={{
              marginTop: "0.85rem",
              padding: "0.75rem 1rem",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "#9f1239",
                marginBottom: "0.35rem",
              }}
            >
              Connected Downstream Items:
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.25rem",
                fontSize: "0.82rem",
                color: "#be123c",
                lineHeight: "1.5",
              }}
            >
              {deleteModalState.details.map((item, idx) => (
                <li key={idx}>
                  <strong>{item}</strong>
                </li>
              ))}
            </ul>
            <div
              style={{
                marginTop: "0.5rem",
                fontSize: "0.78rem",
                color: "#881337",
                fontWeight: 500,
              }}
            >
              Please delete, unlink, or reassign all connected downstream items before deleting this record.
            </div>
          </div>
        ) : null}
      </ConfirmPopupModal>
    </section>
  );
}

export default CrudPage;
