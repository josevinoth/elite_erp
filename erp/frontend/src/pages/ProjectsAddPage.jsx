import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BsBoxes,
  BsCashCoin,
  BsClipboardData,
  BsPlusCircleFill,
  BsX,
} from "react-icons/bs";
import {
  addProjectLifecycleStatusOption,
  createProject,
  createProjectCosting,
  createQuotationSummary,
  listCustomers,
  listProjectCostings,
  listProjects,
  listProjectsMeta,
  listQuotationSummaries,
  updateProject,
} from "../services/crudApi";
import {
  EMPTY_FORM,
  getOptionLabelByValue,
  normalizeInputText,
  normalizeOptionLabel,
  normalizePayloadValue,
  toDateInputValue,
  YESNO_FIELD_CONFIG,
} from "../utils/projectsAddPageUtils";
import ProjectLayoutDrawingSection from "./ProjectLayoutDrawingSection";
import ProjectCostingPage from "./ProjectCostingPage";
import ProjectQuotationPage from "./ProjectQuotationPage";
import "../styles/LCAAddPage.css";
import "../styles/project_quotation.css";

const TEXT_FIELD_KEYS = new Set([
  "project_id",
  "project_name",
  "project_location",
  "description",
  "prod_dwg_issued_justification",
  "prod_dwg_issued_sf_justification",
  "mas_justification",
  "drawing_justification",
]);

function normalizeUpdatedBy(value) {
  if (value && typeof value === "object") {
    return String(value.username || value.name || value.label || value.email || value.id || "");
  }
  if (typeof value === "string" && value.trim().startsWith("{")) {
    const usernameMatch = value.match(/['"]username['"]\s*:\s*['"]([^'"]+)['"]/);
    if (usernameMatch) return usernameMatch[1];
  }
  return value == null ? "—" : String(value);
}

function renderStatusBadge(statusStr) {
  const norm = String(statusStr || "").toLowerCase();
  let bg = "#f1f5f9";
  let color = "#475569";
  if (norm.includes("complete")) {
    bg = "#dcfce7";
    color = "#166534";
  } else if (norm.includes("progress")) {
    bg = "#e0f2fe";
    color = "#0369a1";
  } else if (norm.includes("hold")) {
    bg = "#fef9c3";
    color = "#854d0e";
  } else if (norm.includes("cancel")) {
    bg = "#fee2e2";
    color = "#991b1b";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.2rem 0.55rem",
        borderRadius: "9999px",
        fontSize: "0.76rem",
        fontWeight: 600,
        backgroundColor: bg,
        color: color,
        textTransform: "capitalize",
      }}
    >
      {statusStr || "—"}
    </span>
  );
}

function ProjectsAddPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const isEditMode = Boolean(projectId);
  const focusLayoutDrawingId = new URLSearchParams(window.location.search).get("layoutDrawingId");

  const [statusOptions, setStatusOptions] = useState([]);
  const [yesNoOptions, setYesNoOptions] = useState([]);
  const [projectCategoryOptions, setProjectCategoryOptions] = useState([]);
  const [projectSubCategoryOptions, setProjectSubCategoryOptions] = useState([]);
  const [standardLabOptions, setStandardLabOptions] = useState([]);
  const [nonStandardLabOptions, setNonStandardLabOptions] = useState([]);
  const [nonMoeProductSeriesOptions, setNonMoeProductSeriesOptions] = useState([]);
  const [projectOwnerOptions, setProjectOwnerOptions] = useState([]);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [approvalStatusOptions, setApprovalStatusOptions] = useState([]);
  const [approverOptions, setApproverOptions] = useState([]);
  const [formValues, setFormValues] = useState(() => ({ ...EMPTY_FORM }));
  const [loading, setLoading] = useState(isEditMode);
  const [savingProject, setSavingProject] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
  const [existingProjects, setExistingProjects] = useState([]);

  // Sub-table states
  const [quotations, setQuotations] = useState([]);
  const [quotationsLoading, setQuotationsLoading] = useState(false);
  const [costings, setCostings] = useState([]);
  const [costingsLoading, setCostingsLoading] = useState(false);

  // Modal drilldown states
  const [quotationModalState, setQuotationModalState] = useState({ open: false, quotationId: null });
  const [costingModalState, setCostingModalState] = useState({ open: false, costingId: null });
  const [actionLoading, setActionLoading] = useState(false);

  const mapOptions = useCallback((values = []) => {
    const unique = Array.from(new Set(values.filter(Boolean).map((v) => String(v).trim())));
    return unique.map((v) => ({ value: v, label: v }));
  }, []);

  const ensureStatusExists = useCallback((options, value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return options;
    if (options.some((opt) => String(opt.value).trim().toLowerCase() === normalized.toLowerCase())) return options;
    return [{ value: normalized, label: normalized }, ...options];
  }, []);

  const loadMeta = useCallback(async () => {
    const data = await listProjectsMeta();
    const statusValues = mapOptions(data.statuses);
    setStatusOptions((prev) => ensureStatusExists(statusValues, formValues.status || prev[0]?.value || ""));
    setYesNoOptions(Array.isArray(data.yes_no_options) ? data.yes_no_options : []);
    setProjectCategoryOptions(Array.isArray(data.project_categories) ? data.project_categories : []);
    setProjectSubCategoryOptions(Array.isArray(data.project_sub_categories) ? data.project_sub_categories : []);
    setStandardLabOptions(Array.isArray(data.standard_labs) ? data.standard_labs : []);
    setNonStandardLabOptions(Array.isArray(data.non_standard_labs) ? data.non_standard_labs : []);
    setNonMoeProductSeriesOptions(Array.isArray(data.non_moe_product_series) ? data.non_moe_product_series : []);
    setProjectOwnerOptions(Array.isArray(data.project_owners) ? data.project_owners : []);
    setCustomerOptions(Array.isArray(data.customers) ? data.customers : []);
    setApprovalStatusOptions(Array.isArray(data.approval_statuses) ? data.approval_statuses : []);
    setApproverOptions(Array.isArray(data.approvers) ? data.approvers : []);
    if (!isEditMode && !formValues.status) {
      const defaultStatus = String(data.default_status || "").trim();
      if (defaultStatus) setFormValues((prev) => ({ ...prev, status: defaultStatus }));
    }
  }, [ensureStatusExists, formValues.status, isEditMode, mapOptions]);

  useEffect(() => {
    let alive = true;
    listCustomers()
      .then((data) => {
        if (!alive) return;
        const custs = Array.isArray(data.customers)
          ? data.customers.map((c) => ({
              value: String(c.id),
              label: c.customer_code ? `${c.customer_code} - ${c.name}` : c.name,
              name: c.name,
            }))
          : [];
        setCustomerOptions(custs);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const data = await listProjectsMeta();
        if (!alive) return;
        const statusValues = mapOptions(data.statuses);
        setStatusOptions(ensureStatusExists(statusValues, formValues.status));
        const yesNo = Array.isArray(data.yes_no_options) ? data.yes_no_options : [];
        setYesNoOptions(yesNo);
        setProjectCategoryOptions(Array.isArray(data.project_categories) ? data.project_categories : []);
        setProjectSubCategoryOptions(Array.isArray(data.project_sub_categories) ? data.project_sub_categories : []);
        setStandardLabOptions(Array.isArray(data.standard_labs) ? data.standard_labs : []);
        setNonStandardLabOptions(Array.isArray(data.non_standard_labs) ? data.non_standard_labs : []);
        setNonMoeProductSeriesOptions(Array.isArray(data.non_moe_product_series) ? data.non_moe_product_series : []);
        setProjectOwnerOptions(Array.isArray(data.project_owners) ? data.project_owners : []);
        if (Array.isArray(data.customers) && data.customers.length > 0) {
          setCustomerOptions(data.customers);
        }
        setApprovalStatusOptions(Array.isArray(data.approval_statuses) ? data.approval_statuses : []);
        setApproverOptions(Array.isArray(data.approvers) ? data.approvers : []);
        if (!isEditMode && !formValues.status) {
          const defaultStatus = String(data.default_status || "").trim();
          if (defaultStatus) setFormValues((prev) => ({ ...prev, status: defaultStatus }));
        }
        if (!isEditMode) {
          const noOption = yesNo.find((opt) => String(opt?.label || "").trim().toLowerCase() === "no");
          const noValue = noOption ? String(noOption.value) : "";
          if (noValue) {
            setFormValues((prev) => {
              const next = { ...prev };
              YESNO_FIELD_CONFIG.forEach(({ key }) => { if (!String(next[key] || "").trim()) next[key] = noValue; });
              return next;
            });
          }
        }
      } catch (_err) {
        if (alive) {
          setStatusOptions([]); setYesNoOptions([]); setProjectCategoryOptions([]);
          setProjectSubCategoryOptions([]); setStandardLabOptions([]); setNonStandardLabOptions([]);
          setNonMoeProductSeriesOptions([]); setProjectOwnerOptions([]); setApprovalStatusOptions([]); setApproverOptions([]);
        }
      }
    };
    run();
    return () => { alive = false; };
  }, [ensureStatusExists, formValues.status, isEditMode, mapOptions]);

  // Always load all projects for duplicate validation
  useEffect(() => {
    let alive = true;
    listProjects()
      .then((data) => {
        if (!alive) return;
        setExistingProjects(Array.isArray(data?.projects) ? data.projects : []);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Load project record
  useEffect(() => {
    if (!isEditMode) return;
    let alive = true;
    setLoading(true);
    setProjectError("");
    listProjects()
      .then((data) => {
        if (!alive) return;
        const record = (data.projects || []).find((row) => String(row.id) === String(projectId));
        if (!record) { setProjectError("Project not found."); return; }
        const nextValues = {
          project_id: String(record.project_id || ""),
          project_name: String(record.project_name || ""),
          customer: String(record.customer ?? record.customer_id ?? ""),
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
          project_category: String(record.project_category ?? ""),
          project_sub_category: String(record.project_sub_category ?? ""),
          standard_lab: String(record.standard_lab ?? ""),
          non_standard_lab: String(record.non_standard_lab ?? ""),
          non_moe_product_series: String(record.non_moe_product_series ?? ""),
          project_owner: String(record.project_owner ?? ""),
          order_value_omr: String(record.order_value_omr ?? ""),
          description: String(record.description || ""),
          status: String(record.status || ""),
          expected_customer_need_date: toDateInputValue(record.expected_customer_need_date),
        };
        setFormValues(nextValues);
        setStatusOptions((prev) => ensureStatusExists(prev, nextValues.status));
      })
      .catch((err) => { if (alive) setProjectError(err.message || "Failed to load project record."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ensureStatusExists, isEditMode, projectId]);

  // Load project quotations
  const loadQuotations = useCallback(async () => {
    if (!projectId) return;
    setQuotationsLoading(true);
    try {
      const data = await listQuotationSummaries(projectId);
      setQuotations(Array.isArray(data?.quotations) ? data.quotations : []);
    } catch (_err) {
      setQuotations([]);
    } finally {
      setQuotationsLoading(false);
    }
  }, [projectId]);

  // Load project costings
  const loadCostings = useCallback(async () => {
    if (!projectId) return;
    setCostingsLoading(true);
    try {
      const data = await listProjectCostings();
      const all = Array.isArray(data?.costings) ? data.costings : [];
      const scoped = all.filter((c) => String(c.project_id || c.project?.id || "") === String(projectId));
      setCostings(scoped);
    } catch (_err) {
      setCostings([]);
    } finally {
      setCostingsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isEditMode) {
      loadQuotations();
      loadCostings();
    }
  }, [isEditMode, loadCostings, loadQuotations]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: TEXT_FIELD_KEYS.has(name) ? normalizeInputText(value) : value }));
  };

  const selectedProjectCategoryLabel = getOptionLabelByValue(projectCategoryOptions, formValues.project_category);
  const selectedProjectSubCategoryLabel = getOptionLabelByValue(projectSubCategoryOptions, formValues.project_sub_category);
  const normalizedProjectCategory = normalizeOptionLabel(selectedProjectCategoryLabel);
  const normalizedProjectSubCategory = normalizeOptionLabel(selectedProjectSubCategoryLabel);
  const isNonMoeCategory = normalizedProjectCategory.includes("non moe");
  const isMoeCategory = normalizedProjectCategory.includes("moe") && !isNonMoeCategory;
  const isNonStandardMoeLabSubCategory =
    normalizedProjectSubCategory.includes("non standard moe lab") || normalizedProjectSubCategory.includes("non standard moe");
  const isStandardMoeLabSubCategory =
    (normalizedProjectSubCategory.includes("standard moe lab") || normalizedProjectSubCategory.includes("standard moe")) &&
    !isNonStandardMoeLabSubCategory;
  const isProjectSubCategoryEnabled = isMoeCategory;
  const isNonMoeProductSeriesEnabled = isNonMoeCategory;
  const isStandardLabEnabled = isProjectSubCategoryEnabled && isStandardMoeLabSubCategory;
  const isNonStandardLabEnabled = isProjectSubCategoryEnabled && isNonStandardMoeLabSubCategory;

  useEffect(() => {
    const waitingForCategoryOptions = Boolean(formValues.project_category) && projectCategoryOptions.length === 0;
    const waitingForSubCategoryOptions = Boolean(formValues.project_sub_category) && projectSubCategoryOptions.length === 0;
    if (waitingForCategoryOptions || waitingForSubCategoryOptions) return;
    setFormValues((prev) => {
      const next = { ...prev };
      let changed = false;
      if (!isProjectSubCategoryEnabled && next.project_sub_category) { next.project_sub_category = ""; changed = true; }
      if (!isStandardLabEnabled && next.standard_lab) { next.standard_lab = ""; changed = true; }
      if (!isNonStandardLabEnabled && next.non_standard_lab) { next.non_standard_lab = ""; changed = true; }
      if (!isNonMoeProductSeriesEnabled && next.non_moe_product_series) { next.non_moe_product_series = ""; changed = true; }
      return changed ? next : prev;
    });
  }, [
    formValues.project_category, formValues.project_sub_category,
    isNonMoeProductSeriesEnabled, isNonStandardLabEnabled,
    isProjectSubCategoryEnabled, isStandardLabEnabled,
    projectCategoryOptions, projectSubCategoryOptions,
  ]);

  const isNoSelected = (fieldKey) => {
    const selected = String(formValues[fieldKey] ?? "").trim();
    if (!selected) return false;
    const option = yesNoOptions.find((opt) => String(opt?.value ?? "").trim() === selected);
    return String(option?.label ?? selected).trim().toLowerCase() === "no";
  };

  const handleAddStatus = async () => {
    const raw = window.prompt("Add new status");
    const nextValue = raw ? raw.trim() : "";
    if (!nextValue) return;
    try {
      setProjectError("");
      const data = await addProjectLifecycleStatusOption(nextValue);
      const normalized = String(data?.name || nextValue).trim();
      await loadMeta();
      setFormValues((prev) => ({ ...prev, status: normalized }));
      setStatusOptions((prev) => ensureStatusExists(prev, normalized));
    } catch (err) {
      setProjectError(err.message || "Unable to add status.");
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const trimmed = String(value || "").trim().toLowerCase();
    if (!trimmed) return;
    const currentId = isEditMode ? String(projectId) : null;

    if (name === "project_id") {
      const dup = existingProjects.find(
        (p) => String(p.id) !== currentId && String(p.project_id || "").trim().toLowerCase() === trimmed
      );
      if (dup) {
        setProjectError(`Project ID '${value.trim()}' already exists. Duplicate project ID is not allowed.`);
      } else if (projectError && projectError.includes("Project ID")) {
        setProjectError("");
      }
    } else if (name === "project_name") {
      const dup = existingProjects.find(
        (p) => String(p.id) !== currentId && String(p.project_name || "").trim().toLowerCase() === trimmed
      );
      if (dup) {
        setProjectError(`Project Name '${value.trim()}' already exists. Duplicate project name is not allowed.`);
      } else if (projectError && projectError.includes("Project Name")) {
        setProjectError("");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSavingProject(true);
    setProjectError("");
    setProjectStatus("");

    const trimmedId = String(formValues.project_id || "").trim();
    const trimmedName = String(formValues.project_name || "").trim();

    if (!trimmedId) {
      setProjectError("Project ID is required.");
      setSavingProject(false);
      return;
    }

    if (!trimmedName) {
      setProjectError("Project Name is required.");
      setSavingProject(false);
      return;
    }

    const currentId = isEditMode ? String(projectId) : null;
    const dupId = existingProjects.find(
      (p) => String(p.id) !== currentId && String(p.project_id || "").trim().toLowerCase() === trimmedId.toLowerCase()
    );
    if (dupId) {
      setProjectError(`Project ID '${trimmedId}' already exists. Duplicate project ID is not allowed.`);
      setSavingProject(false);
      return;
    }

    const dupName = existingProjects.find(
      (p) => String(p.id) !== currentId && String(p.project_name || "").trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (dupName) {
      setProjectError(`Project Name '${trimmedName}' already exists. Duplicate project name is not allowed.`);
      setSavingProject(false);
      return;
    }

    const payload = Object.fromEntries(
      Object.entries(formValues).map(([key, value]) => [key, normalizePayloadValue(key, value)])
    );
    try {
      if (isEditMode) {
        await updateProject(projectId, payload);
        setProjectStatus("Project updated successfully.");
        listProjects().then((d) => setExistingProjects(d?.projects || [])).catch(() => {});
      } else {
        const data = await createProject(payload);
        const saved = data?.project;
        if (saved?.id) { navigate(`/projects/record/${saved.id}`, { replace: true }); return; }
        setProjectStatus("Project created successfully.");
        navigate("/projects", { replace: true });
      }
    } catch (err) {
      setProjectError(err.message || "Save failed.");
    } finally {
      setSavingProject(false);
    }
  };

  // Add quotation handler
  const handleAddNewQuotation = async () => {
    if (!projectId) return;
    setActionLoading(true);
    try {
      const res = await createQuotationSummary({ project_id: projectId });
      if (res?.requires_confirmation) {
        const confirmed = window.confirm(
          res.message ||
            `A quotation already exists for this project. Create revision ${res.next_revision_code || "next"}?`
        );
        if (confirmed) {
          const confRes = await createQuotationSummary(
            { project_id: projectId },
            { confirmNewRevision: true }
          );
          if (confRes?.quotation?.id) {
            setQuotationModalState({ open: true, quotationId: confRes.quotation.id });
          }
        }
        return;
      }
      if (res?.quotation?.id) {
        setQuotationModalState({ open: true, quotationId: res.quotation.id });
      }
    } catch (err) {
      alert(err.message || "Failed to create quotation.");
    } finally {
      setActionLoading(false);
    }
  };

  // Add costing handler
  const handleAddNewCosting = async () => {
    if (!projectId) return;
    setActionLoading(true);
    try {
      const existing = costings.find(
        (c) => String(c.project_id || c.project?.id || "") === String(projectId)
      );
      if (existing) {
        setCostingModalState({ open: true, costingId: existing.id });
        return;
      }
      const res = await createProjectCosting({ project_id: projectId });
      if (res?.costing?.id) {
        setCostingModalState({ open: true, costingId: res.costing.id });
      } else {
        alert(res?.message || "Failed to create project costing.");
      }
    } catch (err) {
      alert(err.message || "Failed to create project costing.");
    } finally {
      setActionLoading(false);
    }
  };

  const closeQuotationModal = useCallback(() => {
    setQuotationModalState({ open: false, quotationId: null });
    loadQuotations();
  }, [loadQuotations]);

  const closeCostingModal = useCallback(() => {
    setCostingModalState({ open: false, costingId: null });
    loadCostings();
  }, [loadCostings]);

  return (
    <section className="module-page">
      <div className="crud-page__header pq-header">
        <h1 className="module-page__title module-page__title--projects pq-title">
          {isEditMode ? "Project Edit" : "Project Add"}
        </h1>
        <button
          type="button"
          className="crud-add-btn"
          onClick={() => navigate("/projects")}
          disabled={savingProject}
        >
          Back to List
        </button>
      </div>

      {projectError ? <p className="users-status users-status--error">{projectError}</p> : null}
      {projectStatus ? <p className="users-status users-status--success">{projectStatus}</p> : null}
      {loading ? <p className="users-status">Loading project...</p> : null}

      {!loading ? (
        <>
          {/* ── CARD 1: Project Details (2-Column Form) ── */}
          <div className="project-form-card">
            <div className="project-form-card-header">
              <h2 className="project-form-card-title">
                {isEditMode ? `Edit Project: ${formValues.project_id || ""}` : "Create New Project"}
              </h2>
              {isEditMode && formValues.project_id ? (
                <span className="project-form-card-badge">Record #{projectId}</span>
              ) : null}
            </div>

            <form className="project-form-2col-grid" onSubmit={handleSubmit}>
              {/* Row 1 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="project-id">Project ID *</label>
                <div className="lca-input">
                  <input id="project-id" name="project_id" type="text" className="auth-input" value={formValues.project_id} onChange={handleChange} onBlur={handleBlur} required />
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="project-name">Project Name *</label>
                <div className="lca-input">
                  <input id="project-name" name="project_name" type="text" className="auth-input" value={formValues.project_name} onChange={handleChange} onBlur={handleBlur} required />
                </div>
              </div>

              {/* Row 2 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="project-customer">Customer</label>
                <div className="lca-input">
                  <select id="project-customer" name="customer" className="auth-input" value={formValues.customer} onChange={handleChange}>
                    <option value="">Select Customer (Optional)</option>
                    {customerOptions.map((opt) => (
                      <option key={`customer-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="project-location">Project Location</label>
                <div className="lca-input">
                  <input id="project-location" name="project_location" type="text" className="auth-input" value={formValues.project_location} onChange={handleChange} />
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="project-owner">Project Owner</label>
                <div className="lca-input">
                  <select id="project-owner" name="project_owner" className="auth-input" value={formValues.project_owner} onChange={handleChange}>
                    <option value="">Select Project Owner</option>
                    {projectOwnerOptions.map((opt) => (
                      <option key={`project-owner-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="proposal-date">Date of Proposal *</label>
                <div className="lca-input">
                  <input id="proposal-date" name="proposal_date" type="date" className="auth-input" value={formValues.proposal_date} onChange={handleChange} required />
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="need-date">Expected Customer Need Date *</label>
                <div className="lca-input">
                  <input id="need-date" name="expected_customer_need_date" type="date" className="auth-input" value={formValues.expected_customer_need_date} onChange={handleChange} required />
                </div>
              </div>

              {/* Row 4 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="material-required-date">Material Required Date</label>
                <div className="lca-input">
                  <input id="material-required-date" name="material_required_date" type="date" className="auth-input" value={formValues.material_required_date} onChange={handleChange} />
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="project-completion-date">Project Completion Date</label>
                <div className="lca-input">
                  <input id="project-completion-date" name="project_completion_date" type="date" className="auth-input" value={formValues.project_completion_date} onChange={handleChange} />
                </div>
              </div>

              {/* Row 5 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="order-value">Order Value (OMR)</label>
                <div className="lca-input">
                  <input id="order-value" name="order_value_omr" type="number" className="auth-input" value={formValues.order_value_omr} onChange={handleChange} step="any" />
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="project-status">Status *</label>
                <div className="lca-input">
                  <div className="modal-select-row" style={{ display: "flex", gap: "0.35rem" }}>
                    <select id="project-status" name="status" className="auth-input" value={formValues.status} onChange={handleChange} required>
                      <option value="">Select Status</option>
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button type="button" className="modal-add-option" onClick={handleAddStatus}>+ Add</button>
                  </div>
                </div>
              </div>

              {/* Row 6 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="mas_approved">MAS Approved?</label>
                <div className="lca-input">
                  <select id="mas_approved" name="mas_approved" className="auth-input" value={formValues.mas_approved} onChange={handleChange}>
                    {yesNoOptions.map((opt) => (
                      <option key={`mas_approved-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="mas-justification">MAS Justification</label>
                <div className="lca-input">
                  <textarea id="mas-justification" name="mas_justification" className="auth-input modal-form__textarea" rows="2" value={formValues.mas_justification} onChange={handleChange} disabled={!isNoSelected("mas_approved")} />
                </div>
              </div>

              {/* Row 7 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="prod_dwg_issued">Production Drawing Issued?</label>
                <div className="lca-input">
                  <select id="prod_dwg_issued" name="prod_dwg_issued" className="auth-input" value={formValues.prod_dwg_issued} onChange={handleChange}>
                    {yesNoOptions.map((opt) => (
                      <option key={`prod_dwg_issued-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="prod-dwg-issued-justification">Production Drawing Not Issued - Justification</label>
                <div className="lca-input">
                  <textarea id="prod-dwg-issued-justification" name="prod_dwg_issued_justification" className="auth-input modal-form__textarea" rows="2" value={formValues.prod_dwg_issued_justification} onChange={handleChange} disabled={!isNoSelected("prod_dwg_issued")} />
                </div>
              </div>

              {/* Row 8 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="prod-dwg-release-date">Production Drawing Release Date</label>
                <div className="lca-input">
                  <input id="prod-dwg-release-date" name="prod_dwg_release_date" type="date" className="auth-input" value={formValues.prod_dwg_release_date} onChange={handleChange} />
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="prod-dwg-release-date-sf">Production Drawing Release Date To Shop Floor</label>
                <div className="lca-input">
                  <input id="prod-dwg-release-date-sf" name="prod_dwg_release_date_sf" type="date" className="auth-input" value={formValues.prod_dwg_release_date_sf} onChange={handleChange} />
                </div>
              </div>

              {/* Row 9 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="prod_dwg_issued_sf">Production Drawing Issued To Shop Floor?</label>
                <div className="lca-input">
                  <select id="prod_dwg_issued_sf" name="prod_dwg_issued_sf" className="auth-input" value={formValues.prod_dwg_issued_sf} onChange={handleChange}>
                    {yesNoOptions.map((opt) => (
                      <option key={`prod_dwg_issued_sf-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="prod-dwg-issued-sf-justification">Production Drawing Not Issued Shop Floor - Justification</label>
                <div className="lca-input">
                  <textarea id="prod-dwg-issued-sf-justification" name="prod_dwg_issued_sf_justification" className="auth-input modal-form__textarea" rows="2" value={formValues.prod_dwg_issued_sf_justification} onChange={handleChange} disabled={!isNoSelected("prod_dwg_issued_sf")} />
                </div>
              </div>

              {/* Row 10 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="drawing_approved">Drawing Approved?</label>
                <div className="lca-input">
                  <select id="drawing_approved" name="drawing_approved" className="auth-input" value={formValues.drawing_approved} onChange={handleChange}>
                    {yesNoOptions.map((opt) => (
                      <option key={`drawing_approved-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="drawing-justification">Drawing Justification</label>
                <div className="lca-input">
                  <textarea id="drawing-justification" name="drawing_justification" className="auth-input modal-form__textarea" rows="2" value={formValues.drawing_justification} onChange={handleChange} disabled={!isNoSelected("drawing_approved")} />
                </div>
              </div>

              {/* Row 11 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="advance_payment_received">Advance Payment Received?</label>
                <div className="lca-input">
                  <select id="advance_payment_received" name="advance_payment_received" className="auth-input" value={formValues.advance_payment_received} onChange={handleChange}>
                    {yesNoOptions.map((opt) => (
                      <option key={`advance_payment_received-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="prev_proj_replica">Previous Project Replica?</label>
                <div className="lca-input">
                  <select id="prev_proj_replica" name="prev_proj_replica" className="auth-input" value={formValues.prev_proj_replica} onChange={handleChange}>
                    {yesNoOptions.map((opt) => (
                      <option key={`prev_proj_replica-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 12 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="project-category">Project Category</label>
                <div className="lca-input">
                  <select id="project-category" name="project_category" className="auth-input" value={formValues.project_category} onChange={handleChange}>
                    <option value="">Select Project Category</option>
                    {projectCategoryOptions.map((opt) => (
                      <option key={`project-category-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="project-sub-category">Project Sub Category</label>
                <div className="lca-input">
                  <select id="project-sub-category" name="project_sub_category" className="auth-input" value={formValues.project_sub_category} onChange={handleChange} disabled={!isProjectSubCategoryEnabled}>
                    <option value="">Select Project Sub Category</option>
                    {projectSubCategoryOptions.map((opt) => (
                      <option key={`project-sub-category-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 13 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="standard-lab">Standard Lab</label>
                <div className="lca-input">
                  <select id="standard-lab" name="standard_lab" className="auth-input" value={formValues.standard_lab} onChange={handleChange} disabled={!isStandardLabEnabled}>
                    <option value="">Select Standard Lab</option>
                    {standardLabOptions.map((opt) => (
                      <option key={`standard-lab-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="non-standard-lab">Non Standard Lab</label>
                <div className="lca-input">
                  <select id="non-standard-lab" name="non_standard_lab" className="auth-input" value={formValues.non_standard_lab} onChange={handleChange} disabled={!isNonStandardLabEnabled}>
                    <option value="">Select Non Standard Lab</option>
                    {nonStandardLabOptions.map((opt) => (
                      <option key={`non-standard-lab-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 14 */}
              <div className="lca-field-pair">
                <label className="lca-label" htmlFor="non-moe-product-series">Non MOE Product Series</label>
                <div className="lca-input">
                  <select id="non-moe-product-series" name="non_moe_product_series" className="auth-input" value={formValues.non_moe_product_series} onChange={handleChange} disabled={!isNonMoeProductSeriesEnabled}>
                    <option value="">Select Non MOE Product Series</option>
                    {nonMoeProductSeriesOptions.map((opt) => (
                      <option key={`non-moe-product-series-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div />

              {/* Full width Description */}
              <div className="lca-field-pair lca-field-pair--full-width">
                <label className="lca-label" htmlFor="description">Description *</label>
                <div className="lca-input">
                  <textarea id="description" name="description" className="auth-input modal-form__textarea" rows="3" value={formValues.description} onChange={handleChange} required />
                </div>
              </div>

              {/* Actions */}
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.75rem" }}>
                <button type="button" className="modal-btn modal-btn--cancel" onClick={() => navigate("/projects")} disabled={savingProject}>Cancel</button>
                <button type="submit" className="modal-btn modal-btn--save" disabled={savingProject}>{savingProject ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>

          {/* ── CARD 2: Layout Drawings ── */}
          <ProjectLayoutDrawingSection
            projectId={projectId}
            isEditMode={isEditMode}
            savingProject={savingProject}
            focusLayoutDrawingId={focusLayoutDrawingId}
            approverOptions={approverOptions}
            approvalStatusOptions={approvalStatusOptions}
          />

          {/* ── CARD 3: Project Quotations List ── */}
          <div className="project-subtable-card">
            <div className="project-subtable-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <BsCashCoin size={18} aria-hidden="true" />
                <h3 className="project-subtable-title">Project Quotations</h3>
                {isEditMode ? (
                  <span className="project-subtable-badge">
                    {quotations.length} {quotations.length === 1 ? "Quotation" : "Quotations"}
                  </span>
                ) : null}
              </div>
              {isEditMode ? (
                <button
                  type="button"
                  className="crud-add-btn"
                  onClick={handleAddNewQuotation}
                  disabled={actionLoading}
                >
                  <BsPlusCircleFill style={{ marginRight: "0.35rem" }} aria-hidden="true" />
                  Add Quotation
                </button>
              ) : null}
            </div>

            <div className="project-subtable-wrap">
              {!isEditMode ? (
                <p className="users-status pq-disabled-note" style={{ margin: "1rem" }}>
                  Save the project first to manage quotation records.
                </p>
              ) : quotationsLoading ? (
                <p className="users-status" style={{ margin: "1rem" }}>Loading quotations...</p>
              ) : (
                <table className="users-table project-costing-table" style={{ width: "100%", margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center" }}>Quotation #</th>
                      <th style={{ textAlign: "center" }}>Revision</th>
                      <th style={{ textAlign: "right" }}>Material Cost</th>
                      <th style={{ textAlign: "right" }}>Total Cost To Elite</th>
                      <th style={{ textAlign: "right" }}>Planned Order Value</th>
                      <th style={{ textAlign: "center" }}>Status</th>
                      <th style={{ textAlign: "center" }}>Updated By</th>
                      <th style={{ textAlign: "center" }}>Updated On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map((row) => (
                      <tr
                        key={`quotation-row-${row.id}`}
                        className="project-subtable-row--clickable"
                        onClick={() => setQuotationModalState({ open: true, quotationId: row.id })}
                        title="Click to view/edit quotation"
                      >
                        <td style={{ textAlign: "center", fontWeight: 700, color: "#1e40af" }}>
                          {row.quotation_number || `CQ_${row.id}`}
                        </td>
                        <td style={{ textAlign: "center" }}>{row.revision_code || row.revision_number || "R0"}</td>
                        <td style={{ textAlign: "right" }}>{row.final_material_cost || row.total_material_cost || "0.00"}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{row.total_cost_to_elite || row.total_quotation_cost || "0.00"}</td>
                        <td style={{ textAlign: "right" }}>{row.planned_order_value || "0.00"}</td>
                        <td style={{ textAlign: "center" }}>{renderStatusBadge(row.quotation_status_name || row.quotation_status || row.status)}</td>
                        <td style={{ textAlign: "center" }}>{normalizeUpdatedBy(row.updated_by)}</td>
                        <td style={{ textAlign: "center" }}>{row.updated_on || "—"}</td>
                      </tr>
                    ))}
                    {!quotations.length ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                          No quotation records found for this project. Click "+ Add Quotation" to create one.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── CARD 4: Project Costings List ── */}
          <div className="project-subtable-card">
            <div className="project-subtable-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <BsBoxes size={18} aria-hidden="true" />
                <h3 className="project-subtable-title">Project Costings</h3>
                {isEditMode ? (
                  <span className="project-subtable-badge">
                    {costings.length} {costings.length === 1 ? "Costing" : "Costings"}
                  </span>
                ) : null}
              </div>
              {isEditMode ? (
                <button
                  type="button"
                  className="crud-add-btn"
                  onClick={handleAddNewCosting}
                  disabled={actionLoading}
                >
                  <BsPlusCircleFill style={{ marginRight: "0.35rem" }} aria-hidden="true" />
                  Add Costing
                </button>
              ) : null}
            </div>

            <div className="project-subtable-wrap">
              {!isEditMode ? (
                <p className="users-status pq-disabled-note" style={{ margin: "1rem" }}>
                  Save the project first to manage project costing records.
                </p>
              ) : costingsLoading ? (
                <p className="users-status" style={{ margin: "1rem" }}>Loading costings...</p>
              ) : (
                <table className="users-table project-costing-table" style={{ width: "100%", margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center" }}>Costing ID</th>
                      <th style={{ textAlign: "center" }}>Quotation #</th>
                      <th style={{ textAlign: "right" }}>Material Cost</th>
                      <th style={{ textAlign: "right" }}>Total Cost To Elite</th>
                      <th style={{ textAlign: "center" }}>Status</th>
                      <th style={{ textAlign: "center" }}>Updated By</th>
                      <th style={{ textAlign: "center" }}>Updated On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costings.map((row) => (
                      <tr
                        key={`costing-row-${row.id}`}
                        className="project-subtable-row--clickable"
                        onClick={() => setCostingModalState({ open: true, costingId: row.id })}
                        title="Click to view/edit costing"
                      >
                        <td style={{ textAlign: "center", fontWeight: 700, color: "#1e40af" }}>
                          {row.costing_id || `COST_${row.id}`}
                        </td>
                        <td style={{ textAlign: "center" }}>{row.quotation_number || "—"}</td>
                        <td style={{ textAlign: "right" }}>{row.total_material_cost || "0.00"}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{row.total_cost_to_elite || "0.00"}</td>
                        <td style={{ textAlign: "center" }}>{renderStatusBadge(row.status_name || row.status)}</td>
                        <td style={{ textAlign: "center" }}>{normalizeUpdatedBy(row.updated_by)}</td>
                        <td style={{ textAlign: "center" }}>{row.updated_on || "—"}</td>
                      </tr>
                    ))}
                    {!costings.length ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                          No project costing records found for this project. Click "+ Add Costing" to create one.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── MODAL 1: Quotation Summary & Items Drilldown ── */}
          {quotationModalState.open ? (
            <div
              className="project-drilldown-modal-backdrop"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeQuotationModal();
              }}
            >
              <div className="project-drilldown-modal-container">
                <div className="project-drilldown-modal-header">
                  <h3 className="project-drilldown-modal-title">
                    <BsCashCoin aria-hidden="true" />
                    <span>Project Quotation Details</span>
                  </h3>
                  <button
                    type="button"
                    className="project-drilldown-modal-close"
                    onClick={closeQuotationModal}
                    title="Close"
                    aria-label="Close"
                  >
                    &times;
                  </button>
                </div>
                <div className="project-drilldown-modal-body">
                  <ProjectQuotationPage
                    projectId={projectId}
                    embedded={true}
                    initialQuotationId={quotationModalState.quotationId}
                    onClose={closeQuotationModal}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* ── MODAL 2: Project Costing Summary & Items Drilldown ── */}
          {costingModalState.open ? (
            <div
              className="project-drilldown-modal-backdrop"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeCostingModal();
              }}
            >
              <div className="project-drilldown-modal-container">
                <div className="project-drilldown-modal-header">
                  <h3 className="project-drilldown-modal-title">
                    <BsBoxes aria-hidden="true" />
                    <span>Project Costing Details</span>
                  </h3>
                  <button
                    type="button"
                    className="project-drilldown-modal-close"
                    onClick={closeCostingModal}
                    title="Close"
                    aria-label="Close"
                  >
                    &times;
                  </button>
                </div>
                <div className="project-drilldown-modal-body">
                  <ProjectCostingPage
                    projectId={projectId}
                    projectCode={formValues.project_id}
                    embedded={true}
                    initialCostingId={costingModalState.costingId}
                    onClose={closeCostingModal}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default ProjectsAddPage;
