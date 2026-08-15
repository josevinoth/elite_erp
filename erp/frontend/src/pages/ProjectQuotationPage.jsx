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
  createQuotationItem,
  createQuotationSummary,
  deleteQuotationItem,
  deleteQuotationSummary,
  getItemCostPreview,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listQuotationItems,
  listQuotationSummaries,
  updateQuotationItem,
  updateQuotationSummary,
} from "../services/crudApi";

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

const buildDraftItem = (materialCostTypeId) => ({
  cost_type_id: materialCostTypeId ? String(materialCostTypeId) : "",
  level: "0",
  item_category_id: "",
  item_name: "",
  item_code_id: "",
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
  "loading_unloading",
  "installation",
  "business_development",
  "markup",
];

const SUMMARY_READONLY_FIELDS = [
  "quotation_number",
  "project_id",
  "project_name",
  "total_material_cost",
  "final_material_cost",
  "total_cost_to_elite",
  "total_markup",
  "planned_order_value",
  "discount",
  "undiscounted_quote_value",
  "factor",
];

function ProjectQuotationPage({ projectId = null, embedded = false }) {
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
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [draftRow, setDraftRow] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [savingSummary, setSavingSummary] = useState(false);
  const [savingRow, setSavingRow] = useState(false);

  const itemMasterRef = useRef([]);

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
      return;
    }

    const data = await listQuotationItems(quotationId);
    setItems(Array.isArray(data.items) ? data.items : []);
  }, []);

  const ensureEmbeddedSummary = useCallback(async (summaryRows) => {
    if (!embedded || !projectId) return "";

    const matching = (summaryRows || []).find((row) => String(row.project_id) === String(projectId));
    if (matching) {
      return String(matching.id);
    }

    const created = await createQuotationSummary({ project_id: projectId });
    const createdId = String(created?.quotation?.id || "");
    return createdId;
  }, [embedded, projectId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const activeProjectId = embedded && projectId ? projectId : null;
      const [summaryData, categoryData, itemData] = await Promise.all([
        listQuotationSummaries(activeProjectId),
        listLabFurnitureItemCategories(),
        listLabFurnitureItems(),
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
        }
      } else {
        setSummary(null);
        setItems([]);
      }
    } catch (error) {
      showStatus(error.message || "Failed to load quotations.", "error");
      setQuotations([]);
      setSummary(null);
      setItems([]);
      setCostTypes([]);
      setCategoryOptions([]);
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
    }
  }, [embedded, loadItemsForSummary, projectId]);

  const patchSummary = useCallback((field, value) => {
    setSummary((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const saveSummary = useCallback(async () => {
    if (!summary?.id) return;
    setSavingSummary(true);
    clearStatus();
    try {
      const payload = {};
      SUMMARY_EDITABLE_FIELDS.forEach((field) => {
        payload[field] = summary[field] ?? 0;
      });
      const response = await updateQuotationSummary(summary.id, payload);
      setSummary(response.quotation || summary);
      showStatus("Quotation summary updated successfully.");
      await refreshSelectedSummary(summary.id);
    } catch (error) {
      showStatus(error.message || "Failed to update quotation summary.", "error");
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
        requested_qty: "0",
        max_cost: "0",
        min_cost: "0",
        actual_cost: "0",
        total_cost: "0",
        ...emptyDimensions,
      });
      return;
    }

    const quantity = String(master.available_qty ?? "0");
    applyPatch({
      item_category_id: String(master.item_category_id || ""),
      item_name: master.item_name || "",
      item_code_id: String(master.id),
      requested_qty: quantity,
      length: String(master.length ?? "0"),
      width: String(master.width ?? "0"),
      height: String(master.height ?? "0"),
      volume: String(master.volume ?? "0"),
    });

    try {
      const preview = await getItemCostPreview(master.item_code, 1);
      const previewCost = String(preview?.cost ?? "0");
      applyPatch({ max_cost: previewCost, min_cost: previewCost, actual_cost: previewCost });
    } catch (_error) {
      applyPatch({ max_cost: "0", min_cost: "0", actual_cost: "0" });
    }
  }, [getMasterById]);

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
      level: String(row.level ?? "0"),
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
    if (!normalizeText(row.cost_type_id)) return "Cost type is required.";
    if (toNumber(row.level) < 0) return "Level must be 0 or greater.";
    if (toNumber(row.requested_qty) < 0) return "Requested Qty must be 0 or greater.";
    if (toNumber(row.purchase_qty) < 0) return "Purchase Qty must be 0 or greater.";
    if (toNumber(row.actual_cost) < 0) return "Actual cost must be 0 or greater.";

    if (isMaterialCostType(row.cost_type_id)) {
      if (!normalizeText(row.item_category_id)) return "Item category is required for MATERIAL.";
      if (!normalizeText(row.item_name)) return "Item name is required for MATERIAL.";
      if (!normalizeText(row.item_code_id)) return "Item code is required for MATERIAL.";
    }

    return "";
  }, [isMaterialCostType]);

  const buildItemPayload = useCallback((row) => ({
    cost_type_id: row.cost_type_id,
    level: Number(row.level || 0),
    item_category_id: isMaterialCostType(row.cost_type_id) ? row.item_category_id || null : null,
    item_name: isMaterialCostType(row.cost_type_id) ? row.item_name : "",
    item_code_id: isMaterialCostType(row.cost_type_id) ? row.item_code_id || null : null,
    requested_qty: row.requested_qty || "0",
    purchase_qty: row.purchase_qty || "0",
    actual_cost: row.actual_cost || "0",
  }), [isMaterialCostType]);

  const saveDraftItem = useCallback(async () => {
    if (!summary?.id || !draftRow) return;
    const message = validateItemRow(draftRow);
    if (message) {
      showStatus(message, "error");
      return;
    }

    setSavingRow(true);
    clearStatus();
    try {
      await createQuotationItem(summary.id, buildItemPayload(draftRow));
      setDraftRow(null);
      await refreshSelectedSummary(summary.id);
      showStatus("Quotation item added successfully.");
    } catch (error) {
      const text = error.message || "Failed to add quotation item.";
      showStatus(text, "error");
      window.alert(text);
    } finally {
      setSavingRow(false);
    }
  }, [buildItemPayload, clearStatus, draftRow, refreshSelectedSummary, showStatus, summary, validateItemRow]);

  const saveEditedItem = useCallback(async () => {
    if (!summary?.id || !editingItemId || !editingRow) return;
    const message = validateItemRow(editingRow);
    if (message) {
      showStatus(message, "error");
      return;
    }

    setSavingRow(true);
    clearStatus();
    try {
      await updateQuotationItem(summary.id, editingItemId, buildItemPayload(editingRow));
      setEditingItemId(null);
      setEditingRow(null);
      await refreshSelectedSummary(summary.id);
      showStatus("Quotation item updated successfully.");
    } catch (error) {
      const text = error.message || "Failed to update quotation item.";
      showStatus(text, "error");
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
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        {[...SUMMARY_READONLY_FIELDS, ...SUMMARY_EDITABLE_FIELDS].map((field) => {
          const readOnly = SUMMARY_READONLY_FIELDS.includes(field);
          return (
            <label key={field} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <span style={{ fontSize: "0.83rem", color: "#334155", textTransform: "capitalize" }}>{field.replaceAll("_", " ")}</span>
              <input
                className={`auth-input${readOnly ? " auth-input--readonly" : ""}`}
                value={summary[field] ?? ""}
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
          <select className="auth-input" value={row.cost_type_id} disabled={disabled} onChange={(event) => patchFn({ cost_type_id: event.target.value })}>
            <option value="">Select cost type</option>
            {costTypes.map((option) => (
              <option key={option.id} value={String(option.id)}>{option.name}</option>
            ))}
          </select>
        </td>
        <td><input className="auth-input" type="number" min="0" step="1" value={row.level} disabled={disabled} onChange={(event) => patchFn({ level: event.target.value })} /></td>
        <td>
          <select
            className="auth-input"
            value={row.item_category_id}
            disabled={disabled || !material}
            onChange={(event) => patchFn({ item_category_id: event.target.value, item_name: "", item_code_id: "", ...emptyDimensions })}
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
            onChange={(event) => patchFn({ item_name: event.target.value, item_code_id: "", ...emptyDimensions })}
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
        <td><input className="auth-input auth-input--readonly" value={row.requested_qty} readOnly disabled /></td>
        <td><input className="auth-input" type="number" min="0" step="any" value={row.purchase_qty} disabled={disabled} onChange={(event) => patchFn({ purchase_qty: event.target.value })} /></td>
        <td><input className="auth-input auth-input--readonly" value={row.max_cost} readOnly disabled /></td>
        <td><input className="auth-input auth-input--readonly" value={row.min_cost} readOnly disabled /></td>
        <td><input className="auth-input" type="number" min="0" step="any" value={row.actual_cost} disabled={disabled} onChange={(event) => patchFn({ actual_cost: event.target.value })} /></td>
        <td><input className="auth-input auth-input--readonly" value={toMoney(toNumber(row.requested_qty) * toNumber(row.actual_cost))} readOnly disabled /></td>
        <td><input className="auth-input auth-input--readonly" value={row.length} readOnly disabled /></td>
        <td><input className="auth-input auth-input--readonly" value={row.width} readOnly disabled /></td>
        <td><input className="auth-input auth-input--readonly" value={row.height} readOnly disabled /></td>
        <td><input className="auth-input auth-input--readonly" value={row.volume} readOnly disabled /></td>
      </>
    );
  };

  return (
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <div>
          <h1 className="module-page__title" style={{ margin: 0 }}>{embedded ? "Quotation" : "Project Quotation"}</h1>
          <p className="module-page__description" style={{ marginTop: "0.35rem" }}>
            Manage quotation summary constants with linked item-level costing in one accordion flow.
          </p>
        </div>
        {!embedded ? (
          <button
            type="button"
            className="crud-add-btn"
            onClick={() => (selectedQuotationId ? setSearchParams({}) : navigate("/projects"))}
          >
            {selectedQuotationId ? "Back to Quotation List" : "Back to Projects"}
          </button>
        ) : null}
      </div>

      {status.message ? (
        <p className={`users-status${status.type === "error" ? " users-status--error" : " users-status--success"}`}>
          {status.message}
        </p>
      ) : null}

      {loading ? <p className="users-status">Loading quotations...</p> : null}

      {!loading && !embedded && !selectedQuotationId ? (
        <div className="users-table-wrap" style={{ overflowX: "auto", marginBottom: "1rem" }}>
          <table className="users-table">
            <thead>
              <tr>
                <th>Quotation Number</th>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Total Quotation Cost</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b", padding: "1rem" }}>
                    No quotations found.
                  </td>
                </tr>
              ) : quotations.map((row) => (
                <tr key={row.id}>
                  <td style={{ cursor: "pointer" }} onClick={() => openSummary(row.id)}>{row.quotation_number || "Auto"}</td>
                  <td>{row.project_code || row.project_id}</td>
                  <td>{row.project_name || "-"}</td>
                  <td style={{ textAlign: "right" }}>{row.total_quotation_cost}</td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "inline-flex", gap: "0.35rem" }}>
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
        <details open className="costing-selector-details" style={{ background: "#fff", border: "1px solid #d9dee8", borderRadius: "10px", marginBottom: "1rem" }}>
          <summary className="auth-input costing-selector-summary" style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", padding: "0.9rem 1rem", border: "none" }}>
            <span style={{ fontWeight: 700 }}>{summary.quotation_number || "Auto"} - {summary.project_name || "Project"}</span>
            <span style={{ color: "#475569", fontSize: "0.92rem" }}>Total OMR {toMoney(summary.total_quotation_cost || summary.total_cost_to_elite)}</span>
          </summary>

          <div style={{ padding: "0 1rem 1rem" }}>
            {renderSummaryGrid()}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
              <button type="button" className="crud-add-btn" onClick={saveSummary} disabled={savingSummary}>
                {savingSummary ? "Saving..." : "Save Summary"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <strong>Quotation Items</strong>
              {!draftRow ? (
                <button type="button" className="crud-add-btn" onClick={startAdd}>
                  <BsPlusCircleFill aria-hidden="true" /> Add Item
                </button>
              ) : null}
            </div>

            <div className="users-table-wrap users-table-wrap--fit" style={{ overflowX: "auto" }}>
              <table className="users-table users-table--quotation" style={{ tableLayout: "auto", width: "max-content", minWidth: "100%" }}>
                <thead>
                  <tr>
                    <th>Cost Type</th>
                    <th>Level</th>
                    <th>Item Category</th>
                    <th>Item Name</th>
                    <th>Item Code</th>
                    <th>Requested Qty</th>
                    <th>Purchase Qty</th>
                    <th>Max Cost</th>
                    <th>Min Cost</th>
                    <th>Actual Cost</th>
                    <th>Total Cost</th>
                    <th>Length</th>
                    <th>Width</th>
                    <th>Height</th>
                    <th>Volume</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {draftRow ? (
                    <tr>
                      {renderItemEditorCells(draftRow, patchDraftRow, savingRow)}
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: "0.35rem" }}>
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
                      <td colSpan={16} style={{ textAlign: "center", color: "#64748b", padding: "1rem" }}>No quotation items yet.</td>
                    </tr>
                  ) : items.map((row) => {
                    const inEditMode = editingItemId === row.id && editingRow;
                    return (
                      <tr key={row.id}>
                        {inEditMode ? (
                          <>
                            {renderItemEditorCells(editingRow, patchEditingRow, savingRow)}
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "inline-flex", gap: "0.35rem" }}>
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
                            <td>{row.cost_type || "-"}</td>
                            <td style={{ textAlign: "center" }}>{row.level}</td>
                            <td>{row.item_category || "-"}</td>
                            <td>{row.item_name || "-"}</td>
                            <td>{row.item_code || "-"}</td>
                            <td style={{ textAlign: "right" }}>{row.requested_qty}</td>
                            <td style={{ textAlign: "right" }}>{row.purchase_qty}</td>
                            <td style={{ textAlign: "right" }}>{row.max_cost}</td>
                            <td style={{ textAlign: "right" }}>{row.min_cost}</td>
                            <td style={{ textAlign: "right" }}>{row.actual_cost}</td>
                            <td style={{ textAlign: "right" }}>{row.total_cost}</td>
                            <td style={{ textAlign: "right" }}>{row.length}</td>
                            <td style={{ textAlign: "right" }}>{row.width}</td>
                            <td style={{ textAlign: "right" }}>{row.height}</td>
                            <td style={{ textAlign: "right" }}>{row.volume}</td>
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "inline-flex", gap: "0.35rem" }}>
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
    </section>
  );
}

export default ProjectQuotationPage;

