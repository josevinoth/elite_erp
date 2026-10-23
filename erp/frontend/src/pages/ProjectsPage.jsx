import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CrudPage from "../components/CrudPage";
import {
  addProjectLifecycleStatusOption,
  createProject,
  deleteProject,
  listProjectsMeta,
  listProjects,
  updateProject,
} from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import "../styles/project_quotation.css";

const COLUMNS = [
  { key: "project_id", label: "Project ID" },
  { key: "project_name", label: "Project Name" },
  { key: "proposal_date", label: "Date of Proposal" },
  { key: "updated_by", label: "Updated By" },
  { key: "order_value_omr", label: "Order Value (OMR)" },
  { key: "status", label: "Status" },
  { key: "expected_customer_need_date", label: "Expected Customer Need Date" },
];

function ProjectsPage() {
  const navigate = useNavigate();
  const [statusOptions, setStatusOptions] = useState([]);
  const currentUser = useMemo(() => getSessionUser(), []);
  const loggedInUsername = currentUser?.username || "";

  const mapOptions = (values = []) => {
    const unique = Array.from(new Set(values.filter(Boolean).map((v) => String(v).trim())));
    return unique.map((v) => ({ value: v, label: v }));
  };

  const loadMeta = useCallback(async () => {
    const data = await listProjectsMeta();
    setStatusOptions(mapOptions(data.statuses));
  }, []);

  useEffect(() => {
    loadMeta().catch(() => {
      setStatusOptions([]);
    });
  }, [loadMeta]);

  const appendStatus = async (name) => {
    const data = await addProjectLifecycleStatusOption(name);
    await loadMeta();
    return data.name;
  };

  const fields = useMemo(
    () => [
      { key: "project_id", label: "Project ID", required: true },      { key: "project_name", label: "Project Name", required: true },
      { key: "proposal_date", label: "Date of Proposal", type: "date", required: true },
      { key: "updated_by", label: "Updated By", default: loggedInUsername, required: true },
      { key: "order_value_omr", label: "Order Value (OMR)", type: "number" },
      { key: "description", label: "Description", type: "textarea", required: true },
      {
        key: "status",
        label: "Status",
        options: statusOptions,
        default: statusOptions[0]?.value || "",
        onAppend: appendStatus,
        required: true,
      },
      {
        key: "expected_customer_need_date",
        label: "Expected Customer Need Date",
        type: "date",
        required: true,
      },
    ],
    [statusOptions, loggedInUsername]
  );

  const fetchFn = useCallback(async () => {
    const data = await listProjects();
    return data.projects || [];
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createProject(payload);
    return data.project;
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateProject(id, payload);
    return data.project;
  }, []);

  return (
    <CrudPage
      title="Projects"
      columns={COLUMNS}
      fields={fields}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteProject}
      addButtonTo="/projects/add"
      editButtonTo={(row) => `/projects/record/${row.id}`}
      tableMaxHeight="55vh"
      stickyHeader
      renderHeaderActions={() => (
        <button
          type="button"
          className="crud-add-btn"
          onClick={() => navigate("/projects/quotation")}
        >
          Quotation List
        </button>
      )}
    />
  );
}

export default ProjectsPage;

