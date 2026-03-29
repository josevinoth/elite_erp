import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BsDownload } from "react-icons/bs";
import CrudPage from "../components/CrudPage";
import { useLocation } from "react-router-dom";
import {
  createTimesheet,
  deleteTimesheet,
  downloadTimesheetImportTemplate,
  importTimesheetsExcel,
  listTimesheetMeta,
  listTimesheets,
  updateTimesheet,
} from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import { exportRowsToExcel } from "../utils/exportToExcel";

const COLUMNS = [
  { key: "employee_name", label: "Employee Name" },
  { key: "task_label", label: "Task" },
  { key: "billing_date", label: "Billing Date" },
  { key: "efforts", label: "Efforts" },
  { key: "remarks", label: "Remarks" },
];

const IMPORT_REPORT_COLUMNS = [
  { key: "row", label: "Row" },
  { key: "status", label: "Status" },
  { key: "message", label: "Details" },
  { key: "employee_name_input", label: "Employee Name (Excel)" },
  { key: "project_input", label: "Project (Excel)" },
  { key: "activity_input", label: "Activity (Excel)" },
  { key: "billing_date_input", label: "Billing Date (Excel)" },
  { key: "efforts_input", label: "Efforts (Excel)" },
  { key: "remarks_input", label: "Remarks (Excel)" },
];

function TimesheetPage() {
  const location = useLocation();
  const currentUser = useMemo(() => getSessionUser(), []);
  const loggedInUsername = currentUser?.username || "";

  const isAdmin = useMemo(() => {
    const role = (currentUser?.role || "").trim().toLowerCase();
    return ["admin", "super admin", "staff"].includes(role);
  }, [currentUser]);

  const initialDefaults = useMemo(() => {
    const query = new URLSearchParams(location.search);
    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    const billingFromQuery = query.get("billing_date") || "";
    const validBillingDate = /^\d{4}-\d{2}-\d{2}$/.test(billingFromQuery)
      ? billingFromQuery
      : localToday;

    return {
      openAdd: query.get("openAdd") === "1",
      task: query.get("task") || "",
      employeeName: query.get("employee_name") || "",
      billingDate: validBillingDate,
    };
  }, [location.search]);

  const [taskOptions, setTaskOptions] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exportingImportReport, setExportingImportReport] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importRowReports, setImportRowReports] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const fileInputRef = useRef(null);

  const loadMeta = useCallback(async () => {
    const metaData = await listTimesheetMeta();
    setTaskOptions(
      (metaData.tasks || []).map((task) => ({ value: task.value, label: task.label }))
    );
    const users = Array.isArray(metaData.users) ? [...metaData.users] : [];
    if (loggedInUsername && !users.includes(loggedInUsername)) {
      users.unshift(loggedInUsername);
    }
    setEmployeeOptions(users.map((username) => ({ value: username, label: username })));
  }, [loggedInUsername]);

  useEffect(() => {
    loadMeta().catch(() => {
      setTaskOptions([]);
      setEmployeeOptions([]);
    });
  }, [loadMeta]);

  const fields = useMemo(
    () => [
      {
        key: "employee_name",
        label: "Employee Name",
        options: employeeOptions,
        default: initialDefaults.employeeName || loggedInUsername,
        required: true,
      },
      {
        key: "task",
        label: "Task",
        options: taskOptions,
        default: initialDefaults.task,
        required: true,
      },
      {
        key: "billing_date",
        label: "Billing Date",
        type: "date",
        default: initialDefaults.billingDate,
        required: true,
      },
      { key: "efforts", label: "Efforts", type: "number", default: "0" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
    [taskOptions, employeeOptions, loggedInUsername, initialDefaults]
  );

  const fetchFn = useCallback(async () => {
    const data = await listTimesheets();
    return data.timesheets || [];
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createTimesheet(payload);
    return data.timesheet;
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateTimesheet(id, payload);
    return data.timesheet;
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleTemplateDownload = async () => {
    setDownloadingTemplate(true);
    setImportStatus("");
    setImportRowReports([]);
    try {
      await downloadTimesheetImportTemplate();
    } catch (err) {
      setImportStatus(err.message || "Template download failed.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportReportExport = async () => {
    setExportingImportReport(true);
    try {
      const nonSuccessfulRows = importRowReports.filter(
        (report) => (report.status || "").toLowerCase() !== "created"
      );
      await exportRowsToExcel({
        fileName: "Timesheet Import Report",
        sheetName: "Timesheet Import Report",
        columns: IMPORT_REPORT_COLUMNS,
        rows: nonSuccessfulRows,
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
      const data = await importTimesheetsExcel(file);
      const summary = data.summary || {};
      const info = `Imported ${summary.created || 0}, Blank rows ${summary.blank_rows || 0}, Duplicates ${summary.duplicates || 0}, Failed ${summary.failed || 0}.`;
      setImportStatus(info);
      setImportRowReports(Array.isArray(data.row_reports) ? data.row_reports : []);
      await loadMeta();
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      setImportStatus(err.message || "Import failed.");
      setImportRowReports([]);
    } finally {
      setImporting(false);
    }
  };

  const getToday = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  };

  const isRowEditDeleteDisabled = (row) => {
    if (isAdmin) return false;
    const billingDate = row.billing_date || "";
    const today = getToday();
    return billingDate !== today;
  };

  return (
    <>
      <section className="module-page" style={{ paddingBottom: 0 }}>
        {isAdmin && (
          <>
            <div className="crud-page__header" style={{ marginBottom: "0.75rem" }}>
              <h2 className="module-page__title" style={{ margin: 0, fontSize: "1.05rem" }}>
                Import Timesheet from Excel
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
        title="Timesheet"
        columns={COLUMNS}
        fields={fields}
        fetchFn={fetchFn}
        createFn={createFn}
        updateFn={updateFn}
        deleteFn={deleteTimesheet}
        openAddOnMount={initialDefaults.openAdd}
        stickyHeader
        tableMaxHeight="60vh"
        editDisabledPredicate={isRowEditDeleteDisabled}
        deleteDisabledPredicate={isRowEditDeleteDisabled}
        editDisabledTitle="Only available for today's entries"
        deleteDisabledTitle="Only available for today's entries"
      />
    </>
  );
}

export default TimesheetPage;

