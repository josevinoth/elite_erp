import { useEffect, useMemo, useState } from "react";
import { BsPencilSquare, BsPlusCircleFill, BsTrashFill, BsXCircle } from "react-icons/bs";

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
  computeValues = null,   // (changedKey, changedValue, allValues) => extraValues
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filters, setFilters] = useState({});

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    const field = fields.find((f) => f.key === name);
    const isFreeTextField =
      field &&
      !field.options &&
      (!field.type || ["text", "textarea", "email", "tel", "search"].includes(field.type));

    const nextValue = isFreeTextField
      ? value
          .replace(/\s+/g, " ")
          .replace(/\s*([-_])\s*/g, "$1")
          .trimStart()
      : value;

    setFormValues((prev) => {
      const nextValues = { ...prev, [name]: nextValue };
      const extras = computeValues ? computeValues(name, nextValue, nextValues) : {};
      return { ...nextValues, ...extras };
    });
  };

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

  return (
    <section className="module-page crud-page">
      <div className="crud-page__header">
        <h1 className="module-page__title">{title}</h1>
        {showAddButton ? (
          <button type="button" className="crud-add-btn" onClick={openAdd}>
            <BsPlusCircleFill aria-hidden="true" />
            <span>Add New</span>
          </button>
        ) : null}
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
                    <button
                      type="button"
                      className="users-action users-action--edit"
                      aria-label="Edit"
                      onClick={() => openEdit(row)}
                    >
                      <BsPencilSquare aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="users-action users-action--delete"
                      aria-label="Delete"
                      onClick={() => handleDelete(row[rowKey])}
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
                      <select
                        id={`mf-${field.key}`}
                        name={field.key}
                        className={`auth-input${field.disabled ? " auth-input--readonly" : ""}`}
                        value={formValues[field.key] ?? ""}
                        onChange={field.disabled ? undefined : handleChange}
                        disabled={field.disabled}
                        required={field.required}
                      >
                        <option value="">Select {field.label}</option>
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

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
                  disabled={saving}
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

