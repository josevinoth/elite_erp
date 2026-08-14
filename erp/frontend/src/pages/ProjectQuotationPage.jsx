import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BsCheckCircleFill,
  BsPencilSquare,
  BsPlusCircleFill,
  BsTrashFill,
  BsXCircleFill,
} from "react-icons/bs";
import {
  createProjectQuotationItem,
  deleteProjectQuotationItem,
  getItemCostPreview,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listProjectQuotations,
  updateProjectQuotationItem,
} from "../services/crudApi";

const MATERIAL_NAME = "MATERIAL";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toMoney = (value, decimals = 3) => (Math.round((toNumber(value) + Number.EPSILON) * (10 ** decimals)) / (10 ** decimals)).toFixed(decimals);

const normalizeText = (value) => String(value || "").trim();

const calcRow = (row) => ({
  ...row,
  total_cost: toMoney(toNumber(row.requested_qty) * toNumber(row.cost_per_qty)),
});

const createDraft = (projectId, materialCostTypeId) => calcRow({
  project_id: String(projectId || ""),
  cost_type_id: materialCostTypeId ? String(materialCostTypeId) : "",
  level: "0",
  item_category_id: "",
  item_name: "",
  item_code_id: "",
  item_code: "",
  requested_qty: "0",
  purchase_qty: "0",
  cost_per_qty: "0",
  total_cost: "0.000",
});

const flattenHierarchy = (nodes = [], bucket = []) => {
  nodes.forEach((node) => {
    bucket.push(node);
    flattenHierarchy(node.children || [], bucket);
  });
  return bucket;
};

function QuotationTableHead({ includeActions = true }) {
  return (
    <thead>
      <tr>
        <th style={{ minWidth: "180px" }}>Cost Type</th>
        <th style={{ minWidth: "90px" }}>Level</th>
        <th style={{ minWidth: "180px" }}>Item Category</th>
        <th style={{ minWidth: "240px" }}>Item Name</th>
        <th style={{ minWidth: "160px" }}>Item Code</th>
        <th style={{ minWidth: "130px" }}>Requested Qty</th>
        <th style={{ minWidth: "130px" }}>Purchase Qty</th>
        <th style={{ minWidth: "140px" }}>Cost per Qty</th>
        <th style={{ minWidth: "140px" }}>Total Cost</th>
        {includeActions ? <th style={{ minWidth: "120px", textAlign: "center" }}>Action</th> : null}
      </tr>
    </thead>
  );
}

function ProjectQuotationPage() {
  const [projects, setProjects] = useState([]);
  const [costTypes, setCostTypes] = useState([]);
  const [materialCostTypeId, setMaterialCostTypeId] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [draftProjectId, setDraftProjectId] = useState(null);
  const [draftRow, setDraftRow] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const itemMasterRef = useRef([]);

  const showStatus = useCallback((message, type = "success") => {
    setStatus({ message, type });
  }, []);

  const clearStatus = useCallback(() => {
    setStatus({ message: "", type: "" });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [quotationData, categoryData, itemData] = await Promise.all([
        listProjectQuotations(),
        listLabFurnitureItemCategories(),
        listLabFurnitureItems(),
      ]);
      setProjects(Array.isArray(quotationData.projects) ? quotationData.projects : []);
      setCostTypes(Array.isArray(quotationData.cost_types) ? quotationData.cost_types : []);
      setMaterialCostTypeId(quotationData.material_cost_type_id || null);
      setCategoryOptions(Array.isArray(categoryData.item_categories) ? categoryData.item_categories : []);
      itemMasterRef.current = Array.isArray(itemData.lab_furniture_items) ? itemData.lab_furniture_items : [];
    } catch (error) {
      showStatus(error.message || "Failed to load project quotations.", "error");
      setProjects([]);
      setCostTypes([]);
      setCategoryOptions([]);
      itemMasterRef.current = [];
    } finally {
      setLoading(false);
    }
  }, [showStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const getNamesForCategory = useCallback((categoryId) => {
    const names = itemMasterRef.current
      .filter((item) => String(item.item_category_id || "") === String(categoryId || ""))
      .map((item) => item.item_name)
      .filter(Boolean);
    return Array.from(new Set(names)).sort((left, right) => left.localeCompare(right));
  }, []);

  const getCodesForSelection = useCallback((categoryId, itemName) => itemMasterRef.current
    .filter((item) => String(item.item_category_id || "") === String(categoryId || ""))
    .filter((item) => String(item.item_name || "").trim().toLowerCase() === String(itemName || "").trim().toLowerCase())
    .sort((left, right) => String(left.item_code || "").localeCompare(String(right.item_code || ""))), []);

  const getMasterById = useCallback((itemId) => itemMasterRef.current.find((item) => String(item.id) === String(itemId || "")) || null, []);

  const hydrateExistingRow = useCallback((item) => calcRow({
    project_id: String(item.project_id || ""),
    cost_type_id: String(item.cost_type_id || ""),
    level: String(item.level ?? 0),
    item_category_id: String(item.item_category_id || ""),
    item_name: String(item.item_name || ""),
    item_code_id: String(item.item_code_id || ""),
    item_code: String(item.item_code || ""),
    requested_qty: String(item.requested_qty ?? "0"),
    purchase_qty: String(item.purchase_qty ?? "0"),
    cost_per_qty: String(item.cost_per_qty ?? "0"),
    total_cost: String(item.total_cost ?? "0"),
  }), []);

  const patchDraft = useCallback((patch) => {
    setDraftRow((previous) => (previous ? calcRow({ ...previous, ...patch }) : previous));
  }, []);

  const patchEdit = useCallback((patch) => {
    setEditRow((previous) => (previous ? calcRow({ ...previous, ...patch }) : previous));
  }, []);

  const syncCostFromItemCode = useCallback(async (itemCodeId, applyPatch) => {
    const master = getMasterById(itemCodeId);
    if (!master?.item_code) {
      applyPatch({ cost_per_qty: "0" });
      return;
    }

    try {
      const preview = await getItemCostPreview(master.item_code, 1);
      applyPatch({ cost_per_qty: String(preview?.cost ?? "0") });
    } catch (_error) {
      applyPatch({ cost_per_qty: "0" });
      showStatus("Cost per Qty defaulted to 0 because no stock cost preview was found.", "error");
    }
  }, [getMasterById, showStatus]);

  const applyMaterialSelection = useCallback(async (itemCodeId, applyPatch) => {
    const master = getMasterById(itemCodeId);
    if (!master) {
      applyPatch({ item_code_id: "", item_code: "", cost_per_qty: "0" });
      return;
    }

    applyPatch({
      item_category_id: String(master.item_category_id || ""),
      item_name: master.item_name || "",
      item_code_id: String(master.id),
      item_code: master.item_code || "",
    });
    await syncCostFromItemCode(master.id, applyPatch);
  }, [getMasterById, syncCostFromItemCode]);

  const resetMaterialFields = useCallback((applyPatch) => {
    applyPatch({
      item_category_id: "",
      item_name: "",
      item_code_id: "",
      item_code: "",
      cost_per_qty: "0",
    });
  }, []);

  const handleDraftCostTypeChange = async (value) => {
    const material = isMaterialCostType(value);
    if (!material) {
      setDraftRow((previous) => (previous ? calcRow({
        ...previous,
        cost_type_id: value,
        item_category_id: "",
        item_name: "",
        item_code_id: "",
        item_code: "",
      }) : previous));
      return;
    }
    patchDraft({ cost_type_id: value });
  };

  const handleEditCostTypeChange = async (value) => {
    const material = isMaterialCostType(value);
    if (!material) {
      setEditRow((previous) => (previous ? calcRow({
        ...previous,
        cost_type_id: value,
        item_category_id: "",
        item_name: "",
        item_code_id: "",
        item_code: "",
      }) : previous));
      return;
    }
    patchEdit({ cost_type_id: value });
  };

  const startAdd = useCallback((projectId) => {
    clearStatus();
    setEditingItemId(null);
    setEditingProjectId(null);
    setEditRow(null);
    setDraftProjectId(projectId);
    setDraftRow(createDraft(projectId, materialCostTypeId));
  }, [clearStatus, materialCostTypeId]);

  const cancelAdd = useCallback(() => {
    setDraftProjectId(null);
    setDraftRow(null);
  }, []);

  const startEdit = useCallback((projectId, item) => {
    clearStatus();
    setDraftProjectId(null);
    setDraftRow(null);
    setEditingProjectId(projectId);
    setEditingItemId(item.id);
    setEditRow(hydrateExistingRow(item));
  }, [clearStatus, hydrateExistingRow]);

  const cancelEdit = useCallback(() => {
    setEditingProjectId(null);
    setEditingItemId(null);
    setEditRow(null);
  }, []);

  const validateClientRow = useCallback((row) => {
    if (!normalizeText(row.cost_type_id)) return "Cost Type is required.";
    if (!/^\d+$/.test(String(row.level || ""))) return "Level must be a whole number 0 or greater.";
    if (toNumber(row.level) < 0) return "Level must be 0 or greater.";
    if (toNumber(row.requested_qty) < 0) return "Requested Qty must be 0 or greater.";
    if (toNumber(row.purchase_qty) < 0) return "Purchase Qty must be 0 or greater.";
    if (toNumber(row.cost_per_qty) < 0) return "Cost per Qty must be 0 or greater.";
    if (isMaterialCostType(row.cost_type_id)) {
      if (!normalizeText(row.item_category_id)) return "Item Category is required for MATERIAL.";
      if (!normalizeText(row.item_name)) return "Item Name is required for MATERIAL.";
      if (!normalizeText(row.item_code_id)) return "Item Code is required for MATERIAL.";
    }
    return "";
  }, [isMaterialCostType]);

  const shouldConfirmPurchaseQty = useCallback((row) => (
    toNumber(row.requested_qty) < toNumber(row.purchase_qty)
  ), []);

  const buildPayload = useCallback((row) => ({
    project_id: row.project_id,
    cost_type_id: row.cost_type_id,
    level: Number(row.level || 0),
    item_category_id: isMaterialCostType(row.cost_type_id) ? (row.item_category_id || null) : null,
    item_name: isMaterialCostType(row.cost_type_id) ? row.item_name : "",
    item_code_id: isMaterialCostType(row.cost_type_id) ? (row.item_code_id || null) : null,
    requested_qty: row.requested_qty || "0",
    purchase_qty: row.purchase_qty || "0",
    cost_per_qty: row.cost_per_qty || "0",
  }), [isMaterialCostType]);

  const saveDraft = useCallback(async () => {
    if (!draftRow) return;
    const error = validateClientRow(draftRow);
    if (error) {
      showStatus(error, "error");
      return;
    }
    if (shouldConfirmPurchaseQty(draftRow) && !window.confirm("Requested Qty is less than Purchase Qty. Do you want to continue adding this item?")) {
      return;
    }

    setSavingDraft(true);
    clearStatus();
    try {
      await createProjectQuotationItem(buildPayload(draftRow));
      showStatus("Project quotation item added successfully.");
      cancelAdd();
      await loadData();
    } catch (errorResponse) {
      const message = errorResponse.message || "Failed to add project quotation item.";
      showStatus(message, "error");
      window.alert(message);
    } finally {
      setSavingDraft(false);
    }
  }, [buildPayload, cancelAdd, clearStatus, draftRow, loadData, shouldConfirmPurchaseQty, showStatus, validateClientRow]);

  const saveEdit = useCallback(async () => {
    if (!editRow || !editingItemId) return;
    const error = validateClientRow(editRow);
    if (error) {
      showStatus(error, "error");
      return;
    }
    if (shouldConfirmPurchaseQty(editRow) && !window.confirm("Requested Qty is less than Purchase Qty. Do you want to continue updating this item?")) {
      return;
    }

    setSavingEdit(true);
    clearStatus();
    try {
      await updateProjectQuotationItem(editingItemId, buildPayload(editRow));
      showStatus("Project quotation item updated successfully.");
      cancelEdit();
      await loadData();
    } catch (errorResponse) {
      const message = errorResponse.message || "Failed to update project quotation item.";
      showStatus(message, "error");
      window.alert(message);
    } finally {
      setSavingEdit(false);
    }
  }, [buildPayload, cancelEdit, clearStatus, editRow, editingItemId, loadData, shouldConfirmPurchaseQty, showStatus, validateClientRow]);

  const handleDelete = useCallback(async (itemId) => {
    if (!window.confirm("Delete this quotation item?")) return;
    clearStatus();
    try {
      await deleteProjectQuotationItem(itemId);
      showStatus("Project quotation item deleted.");
      await loadData();
    } catch (error) {
      const message = error.message || "Failed to delete project quotation item.";
      showStatus(message, "error");
      window.alert(message);
    }
  }, [clearStatus, loadData, showStatus]);

  const renderEditorRow = (row, onPatch, onCostTypeChange, disabled) => {
    const material = isMaterialCostType(row.cost_type_id);
    const itemNames = material ? getNamesForCategory(row.item_category_id) : [];
    const itemCodes = material ? getCodesForSelection(row.item_category_id, row.item_name) : [];

    return (
      <>
        <td>
          <select
            className="auth-input"
            value={row.cost_type_id}
            onChange={(event) => onCostTypeChange(event.target.value)}
            disabled={disabled}
          >
            <option value="">Select cost type</option>
            {costTypes.map((option) => (
              <option key={option.id} value={String(option.id)}>{option.name}</option>
            ))}
          </select>
        </td>
        <td>
          <input
            type="number"
            min="0"
            step="1"
            className="auth-input"
            value={row.level}
            onChange={(event) => onPatch({ level: event.target.value })}
            disabled={disabled}
          />
        </td>
        <td>
          <select
            className="auth-input"
            value={row.item_category_id}
            onChange={(event) => onPatch({ item_category_id: event.target.value, item_name: "", item_code_id: "", item_code: "", cost_per_qty: material ? row.cost_per_qty : "0" })}
            disabled={disabled || !material}
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
            onChange={async (event) => {
              const nextItemName = event.target.value;
              const matchingCodes = getCodesForSelection(row.item_category_id, nextItemName);
              onPatch({ item_name: nextItemName, item_code_id: "", item_code: "", cost_per_qty: "0" });
              if (matchingCodes.length === 1) {
                await applyMaterialSelection(matchingCodes[0].id, onPatch);
              }
            }}
            disabled={disabled || !material || !row.item_category_id}
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
            onChange={async (event) => {
              await applyMaterialSelection(event.target.value, onPatch);
            }}
            disabled={disabled || !material || !row.item_name}
          >
            <option value="">Select item code</option>
            {itemCodes.map((option) => (
              <option key={option.id} value={String(option.id)}>{option.item_code}</option>
            ))}
          </select>
        </td>
        <td>
          <input
            type="number"
            min="0"
            step="any"
            className="auth-input"
            value={row.requested_qty}
            onChange={(event) => onPatch({ requested_qty: event.target.value })}
            disabled={disabled}
          />
        </td>
        <td>
          <input
            type="number"
            min="0"
            step="any"
            className="auth-input"
            value={row.purchase_qty}
            onChange={(event) => onPatch({ purchase_qty: event.target.value })}
            disabled={disabled}
          />
        </td>
        <td>
          <input
            type="number"
            min="0"
            step="any"
            className="auth-input"
            value={row.cost_per_qty}
            onChange={(event) => onPatch({ cost_per_qty: event.target.value })}
            disabled={disabled}
          />
        </td>
        <td>
          <input className="auth-input auth-input--readonly" value={row.total_cost} readOnly disabled />
        </td>
      </>
    );
  };

  return (
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <div>
          <h1 className="module-page__title" style={{ margin: 0 }}>Project Quotation</h1>
          <p className="module-page__description" style={{ marginTop: "0.35rem" }}>
            Prepare project quotations with BOM level hierarchy, cost type routing, and item-linked material costing.
          </p>
        </div>
      </div>

      {status.message ? (
        <p
          className={`users-status${status.type === "error" ? " users-status--error" : " users-status--success"}`}
          style={status.type === "error" ? { whiteSpace: "pre-wrap" } : undefined}
        >
          {status.message}
        </p>
      ) : null}

      {loading ? <p className="users-status">Loading project quotations...</p> : null}

      {!loading && projects.length === 0 ? (
        <p className="users-status">No projects found.</p>
      ) : null}

      {!loading ? projects.map((project) => {
        const projectId = project.project_id;
        const flattenedRows = flattenHierarchy(project.bom_hierarchy || [], []);
        const addMode = String(draftProjectId || "") === String(projectId);

        return (
          <details
            key={projectId}
            className="costing-selector-details"
            style={{ background: "#fff", border: "1px solid #d9dee8", borderRadius: "10px", marginBottom: "1rem" }}
          >
            <summary
              className="auth-input costing-selector-summary"
              style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", padding: "0.9rem 1rem", border: "none" }}
            >
              <span style={{ fontWeight: 700 }}>{project.project_code || `Project ${projectId}`} {project.project_name ? `- ${project.project_name}` : ""}</span>
              <span style={{ color: "#475569", fontSize: "0.92rem" }}>{project.item_count} item(s) • Total OMR {toMoney(project.total_cost)}</span>
            </summary>

            <div style={{ padding: "0 1rem 1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", margin: "0.9rem 0" }}>
                <div style={{ color: "#475569", fontSize: "0.95rem" }}>
                  Add quotation items one by one. Level indentation reflects the BOM hierarchy.
                </div>
                {!addMode ? (
                  <button type="button" className="crud-add-btn" onClick={() => startAdd(projectId)}>
                    <BsPlusCircleFill aria-hidden="true" /> Add Item
                  </button>
                ) : null}
              </div>

              {addMode && draftRow ? (
                <div className="users-table-wrap" style={{ overflowX: "auto", marginBottom: "1rem" }}>
                  <table className="users-table users-table--sp-items">
                    <QuotationTableHead includeActions />
                    <tbody>
                      <tr>
                        {renderEditorRow(draftRow, patchDraft, handleDraftCostTypeChange, savingDraft)}
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", gap: "0.35rem", justifyContent: "center" }}>
                            <button
                              type="button"
                              className="modal-btn modal-btn--save"
                              style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                              onClick={saveDraft}
                              disabled={savingDraft}
                              title="Save"
                            >
                              <BsCheckCircleFill aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="modal-btn modal-btn--cancel"
                              style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                              onClick={cancelAdd}
                              disabled={savingDraft}
                              title="Cancel"
                            >
                              <BsXCircleFill aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="users-table-wrap" style={{ overflowX: "auto" }}>
                <table className="users-table users-table--sp-items">
                  <QuotationTableHead includeActions />
                  <tbody>
                    {flattenedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: "center", color: "#64748b", padding: "1rem" }}>
                          No quotation items yet.
                        </td>
                      </tr>
                    ) : flattenedRows.map((item) => {
                      const inEditMode = editingItemId === item.id && String(editingProjectId || "") === String(projectId) && editRow;
                      return (
                        <tr key={item.id}>
                          {inEditMode ? (
                            <>
                              {renderEditorRow(editRow, patchEdit, handleEditCostTypeChange, savingEdit)}
                              <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                <div style={{ display: "flex", gap: "0.35rem", justifyContent: "center" }}>
                                  <button
                                    type="button"
                                    className="modal-btn modal-btn--save"
                                    style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                                    onClick={saveEdit}
                                    disabled={savingEdit}
                                    title="Save"
                                  >
                                    <BsCheckCircleFill aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="modal-btn modal-btn--cancel"
                                    style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                                    onClick={cancelEdit}
                                    disabled={savingEdit}
                                    title="Cancel"
                                  >
                                    <BsXCircleFill aria-hidden="true" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{item.cost_type || "—"}</td>
                              <td style={{ textAlign: "center" }}>{item.level}</td>
                              <td>{item.item_category || "—"}</td>
                              <td>
                                <div style={{ paddingLeft: `${Math.max(Number(item.level || 0), 0) * 18}px`, display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                  {Number(item.level || 0) > 0 ? <span aria-hidden="true" style={{ color: "#94a3b8" }}>↳</span> : null}
                                  <span>{item.item_name || "—"}</span>
                                </div>
                              </td>
                              <td>{item.item_code || "—"}</td>
                              <td style={{ textAlign: "right" }}>{item.requested_qty}</td>
                              <td style={{ textAlign: "right" }}>{item.purchase_qty}</td>
                              <td style={{ textAlign: "right" }}>{item.cost_per_qty}</td>
                              <td style={{ textAlign: "right" }}>{item.total_cost}</td>
                              <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                <div style={{ display: "flex", gap: "0.35rem", justifyContent: "center" }}>
                                  <button
                                    type="button"
                                    className="users-action users-action--edit"
                                    onClick={() => startEdit(projectId, item)}
                                    title="Edit"
                                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                  >
                                    <BsPencilSquare aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="users-action users-action--delete"
                                    onClick={() => handleDelete(item.id)}
                                    title="Delete"
                                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                  >
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
        );
      }) : null}
    </section>
  );
}

export default ProjectQuotationPage;

