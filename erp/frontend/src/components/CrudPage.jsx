import { useEffect, useMemo, useRef, useState } from "react";
import { BsDownload, BsPencilSquare, BsPlusCircleFill, BsTrashFill, BsXCircle } from "react-icons/bs";
import Select from "react-select";
import { exportRowsToExcel } from "../utils/exportToExcel";

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
  columns,
  fields,
  fetchFn,
  createFn,
  updateFn,
  deleteFn,
  rowKey = "id",
  tableMaxHeight = null,
  stickyHeader = false,
  tableWrapClassName = "",
  showAddButton = true,
  showExportButton = true,
  exportFileName = null,
  openAddOnMount = false,
  rowActions = [],
  computeValues = null,   // (changedKey, changedValue, allValues) => extraValues
  editDisabledPredicate = null,  // (row) => boolean
  deleteDisabledPredicate = null,  // (row) => boolean
  editDisabledTitle = "Edit",
  deleteDisabledTitle = "Delete",
  saveDisabledPredicate = null,  // (editRow, formValues) => boolean
  saveDisabledTitle = "Save",
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filters, setFilters] = useState({});
  const autoOpenedRef = useRef(false);

  const emptyForm = () =>
    Object.fromEntries(fields.map((f) => [f.key, f.default ?? ""]));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchFn()
      .then((data) => {
        if (alive) setRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (alive) setError(e.message || "Failed to load data.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fetchFn]);

  const openAdd = () => {
    setEditRow(null);
    setFormValues(emptyForm());
    setShowModal(true);
  };

  useEffect(() => {
    if (openAddOnMount && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setEditRow(null);
      setFormValues(emptyForm());
      setShowModal(true);
    }
  }, [openAddOnMount, fields]);

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
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditRow(null);
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

  const selectStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: 40,
        backgroundColor: "#0a3338",
        borderColor: state.isFocused ? "#16b2a5" : "#1e666d",
        boxShadow: state.isFocused ? "0 0 0 3px rgba(22,178,165,0.2)" : "none",
        ":hover": { borderColor: "#25d2c3" },
      }),
      singleValue: (base) => ({ ...base, color: "#f0fffe" }),
      input: (base) => ({ ...base, color: "#f0fffe" }),
      placeholder: (base) => ({ ...base, color: "#cce8e5" }),
      menu: (base) => ({ ...base, backgroundColor: "#0b3a40", zIndex: 2000 }),
      menuPortal: (base) => ({ ...base, zIndex: 3000 }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? "#11474f" : "#0b3a40",
        color: "#f0fffe",
      }),
    }),
    []
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

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
            const ok = window.confirm(
              `${retryErr.message}\n\nUse revision "${suggested}" instead?`
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
        setRows((prev) =>
          prev.map((r) => (r[rowKey] === editRow[rowKey] ? savedRow : r))
        );
      } else {
        setRows((prev) => [savedRow, ...prev]);
      }
      closeModal();
    } catch (err) {
      setError(err.message || "Save failed.");
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

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    setError("");
    try {
      await deleteFn(id);
      setRows((prev) => prev.filter((r) => r[rowKey] !== id));
    } catch (err) {
      setError(err.message || "Delete failed.");
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = async () => {
    setError("");
    setExporting(true);
    try {
      await exportRowsToExcel({
        fileName: exportFileName || title,
        sheetName: title,
        columns,
        rows: displayedRows,
      });
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const displayedRows = useMemo(() => {
    const normalizedFilters = Object.entries(filters).filter(([, value]) =>
      String(value || "").trim()
    );

    const filtered = normalizedFilters.length
      ? rows.filter((row) =>
          normalizedFilters.every(([key, value]) =>
            String(row[key] ?? "")
              .toLowerCase()
              .includes(String(value).trim().toLowerCase())
          )
        )
      : rows;

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
  }, [rows, filters, sortConfig]);

  const saveDisabled =
    typeof saveDisabledPredicate === "function"
      ? saveDisabledPredicate(editRow, formValues)
      : false;

  return (
    <section className="module-page crud-page">
      <div className="crud-page__header">
        <h1 className="module-page__title">{title}</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {showExportButton ? (
            <button type="button" className="crud-add-btn" onClick={handleExport} disabled={exporting || loading}>
              <BsDownload aria-hidden="true" />
              <span>{exporting ? "Exporting..." : "Download Excel"}</span>
            </button>
          ) : null}
          {showAddButton ? (
            <button type="button" className="crud-add-btn" onClick={openAdd}>
              <BsPlusCircleFill aria-hidden="true" />
              <span>Add New</span>
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="users-status users-status--error">{error}</p> : null}
      {loading ? <p className="users-status">Loading...</p> : null}

      <div
        className={`users-table-wrap${stickyHeader ? " users-table-wrap--sticky" : ""}${tableWrapClassName ? ` ${tableWrapClassName}` : ""}`}
        style={tableMaxHeight ? { maxHeight: tableMaxHeight, overflowY: "auto" } : undefined}
      >
        <table className="users-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={stickyHeader ? "users-table__sticky-head" : undefined}
                >
                  <button
                    type="button"
                    className="users-table__sort-btn"
                    onClick={() => handleSort(col.key)}
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
              ))}
              <th className={stickyHeader ? "users-table__sticky-head" : undefined}>Actions</th>
            </tr>
            <tr>
              {columns.map((col) => (
                <th key={`filter-${col.key}`}>
                  <input
                    className="users-table__filter-input"
                    type="text"
                    placeholder="Filter"
                    value={filters[col.key] ?? ""}
                    onChange={(e) => handleFilterChange(col.key, e.target.value)}
                  />
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {!loading && displayedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1}>No records found.</td>
              </tr>
            ) : null}
            {displayedRows.map((row) => (
              <tr key={row[rowKey]}>
                {columns.map((col) => (
                  <td key={col.key}>{row[col.key]}</td>
                ))}
                <td>
                  <div className="users-actions">
                    {rowActions.map((action) => {
                      const Icon = action.icon;
                      const isDisabled =
                        typeof action.disabled === "function"
                          ? action.disabled(row)
                          : !!action.disabled;
                      return (
                        <button
                          key={action.key || action.label}
                          type="button"
                          className={`users-action ${action.className || ""}`.trim()}
                          aria-label={action.ariaLabel || action.label}
                          title={isDisabled ? (action.disabledTitle || action.label) : action.label}
                          disabled={isDisabled}
                          onClick={() => !isDisabled && action.onClick?.(row)}
                        >
                          {Icon ? <Icon aria-hidden="true" /> : action.label}
                        </button>
                      );
                    })}
                    {(() => {
                      const editDisabled =
                        typeof editDisabledPredicate === "function"
                          ? editDisabledPredicate(row)
                          : false;
                      return (
                        <button
                          type="button"
                          className="users-action users-action--edit"
                          aria-label="Edit"
                          title={editDisabled ? editDisabledTitle : "Edit"}
                          disabled={editDisabled}
                          onClick={() => !editDisabled && openEdit(row)}
                        >
                          <BsPencilSquare aria-hidden="true" />
                        </button>
                      );
                    })()}
                    {(() => {
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
                          onClick={() => !deleteDisabled && handleDelete(row[rowKey])}
                        >
                          <BsTrashFill aria-hidden="true" />
                        </button>
                      );
                    })()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal ? (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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
              {fields.map((field) => (
                <div className="modal-form__row" key={field.key}>
                  <label className="modal-form__label" htmlFor={`mf-${field.key}`}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>

                  {field.options ? (
                    <div className="modal-select-row">
                      <Select
                        inputId={`mf-${field.key}`}
                        className="crud-select"
                        classNamePrefix="crud-select"
                        isSearchable
                        isDisabled={field.disabled}
                        options={field.options}
                        placeholder={`Select ${field.label}`}
                        value={
                          field.options.find(
                            (opt) => String(opt.value) === String(formValues[field.key] ?? "")
                          ) || null
                        }
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
                        required={field.required}
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
                      required={field.required}
                      readOnly={field.readOnly}
                    />
                  ) : (
                    <input
                      id={`mf-${field.key}`}
                      name={field.key}
                      type={field.type || "text"}
                      className={`auth-input${(field.readOnly || field.disabled) ? " auth-input--readonly" : ""}`}
                      value={formValues[field.key] ?? ""}
                      onChange={(!field.readOnly && !field.disabled) ? handleChange : undefined}
                      readOnly={field.readOnly}
                      disabled={field.disabled}
                      required={field.required}
                    />
                  )}
                </div>
              ))}

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
    </section>
  );
}

export default CrudPage;

