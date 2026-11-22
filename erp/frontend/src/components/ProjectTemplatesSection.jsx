import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BsBoxes,
  BsTrashFill,
  BsEye,
  BsX,
} from "react-icons/bs";
import ConfirmPopupModal from "./ConfirmPopupModal";
import {
  listProjectTemplates,
  listQuotationTemplates,
  previewQuotationTemplate,
  applyQuotationTemplate,
  deleteQuotationTemplate,
  listCostingTemplates,
  previewCostingTemplate,
  applyCostingTemplate,
  deleteCostingTemplate,
} from "../services/crudApi";
import { formatUtcDateTime } from "../utils/dateUtils";

export default function ProjectTemplatesSection({
  mode, // "quotation" | "costing"
  parentId, // quotation_number (str) or costing_id (int)
  readOnly = false,
  onItemsUpdated,
}) {
  const [appliedTemplates, setAppliedTemplates] = useState([]);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Add row state
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [multiplierQty, setMultiplierQty] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewSearch, setPreviewSearch] = useState("");
  const [applying, setApplying] = useState(false);

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    type: "danger",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    onConfirm: null,
  });

  const loadAppliedTemplates = useCallback(async () => {
    if (!parentId) {
      setAppliedTemplates([]);
      return;
    }
    setLoading(true);
    setActionError(null);
    try {
      if (mode === "quotation") {
        const data = await listQuotationTemplates(parentId);
        setAppliedTemplates(Array.isArray(data.applied_templates) ? data.applied_templates : []);
      } else {
        const data = await listCostingTemplates(parentId);
        setAppliedTemplates(Array.isArray(data.applied_templates) ? data.applied_templates : []);
      }
    } catch (err) {
      setActionError(err?.message || "Failed to load applied templates.");
    } finally {
      setLoading(false);
    }
  }, [mode, parentId]);

  const loadAvailableTemplates = useCallback(async () => {
    try {
      const data = await listProjectTemplates();
      setAvailableTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadAppliedTemplates();
    loadAvailableTemplates();
  }, [loadAppliedTemplates, loadAvailableTemplates]);

  const handleOpenPreview = async () => {
    if (!selectedTemplateId) {
      alert("Please select a project template to preview.");
      return;
    }
    const numQty = parseFloat(multiplierQty);
    if (isNaN(numQty) || numQty <= 0) {
      alert("Please enter a valid multiplier quantity greater than 0.");
      return;
    }

    setPreviewLoading(true);
    setActionError(null);
    try {
      let data;
      if (mode === "quotation") {
        data = await previewQuotationTemplate(parentId, selectedTemplateId, numQty);
      } else {
        data = await previewCostingTemplate(parentId, selectedTemplateId, numQty);
      }
      setPreviewData(data);
      setPreviewSearch("");
      setPreviewModalOpen(true);
    } catch (err) {
      alert(err?.message || "Failed to preview template items.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApplyClick = () => {
    if (!previewData) return;
    const templateName = previewData.template?.name || "Template";
    const count = previewData.preview_items?.length || 0;
    const modeLabel = mode === "quotation" ? "quotation" : "costing";

    setConfirmModal({
      open: true,
      title: "Confirm Apply Project Template",
      type: "info",
      message: `Are you sure you want to apply project template "${templateName}" with quantity ${previewData.multiplier_qty}? This will automatically add ${count} item(s) to this ${modeLabel}.`,
      confirmLabel: "Apply Template",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setApplying(true);
        setActionError(null);
        try {
          if (mode === "quotation") {
            await applyQuotationTemplate(parentId, selectedTemplateId, previewData.multiplier_qty);
          } else {
            await applyCostingTemplate(parentId, selectedTemplateId, previewData.multiplier_qty);
          }
          setPreviewModalOpen(false);
          setSelectedTemplateId("");
          setMultiplierQty(1);
          await loadAppliedTemplates();
          if (onItemsUpdated) {
            await onItemsUpdated();
          }
        } catch (err) {
          setActionError(err?.message || "Failed to apply project template.");
        } finally {
          setApplying(false);
        }
      },
    });
  };

  const handleDeleteApplied = (appliedRow) => {
    const modeLabel = mode === "quotation" ? "quotation" : "costing";
    const templateName = appliedRow.template_name || "Template";
    const count = appliedRow.items_count || 0;

    setConfirmModal({
      open: true,
      title: "Remove Project Template",
      type: "danger",
      message:
        mode === "costing"
          ? `Are you sure you want to remove project template "${templateName}" and all its ${count} dependent item(s) from this costing? (Note: Items can only be removed if they are in "Item Requested" state.)`
          : `Are you sure you want to remove project template "${templateName}" and all its ${count} dependent item(s) from this quotation?`,
      confirmLabel: "Delete Template & Items",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setActionError(null);
        try {
          if (mode === "quotation") {
            await deleteQuotationTemplate(parentId, appliedRow.id);
          } else {
            await deleteCostingTemplate(parentId, appliedRow.id);
          }
          await loadAppliedTemplates();
          if (onItemsUpdated) {
            await onItemsUpdated();
          }
        } catch (err) {
          setActionError(err?.message || "Failed to remove project template.");
        }
      },
    });
  };

  const filteredPreviewItems = useMemo(() => {
    if (!previewData?.preview_items) return [];
    if (!previewSearch.trim()) return previewData.preview_items;
    const term = previewSearch.toLowerCase();
    return previewData.preview_items.filter((item) =>
      `${item.item_code} ${item.item_category_name} ${item.item_name}`
        .toLowerCase()
        .includes(term)
    );
  }, [previewData, previewSearch]);

  if (!parentId) return null;

  return (
    <div
      className="project-templates-section"
      style={{
        backgroundColor: "#fff",
        borderRadius: "8px",
        border: "1px solid #e9edf4",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        padding: "1rem 1.25rem",
        marginBottom: "1.25rem",
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "0.85rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <BsBoxes style={{ color: "#556ee6", fontSize: "1.2rem" }} />
          <h2 style={{ fontSize: "1.05rem", fontWeight: "700", margin: 0, color: "#2a3042" }}>
            Project Templates
          </h2>
          <span
            style={{
              backgroundColor: "#eef2f6",
              color: "#556ee6",
              padding: "0.15rem 0.5rem",
              borderRadius: "10px",
              fontSize: "0.75rem",
              fontWeight: "600",
            }}
          >
            {appliedTemplates.length} {appliedTemplates.length === 1 ? "Template" : "Templates"} Applied
          </span>
        </div>

        {/* Add Template Controls */}
        {!readOnly ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <select
              className="form-select form-select-sm"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              style={{ width: "230px", fontSize: "0.85rem" }}
            >
              <option value="">Select Project Template...</option>
              {availableTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.items_count || 0} items)
                </option>
              ))}
            </select>

            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.8rem", color: "#74788d" }}>Qty:</span>
              <input
                type="number"
                min="0.1"
                step="any"
                value={multiplierQty}
                onChange={(e) => setMultiplierQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleOpenPreview();
                  }
                }}
                className="form-control form-control-sm"
                style={{ width: "70px", textAlign: "center", fontSize: "0.85rem" }}
                title="Template multiplier quantity"
              />
            </div>

            <button
              type="button"
              className="crud-add-btn"
              onClick={handleOpenPreview}
              disabled={!selectedTemplateId || previewLoading}
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              <BsEye /> {previewLoading ? "Loading..." : "Preview & Add"}
            </button>
          </div>
        ) : null}
      </div>

      {actionError ? (
        <div
          className="alert alert-danger"
          style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", marginBottom: "0.75rem" }}
        >
          {actionError}
        </div>
      ) : null}

      {/* Applied Templates Table */}
      <div style={{ border: "1px solid #e9edf4", borderRadius: "6px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "0.85rem" }}>
          <thead>
            <tr>
              <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", width: "40px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>#</th>
              <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Template Name</th>
              <th style={{ padding: "0.6rem 0.75rem", textAlign: "center", width: "120px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Template Qty</th>
              <th style={{ padding: "0.6rem 0.75rem", textAlign: "center", width: "130px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Items Added</th>
              <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", width: "150px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Applied By</th>
              <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", width: "150px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Applied On</th>
              {!readOnly ? (
                <th style={{ padding: "0.6rem 0.75rem", textAlign: "center", width: "90px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Action</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={readOnly ? 6 : 7} style={{ textAlign: "center", padding: "1.25rem", color: "#74788d", borderBottom: "1px solid #e9edf4" }}>
                  Loading applied templates...
                </td>
              </tr>
            ) : appliedTemplates.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 6 : 7} style={{ textAlign: "center", padding: "1.25rem", color: "#74788d", borderBottom: "1px solid #e9edf4" }}>
                  No project templates applied. Select a template above and enter a quantity to add items.
                </td>
              </tr>
            ) : (
              appliedTemplates.map((row, idx) => (
                <tr key={row.id}>
                  <td style={{ padding: "0.55rem 0.75rem", color: "#74788d", borderBottom: "1px solid #e9edf4" }}>{idx + 1}</td>
                  <td style={{ padding: "0.55rem 0.75rem", fontWeight: "600", color: "#2a3042", borderBottom: "1px solid #e9edf4" }}>
                    {row.template_name}
                  </td>
                  <td style={{ padding: "0.55rem 0.75rem", textAlign: "center", borderBottom: "1px solid #e9edf4" }}>
                    <span
                      style={{
                        backgroundColor: "#f5f7fc",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "8px",
                        fontWeight: "600",
                        color: "#334155",
                      }}
                    >
                      {row.qty}x
                    </span>
                  </td>
                  <td style={{ padding: "0.55rem 0.75rem", textAlign: "center", borderBottom: "1px solid #e9edf4" }}>
                    <span
                      style={{
                        backgroundColor: "#eef2f6",
                        color: "#556ee6",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "10px",
                        fontWeight: "600",
                      }}
                    >
                      {row.items_count || 0}
                    </span>
                  </td>
                  <td style={{ padding: "0.55rem 0.75rem", color: "#74788d", borderBottom: "1px solid #e9edf4" }}>{row.applied_by || "-"}</td>
                  <td style={{ padding: "0.55rem 0.75rem", color: "#74788d", borderBottom: "1px solid #e9edf4" }}>
                    {formatUtcDateTime(row.created_at) || "-"}
                  </td>
                  {!readOnly ? (
                    <td style={{ padding: "0.4rem 0.75rem", textAlign: "center", borderBottom: "1px solid #e9edf4" }}>
                      <div className="users-actions" style={{ justifyContent: "center" }}>
                        <button
                          type="button"
                          className="users-action users-action--delete"
                          onClick={() => handleDeleteApplied(row)}
                          title="Delete template and its added items"
                          aria-label="Delete"
                        >
                          <BsTrashFill aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {previewModalOpen && previewData ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2500,
            padding: "1.5rem 1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "960px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                backgroundColor: "#2a3042",
                color: "#fff",
                padding: "1rem 1.25rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "600", margin: 0 }}>
                  Preview Template Items: {previewData.template?.name}
                </h3>
                <span style={{ fontSize: "0.8rem", color: "#a6b0cf" }}>
                  Multiplier: {previewData.multiplier_qty}x | Total Items to add: {previewData.total_items}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                style={{ background: "none", border: "none", color: "#fff", fontSize: "1.5rem", cursor: "pointer" }}
              >
                <BsX />
              </button>
            </div>

            {/* Modal Subheader filter */}
            <div
              style={{
                padding: "0.75rem 1.25rem",
                borderBottom: "1px solid #e9edf4",
                backgroundColor: "#f8f9fa",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#555" }}>
                Review the items below before applying them to the {mode}.
              </div>
              <input
                type="text"
                placeholder="Search preview items..."
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                className="form-control form-control-sm"
                style={{ width: "220px", fontSize: "0.8rem" }}
              />
            </div>

            {/* Modal Body: Items Table */}
            <div style={{ flex: 1, padding: "1rem 1.25rem", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  border: "1px solid #e9edf4",
                  borderRadius: "6px",
                  position: "relative",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "left", width: "45px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>#</th>
                      <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "left", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Item Code _ Category _ Name</th>
                      <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "center", width: "80px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>UOM</th>
                      <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "right", width: "95px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Base Qty</th>
                      <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "right", width: "110px", color: "#38bdf8", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Multiplied Qty</th>
                      <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "right", width: "100px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Est. Cost</th>
                      <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "right", width: "110px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPreviewItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "0.5rem 0.75rem", color: "#74788d", borderBottom: "1px solid #e9edf4" }}>{idx + 1}</td>
                        <td style={{ padding: "0.5rem 0.75rem", fontWeight: "500", color: "#2a3042", borderBottom: "1px solid #e9edf4" }}>
                          {item.display_name}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#555", borderBottom: "1px solid #e9edf4" }}>
                          {item.uom || "-"}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#74788d", borderBottom: "1px solid #e9edf4" }}>
                          {item.base_qty}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: "700", color: "#556ee6", borderBottom: "1px solid #e9edf4" }}>
                          {item.qty}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#555", borderBottom: "1px solid #e9edf4" }}>
                          {item.cost_per_qty?.toFixed(2) || "0.00"}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: "600", color: "#2a3042", borderBottom: "1px solid #e9edf4" }}>
                          {item.total_cost?.toFixed(2) || "0.00"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem 1.25rem",
                borderTop: "1px solid #e9edf4",
                backgroundColor: "#f8f9fa",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#74788d" }}>
                Showing {filteredPreviewItems.length} of {previewData.total_items} items
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="modal-btn modal-btn--cancel"
                  onClick={() => setPreviewModalOpen(false)}
                  disabled={applying}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="crud-add-btn"
                  onClick={handleApplyClick}
                  disabled={applying}
                >
                  {applying ? "Applying..." : "Apply Template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirmation Modal */}
      <ConfirmPopupModal
        open={confirmModal.open}
        title={confirmModal.title}
        type={confirmModal.type}
        message={confirmModal.message}
        zIndex={3000}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
