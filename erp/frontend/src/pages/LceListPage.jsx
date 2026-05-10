import { useEffect, useState } from "react";
import { BsPencilSquare, BsTrashFill } from "react-icons/bs";
import { Link, useNavigate } from "react-router-dom";
import { deleteLceEstimateById, listLceEstimates } from "../services/crudApi";

function LceListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRows = () => {
    setLoading(true);
    setError("");
    return listLceEstimates()
      .then((data) => {
        setRows(Array.isArray(data.lce_estimates) ? data.lce_estimates : []);
      })
      .catch((err) => {
        setRows([]);
        setError(err.message || "Failed to load LCE records.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRows().catch(() => {});
  }, []);

  const formatLceId = (id) => `LCE_${String(id).padStart(3, "0")}`;

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${formatLceId(row.id)}?`)) {
      return;
    }
    try {
      await deleteLceEstimateById(row.id);
      await loadRows();
    } catch (err) {
      setError(err.message || "Delete failed.");
    }
  };

  return (
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <h1 className="module-page__title" style={{ margin: 0 }}>LCE List</h1>
        <Link
          className="crud-add-btn"
          title="LCE ADD"
          to="/projects/costing/add"
          style={{ textDecoration: "none" }}
        >
          LCE ADD
        </Link>
      </div>
      <p className="module-page__description" style={{ marginBottom: "0.9rem" }}>
        Showing saved LCE records. Click Edit to update a record.
      </p>

      {loading ? <p className="users-status">Loading LCE records...</p> : null}
      {error ? <p className="users-status users-status--error">{error}</p> : null}

      {!loading ? (
        <div className="users-table-wrap" style={{ maxHeight: "65vh", overflowY: "auto" }}>
          <table className="users-table">
            <thead>
              <tr>
                <th>LCE ID</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Supplier Price</th>
                <th style={{ textAlign: "right" }}>Supplier Price (OMR)</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatLceId(row.id)}</td>
                  <td>{row.date}</td>
                  <td style={{ textAlign: "right" }}>{row.total_supplier_price}</td>
                  <td style={{ textAlign: "right" }}>{row.total_supplier_price_omr}</td>
                  <td style={{ textAlign: "right" }}>{row.total}</td>
                  <td>
                    <button
                      type="button"
                      className="users-action users-action--edit"
                      title="Edit LCE"
                      aria-label="Edit LCE"
                      onClick={() => navigate(`/projects/costing/record/${row.id}`)}
                    >
                      <BsPencilSquare aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="users-action users-action--delete"
                      title="Delete LCE"
                      aria-label="Delete LCE"
                      style={{ marginLeft: "0.45rem" }}
                      onClick={() => handleDelete(row)}
                    >
                      <BsTrashFill aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#8eb1af" }}>
                    No LCE records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default LceListPage;

