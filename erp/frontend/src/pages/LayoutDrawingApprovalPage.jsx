import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { listLayoutDrawingApprovals } from "../services/crudApi";

function LayoutDrawingApprovalPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={`layout-approval-${row.drawing_id}`}>
                  <td>{`${row.project_code || ""} ${row.project_name ? `- ${row.project_name}` : ""}`.trim()}</td>
                  <td>{row.drawing_name || "-"}</td>
                  <td>{`${row.approver_name || "Unassigned"} (${row.approver_status || "-"})`}</td>
                  <td>{row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>
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
                  <td colSpan={5}>No pending layout drawing approvals.</td>
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

