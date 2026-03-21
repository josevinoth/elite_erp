import { useCallback, useEffect, useMemo, useState } from "react";
import CrudPage from "../components/CrudPage";
import {
  addProjectLifecycleStatusOption,
  createProject,
  deleteProject,
  listProjectsMeta,
  listProjects,
  updateProject,
} from "../services/crudApi";

const COLUMNS = [
  { key: "project_id", label: "Project ID" },
  { key: "project_name", label: "Project Name" },
  { key: "updated_by", label: "Updated By" },
  { key: "order_value_omr", label: "Order Value (OMR)" },
  { key: "status", label: "Status" },
  { key: "expected_customer_need_date", label: "Expected Customer Need Date" },
];

function ProjectsPage() {
  const [statusOptions, setStatusOptions] = useState([]);

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
      { key: "project_id", label: "Project ID", required: true },
      { key: "project_name", label: "Project Name" },
      { key: "updated_by", label: "Updated By" },
      { key: "order_value_omr", label: "Order Value (OMR)", type: "number" },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "status",
        label: "Status",
        options: statusOptions,
        default: statusOptions[0]?.value || "",
        onAppend: appendStatus,
      },
      { key: "expected_customer_need_date", label: "Expected Customer Need Date", type: "date" },
    ],
    [statusOptions]
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
      tableMaxHeight="55vh"
      stickyHeader
      tableWrapClassName="projects-table--no-header-bg"
    />
  );
}

export default ProjectsPage;

