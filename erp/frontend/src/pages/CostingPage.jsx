import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BsDownload } from "react-icons/bs";
import Select from "react-select";
import {
  bulkSaveLceCostDetails,
  calculateLceCostIndex,
  deleteLceCostDetail,
  downloadLceCostingExport,
  downloadLceCostingImportTemplate,
  importLceCostingExcel,
  listLceCostDetailsByProject,
  listLceCostingMeta,
} from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import { exportRowsToExcel } from "../utils/exportToExcel";

const IMPORT_REPORT_COLUMNS = [
  { key: "row", label: "Row" },
  { key: "status", label: "Status" },
  { key: "message", label: "Details" },
  { key: "project_input", label: "Project (Excel)" },
  { key: "cost_head_input", label: "Cost Head (Excel)" },
  { key: "amount_input", label: "Amount (Excel)" },
];

const COST_INDEX_COLUMNS = [
  { key: "product_code", label: "Product Code" },
  { key: "product_name", label: "Product Name" },
  { key: "qty", label: "Qty" },
  { key: "base_unit_omr", label: "Base Unit (OMR)" },
  { key: "allocated_cost_omr", label: "Allocated Cost (OMR)" },
  { key: "unit_landed_omr", label: "Landed Unit (OMR)" },
  { key: "cost_index_ratio", label: "Cost Index Ratio" },
  { key: "cost_index_pct", label: "Cost Index %" },
];

const ALLOCATION_BASIS_OPTIONS = [
  { value: "value", label: "By Value" },
  { value: "qty", label: "By Quantity" },
  { value: "weight", label: "By Weight" },
  { value: "area", label: "By Area" },
  { value: "equal", label: "Equal Split" },
  { value: "direct", label: "Direct (Single Product)" },
];

const PRODUCT_CURRENCY_OPTIONS = ["OMR", "USD", "EUR", "INR"].map((code) => ({
  value: code,
  label: code,
}));

const UNIT_OPTIONS = ["Sheet", "Sqm", "Nos", "Meter", "Lot", "Set", "Pair"].map((u) => ({
  value: u,
  label: u,
}));

const SELECT_STYLES = {
  control: (base, state) => ({
    ...base,
    minHeight: 34,
    backgroundColor: "#0a3338",
    borderColor: state.isFocused ? "#16b2a5" : "#1e666d",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(22,178,165,0.2)" : "none",
    ":hover": { borderColor: "#25d2c3" },
    fontSize: "0.82rem",
  }),
  singleValue: (base) => ({ ...base, color: "#f0fffe" }),
  input: (base) => ({ ...base, color: "#f0fffe" }),
  placeholder: (base) => ({ ...base, color: "#aacbc8", fontSize: "0.8rem" }),
  menu: (base) => ({ ...base, backgroundColor: "#0b3a40", zIndex: 3000 }),
  menuPortal: (base) => ({ ...base, zIndex: 4000 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "#11474f" : "#0b3a40",
    color: "#f0fffe",
    fontSize: "0.82rem",
  }),
};

const PROJECT_SELECT_STYLES = {
  ...SELECT_STYLES,
  control: (base, state) => ({
    ...SELECT_STYLES.control(base, state),
    minHeight: 40,
    fontSize: "0.92rem",
  }),
};

function CostingPage() {
  const currentUser = useMemo(() => getSessionUser(), []);
  const loggedInUsername = currentUser?.username || "";
  const isAdmin = useMemo(() => {
    const role = (currentUser?.role || "").trim().toLowerCase();
    return ["admin", "super admin", "staff"].includes(role);
  }, [currentUser]);

  // Meta
  const [projectOptions, setProjectOptions] = useState([]);
  const [costHeadDefs, setCostHeadDefs] = useState([]);

  // Selection
  const [selectedProject, setSelectedProject] = useState(null);

  // Inline form rows — one per LCE cost-head definition entry
  const [formRows, setFormRows] = useState([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [savedRows, setSavedRows] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [tableError, setTableError] = useState("");

  // Import/Export
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [downloadingExport, setDownloadingExport] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importRowReports, setImportRowReports] = useState([]);

  // Cost index calculator state
  const [productRows, setProductRows] = useState([
    {
      id: 1,
      product_code: "",
      product_name: "",
      qty: "1",
      base_unit_cost: "",
      currency: "OMR",
      weight: "",
      area: "",
    },
  ]);
  const [costAllocationSettings, setCostAllocationSettings] = useState({});
  const [fxRates, setFxRates] = useState({ USD: "", EUR: "", INR: "" });
  const [defaultForeignRate, setDefaultForeignRate] = useState("");
  const [calculatingIndex, setCalculatingIndex] = useState(false);
  const [costIndexStatus, setCostIndexStatus] = useState("");
  const [costIndexSummary, setCostIndexSummary] = useState(null);
  const [costIndexRows, setCostIndexRows] = useState([]);
  const [exportingCostIndex, setExportingCostIndex] = useState(false);

  // ── Load meta ────────────────────────────────────────────
  const loadMeta = useCallback(async () => {
    const data = await listLceCostingMeta();
    setProjectOptions(
      Array.isArray(data.projects) ? data.projects.map((p) => ({ value: p.value, label: p.label })) : []
    );
    setCostHeadDefs(Array.isArray(data.cost_heads) ? data.cost_heads : []);
  }, []);

  useEffect(() => {
    loadMeta().catch(() => {
      setProjectOptions([]);
      setCostHeadDefs([]);
    });
  }, [loadMeta]);

  // ── Build blank form rows ─────────────────────────────────
  const buildEmptyRows = useCallback(
    (defs) =>
      defs.map((def, idx) => ({
        _defIdx: idx,
        id: null,
        cost_head: def.name || "",
        amount: "",
        currency: def.currency || "",
        quantity: "1",
        unit: "",
        reference_note: def.reference_note || "",
        remarks: "",
      })),
    []
  );

  // Seed blank rows when definitions arrive
  useEffect(() => {
    if (costHeadDefs.length > 0 && formRows.length === 0) {
      setFormRows(buildEmptyRows(costHeadDefs));
    }
  }, [costHeadDefs, formRows.length, buildEmptyRows]);

  // ── Load costs when project changes ───────────────────────
  useEffect(() => {
    if (!selectedProject) {
      setFormRows(buildEmptyRows(costHeadDefs));
      setSavedRows([]);
      setSaveStatus("");
      return;
    }

    let alive = true;
    setLoadingCosts(true);
    setSaveStatus("");

    listLceCostDetailsByProject(selectedProject.value)
      .then((data) => {
        if (!alive) return;
        const existing = Array.isArray(data.lce_cost_details) ? data.lce_cost_details : [];
        setSavedRows(existing);

        // key = "cost_head_lower||reference_note_lower"
        const lookup = {};
        for (const row of existing) {
          const key = `${String(row.cost_head || "").trim().toLowerCase()}||${String(row.reference_note || "").trim().toLowerCase()}`;
          lookup[key] = row;
        }

        setFormRows(
          costHeadDefs.map((def, idx) => {
            const key = `${String(def.name || "").trim().toLowerCase()}||${String(def.reference_note || "").trim().toLowerCase()}`;
            const saved = lookup[key] || null;
            return {
              _defIdx: idx,
              id: saved ? saved.id : null,
              cost_head: def.name || "",
              amount: saved ? String(saved.amount ?? "") : "",
              currency: saved ? (saved.currency || def.currency || "") : (def.currency || ""),
              quantity: saved ? String(saved.quantity ?? "1") : "1",
              unit: saved ? (saved.unit || "") : "",
              reference_note: saved
                ? (saved.reference_note || def.reference_note || "")
                : (def.reference_note || ""),
              remarks: saved ? (saved.remarks || "") : "",
            };
          })
        );
      })
      .catch(() => {
        if (!alive) return;
        setFormRows(buildEmptyRows(costHeadDefs));
        setSavedRows([]);
      })
      .finally(() => {
        if (alive) setLoadingCosts(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedProject, costHeadDefs, buildEmptyRows]);

  useEffect(() => {
    setCostAllocationSettings((prev) => {
      const next = { ...prev };
      for (const row of savedRows) {
        if (!next[row.id]) {
          next[row.id] = { allocation_basis: "value", applies_to: "ALL" };
        }
      }
      return next;
    });
  }, [savedRows]);

  // ── Field change handler ──────────────────────────────────
  const handleRowChange = (defIdx, field, value) => {
    setFormRows((prev) =>
      prev.map((row) => (row._defIdx === defIdx ? { ...row, [field]: value } : row))
    );
  };

  const handleProductRowChange = (rowId, field, value) => {
    setProductRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handleAddProductRow = () => {
    setProductRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        product_code: "",
        product_name: "",
        qty: "1",
        base_unit_cost: "",
        currency: "OMR",
        weight: "",
        area: "",
      },
    ]);
  };

  const handleRemoveProductRow = (rowId) => {
    setProductRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== rowId)));
  };

  // ── Save All ──────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (!selectedProject) {
      setSaveStatus("Please select a project first.");
      return;
    }
    setSaving(true);
    setSaveStatus("");
    try {
      const rowsToSave = formRows
        .filter((row) => {
          const amt = parseFloat(row.amount);
          return !isNaN(amt) && amt !== 0;
        })
        .map((row) => ({
          id: row.id || null,
          cost_head: row.cost_head,
          amount: row.amount,
          currency: row.currency,
          quantity: row.quantity || "1",
          unit: row.unit,
          reference_note: row.reference_note,
          remarks: row.remarks,
          created_by: loggedInUsername,
        }));

      if (rowsToSave.length === 0) {
        setSaveStatus("No amounts entered. Fill in at least one cost line.");
        setSaving(false);
        return;
      }

      const data = await bulkSaveLceCostDetails({
        project: selectedProject.value,
        rows: rowsToSave,
      });

      const saved = Array.isArray(data.lce_cost_details) ? data.lce_cost_details : [];
      setSavedRows(saved);

      // Patch IDs back into form rows
      const idLookup = {};
      for (const row of saved) {
        const key = `${String(row.cost_head || "").trim().toLowerCase()}||${String(row.reference_note || "").trim().toLowerCase()}`;
        idLookup[key] = row.id;
      }
      setFormRows((prev) =>
        prev.map((row) => {
          const key = `${String(row.cost_head || "").trim().toLowerCase()}||${String(row.reference_note || "").trim().toLowerCase()}`;
          return idLookup[key] !== undefined ? { ...row, id: idLookup[key] } : row;
        })
      );

      setSaveStatus(`✓ Saved ${saved.length} cost line(s) successfully.`);
    } catch (err) {
      setSaveStatus(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete a saved row ────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this cost record?")) return;
    setDeleting(id);
    setTableError("");
    try {
      await deleteLceCostDetail(id);
      setSavedRows((prev) => prev.filter((r) => r.id !== id));
      setFormRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, id: null, amount: "" } : row))
      );
    } catch (err) {
      setTableError(err.message || "Delete failed.");
    } finally {
      setDeleting(null);
    }
  };

  // ── Import / Export ───────────────────────────────────────
  const handleImportClick = () => fileInputRef.current?.click();

  const handleTemplateDownload = async () => {
    setDownloadingTemplate(true);
    try { await downloadLceCostingImportTemplate(); }
    catch (err) { setImportStatus(err.message || "Template download failed."); }
    finally { setDownloadingTemplate(false); }
  };

  const handleExcelExport = async () => {
    setDownloadingExport(true);
    try { await downloadLceCostingExport(); }
    catch (err) { setImportStatus(err.message || "Export failed."); }
    finally { setDownloadingExport(false); }
  };

  const handleImportReportExport = async () => {
    setExportingReport(true);
    try {
      await exportRowsToExcel({
        fileName: "LCE Costing Import Report",
        sheetName: "LCE Costing Import Report",
        columns: IMPORT_REPORT_COLUMNS,
        rows: importRowReports.filter((r) => (r.status || "").toLowerCase() !== "created"),
      });
    } catch (err) { setImportStatus(err.message || "Export failed."); }
    finally { setExportingReport(false); }
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportStatus("");
    setImportRowReports([]);
    try {
      const data = await importLceCostingExcel(file);
      const s = data.summary || {};
      setImportStatus(
        `Imported ${s.created || 0}, Blank rows ${s.blank_rows || 0}, Duplicates ${s.duplicates || 0}, Failed ${s.failed || 0}.`
      );
      setImportRowReports(Array.isArray(data.row_reports) ? data.row_reports : []);
      if (selectedProject) {
        const refreshed = await listLceCostDetailsByProject(selectedProject.value);
        setSavedRows(Array.isArray(refreshed.lce_cost_details) ? refreshed.lce_cost_details : []);
      }
    } catch (err) {
      setImportStatus(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const handleCalculateCostIndex = async () => {
    if (!selectedProject) {
      setCostIndexStatus("Please select a project first.");
      return;
    }

    const normalizedProducts = productRows
      .map((row, idx) => ({
        product_code: String(row.product_code || "").trim(),
        product_name: String(row.product_name || "").trim(),
        qty: row.qty,
        base_unit_cost: row.base_unit_cost,
        currency: row.currency || "OMR",
        weight: row.weight,
        area: row.area,
        sort_id: idx,
      }))
      .filter((row) => Number(row.qty) > 0 && (row.product_code || row.product_name));

    if (!normalizedProducts.length) {
      setCostIndexStatus("Add at least one product with qty > 0 and code/name.");
      return;
    }

    const costRowsPayload = savedRows.map((row) => {
      const settings = costAllocationSettings[row.id] || { allocation_basis: "value", applies_to: "ALL" };
      return {
        id: row.id,
        cost_head: row.cost_head,
        amount: row.amount,
        quantity: row.quantity,
        currency: row.currency,
        reference_note: row.reference_note,
        allocation_basis: settings.allocation_basis || "value",
        applies_to: [settings.applies_to || "ALL"],
      };
    });

    setCalculatingIndex(true);
    setCostIndexStatus("");
    try {
      const data = await calculateLceCostIndex({
        project: selectedProject.value,
        products: normalizedProducts,
        cost_rows: costRowsPayload,
        fx_rates: fxRates,
        default_foreign_rate: defaultForeignRate,
      });
      setCostIndexRows(Array.isArray(data.products) ? data.products : []);
      setCostIndexSummary(data.summary || null);
      setCostIndexStatus("Cost index calculated successfully.");
    } catch (err) {
      setCostIndexRows([]);
      setCostIndexSummary(null);
      setCostIndexStatus(err.message || "Cost index calculation failed.");
    } finally {
      setCalculatingIndex(false);
    }
  };

  const handleExportCostIndex = async () => {
    setExportingCostIndex(true);
    try {
      await exportRowsToExcel({
        fileName: "LCE Cost Index",
        sheetName: "LCE Cost Index",
        columns: COST_INDEX_COLUMNS,
        rows: costIndexRows,
      });
    } catch (err) {
      setCostIndexStatus(err.message || "Failed to export cost index.");
    } finally {
      setExportingCostIndex(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <section className="module-page">

      {/* Title + Project selector */}
      <h1 className="module-page__title" style={{ marginBottom: "0.9rem" }}>LCE Costing</h1>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <label style={{ color: "#cce8e5", fontWeight: 600, whiteSpace: "nowrap" }}>
          Project:
        </label>
        <div style={{ flex: 1, minWidth: 300, maxWidth: 520 }}>
          <Select
            options={projectOptions}
            value={selectedProject}
            onChange={(opt) => { setSelectedProject(opt); setSaveStatus(""); }}
            placeholder="Select a project to load / enter costs..."
            isClearable
            isSearchable
            styles={PROJECT_SELECT_STYLES}
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            menuPosition="fixed"
          />
        </div>
        {selectedProject && (
          <button
            type="button"
            className="crud-add-btn"
            onClick={handleSaveAll}
            disabled={saving || loadingCosts}
            style={{ minWidth: 100 }}
          >
            {saving ? "Saving..." : "💾 Save All"}
          </button>
        )}
      </div>

      {saveStatus ? (
        <p className="users-status" style={{ marginBottom: "0.75rem" }}>{saveStatus}</p>
      ) : null}

      {/* ── Structured inline cost-entry table ── */}
      {loadingCosts ? (
        <p className="users-status">Loading costs for project...</p>
      ) : (
        <div
          className="users-table-wrap"
          style={{ overflowX: "auto", marginBottom: "1.5rem", maxHeight: "65vh", overflowY: "auto" }}
        >
          <table className="users-table" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th
                  style={{ minWidth: 310, textAlign: "left", position: "sticky", top: 0, zIndex: 1 }}
                  className="users-table__sticky-head"
                >
                  Cost Head
                </th>
                <th className="users-table__sticky-head" style={{ minWidth: 200 }}>Reference / Note</th>
                <th className="users-table__sticky-head" style={{ minWidth: 110 }}>Currency</th>
                <th className="users-table__sticky-head" style={{ minWidth: 120, textAlign: "right" }}>Amount</th>
                <th className="users-table__sticky-head" style={{ minWidth: 80, textAlign: "right" }}>Qty</th>
                <th className="users-table__sticky-head" style={{ minWidth: 110 }}>Unit</th>
                <th className="users-table__sticky-head" style={{ minWidth: 160 }}>Remarks</th>
                <th className="users-table__sticky-head" style={{ minWidth: 50 }}>Del</th>
              </tr>
            </thead>
            <tbody>
              {formRows.map((row) => (
                <tr key={row._defIdx} style={row.id ? { background: "rgba(22,178,165,0.05)" } : undefined}>
                  {/* Cost Head — fixed label */}
                  <td
                    style={{
                      color: "#d4f0ed",
                      fontWeight: 500,
                      fontSize: "0.83rem",
                      whiteSpace: "normal",
                      lineHeight: 1.35,
                    }}
                  >
                    {row.cost_head}
                    {row.id ? (
                      <span style={{ marginLeft: 6, fontSize: "0.7rem", color: "#16b2a5" }}>✓</span>
                    ) : null}
                  </td>

                  {/* Reference Note */}
                  <td>
                    <input
                      type="text"
                      className="auth-input"
                      style={{ fontSize: "0.8rem", padding: "0.22rem 0.4rem", width: "100%" }}
                      value={row.reference_note}
                      onChange={(e) => handleRowChange(row._defIdx, "reference_note", e.target.value)}
                    />
                  </td>

                  {/* Currency */}
                  <td>
                    <input
                      type="text"
                      className="auth-input"
                      style={{ fontSize: "0.8rem", padding: "0.22rem 0.4rem", width: "100%" }}
                      value={row.currency}
                      onChange={(e) => handleRowChange(row._defIdx, "currency", e.target.value)}
                    />
                  </td>

                  {/* Amount */}
                  <td>
                    <input
                      type="number"
                      className="auth-input"
                      style={{ fontSize: "0.8rem", padding: "0.22rem 0.4rem", width: "100%", textAlign: "right" }}
                      value={row.amount}
                      step="any"
                      min="0"
                      placeholder="0"
                      onChange={(e) => handleRowChange(row._defIdx, "amount", e.target.value)}
                    />
                  </td>

                  {/* Quantity */}
                  <td>
                    <input
                      type="number"
                      className="auth-input"
                      style={{ fontSize: "0.8rem", padding: "0.22rem 0.4rem", width: "100%", textAlign: "right" }}
                      value={row.quantity}
                      step="any"
                      min="0"
                      onChange={(e) => handleRowChange(row._defIdx, "quantity", e.target.value)}
                    />
                  </td>

                  {/* Unit dropdown */}
                  <td>
                    <Select
                      options={UNIT_OPTIONS}
                      value={UNIT_OPTIONS.find((o) => o.value === row.unit) || null}
                      onChange={(opt) => handleRowChange(row._defIdx, "unit", opt ? opt.value : "")}
                      placeholder="Unit"
                      isClearable
                      styles={SELECT_STYLES}
                      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                      menuPosition="fixed"
                    />
                  </td>

                  {/* Remarks */}
                  <td>
                    <input
                      type="text"
                      className="auth-input"
                      style={{ fontSize: "0.8rem", padding: "0.22rem 0.4rem", width: "100%" }}
                      value={row.remarks}
                      onChange={(e) => handleRowChange(row._defIdx, "remarks", e.target.value)}
                    />
                  </td>

                  {/* Delete saved row */}
                  <td style={{ textAlign: "center" }}>
                    {row.id ? (
                      <button
                        type="button"
                        className="users-action users-action--delete"
                        title="Delete saved entry"
                        disabled={deleting === row.id}
                        onClick={() => handleDelete(row.id)}
                      >
                        ✕
                      </button>
                    ) : (
                      <span style={{ color: "#3a6060", fontSize: "0.7rem" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tableError ? (
        <p className="users-status users-status--error" style={{ marginBottom: "1rem" }}>{tableError}</p>
      ) : null}

      {/* ── Cost Index Calculator ── */}
      <div style={{ borderTop: "1px solid #1e666d", paddingTop: "1rem", marginBottom: "1.25rem" }}>
        <div className="crud-page__header" style={{ marginBottom: "0.5rem" }}>
          <h2 className="module-page__title" style={{ margin: 0, fontSize: "1rem" }}>
            Cost Index Calculator
          </h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="crud-add-btn"
              onClick={handleCalculateCostIndex}
              disabled={calculatingIndex || !selectedProject}
            >
              {calculatingIndex ? "Calculating..." : "Calculate Cost Index"}
            </button>
            {costIndexRows.length > 0 ? (
              <button
                type="button"
                className="crud-add-btn"
                onClick={handleExportCostIndex}
                disabled={exportingCostIndex}
              >
                <BsDownload aria-hidden="true" />
                <span>{exportingCostIndex ? "Exporting..." : "Download Cost Index"}</span>
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <label style={{ color: "#cce8e5", display: "grid", gap: "0.25rem" }}>
            <span>{"USD -> OMR"}</span>
            <input
              type="number"
              className="auth-input"
              value={fxRates.USD}
              step="any"
              onChange={(e) => setFxRates((prev) => ({ ...prev, USD: e.target.value }))}
            />
          </label>
          <label style={{ color: "#cce8e5", display: "grid", gap: "0.25rem" }}>
            <span>{"EUR -> OMR"}</span>
            <input
              type="number"
              className="auth-input"
              value={fxRates.EUR}
              step="any"
              onChange={(e) => setFxRates((prev) => ({ ...prev, EUR: e.target.value }))}
            />
          </label>
          <label style={{ color: "#cce8e5", display: "grid", gap: "0.25rem" }}>
            <span>{"INR -> OMR"}</span>
            <input
              type="number"
              className="auth-input"
              value={fxRates.INR}
              step="any"
              onChange={(e) => setFxRates((prev) => ({ ...prev, INR: e.target.value }))}
            />
          </label>
          <label style={{ color: "#cce8e5", display: "grid", gap: "0.25rem" }}>
            <span>Default Foreign Rate</span>
            <input
              type="number"
              className="auth-input"
              value={defaultForeignRate}
              step="any"
              onChange={(e) => setDefaultForeignRate(e.target.value)}
            />
          </label>
        </div>

        <h3 className="module-page__title" style={{ margin: "0.5rem 0", fontSize: "0.95rem" }}>Products</h3>
        <div className="users-table-wrap" style={{ maxHeight: "18rem", overflowY: "auto", marginBottom: "0.75rem" }}>
          <table className="users-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Base Unit Cost</th>
                <th>Currency</th>
                <th style={{ textAlign: "right" }}>Weight</th>
                <th style={{ textAlign: "right" }}>Area</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {productRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input className="auth-input" value={row.product_code} onChange={(e) => handleProductRowChange(row.id, "product_code", e.target.value)} />
                  </td>
                  <td>
                    <input className="auth-input" value={row.product_name} onChange={(e) => handleProductRowChange(row.id, "product_name", e.target.value)} />
                  </td>
                  <td>
                    <input type="number" className="auth-input" style={{ textAlign: "right" }} value={row.qty} step="any" onChange={(e) => handleProductRowChange(row.id, "qty", e.target.value)} />
                  </td>
                  <td>
                    <input type="number" className="auth-input" style={{ textAlign: "right" }} value={row.base_unit_cost} step="any" onChange={(e) => handleProductRowChange(row.id, "base_unit_cost", e.target.value)} />
                  </td>
                  <td>
                    <Select
                      options={PRODUCT_CURRENCY_OPTIONS}
                      value={PRODUCT_CURRENCY_OPTIONS.find((o) => o.value === row.currency) || null}
                      onChange={(opt) => handleProductRowChange(row.id, "currency", opt ? opt.value : "OMR")}
                      isClearable={false}
                      styles={SELECT_STYLES}
                      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                      menuPosition="fixed"
                    />
                  </td>
                  <td>
                    <input type="number" className="auth-input" style={{ textAlign: "right" }} value={row.weight} step="any" onChange={(e) => handleProductRowChange(row.id, "weight", e.target.value)} />
                  </td>
                  <td>
                    <input type="number" className="auth-input" style={{ textAlign: "right" }} value={row.area} step="any" onChange={(e) => handleProductRowChange(row.id, "area", e.target.value)} />
                  </td>
                  <td>
                    <button type="button" className="users-action users-action--delete" onClick={() => handleRemoveProductRow(row.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="crud-add-btn" onClick={handleAddProductRow}>+ Add Product</button>

        <h3 className="module-page__title" style={{ margin: "0.75rem 0 0.5rem", fontSize: "0.95rem" }}>Cost Allocation Rules</h3>
        <div className="users-table-wrap" style={{ maxHeight: "16rem", overflowY: "auto", marginBottom: "0.75rem" }}>
          <table className="users-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Cost Head</th>
                <th style={{ textAlign: "right" }}>Line Total</th>
                <th>Basis</th>
                <th>Applies To</th>
              </tr>
            </thead>
            <tbody>
              {savedRows.map((row) => {
                const settings = costAllocationSettings[row.id] || { allocation_basis: "value", applies_to: "ALL" };
                const appliesOptions = [
                  { value: "ALL", label: "All Products" },
                  ...productRows
                    .filter((p) => p.product_code || p.product_name)
                    .map((p) => {
                      const key = (p.product_code || p.product_name).trim();
                      return { value: key, label: key };
                    }),
                ];
                return (
                  <tr key={row.id}>
                    <td>{row.cost_head}</td>
                    <td style={{ textAlign: "right" }}>{row.line_total}</td>
                    <td style={{ minWidth: 170 }}>
                      <Select
                        options={ALLOCATION_BASIS_OPTIONS}
                        value={ALLOCATION_BASIS_OPTIONS.find((o) => o.value === settings.allocation_basis) || ALLOCATION_BASIS_OPTIONS[0]}
                        onChange={(opt) => setCostAllocationSettings((prev) => ({
                          ...prev,
                          [row.id]: { ...settings, allocation_basis: opt ? opt.value : "value" },
                        }))}
                        isClearable={false}
                        styles={SELECT_STYLES}
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        menuPosition="fixed"
                      />
                    </td>
                    <td style={{ minWidth: 200 }}>
                      <Select
                        options={appliesOptions}
                        value={appliesOptions.find((o) => o.value === settings.applies_to) || appliesOptions[0]}
                        onChange={(opt) => setCostAllocationSettings((prev) => ({
                          ...prev,
                          [row.id]: { ...settings, applies_to: opt ? opt.value : "ALL" },
                        }))}
                        isClearable={false}
                        styles={SELECT_STYLES}
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        menuPosition="fixed"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {costIndexStatus ? <p className="users-status">{costIndexStatus}</p> : null}

        {costIndexSummary ? (
          <div style={{ color: "#cce8e5", marginBottom: "0.5rem" }}>
            <strong>Summary:</strong>{" "}
            Base OMR {costIndexSummary.total_base_omr} | Allocated OMR {costIndexSummary.total_allocated_omr} | Landed OMR {costIndexSummary.total_landed_omr}
          </div>
        ) : null}

        {costIndexRows.length ? (
          <div className="users-table-wrap" style={{ maxHeight: "18rem", overflowY: "auto" }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Base Unit OMR</th>
                  <th style={{ textAlign: "right" }}>Allocated OMR</th>
                  <th style={{ textAlign: "right" }}>Landed Unit OMR</th>
                  <th style={{ textAlign: "right" }}>Index Ratio</th>
                  <th style={{ textAlign: "right" }}>Index %</th>
                </tr>
              </thead>
              <tbody>
                {costIndexRows.map((row) => (
                  <tr key={row.product_key || `${row.product_code}-${row.product_name}`}>
                    <td>{row.product_code}</td>
                    <td>{row.product_name}</td>
                    <td style={{ textAlign: "right" }}>{row.qty}</td>
                    <td style={{ textAlign: "right" }}>{row.base_unit_omr}</td>
                    <td style={{ textAlign: "right" }}>{row.allocated_cost_omr}</td>
                    <td style={{ textAlign: "right" }}>{row.unit_landed_omr}</td>
                    <td style={{ textAlign: "right" }}>{row.cost_index_ratio}</td>
                    <td style={{ textAlign: "right" }}>{row.cost_index_pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ── Import / Export (admin) ── */}
      {isAdmin && (
        <div style={{ borderTop: "1px solid #1e666d", paddingTop: "1rem" }}>
          <div className="crud-page__header" style={{ marginBottom: "0.5rem" }}>
            <h2 className="module-page__title" style={{ margin: 0, fontSize: "1rem" }}>
              Import / Export LCE Costing Excel
            </h2>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="crud-add-btn"
                onClick={handleTemplateDownload}
                disabled={downloadingTemplate || importing || downloadingExport}
              >
                {downloadingTemplate ? "Downloading..." : "Download Template"}
              </button>
              <button
                type="button"
                className="crud-add-btn"
                onClick={handleImportClick}
                disabled={importing || downloadingTemplate || downloadingExport}
              >
                {importing ? "Importing..." : "Import Excel"}
              </button>
              <button
                type="button"
                className="crud-add-btn"
                onClick={handleExcelExport}
                disabled={downloadingExport || importing || downloadingTemplate}
              >
                <BsDownload aria-hidden="true" />
                <span>{downloadingExport ? "Exporting..." : "Export Excel"}</span>
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={handleImportFileChange}
          />
          {importStatus ? <p className="users-status">{importStatus}</p> : null}
          {importRowReports.length ? (
            <>
              <div className="crud-page__header" style={{ margin: "0.5rem 0" }}>
                <h3 className="module-page__title" style={{ margin: 0, fontSize: "0.95rem" }}>Import Details</h3>
                <button
                  type="button"
                  className="crud-add-btn"
                  onClick={handleImportReportExport}
                  disabled={exportingReport}
                >
                  <BsDownload aria-hidden="true" />
                  <span>{exportingReport ? "Exporting..." : "Download Report"}</span>
                </button>
              </div>
              <div className="users-table-wrap" style={{ maxHeight: "14rem", overflowY: "auto" }}>
                <table className="users-table">
                  <thead>
                    <tr><th>Row</th><th>Status</th><th>Details</th></tr>
                  </thead>
                  <tbody>
                    {importRowReports.map((r) => (
                      <tr key={`${r.row}-${r.status}`}>
                        <td>{r.row}</td><td>{r.status}</td><td>{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

export default CostingPage;

