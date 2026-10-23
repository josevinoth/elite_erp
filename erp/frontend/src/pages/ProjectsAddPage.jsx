import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addProjectLifecycleStatusOption,
  createProject,
  listProjects,
  listProjectsMeta,
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
import "../styles/project_quotation.css";
const TEXT_FIELD_KEYS = new Set([
  "project_id","project_name","project_location","description",
  "prod_dwg_issued_justification","prod_dwg_issued_sf_justification",
  "mas_justification","drawing_justification",
]);
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
  const [approvalStatusOptions, setApprovalStatusOptions] = useState([]);
  const [approverOptions, setApproverOptions] = useState([]);
  const [formValues, setFormValues] = useState(() => ({ ...EMPTY_FORM }));
  const [loading, setLoading] = useState(isEditMode);
  const [savingProject, setSavingProject] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
  const [quotationStatus, setQuotationStatus] = useState({ type: "", message: "" });
  const [costingStatus, setCostingStatus] = useState({ type: "", message: "" });
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
    setApprovalStatusOptions(Array.isArray(data.approval_statuses) ? data.approval_statuses : []);
    setApproverOptions(Array.isArray(data.approvers) ? data.approvers : []);
    if (!isEditMode && !formValues.status) {
      const defaultStatus = String(data.default_status || "").trim();
      if (defaultStatus) setFormValues((prev) => ({ ...prev, status: defaultStatus }));
    }
  }, [ensureStatusExists, formValues.status, isEditMode, mapOptions]);
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
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSavingProject(true);
    setProjectError("");
    setProjectStatus("");
    const payload = Object.fromEntries(
      Object.entries(formValues).map(([key, value]) => [key, normalizePayloadValue(key, value)])
    );
    try {
      if (isEditMode) {
        await updateProject(projectId, payload);
        setProjectStatus("Project updated successfully.");
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

  const handleQuotationSummaryStatus = useCallback((nextStatus) => {
    setQuotationStatus(nextStatus || { type: "", message: "" });
  }, []);

  const handleCostingStatus = useCallback((nextStatus) => {
    setCostingStatus(nextStatus || { type: "", message: "" });
  }, []);
  return (
    <section className="module-page">
      <div className="crud-page__header pq-header">
        <h1 className="module-page__title module-page__title--projects pq-title">{isEditMode ? "Project Edit" : "Project Add"}</h1>
        <button type="button" className="crud-add-btn" onClick={() => navigate("/projects")} disabled={savingProject}>Back to List</button>
      </div>
      {projectError ? <p className="users-status users-status--error">{projectError}</p> : null}
      {projectStatus ? <p className="users-status users-status--success">{projectStatus}</p> : null}
      {loading ? <p className="users-status">Loading project...</p> : null}
      {!loading ? (
        <>
          <form className="modal-form projects-detail-form" onSubmit={handleSubmit}>
            <div className="projects-detail-form__full-row projects-detail-card-grid pq-project-form-card">
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="project-id">Project ID *</label><input id="project-id" name="project_id" type="text" className="auth-input" value={formValues.project_id} onChange={handleChange} required /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="project-name">Project Name *</label><input id="project-name" name="project_name" type="text" className="auth-input" value={formValues.project_name} onChange={handleChange} required /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="project-location">Project Location</label><input id="project-location" name="project_location" type="text" className="auth-input" value={formValues.project_location} onChange={handleChange} /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="project-owner">Project Owner</label><select id="project-owner" name="project_owner" className="auth-input" value={formValues.project_owner} onChange={handleChange}><option value="">Select Project Owner</option>{projectOwnerOptions.map((opt) => <option key={`project-owner-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="proposal-date">Date of Proposal *</label><input id="proposal-date" name="proposal_date" type="date" className="auth-input" value={formValues.proposal_date} onChange={handleChange} required /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="material-required-date">Material Required Date</label><input id="material-required-date" name="material_required_date" type="date" className="auth-input" value={formValues.material_required_date} onChange={handleChange} /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="project-completion-date">Project Completion Date</label><input id="project-completion-date" name="project_completion_date" type="date" className="auth-input" value={formValues.project_completion_date} onChange={handleChange} /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="need-date">Expected Customer Need Date *</label><input id="need-date" name="expected_customer_need_date" type="date" className="auth-input" value={formValues.expected_customer_need_date} onChange={handleChange} required /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="order-value">Order Value (OMR)</label><input id="order-value" name="order_value_omr" type="number" className="auth-input" value={formValues.order_value_omr} onChange={handleChange} step="any" /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="mas_approved">MAS Approved?</label><select id="mas_approved" name="mas_approved" className="auth-input" value={formValues.mas_approved} onChange={handleChange}>{yesNoOptions.map((opt) => <option key={`mas_approved-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="mas-justification">MAS Justification</label><textarea id="mas-justification" name="mas_justification" className="auth-input modal-form__textarea" value={formValues.mas_justification} onChange={handleChange} disabled={!isNoSelected("mas_approved")} /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="prod_dwg_issued">Production Drawing Issued?</label><select id="prod_dwg_issued" name="prod_dwg_issued" className="auth-input" value={formValues.prod_dwg_issued} onChange={handleChange}>{yesNoOptions.map((opt) => <option key={`prod_dwg_issued-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="prod-dwg-issued-justification">Production Drawing Not Issued - Justification</label><textarea id="prod-dwg-issued-justification" name="prod_dwg_issued_justification" className="auth-input modal-form__textarea" value={formValues.prod_dwg_issued_justification} onChange={handleChange} disabled={!isNoSelected("prod_dwg_issued")} /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="prod_dwg_issued_sf">Production Drawing Issued To Shop Floor?</label><select id="prod_dwg_issued_sf" name="prod_dwg_issued_sf" className="auth-input" value={formValues.prod_dwg_issued_sf} onChange={handleChange}>{yesNoOptions.map((opt) => <option key={`prod_dwg_issued_sf-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="prod-dwg-issued-sf-justification">Production Drawing Not Issued Shop Floor - Justification</label><textarea id="prod-dwg-issued-sf-justification" name="prod_dwg_issued_sf_justification" className="auth-input modal-form__textarea" value={formValues.prod_dwg_issued_sf_justification} onChange={handleChange} disabled={!isNoSelected("prod_dwg_issued_sf")} /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="prod-dwg-release-date">Production Drawing Release Date</label><input id="prod-dwg-release-date" name="prod_dwg_release_date" type="date" className="auth-input" value={formValues.prod_dwg_release_date} onChange={handleChange} /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="prod-dwg-release-date-sf">Production Drawing Release Date To Shop Floor</label><input id="prod-dwg-release-date-sf" name="prod_dwg_release_date_sf" type="date" className="auth-input" value={formValues.prod_dwg_release_date_sf} onChange={handleChange} /></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="drawing_approved">Drawing Approved?</label><select id="drawing_approved" name="drawing_approved" className="auth-input" value={formValues.drawing_approved} onChange={handleChange}>{yesNoOptions.map((opt) => <option key={`drawing_approved-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="drawing-justification">Drawing Justification</label><textarea id="drawing-justification" name="drawing_justification" className="auth-input modal-form__textarea" value={formValues.drawing_justification} onChange={handleChange} disabled={!isNoSelected("drawing_approved")} /></div>
              {YESNO_FIELD_CONFIG.map((field) => (
                <div className="modal-form__row" key={field.key}>
                  <label className="modal-form__label" htmlFor={field.key}>{field.label}</label>
                  <select id={field.key} name={field.key} className="auth-input" value={formValues[field.key]} onChange={handleChange}>{yesNoOptions.map((opt) => <option key={`${field.key}-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select>
                </div>
              ))}
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="project-category">Project Category</label><select id="project-category" name="project_category" className="auth-input" value={formValues.project_category} onChange={handleChange}><option value="">Select Project Category</option>{projectCategoryOptions.map((opt) => <option key={`project-category-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="project-sub-category">Project Sub Category</label><select id="project-sub-category" name="project_sub_category" className="auth-input" value={formValues.project_sub_category} onChange={handleChange} disabled={!isProjectSubCategoryEnabled}><option value="">Select Project Sub Category</option>{projectSubCategoryOptions.map((opt) => <option key={`project-sub-category-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="standard-lab">Standard Lab</label><select id="standard-lab" name="standard_lab" className="auth-input" value={formValues.standard_lab} onChange={handleChange} disabled={!isStandardLabEnabled}><option value="">Select Standard Lab</option>{standardLabOptions.map((opt) => <option key={`standard-lab-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="non-standard-lab">Non Standard Lab</label><select id="non-standard-lab" name="non_standard_lab" className="auth-input" value={formValues.non_standard_lab} onChange={handleChange} disabled={!isNonStandardLabEnabled}><option value="">Select Non Standard Lab</option>{nonStandardLabOptions.map((opt) => <option key={`non-standard-lab-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="modal-form__row"><label className="modal-form__label" htmlFor="non-moe-product-series">Non MOE Product Series</label><select id="non-moe-product-series" name="non_moe_product_series" className="auth-input" value={formValues.non_moe_product_series} onChange={handleChange} disabled={!isNonMoeProductSeriesEnabled}><option value="">Select Non MOE Product Series</option>{nonMoeProductSeriesOptions.map((opt) => <option key={`non-moe-product-series-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="modal-form__row projects-detail-form__status-row">
                <label className="modal-form__label" htmlFor="project-status">Status *</label>
                <div className="modal-select-row">
                  <select id="project-status" name="status" className="auth-input" value={formValues.status} onChange={handleChange} required><option value="">Select Status</option>{statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                  <button type="button" className="modal-add-option" onClick={handleAddStatus}>+ Add</button>
                </div>
              </div>
              <div className="modal-form__row projects-detail-form__full-row"><label className="modal-form__label" htmlFor="description">Description *</label><textarea id="description" name="description" className="auth-input modal-form__textarea" value={formValues.description} onChange={handleChange} required /></div>
              <div className="modal-form__actions projects-detail-form__actions pq-project-form-actions">
                <button type="button" className="modal-btn modal-btn--cancel" onClick={() => navigate("/projects")} disabled={savingProject}>Cancel</button>
                <button type="submit" className="modal-btn modal-btn--save" disabled={savingProject}>{savingProject ? "Saving..." : "Save"}</button>
              </div>
            </div>
          </form>
          <ProjectLayoutDrawingSection
            projectId={projectId}
            isEditMode={isEditMode}
            savingProject={savingProject}
            focusLayoutDrawingId={focusLayoutDrawingId}
            approverOptions={approverOptions}
            approvalStatusOptions={approvalStatusOptions}
          />
          <details
            open
            className="costing-selector-details pq-details-card pq-project-quotation-panel"
          >
            {quotationStatus.message ? (
              <p className={`${quotationStatus.type === "error" ? "users-status users-status--error" : "users-status users-status--success"} pq-disabled-note`} style={{ marginTop: 0 }}>
                {quotationStatus.message}
              </p>
            ) : null}
            <summary
              className="auth-input costing-selector-summary pq-details-summary pq-project-quotation-summary"
            >
              Quotation List
            </summary>
            <div className="pq-details-content">
              {isEditMode ? (
                <ProjectQuotationPage projectId={projectId} embedded onSummaryStatusChange={handleQuotationSummaryStatus} />
              ) : (
                <p className="users-status pq-disabled-note" style={{ marginTop: 0 }}>
                  Save the project first to add quotation items.
                </p>
              )}
            </div>
          </details>

          <details
            open
            className="costing-selector-details pq-details-card pq-project-quotation-panel"
          >
            {costingStatus.message ? (
              <p className={`${costingStatus.type === "error" ? "users-status users-status--error" : "users-status users-status--success"} pq-disabled-note`} style={{ marginTop: 0 }}>
                {costingStatus.message}
              </p>
            ) : null}
            <summary
              className="auth-input costing-selector-summary pq-details-summary pq-project-quotation-summary"
            >
              Project Costing List
            </summary>
            <div className="pq-details-content">
              {isEditMode ? (
                <ProjectCostingPage
                  projectId={projectId}
                  projectCode={formValues.project_id}
                  embedded
                  onStatusChange={handleCostingStatus}
                />
              ) : (
                <p className="users-status pq-disabled-note" style={{ marginTop: 0 }}>
                  Save the project first to manage project costing records.
                </p>
              )}
            </div>
          </details>
        </>
      ) : null}
    </section>
  );
}
export default ProjectsAddPage;
