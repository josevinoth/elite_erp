import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { listLayoutDrawingApprovals } from "../services/crudApi";

function LayoutDrawingApprovalPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [columnFilters, setColumnFilters] = useState({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    listLayoutDrawingApprovals()
      .then((data) => {
        if (!alive) {
          return;
        }
        setRows(Array.isArray(data.records) ? data.records : []);
      })
      .catch((err) => {
        if (!alive) {
          return;
        }
        setError(err.message || "Failed to load layout drawing approvals.");
        setRows([]);
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(([, val]) => String(val || "").trim());
    if (!activeFilters.length) return rows;
    return rows.filter((row) => {
      const proj = `${row.project_code || ""} ${row.project_name ? `- ${row.project_name}` : ""}`.trim();
      const status = `${row.approver_name || "Unassigned"} (${row.approver_status || "-"})`;
      const updatedBy = row.updated_by || row.approver_name || "";
      const updatedOn = row.updated_on || (row.updated_at ? new Date(row.updated_at).toLocaleString() : "");
      const map = {
        project: proj,
        drawing_name: row.drawing_name || "",
        approver_status: status,
        updated_by: updatedBy,
        updated_on: updatedOn,
      };
      return activeFilters.every(([key, filterVal]) =>
        String(map[key] ?? "").toLowerCase().includes(String(filterVal).trim().toLowerCase())
      );
    });
  }, [rows, columnFilters]);

  return (
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <h1 className="module-page__title module-page__title--approvals" style={{ margin: 0 }}>
          Layout Drawing Approval
        </h1>
        <button type="button" className="crud-add-btn" onClick={() => navigate("/projects")}>Back to Projects</button>
      </div>

      {error ? <p className="users-status users-status--error">{error}</p> : null}
      {loading ? <p className="users-status">Loading approvals...</p> : null}

      {!loading ? (
        <div className="users-table-wrap" style={{ maxHeight: "60vh" }}>
          <table className="users-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Drawing</th>
                <th>Approver Status</th>
                <th>Updated By</th>
                <th>Updated On</th>
                <th>Action</th>
              </tr>
              <tr>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, project: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.drawing_name ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, drawing_name: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.approver_status ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, approver_status: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.updated_by ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, updated_by: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.updated_on ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, updated_on: e.target.value }))} /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? filteredRows.map((row) => (
                <tr key={`layout-approval-${row.drawing_id}`}>
                  <td>{`${row.project_code || ""} ${row.project_name ? `- ${row.project_name}` : ""}`.trim()}</td>
                  <td>{row.drawing_name || "-"}</td>
                  <td>{`${row.approver_name || "Unassigned"} (${row.approver_status || "-"})`}</td>
                  <td>{row.updated_by || row.approver_name || "—"}</td>
                  <td>{row.updated_on || (row.updated_at ? new Date(row.updated_at).toLocaleString() : "—")}</td>
                  <td>
                    <button
                      type="button"
                      className="modal-btn modal-btn--save"
                      onClick={() => navigate(row.edit_url)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6}>No pending layout drawing approvals.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default LayoutDrawingApprovalPage;

