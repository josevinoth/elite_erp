import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addProjectLifecycleStatusOption,
  createProject,
  listProjects,
  listProjectsMeta,
  updateProject,
} from "../services/crudApi";

const EMPTY_FORM = {
  project_id: "",
  project_name: "",
  project_location: "",
  proposal_date: "",
  material_required_date: "",
  project_completion_date: "",
  mas_approved: "",
  advance_payment_received: "",
  prod_dwg_issued: "",
  prod_dwg_issued_justification: "",
  prod_dwg_release_date: "",
  prod_dwg_issued_sf: "",
  prod_dwg_issued_sf_justification: "",
  prod_dwg_release_date_sf: "",
  mas_justification: "",
  drawing_approved: "",
  drawing_justification: "",
  prev_proj_replica: "",
  order_value_omr: "",
  description: "",
  status: "",
  expected_customer_need_date: "",
};

const TEXT_KEYS = new Set([
  "project_id",
  "project_name",
  "project_location",
  "description",
  "prod_dwg_issued_justification",
  "prod_dwg_issued_sf_justification",
  "mas_justification",
  "drawing_justification",
]);

const YESNO_FIELD_CONFIG = [
  { key: "mas_approved", label: "MAS Approved" },
  { key: "advance_payment_received", label: "Advance Payment Received" },
  { key: "prod_dwg_issued", label: "Prod DWG Issued" },
  { key: "prod_dwg_issued_sf", label: "Prod DWG Issued SF" },
  { key: "drawing_approved", label: "Drawing Approved" },
  { key: "prev_proj_replica", label: "Prev Project Replica" },
];

function normalizeInputText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*([-_])\s*/g, "$1")
    .trimStart();
}

function normalizePayloadValue(key, value) {
  if (!TEXT_KEYS.has(key)) {
    return value;
  }
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*([-_])\s*/g, "$1")
    .trim();
}

function toDateInputValue(value) {
  const source = String(value || "").trim();
  if (!source) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    return source;
  }
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ProjectsAddPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const isEditMode = Boolean(projectId);

  const [statusOptions, setStatusOptions] = useState([]);
  const [yesNoOptions, setYesNoOptions] = useState([]);
  const [formValues, setFormValues] = useState(() => ({ ...EMPTY_FORM }));
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const mapOptions = useCallback((values = []) => {
    const unique = Array.from(new Set(values.filter(Boolean).map((v) => String(v).trim())));
    return unique.map((v) => ({ value: v, label: v }));
  }, []);

  const ensureStatusExists = useCallback((options, value) => {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return options;
    }
    if (options.some((opt) => String(opt.value).trim().toLowerCase() === normalized.toLowerCase())) {
      return options;
    }
    return [{ value: normalized, label: normalized }, ...options];
  }, []);

  const loadMeta = useCallback(async () => {
    const data = await listProjectsMeta();
    const statusValues = mapOptions(data.statuses);
    setStatusOptions((prev) => {
      const currentStatus = formValues.status || prev[0]?.value || "";
      return ensureStatusExists(statusValues, currentStatus);
    });
    setYesNoOptions(Array.isArray(data.yes_no_options) ? data.yes_no_options : []);
  }, [ensureStatusExists, formValues.status, mapOptions]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        const data = await listProjectsMeta();
        if (!alive) {
          return;
        }
        const statusValues = mapOptions(data.statuses);
        setStatusOptions(ensureStatusExists(statusValues, formValues.status));
        setYesNoOptions(Array.isArray(data.yes_no_options) ? data.yes_no_options : []);
      } catch (_err) {
        if (alive) {
          setStatusOptions([]);
          setYesNoOptions([]);
        }
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [ensureStatusExists, formValues.status, mapOptions]);

  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    let alive = true;
    setLoading(true);
    setError("");

    listProjects()
      .then((data) => {
        if (!alive) {
          return;
        }
        const projects = data.projects || [];
        const record = projects.find((row) => String(row.id) === String(projectId));
        if (!record) {
          setError("Project not found.");
          return;
        }

        const nextValues = {
          project_id: String(record.project_id || ""),
          project_name: String(record.project_name || ""),
          project_location: String(record.project_location || ""),
          proposal_date: toDateInputValue(record.proposal_date),
          material_required_date: toDateInputValue(record.material_required_date),
          project_completion_date: toDateInputValue(record.project_completion_date),
          mas_approved: String(record.mas_approved ?? ""),
          advance_payment_received: String(record.advance_payment_received ?? ""),
          prod_dwg_issued: String(record.prod_dwg_issued ?? ""),
          prod_dwg_issued_justification: String(record.prod_dwg_issued_justification || ""),
          prod_dwg_release_date: toDateInputValue(record.prod_dwg_release_date),
          prod_dwg_issued_sf: String(record.prod_dwg_issued_sf ?? ""),
          prod_dwg_issued_sf_justification: String(record.prod_dwg_issued_sf_justification || ""),
          prod_dwg_release_date_sf: toDateInputValue(record.prod_dwg_release_date_sf),
          mas_justification: String(record.mas_justification || ""),
          drawing_approved: String(record.drawing_approved ?? ""),
          drawing_justification: String(record.drawing_justification || ""),
          prev_proj_replica: String(record.prev_proj_replica ?? ""),
          order_value_omr: String(record.order_value_omr ?? ""),
          description: String(record.description || ""),
          status: String(record.status || ""),
          expected_customer_need_date: toDateInputValue(record.expected_customer_need_date),
        };

        setFormValues(nextValues);
        setStatusOptions((prev) => ensureStatusExists(prev, nextValues.status));
      })
      .catch((err) => {
        if (alive) {
          setError(err.message || "Failed to load project record.");
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [ensureStatusExists, isEditMode, projectId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: TEXT_KEYS.has(name) ? normalizeInputText(value) : value,
    }));
  };

  const handleAddStatus = async () => {
    const raw = window.prompt("Add new status");
    const nextValue = raw ? raw.trim() : "";
    if (!nextValue) {
      return;
    }

    try {
      setError("");
      const data = await addProjectLifecycleStatusOption(nextValue);
      const normalized = String(data?.name || nextValue).trim();
      await loadMeta();
      setFormValues((prev) => ({ ...prev, status: normalized }));
      setStatusOptions((prev) => ensureStatusExists(prev, normalized));
    } catch (err) {
      setError(err.message || "Unable to add status.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    const payload = Object.fromEntries(
      Object.entries(formValues).map(([key, value]) => [key, normalizePayloadValue(key, value)])
    );

    try {
      if (isEditMode) {
        await updateProject(projectId, payload);
        setStatus("Project updated successfully.");
      } else {
        const data = await createProject(payload);
        const saved = data?.project;
        if (saved?.id) {
          navigate(`/projects/record/${saved.id}`, { replace: true });
          return;
        }
        setStatus("Project created successfully.");
        navigate("/projects", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <h1 className="module-page__title" style={{ margin: 0 }}>
          {isEditMode ? "Project Edit" : "Project Add"}
        </h1>
        <button
          type="button"
          className="crud-add-btn"
          onClick={() => navigate("/projects")}
          disabled={saving}
        >
          Back to List
        </button>
      </div>

      {error ? <p className="users-status users-status--error">{error}</p> : null}
      {status ? <p className="users-status users-status--success">{status}</p> : null}
      {loading ? <p className="users-status">Loading project...</p> : null}

      {!loading ? (
        <form className="modal-form projects-detail-form" onSubmit={handleSubmit}>
          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="project-id">Project ID *</label>
            <input
              id="project-id"
              name="project_id"
              type="text"
              className="auth-input"
              value={formValues.project_id}
              onChange={handleChange}
              required
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="project-name">Project Name *</label>
            <input
              id="project-name"
              name="project_name"
              type="text"
              className="auth-input"
              value={formValues.project_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="project-location">Project Location</label>
            <input
              id="project-location"
              name="project_location"
              type="text"
              className="auth-input"
              value={formValues.project_location}
              onChange={handleChange}
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="proposal-date">Date of Proposal *</label>
            <input
              id="proposal-date"
              name="proposal_date"
              type="date"
              className="auth-input"
              value={formValues.proposal_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="material-required-date">Material Required Date</label>
            <input
              id="material-required-date"
              name="material_required_date"
              type="date"
              className="auth-input"
              value={formValues.material_required_date}
              onChange={handleChange}
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="project-completion-date">Project Completion Date</label>
            <input
              id="project-completion-date"
              name="project_completion_date"
              type="date"
              className="auth-input"
              value={formValues.project_completion_date}
              onChange={handleChange}
            />
          </div>

          {YESNO_FIELD_CONFIG.map((field) => (
            <div className="modal-form__row" key={field.key}>
              <label className="modal-form__label" htmlFor={field.key}>{field.label}</label>
              <select
                id={field.key}
                name={field.key}
                className="auth-input"
                value={formValues[field.key]}
                onChange={handleChange}
              >
                <option value="">Use Default</option>
                {yesNoOptions.map((opt) => (
                  <option key={`${field.key}-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="prod-dwg-issued-justification">Prod DWG Issued Justification</label>
            <textarea
              id="prod-dwg-issued-justification"
              name="prod_dwg_issued_justification"
              className="auth-input modal-form__textarea"
              value={formValues.prod_dwg_issued_justification}
              onChange={handleChange}
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="prod-dwg-release-date">Prod DWG Release Date</label>
            <input
              id="prod-dwg-release-date"
              name="prod_dwg_release_date"
              type="date"
              className="auth-input"
              value={formValues.prod_dwg_release_date}
              onChange={handleChange}
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="prod-dwg-issued-sf-justification">Prod DWG Issued SF Justification</label>
            <textarea
              id="prod-dwg-issued-sf-justification"
              name="prod_dwg_issued_sf_justification"
              className="auth-input modal-form__textarea"
              value={formValues.prod_dwg_issued_sf_justification}
              onChange={handleChange}
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="prod-dwg-release-date-sf">Prod DWG Release Date SF</label>
            <input
              id="prod-dwg-release-date-sf"
              name="prod_dwg_release_date_sf"
              type="date"
              className="auth-input"
              value={formValues.prod_dwg_release_date_sf}
              onChange={handleChange}
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="mas-justification">MAS Justification</label>
            <textarea
              id="mas-justification"
              name="mas_justification"
              className="auth-input modal-form__textarea"
              value={formValues.mas_justification}
              onChange={handleChange}
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="drawing-justification">Drawing Justification</label>
            <textarea
              id="drawing-justification"
              name="drawing_justification"
              className="auth-input modal-form__textarea"
              value={formValues.drawing_justification}
              onChange={handleChange}
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="order-value">Order Value (OMR)</label>
            <input
              id="order-value"
              name="order_value_omr"
              type="number"
              className="auth-input"
              value={formValues.order_value_omr}
              onChange={handleChange}
              step="any"
            />
          </div>

          <div className="modal-form__row projects-detail-form__status-row">
            <label className="modal-form__label" htmlFor="project-status">Status *</label>
            <div className="modal-select-row">
              <select
                id="project-status"
                name="status"
                className="auth-input"
                value={formValues.status}
                onChange={handleChange}
                required
              >
                <option value="">Select Status</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button type="button" className="modal-add-option" onClick={handleAddStatus}>
                + Add
              </button>
            </div>
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="need-date">Expected Customer Need Date *</label>
            <input
              id="need-date"
              name="expected_customer_need_date"
              type="date"
              className="auth-input"
              value={formValues.expected_customer_need_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="modal-form__row projects-detail-form__full-row">
            <label className="modal-form__label" htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              className="auth-input modal-form__textarea"
              value={formValues.description}
              onChange={handleChange}
              required
            />
          </div>

          <div className="modal-form__actions projects-detail-form__actions">
            <button
              type="button"
              className="modal-btn modal-btn--cancel"
              onClick={() => navigate("/projects")}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="modal-btn modal-btn--save" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default ProjectsAddPage;

