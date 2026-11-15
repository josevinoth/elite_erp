import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BsPlus,
  BsTrashFill,
  BsBoxes,
  BsSearch,
  BsX,
} from "react-icons/bs";
import ConfirmPopupModal from "../components/ConfirmPopupModal";
import Select from "react-select";
import {
  listProjectTemplates,
  getProjectTemplate,
  createProjectTemplate,
  updateProjectTemplate,
  deleteProjectTemplate,
  checkProjectTemplateDownstream,
  listLabFurnitureItems,
} from "../services/crudApi";
import { formatUtcDateTime } from "../utils/dateUtils";

export default function ProjectTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Available lab furniture items for dropdown
  const [labItems, setLabItems] = useState([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formItems, setFormItems] = useState([]);
  const [itemSearchFilter, setItemSearchFilter] = useState("");

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    type: "danger",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    onConfirm: null,
  });

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjectTemplates();
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (err) {
      setError(err?.message || "Failed to load project templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLabItems = useCallback(async () => {
    try {
      const data = await listLabFurnitureItems();
      const items = Array.isArray(data.lab_furniture_items)
        ? data.lab_furniture_items
        : (Array.isArray(data.items) ? data.items : []);
      setLabItems(items);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadLabItems();
  }, [loadTemplates, loadLabItems]);

  const labItemOptions = useMemo(() => {
    return labItems.map((item) => {
      const code = item.item_code || "";
      const category = item.item_category?.name || item.item_category_name || "";
      const name = item.item_name || "";
      const label = `${code} _ ${category} _ ${name}`.replace(/^[ _]+|[ _]+$/g, "");
      return {
        value: item.id,
        label,
        item,
      };
    });
  }, [labItems]);

  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return templates;
    const term = searchTerm.toLowerCase();
    return templates.filter((t) =>
      (t.name || "").toLowerCase().includes(term) ||
      (t.description || "").toLowerCase().includes(term) ||
      (t.updated_by || "").toLowerCase().includes(term)
    );
  }, [templates, searchTerm]);

  const handleOpenAdd = () => {
    setModalMode("add");
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormItems([]);
    setItemSearchFilter("");
    setModalOpen(true);
  };

  const handleOpenEdit = async (templateId) => {
    setModalMode("edit");
    setEditingId(templateId);
    setModalLoading(true);
    setModalOpen(true);
    setItemSearchFilter("");
    try {
      const data = await getProjectTemplate(templateId);
      const tmpl = data.template || {};
      setFormName(tmpl.name || "");
      setFormDescription(tmpl.description || "");
      const items = (tmpl.items || []).map((it) => ({
        item_code_id: it.item_code_id,
        item_code: it.item_code,
        item_category_name: it.item_category_name,
        item_name: it.item_name,
        uom: it.uom,
        qty: it.qty,
      }));
      setFormItems(items);
    } catch (err) {
      alert(err?.message || "Failed to load template details.");
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      {
        item_code_id: null,
        item_code: "",
        item_category_name: "",
        item_name: "",
        uom: "",
        qty: 1,
      },
    ]);
  };

  const handleItemSelect = (index, selectedOption) => {
    const item = selectedOption?.item;
    if (!item) return;
    setFormItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        item_code_id: item.id,
        item_code: item.item_code || "",
        item_category_name: item.item_category?.name || item.item_category_name || "",
        item_name: item.item_name || "",
        uom: item.uom?.name || "",
      };
      return copy;
    });
  };

  const handleQtyChange = (index, value) => {
    setFormItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], qty: value };
      return copy;
    });
  };

  const handleRemoveItemRow = (index) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("Please provide a template name.");
      return;
    }

    const validItems = [];
    for (const row of formItems) {
      if (!row.item_code_id) continue;
      const numQty = parseFloat(row.qty);
      if (isNaN(numQty) || numQty <= 0) {
        alert("All item quantities must be greater than 0.");
        return;
      }
      validItems.push({
        item_code_id: row.item_code_id,
        qty: numQty,
      });
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim(),
        items: validItems,
      };

      if (modalMode === "add") {
        await createProjectTemplate(payload);
      } else {
        await updateProjectTemplate(editingId, payload);
      }
      setModalOpen(false);
      await loadTemplates();
    } catch (err) {
      alert(err?.message || "Failed to save project template.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (tmpl) => {
    checkProjectTemplateDownstream(tmpl.id)
      .then((downstream) => {
        if (downstream?.has_downstream) {
          setConfirmModal({
            open: true,
            title: "Cannot Delete Template",
            type: "warning",
            message: `Template "${tmpl.name}" cannot be deleted because it is applied to active quotations or costings.`,
            details: downstream.details || [],
            cancelLabel: "Close",
            confirmLabel: null,
            onConfirm: () => setConfirmModal((prev) => ({ ...prev, open: false })),
          });
          return;
        }

        setConfirmModal({
          open: true,
          title: "Delete Project Template",
          type: "danger",
          message: `Are you sure you want to delete template "${tmpl.name}" and all its ${tmpl.items_count || 0} items? This action cannot be undone.`,
          cancelLabel: "Cancel",
          confirmLabel: "Delete Template",
          onConfirm: async () => {
            try {
              await deleteProjectTemplate(tmpl.id);
              setConfirmModal((prev) => ({ ...prev, open: false }));
              await loadTemplates();
            } catch (err) {
              alert(err?.message || "Failed to delete template.");
            }
          },
        });
      })
      .catch((err) => {
        alert(err?.message || "Failed to check template downstream usage.");
      });
  };

  return (
    <div className="crud-page-container" style={{ padding: "1.5rem" }}>
      {/* Top Header */}
      <div className="crud-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#2a3042", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BsBoxes style={{ color: "#556ee6" }} /> Project Templates
          </h1>
          <p style={{ margin: "0.25rem 0 0 0", color: "#74788d", fontSize: "0.875rem" }}>
            Define reusable Bill of Materials (BOM) templates that can be applied to Project Quotations and Costings.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <div style={{ position: "relative", width: "260px" }}>
            <BsSearch style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#74788d" }} />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
              style={{ paddingLeft: "32px", fontSize: "0.875rem" }}
            />
          </div>
          <button
            type="button"
            className="crud-add-btn"
            onClick={handleOpenAdd}
            style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
          >
            <BsPlus style={{ fontSize: "1.25rem" }} /> Add Template
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      ) : null}

      {/* Templates Table */}
      <div className="users-table-wrap" style={{ backgroundColor: "#fff", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.06)", overflowX: "auto" }}>
        <table className="users-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--list-header-bg, #3a4461)", color: "#ffffff", textAlign: "left" }}>
              <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", fontWeight: "600", width: "60px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)" }}>#</th>
              <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", fontWeight: "600", color: "#ffffff", background: "var(--list-header-bg, #3a4461)" }}>Template Name</th>
              <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", fontWeight: "600", color: "#ffffff", background: "var(--list-header-bg, #3a4461)" }}>Description</th>
              <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", fontWeight: "600", textAlign: "center", width: "120px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)" }}>Items Count</th>
              <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", fontWeight: "600", width: "160px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)" }}>Updated By</th>
              <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", fontWeight: "600", width: "160px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)" }}>Updated On</th>
              <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", fontWeight: "600", textAlign: "center", width: "100px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#74788d" }}>
                  Loading templates...
                </td>
              </tr>
            ) : filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#74788d" }}>
                  {searchTerm ? "No templates match your search." : "No project templates defined yet."}
                </td>
              </tr>
            ) : (
              filteredTemplates.map((tmpl, idx) => (
                <tr key={tmpl.id} style={{ borderBottom: "1px solid #e9edf4", cursor: "pointer" }} onClick={() => handleOpenEdit(tmpl.id)}>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#74788d" }}>{idx + 1}</td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.9rem", fontWeight: "600", color: "#2a3042" }}>
                    {tmpl.name}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#555" }}>
                    {tmpl.description || "-"}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                    <span style={{ backgroundColor: "#eef2f6", color: "#556ee6", padding: "0.25rem 0.6rem", borderRadius: "12px", fontWeight: "600", fontSize: "0.825rem" }}>
                      {tmpl.items_count || 0}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#74788d" }}>
                    {tmpl.updated_by || "-"}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#74788d" }}>
                    {formatUtcDateTime(tmpl.updated_at) || "-"}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                    <div className="users-actions" style={{ justifyContent: "center" }}>
                      <button
                        type="button"
                        className="users-action users-action--delete"
                        aria-label="Delete"
                        title="Delete Template"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(tmpl);
                        }}
                      >
                        <BsTrashFill aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Template Modal */}
      {modalOpen ? (
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
              <h2 style={{ fontSize: "1.15rem", fontWeight: "600", margin: 0 }}>
                {modalMode === "add" ? "Add Project Template" : `Edit Project Template: ${formName}`}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: "none", border: "none", color: "#fff", fontSize: "1.5rem", cursor: "pointer" }}
              >
                <BsX />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
              {modalLoading ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#74788d" }}>Loading template details...</div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem", marginBottom: "1.25rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#2a3042", marginBottom: "0.35rem" }}>
                        Template Name <span style={{ color: "#f46a6a" }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. GS (EXISTING SCHOOLS), MC, MB..."
                        required
                        style={{ fontSize: "0.9rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#2a3042", marginBottom: "0.35rem" }}>
                        Description
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Optional description / notes for this template"
                        style={{ fontSize: "0.9rem" }}
                      />
                    </div>
                  </div>

                  {/* Items Sub-Section */}
                  <div style={{ borderTop: "1px solid #e9edf4", paddingTop: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <h3 style={{ fontSize: "1rem", fontWeight: "600", margin: 0, color: "#2a3042" }}>
                          Template Items ({formItems.length})
                        </h3>
                        <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.8rem", color: "#74788d" }}>
                          Specify the item codes and standard quantities that belong to this template.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        {formItems.length > 5 ? (
                          <input
                            type="text"
                            placeholder="Filter items list..."
                            value={itemSearchFilter}
                            onChange={(e) => setItemSearchFilter(e.target.value)}
                            className="form-control form-control-sm"
                            style={{ width: "180px", fontSize: "0.8rem" }}
                          />
                        ) : null}
                        <button
                          type="button"
                          className="crud-add-btn"
                          onClick={handleAddItemRow}
                          style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                        >
                          <BsPlus style={{ fontSize: "1.1rem" }} /> Add Item Row
                        </button>
                      </div>
                    </div>

                    <div style={{ border: "1px solid #e9edf4", borderRadius: "6px", maxHeight: "360px", overflowY: "auto", position: "relative" }}>
                      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "0.85rem" }}>
                        <thead>
                          <tr>
                            <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "left", width: "45px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>#</th>
                            <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "left", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Item Code _ Category _ Name</th>
                            <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "left", width: "90px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>UOM</th>
                            <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "right", width: "120px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}>Qty</th>
                            <th style={{ position: "sticky", top: 0, zIndex: 10, padding: "0.65rem 0.75rem", textAlign: "center", width: "50px", color: "#ffffff", background: "var(--list-header-bg, #3a4461)", borderBottom: "1px solid #2a3042" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formItems.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: "center", padding: "1.5rem", color: "#74788d", borderBottom: "1px solid #e9edf4" }}>
                                No items added yet. Click &quot;Add Item Row&quot; above to add items to this template.
                              </td>
                            </tr>
                          ) : (
                            formItems.map((row, idx) => {
                              const matchSearch =
                                !itemSearchFilter.trim() ||
                                `${row.item_code} ${row.item_category_name} ${row.item_name}`
                                  .toLowerCase()
                                  .includes(itemSearchFilter.toLowerCase());
                              if (!matchSearch) return null;

                              const selectedOption = labItemOptions.find((opt) => opt.value === row.item_code_id);

                              return (
                                <tr key={idx}>
                                  <td style={{ padding: "0.5rem 0.75rem", color: "#74788d", borderBottom: "1px solid #e9edf4" }}>{idx + 1}</td>
                                  <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #e9edf4" }}>
                                    <Select
                                      options={labItemOptions}
                                      value={selectedOption || null}
                                      onChange={(opt) => handleItemSelect(idx, opt)}
                                      placeholder="Search Item Code _ Category _ Name..."
                                      isClearable={false}
                                      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                                      styles={{
                                        control: (base) => ({
                                          ...base,
                                          minHeight: "34px",
                                          fontSize: "0.85rem",
                                          borderColor: "#ced4da",
                                        }),
                                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                        menu: (base) => ({ ...base, zIndex: 9999, fontSize: "0.85rem" }),
                                      }}
                                    />
                                  </td>
                                  <td style={{ padding: "0.5rem 0.75rem", color: "#555", borderBottom: "1px solid #e9edf4" }}>
                                    {row.uom || "-"}
                                  </td>
                                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", borderBottom: "1px solid #e9edf4" }}>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0.0001"
                                      value={row.qty}
                                      onChange={(e) => handleQtyChange(idx, e.target.value)}
                                      className="form-control form-control-sm"
                                      style={{ textAlign: "right", width: "100px", display: "inline-block" }}
                                      required
                                    />
                                  </td>
                                  <td style={{ padding: "0.4rem 0.75rem", textAlign: "center", borderBottom: "1px solid #e9edf4" }}>
                                    <div className="users-actions" style={{ justifyContent: "center" }}>
                                      <button
                                        type="button"
                                        className="users-action users-action--delete"
                                        onClick={() => handleRemoveItemRow(idx)}
                                        title="Remove Item"
                                        aria-label="Remove Item"
                                      >
                                        <BsTrashFill aria-hidden="true" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Modal Footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "1.25rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #e9edf4",
                }}
              >
                <button
                  type="button"
                  className="modal-btn modal-btn--cancel"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crud-add-btn"
                  disabled={saving || modalLoading}
                >
                  {saving ? "Saving..." : modalMode === "add" ? "Create Template" : "Save Changes"}
                </button>
              </div>
            </form>
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
      >
        {Array.isArray(confirmModal.details) && confirmModal.details.length > 0 ? (
          <ul style={{ margin: "0.5rem 0 0 1.25rem", padding: 0, fontSize: "0.85rem", color: "#64748b" }}>
            {confirmModal.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        ) : null}
      </ConfirmPopupModal>
    </div>
  );
}
