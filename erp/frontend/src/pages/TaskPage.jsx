import { useCallback, useEffect, useMemo, useState } from "react";
import CrudPage from "../components/CrudPage";
import { listUsers } from "../services/authApi";
import {
  addActivityOption,
  addTaskStatusOption,
  createTask,
  deleteTask,
  listTaskMeta,
  listTasks,
  updateTask,
} from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";

/** Counts non-Sunday days between two date strings (inclusive). Min 1. */
function calcDaysExcludingSunday(startStr, endStr) {
  if (!startStr || !endStr) return "";
  const s = new Date(startStr);
  const e = new Date(endStr);
  if (isNaN(s) || isNaN(e)) return "";
  // Work with calendar dates only (avoid TZ offsets)
  let start = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  let end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  if (start > end) [start, end] = [end, start];
  if (start.getTime() === end.getTime()) return "1";
  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0) days++; // 0 = Sunday
    cur.setDate(cur.getDate() + 1);
  }
  return String(Math.max(days, 1));
}

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
  const currentUser = useMemo(() => getSessionUser(), []);
  const loggedInUsername = currentUser?.username || "";

  const [taskStatuses, setTaskStatuses] = useState([]);
  const [activityOptions, setActivityOptions] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [omanTeamUserOptions, setOmanTeamUserOptions] = useState([]);
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
    setActivityOptions(mapOptions(metaData.activity_options || []));
    setUserOptions(mapOptions((usersData.users || []).map((u) => u.username)));
    setOmanTeamUserOptions(mapOptions(metaData.oman_team_users || []));
    setProjectOptions(
      (metaData.project_options || []).map((p) => ({ value: p.value, label: p.label }))
    );
  }, []);

  useEffect(() => {
    loadMeta().catch(() => {
      setTaskStatuses([]);
      setActivityOptions([]);
      setUserOptions([]);
      setOmanTeamUserOptions([]);
    });
  }, [loadMeta]);

  const appendTaskStatus = async (name) => {
    const data = await addTaskStatusOption(name);
    await loadMeta();
    return data.name;
  };

  const appendActivity = async (name) => {
    const data = await addActivityOption(name);
    await loadMeta();
    return data.name;
  };

  /** Re-calculate no_of_days whenever start_date or end_date changes in the form. */
  const computeValues = useCallback((changedKey, changedValue, allValues) => {
    if (changedKey === "start_date" || changedKey === "end_date") {
      const start = changedKey === "start_date" ? changedValue : allValues.start_date;
      const end = changedKey === "end_date" ? changedValue : allValues.end_date;
      const days = calcDaysExcludingSunday(start, end);
      if (days !== "") return { no_of_days: days };
    }
    return {};
  }, []);

  const fields = useMemo(
    () => [
      {
        key: "updated_by",
        label: "Updated By",
        type: "text",
        disabled: true,
        default: loggedInUsername,
      },
      {
        key: "project",
        label: "Project (ID + Name)",
        options: projectOptions,
        required: true,
      },
      { key: "proposal_date", label: "Date of Proposal", type: "date" },
      {
        key: "activity",
        label: "Activity",
        options: activityOptions,
        onAppend: appendActivity,
        required: true,
      },
      { key: "revision", label: "Revision", default: "01" },
      { key: "start_date", label: "Start Date", type: "date" },
      { key: "end_date", label: "End Date", type: "date" },
      {
        key: "no_of_days",
        label: "No of Days (auto)",
        type: "number",
        readOnly: true,
        default: "1",
      },
      { key: "drawn_by", label: "Drawn By", options: userOptions },
      { key: "approved_by", label: "Approved By", options: omanTeamUserOptions },
      { key: "approved_date", label: "Approved Date", type: "date" },
      {
        key: "task_status",
        label: "Status",
        options: taskStatuses,
        onAppend: appendTaskStatus,
      },
      { key: "project_owner", label: "Project Owner", options: omanTeamUserOptions },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
    [taskStatuses, activityOptions, userOptions, omanTeamUserOptions, projectOptions, loggedInUsername]
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
      computeValues={computeValues}
    />
  );
}

export default TaskPage;

