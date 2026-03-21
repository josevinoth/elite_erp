import { useCallback, useEffect, useMemo, useState } from "react";
import CrudPage from "../components/CrudPage";
import { listUsers } from "../services/authApi";
import {
  addTaskStatusOption,
  createTask,
  deleteTask,
  listTaskMeta,
  listTasks,
  updateTask,
} from "../services/crudApi";

const COLUMNS = [
  { key: "project_id_name", label: "Project ID + Name" },
  { key: "proposal_date", label: "Date of Proposal" },
  { key: "activity", label: "Activity" },
  { key: "revision", label: "Revision" },
  { key: "start_date", label: "Start Date" },
  { key: "end_date", label: "End Date" },
  { key: "no_of_days", label: "No of Days" },
  { key: "drawn_by", label: "Drawn By" },
  { key: "approved_by", label: "Approved By" },
  { key: "approved_date", label: "Approved Date" },
  { key: "task_status", label: "Status" },
];

function TaskPage() {
  const [taskStatuses, setTaskStatuses] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);

  const toTitleCase = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const mapOptions = (values = []) => {
    const unique = Array.from(new Set(values.filter(Boolean).map((v) => toTitleCase(v))));
    return unique.map((v) => ({ value: v, label: v }));
  };

  const loadMeta = useCallback(async () => {
    const [metaData, usersData] = await Promise.all([listTaskMeta(), listUsers()]);
    setTaskStatuses(mapOptions(metaData.task_statuses));
    setUserOptions(mapOptions((usersData.users || []).map((u) => u.username)));
    setProjectOptions(
      (metaData.project_options || []).map((p) => ({ value: p.value, label: p.label }))
    );
  }, []);

  useEffect(() => {
    loadMeta().catch(() => {
      setTaskStatuses([]);
      setUserOptions([]);
    });
  }, [loadMeta]);

  const appendTaskStatus = async (name) => {
    const data = await addTaskStatusOption(name);
    await loadMeta();
    return data.name;
  };

  const fields = useMemo(
    () => [
      {
        key: "project",
        label: "Project (ID + Name)",
        options: projectOptions,
        required: true,
      },
      { key: "proposal_date", label: "Date of Proposal", type: "date" },
      { key: "activity", label: "Activity" },
      { key: "revision", label: "Revision" },
      { key: "start_date", label: "Start Date", type: "date" },
      { key: "end_date", label: "End Date", type: "date" },
      { key: "no_of_days", label: "No of Days", type: "number" },
      { key: "drawn_by", label: "Drawn By", options: userOptions },
      { key: "approved_by", label: "Approved By", options: userOptions },
      { key: "approved_date", label: "Approved Date", type: "date" },
      {
        key: "task_status",
        label: "Status",
        options: taskStatuses,
        onAppend: appendTaskStatus,
      },
      { key: "project_owner", label: "Project Owner", options: userOptions },
      { key: "remarks", label: "Remarks", type: "textarea" },
      { key: "updated_by", label: "Updated By", options: userOptions },
    ],
    [taskStatuses, userOptions, projectOptions]
  );

  const fetchFn = useCallback(async () => {
    const data = await listTasks();
    return data.tasks || [];
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createTask(payload);
    return data.task;
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateTask(id, payload);
    return data.task;
  }, []);

  return (
    <CrudPage
      title="Tasks"
      columns={COLUMNS}
      fields={fields}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteTask}
    />
  );
}

export default TaskPage;

