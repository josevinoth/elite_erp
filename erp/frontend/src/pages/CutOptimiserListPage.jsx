import { useEffect, useState } from "react";
import { BsPencilSquare, BsTrashFill } from "react-icons/bs";
import { Link, useNavigate } from "react-router-dom";
import {
  listCutOptimiserRecords,
  deleteCutOptimiserRecord,
} from "../services/crudApi";

function formatCutId(cut_optimiser_id) {
  return cut_optimiser_id || "-";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function CutOptimiserListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await listCutOptimiserRecords();
      // Support both paginated and non-paginated responses
      setRows(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, []);

  const onDelete = async (row) => {
    if (!window.confirm(`Delete ${formatCutId(row.cut_optimiser_id)}?`)) return;
    await deleteCutOptimiserRecord(row.id);
    loadRows();
  };

  return (
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <h1 className="module-page__title" style={{ margin: 0 }}>Cut Optimiser List</h1>
        <Link
          className="crud-add-btn"
          title="Add Cut Optimiser"
          to="/projects/cut-optimiser/add"
          style={{ textDecoration: "none" }}
        >
          Add Cut Optimiser
        </Link>
      </div>

      <p className="module-page__description" style={{ marginBottom: "0.9rem" }}>
        Saved calculations with revision tracking by project.
      </p>

      <div className="users-table-wrap" style={{ maxHeight: "68vh", overflowY: "auto" }}>
        <table className="users-table">
          <thead>
            <tr>
              <th>Cut ID</th>
              <th>Project</th>
              <th style={{ textAlign: "right" }}>Revision</th>
              <th>Last Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center" }}>Loading...</td></tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatCutId(row.cut_optimiser_id)}</td>
                  <td>{row.project_name || "-"}</td>
                  <td style={{ textAlign: "right" }}>R{row.revision || 1}</td>
                  <td>{formatDateTime(row.updated_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="users-action users-action--edit"
                      title="Edit"
                      aria-label="Edit"
                      onClick={() => navigate(`/projects/cut-optimiser/record/${row.id}`)}
                    >
                      <BsPencilSquare aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="users-action users-action--delete"
                      title="Delete"
                      aria-label="Delete"
                      style={{ marginLeft: "0.45rem" }}
                      onClick={() => onDelete(row)}
                    >
                      <BsTrashFill aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#8eb1af" }}>
                  No cut optimiser records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default CutOptimiserListPage;

