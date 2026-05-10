import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BsClockHistory, BsDownload } from "react-icons/bs";
import CrudPage from "../components/CrudPage";
import TaskBarChart from "../components/TaskBarChart";
import TaskCommentsPanel from "../components/TaskCommentsPanel";
import { useLocation, useNavigate } from "react-router-dom";
import { listUsers } from "../services/authApi";
import {
  addActivityOption,
  listUnreadMessageNotifications,
  listUnreadTaskNotifications,
  markMessageNotificationsReadByTask,
  markTaskNotificationsRead,
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
  if (s > e) return "";
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

function getTaskDateValidationError(values) {
  const start = String(values?.start_date || "").trim();
  const end = String(values?.end_date || "").trim();
  const approved = String(values?.approved_date || "").trim();

  if (start && end && end < start) {
    return "End Date must be greater than or equal to Start Date.";
  }
  if (end && approved && approved < end) {
    return "Approved Date must be greater than or equal to End Date.";
  }
  return "";
}

function getTaskCompletionValidationError(values, isCompletedStatus) {
  const completed = isCompletedStatus(values?.task_status);
  if (!completed) {
    return "";
  }

  const missingApprovedBy = !String(values?.approved_by || "").trim();
  const missingApprovedDate = !String(values?.approved_date || "").trim();

  if (missingApprovedBy && missingApprovedDate) {
    return "Approved By and Approved Date are required when Status is Completed.";
  }
  if (missingApprovedBy) {
    return "Approved By is required when Status is Completed.";
  }
  if (missingApprovedDate) {
    return "Approved Date is required when Status is Completed.";
  }
  return "";
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

function TaskPage({ onNotificationsChanged = null }) {
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

  const openEditTaskId = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get("editTask") || "";
  }, [location.search]);

  const alertMode = useMemo(() => {
    const query = new URLSearchParams(location.search);
    const raw = String(query.get("alert") || "").trim().toLowerCase();
    return raw === "tasks" || raw === "messages" ? raw : "";
  }, [location.search]);

  const [unreadTaskIds, setUnreadTaskIds] = useState(null);
  const [loadingUnreadFilter, setLoadingUnreadFilter] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!alertMode) {
      setUnreadTaskIds(null);
      setLoadingUnreadFilter(false);
      return;
    }

    const loadUnreadFilter = async () => {
      setLoadingUnreadFilter(true);
      try {
        if (alertMode === "tasks") {
          const data = await listUnreadTaskNotifications();
          const ids = Array.isArray(data.tasks) ? data.tasks.map((item) => Number(item.task_id)).filter(Boolean) : [];
          if (!alive) return;
          setUnreadTaskIds(Array.from(new Set(ids)));
          return;
        }

        const data = await listUnreadMessageNotifications();
        const ids = Array.isArray(data.messages) ? data.messages.map((item) => Number(item.task_id)).filter(Boolean) : [];
        if (!alive) return;
        setUnreadTaskIds(Array.from(new Set(ids)));
      } catch (_error) {
        if (!alive) return;
        setUnreadTaskIds([]);
      } finally {
        if (alive) setLoadingUnreadFilter(false);
      }
    };

    loadUnreadFilter();
    return () => {
      alive = false;
    };
  }, [alertMode]);

  const handleRowsChange = useCallback((rows) => setChartRows(rows), []);

  const toTitleCase = (value) =>
      String(value || "")
          .trim()
          .toLowerCase()
          .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const mapOptions = (values = []) => {
    const normalized = (values || [])
      .map((item) => {
        if (item && typeof item === "object") {
          const value = String(item.value ?? item.id ?? "").trim();
          const label = toTitleCase(item.label ?? item.name ?? "");
          if (!value || !label) return null;
          return { value, label };
        }

        const label = toTitleCase(item);
        if (!label) return null;
        return { value: label, label };
      })
      .filter(Boolean);

    const seen = new Set();
    return normalized.filter((opt) => {
      const key = `${String(opt.value).toLowerCase()}|${String(opt.label).toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const loadMeta = useCallback(async () => {
    const [metaData, usersData] = await Promise.all([listTaskMeta(), listUsers()]);
    setTaskStatuses(mapOptions(metaData.task_statuses_linked || metaData.task_statuses || []));
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
      const approved = String(allValues.approved_date || "");
      const extra = {};

      if (start && end && String(end) < String(start)) {
        extra.end_date = "";
        extra.approved_date = "";
        extra.no_of_days = "";
        return extra;
      }

      if (approved && end && approved < String(end)) {
        extra.approved_date = "";
      }

      const days = calcDaysExcludingSunday(start, end);
      extra.no_of_days = days || "";
      return extra;
    }

    if (changedKey === "approved_date") {
      const approved = String(changedValue || "");
      const end = String(allValues.end_date || "");
      if (approved && end && approved < end) {
        return { approved_date: "" };
      }
    }
    return {};
  }, []);

  const defaultTaskStatusValue = useMemo(() => {
    const match = (taskStatuses || []).find(
      (opt) => String(opt?.label || "").trim().toLowerCase() === "yet to start"
    );
    return match ? String(match.value) : "Yet To Start";
  }, [taskStatuses]);

  const resolveTaskStatusLabel = useCallback(
    (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";

      const byValue = (taskStatuses || []).find((opt) => String(opt?.value || "").trim() === raw);
      if (byValue?.label) {
        return String(byValue.label).trim();
      }

      return raw;
    },
    [taskStatuses]
  );

  const isCompletedStatus = useCallback(
    (value) => String(resolveTaskStatusLabel(value) || "").trim().toLowerCase() === "completed",
    [resolveTaskStatusLabel]
  );

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
        {
          key: "revision",
          label: "Revision",
          default: "Auto",
          readOnly: true,
        },
        { key: "start_date", label: "Start Date", type: "date", required: true },
        {
          key: "end_date",
          label: "End Date",
          type: "date",
          required: true,
          min: (formValues) => formValues.start_date || undefined,
        },
        {
          key: "no_of_days",
          label: "No of Days (auto)",
          type: "number",
          readOnly: true,
          default: "1",
        },
        { key: "drawn_by", label: "Drawn By", options: userOptions, required: true },
        {
          key: "approved_by",
          label: "Approved By",
          options: omanTeamUserOptions,
          required: (formValues) => isCompletedStatus(formValues?.task_status),
        },
        {
          key: "approved_date",
          label: "Approved Date",
          type: "date",
          min: (formValues) => formValues.end_date || undefined,
          required: (formValues) => isCompletedStatus(formValues?.task_status),
        },

        { key: "project_owner", label: "Project Owner", options: omanTeamUserOptions, required: true },
        {
          key: "task_status",
          label: "Status",
          options: taskStatuses,
          onAppend: appendTaskStatus,
          required: true,
          default: defaultTaskStatusValue,
        },
      ],
      [
        taskStatuses,
        activityOptions,
        userOptions,
        omanTeamUserOptions,
        projectOptions,
        loggedInUsername,
        isCompletedStatus,
        defaultTaskStatusValue,
      ]
  );

  const fetchFn = useCallback(async () => {
    const data = await listTasks();
    const rows = data.tasks || [];

    if (!alertMode) {
      return rows;
    }
    if (unreadTaskIds === null) {
      return [];
    }

    const unreadSet = new Set((unreadTaskIds || []).map((id) => String(id)));
    return rows.filter((row) => unreadSet.has(String(row.id)));
  }, [alertMode, unreadTaskIds]);

  const handleTaskEditOpen = useCallback(
    async (row) => {
      const taskId = Number(row?.id || 0);
      if (!taskId) return;

      let didMark = false;

      if (alertMode === "tasks") {
        await markTaskNotificationsRead([taskId]);
        setUnreadTaskIds((prev) => (Array.isArray(prev) ? prev.filter((id) => Number(id) !== taskId) : prev));
        didMark = true;
      }

      if (alertMode === "messages") {
        await markMessageNotificationsReadByTask(taskId);
        setUnreadTaskIds((prev) => (Array.isArray(prev) ? prev.filter((id) => Number(id) !== taskId) : prev));
        didMark = true;
      }

      if (didMark && typeof onNotificationsChanged === "function") {
        onNotificationsChanged();
      }
    },
    [alertMode, onNotificationsChanged]
  );

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
        disabled: (row) => {
          const allowedStatuses = ["yet to start", "awaiting for approval", "work in progress"];
          const status = (row.task_status || "").trim().toLowerCase();
          const endDate = row.end_date ? new Date(row.end_date) : null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const endDateValid = endDate && endDate >= today;
          return !(endDateValid && allowedStatuses.includes(status));
        },
        disabledTitle: "Only available when end date is today or in the future and status is Yet To Start, Awaiting For Approval, or Work In Progress",
      },
    ],
    [openTimesheetForTask, isAdmin]
  );


  const isTaskDeleteDisabled = (row) => !isAdmin && isCompletedStatus(row?.task_status);

  const isTaskSaveDisabled = (editRow, formValues) => {
    if (getTaskDateValidationError(formValues)) {
      return true;
    }

    if (getTaskCompletionValidationError(formValues, isCompletedStatus)) {
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

      {alertMode ? (
        <section className="module-page" style={{ paddingTop: 0, paddingBottom: "0.5rem" }}>
          <p className="users-status">
            {loadingUnreadFilter
              ? "Loading unread alerts..."
              : alertMode === "messages"
                ? "Showing tasks that have unread messages. Open a task to mark its messages as viewed."
                : "Showing unread new tasks. Open a task to mark it as viewed."}
          </p>
        </section>
      ) : null}

      <CrudPage
        key={reloadKey}
        title="Tasks"
        columns={COLUMNS}
        fields={fields}
        fetchFn={fetchFn}
        createFn={createFn}
        updateFn={updateFn}
        deleteFn={deleteTask}
        openEditIdOnMount={openEditTaskId || null}
        onEditOpen={handleTaskEditOpen}
        rowActions={taskRowActions}
        computeValues={computeValues}
        tableWrapClassName="task-table-wrap"
        stickyHeader
        tableMaxHeight="60vh"
        deleteDisabledPredicate={isTaskDeleteDisabled}
        deleteDisabledTitle="Completed tasks can only be deleted by admin users"
        saveDisabledPredicate={isTaskSaveDisabled}
        saveDisabledTitle={
          "End Date must be >= Start Date, Approved Date must be >= End Date, and Completed status requires Approved By + Approved Date; completed tasks can only be edited by admin users"
        }
        onRowsChange={handleRowsChange}
        renderFooter={() => <TaskBarChart rows={chartRows} />}
        renderFormExtension={({ editRow, formValues }) => (
          <>
            {getTaskDateValidationError(formValues) ? (
              <p className="users-status users-status--error">{getTaskDateValidationError(formValues)}</p>
            ) : null}
            {getTaskCompletionValidationError(formValues, isCompletedStatus) ? (
              <p className="users-status users-status--error">
                {getTaskCompletionValidationError(formValues, isCompletedStatus)}
              </p>
            ) : null}
            <TaskCommentsPanel
              taskId={editRow?.id || null}
              onCommentCreated={onNotificationsChanged}
            />
          </>
        )}
      />
    </>
  );
}

export default TaskPage;

