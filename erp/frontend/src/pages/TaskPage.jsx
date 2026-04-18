import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BsClockHistory, BsDownload } from "react-icons/bs";
import CrudPage from "../components/CrudPage";
import TaskBarChart from "../components/TaskBarChart";
import TaskCommentsPanel from "../components/TaskCommentsPanel";
import { useLocation, useNavigate } from "react-router-dom";
import { listUsers } from "../services/authApi";
import {
  addActivityOption,
  addTaskStatusOption,
  createTask,
  deleteTask,
  downloadTaskImportTemplate,
  importTasksExcel,
  listTaskMeta,
  listTasks,
  updateTask,
} from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import { exportRowsToExcel } from "../utils/exportToExcel";

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
  { key: "activity", label: "Activity" },
  { key: "revision", label: "Revision" },
  { key: "start_date", label: "Start Date" },
  { key: "end_date", label: "End Date" },
  { key: "drawn_by", label: "Drawn By" },
  { key: "task_status", label: "Status" },
];

const IMPORT_REPORT_COLUMNS = [
  { key: "row", label: "Row" },
  { key: "status", label: "Status" },
  { key: "message", label: "Details" },
];

function TaskPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useMemo(() => getSessionUser(), []);
  const loggedInUsername = currentUser?.username || "";

  const isAdmin = useMemo(() => {
    const role = (currentUser?.role || "").trim().toLowerCase();
    return ["admin", "super admin", "staff"].includes(role);
  }, [currentUser]);

  const [taskStatuses, setTaskStatuses] = useState([]);
  const [activityOptions, setActivityOptions] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [omanTeamUserOptions, setOmanTeamUserOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exportingImportReport, setExportingImportReport] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importRowReports, setImportRowReports] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [chartRows, setChartRows] = useState([]);
  const fileInputRef = useRef(null);

  const handleRowsChange = useCallback((rows) => setChartRows(rows), []);

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
        {
          key: "activity",
          label: "Activity",
          options: activityOptions,
          onAppend: appendActivity,
          required: true,
        },
        { key: "revision", label: "Revision", default: "01", readOnly: !isAdmin },
        { key: "start_date", label: "Start Date", type: "date", required: true },
        { key: "end_date", label: "End Date", type: "date", required: true },
        {
          key: "no_of_days",
          label: "No of Days (auto)",
          type: "number",
          readOnly: true,
          default: "1",
        },
        { key: "drawn_by", label: "Drawn By", options: userOptions, required: true },
        { key: "approved_by", label: "Approved By", options: omanTeamUserOptions },
        { key: "approved_date", label: "Approved Date", type: "date" },

        { key: "project_owner", label: "Project Owner", options: omanTeamUserOptions, required: true },
        {
          key: "task_status",
          label: "Status",
          options: taskStatuses,
          onAppend: appendTaskStatus,
        },
      ],
      [taskStatuses, activityOptions, userOptions, omanTeamUserOptions, projectOptions, loggedInUsername, isAdmin]
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

  const openTimesheetForTask = useCallback(
    (row) => {
      const now = new Date();
      const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
      const params = new URLSearchParams({
        openAdd: "1",
        task: String(row?.id || ""),
        employee_name: loggedInUsername,
        billing_date: localToday,
      });
      navigate(`/timesheet?${params.toString()}`);
    },
    [navigate, loggedInUsername]
  );

  const taskRowActions = useMemo(
    () => [
      {
        key: "timesheet",
        label: "Add Timesheet",
        ariaLabel: "Add Timesheet",
        className: "users-action--timesheet",
        icon: BsClockHistory,
        onClick: openTimesheetForTask,
        disabled: (row) =>
          !isAdmin &&
          (row.task_status || "").trim().toLowerCase() !== "work in progress",
        disabledTitle: "Only available when status is Work In Progress",
      },
    ],
    [openTimesheetForTask, isAdmin]
  );

  const isCompletedStatus = (value) =>
    String(value || "").trim().toLowerCase() === "completed";

  const isTaskDeleteDisabled = (row) => !isAdmin && isCompletedStatus(row?.task_status);

  const isTaskSaveDisabled = (editRow, formValues) => {
    const nextStatusCompleted = isCompletedStatus(formValues?.task_status);
    const missingApprovalInfo =
      nextStatusCompleted &&
      (!String(formValues?.approved_by || "").trim() || !String(formValues?.approved_date || "").trim());

    if (missingApprovalInfo) {
      return true;
    }

    if (isAdmin) {
      return false;
    }

    // Non-admins can mark a task as Completed once, but cannot edit it after completion.
    return isCompletedStatus(editRow?.task_status);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleTemplateDownload = async () => {
    setDownloadingTemplate(true);
    setImportStatus("");
    setImportRowReports([]);
    try {
      await downloadTaskImportTemplate();
    } catch (err) {
      setImportStatus(err.message || "Template download failed.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportReportExport = async () => {
    setExportingImportReport(true);
    try {
      await exportRowsToExcel({
        fileName: "Task Import Report",
        sheetName: "Task Import Report",
        columns: IMPORT_REPORT_COLUMNS,
        rows: importRowReports,
      });
    } catch (err) {
      setImportStatus(err.message || "Import report export failed.");
    } finally {
      setExportingImportReport(false);
    }
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setImporting(true);
    setImportStatus("");
    setImportRowReports([]);
    try {
      const data = await importTasksExcel(file);
      const summary = data.summary || {};
      const blankRows = summary.blank_rows ?? summary.skipped ?? 0;
      const info = `Imported ${summary.created || 0}, Blank rows ${blankRows}, Failed ${summary.failed || 0}, Revision adjusted ${summary.revision_adjusted || 0}.`;
      setImportStatus(info);
      setImportRowReports(Array.isArray(data.row_reports) ? data.row_reports : []);
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      setImportRowReports([]);
      setImportStatus(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get("import") === "excel") {
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 0);
    }
  }, [location.search]);

  return (
    <>
      <section className="module-page" style={{ paddingBottom: 0 }}>
        {isAdmin && (
          <>
            <div className="crud-page__header" style={{ marginBottom: "0.75rem" }}>
              <h2 className="module-page__title" style={{ margin: 0, fontSize: "1.05rem" }}>
                Import Tasks from Excel
              </h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="crud-add-btn"
                  onClick={handleTemplateDownload}
                  disabled={downloadingTemplate || importing}
                >
                  {downloadingTemplate ? "Downloading..." : "Download Template"}
                </button>
                <button
                  type="button"
                  className="crud-add-btn"
                  onClick={handleImportClick}
                  disabled={importing || downloadingTemplate}
                >
                  {importing ? "Importing..." : "Import Excel"}
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
                  <h3 className="module-page__title" style={{ margin: 0, fontSize: "1rem" }}>
                    Import Details
                  </h3>
                  <button
                    type="button"
                    className="crud-add-btn"
                    onClick={handleImportReportExport}
                    disabled={exportingImportReport}
                  >
                    <BsDownload aria-hidden="true" />
                    <span>{exportingImportReport ? "Exporting..." : "Download Excel"}</span>
                  </button>
                </div>
                <div className="users-table-wrap" style={{ maxHeight: "18rem", overflowY: "auto" }}>
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRowReports.map((report) => (
                        <tr key={`${report.row}-${report.status}-${report.message}`}>
                          <td>{report.row}</td>
                          <td>{report.status}</td>
                          <td>{report.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </>
        )}
      </section>

      <CrudPage
        key={reloadKey}
        title="Tasks"
        columns={COLUMNS}
        fields={fields}
        fetchFn={fetchFn}
        createFn={createFn}
        updateFn={updateFn}
        deleteFn={deleteTask}
        rowActions={taskRowActions}
        computeValues={computeValues}
        tableWrapClassName="task-table-wrap"
        stickyHeader
        tableMaxHeight="60vh"
        deleteDisabledPredicate={isTaskDeleteDisabled}
        deleteDisabledTitle="Completed tasks can only be deleted by admin users"
        saveDisabledPredicate={isTaskSaveDisabled}
        saveDisabledTitle="Completed status requires Approved By and Approved Date; completed tasks can only be edited by admin users"
        onRowsChange={handleRowsChange}
        renderFooter={() => <TaskBarChart rows={chartRows} />}
        renderFormExtension={({ editRow }) => (
          <TaskCommentsPanel
            taskId={editRow?.id || null}
            taskStatus={editRow?.task_status || ""}
          />
        )}
      />
    </>
  );
}

export default TaskPage;

